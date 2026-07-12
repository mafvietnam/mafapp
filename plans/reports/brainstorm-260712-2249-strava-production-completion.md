# Brainstorm: Strava Production Completion — Enable, Complete UX, E2E

**Date:** 2026-07-12 | **Session:** goal-driven (combo brainstorm→plan→red-team→validate→cook→deploy→E2E)

## Problem Statement

Strava integration code complete (phases 13.1–13.5: OAuth2, webhook, sync engine, cron, activities API, MAF Lab auto-fill, admin UI DB-backed credentials) but **never enabled nor verified on production**. Strava app just granted **10 athlete slots** (basic approval). Goal: real users connect Strava + pull activities on https://app.maf.run.

## Current State (verified 2026-07-12)

**Codebase (dev branch):**
- Full OAuth flow: `api/src/strava/strava.controller.ts` (connect/callback/status/disconnect/sync/webhook/activities)
- HMAC state + Redis nonce (red-teamed 260517), token encryption at rest, webhook auto-resubscribe on credential save
- Admin UI: `/admin/settings` (credentials) + `/admin/strava` (connections overview, per-user sync)
- MAF Lab auto-fill: `use-strava-auto-fill.ts`, gated `VITE_FEATURE_STRAVA`

**Gaps found:**
1. **Dashboard fake data**: `src/components/dashboard/activity-section.tsx` renders hardcoded `SAMPLE_ACTIVITIES` — user connects Strava, syncs, but dashboard never shows real activities
2. **No 10-slot cap handling**: 11th user hits raw Strava error mid-OAuth; no guard, no friendly message, no slot visibility
3. **Callback error UX**: generic `?strava_error=1` redirect only

**Production server (72.61.125.159, /opt/maf-tool/full-maf-coaching-tool):**
- NOT a git repo — deploys are file-copy + `docker compose build`
- `.env` keys: TUNNEL_TOKEN, TUNNEL_ID, MAF_DB_USER, MAF_DB_PASSWORD, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, WP_OAUTH_CLIENT_ID, NODE_ENV, TZ — **NO Strava vars, NO GARMIN_ENCRYPTION_KEY**
- Joi requires `GARMIN_ENCRYPTION_KEY` (64 hex) unconditionally + `STRAVA_ENCRYPTION_KEY` (64 hex) when FEATURE_STRAVA=true → **deployed API image predates current code** (healthy 5d uptime with missing required env proves it). Big-bang update ahead.
- `api/Dockerfile` CMD = `node dist/main.js` — **no auto prisma migrate**; prod DB likely missing `strava_*` tables + `app_setting` table → manual `prisma migrate deploy` required
- Containers healthy: maf-app, maf-api, maf-cloudflare-tunnel, mafweb, maf-redis, maf-postgres, mafweb-db
- SSH key auth works (BatchMode OK)

**Uncommitted change:** `wordpress/mu-plugins/maf-sso-provider.php` (+57) — no-cache headers for SSO gateway/logout (Cloudflare cache broke redirect-back flow) + auto-open login modal. Related to login flow E2E will exercise.

## Approaches Evaluated

| | Approach | Verdict |
|---|---|---|
| A | Enable-only: config + deploy + E2E, zero code | ❌ Dashboard stays fake → "pull data" invisible to user; slot-cap confusion at 11th user |
| B | Enable + minimal completion (dashboard real data, slot guard, error UX) + full E2E loop | ✅ **CHOSEN** — closes actual user-visible loop, small surface (~1d code) |
| C | Full build-out (charts, merged Garmin+Strava timeline, detail pages) | ❌ YAGNI at 10-athlete stage |

## Decisions (validated with user 2026-07-12)

1. **Credentials entry:** user pastes STRAVA_CLIENT_ID/SECRET in chat when needed → server `.env` (never committed). Admin UI remains rotation path.
2. **Dashboard real activities:** IN SCOPE — replace SAMPLE_ACTIVITIES with `GET /strava/activities` (loading/empty/error states).
3. **Slot cap:** server-side guard — count active StravaConnection before issuing connect URL; cap in AppSettings (`strava.maxAthletes`, default 10); friendly VN error; expose slot availability via `/strava/status` so card can disable Connect when full.
4. **WP SSO no-cache fix:** commit + include in this deploy; E2E covers SSO login flow.

## Solution Outline

**Track 1 — Code (local):**
- Dashboard: wire activity-section to `stravaService.getActivities()` (paginated, exclude duplicates), keep visual design, add empty state "Chưa có hoạt động — kết nối Strava"
- Slot guard: `StravaService.countActiveConnections()`; `GET /strava/connect` throws 409 friendly khi full; `/strava/status` + `strava-connect-card` show "hết slot"
- Callback error translation: `?strava_error=denied|full|invalid|1` → VN messages on profile page
- Commit WP SSO fix separately

**Track 2 — Server enablement (ordered):**
1. Pre-deploy discovery: diff server compose vs repo; check applied migrations in prod DB; verify tunnel route api.maf.run
2. `pg_dump` backup both DBs
3. Generate + persist: GARMIN_ENCRYPTION_KEY, STRAVA_ENCRYPTION_KEY (64 hex each), STRAVA_WEBHOOK_VERIFY_TOKEN; add FEATURE_STRAVA=true, VITE_FEATURE_STRAVA=true, STRAVA_CLIENT_ID/SECRET (user-provided)
4. rsync working tree → server; `prisma migrate deploy`; `docker compose build && up -d`
5. Verify: API health, webhook subscription auto-registered (logs + Strava API), admin UI shows credentials status
6. Deploy WP mu-plugin to mafweb container path
7. **User action required:** Strava app settings — Authorization Callback Domain must be `api.maf.run`

**Track 3 — E2E on prod (Playwright MCP) + fix-redeploy loop:**
- SSO login (direct + gateway + logout), guide, MAF calculator, MAF Lab (+ auto-fill), dashboard real activities, profile Strava connect→sync→activities→disconnect, admin pages (users/settings/strava, per-user sync), 11th-slot guard behavior (simulated)
- Any bug → fix local → redeploy → retest until all pass

## Risks

| Risk | Mitigation |
|---|---|
| Big-bang deploy (old API → months of new code: SSO, admin, garmin, strava, shared) | DB backup first; compose rollback = previous image retag; health-check gate; deploy off-peak |
| Prisma migrate on prod without auto-migrate history | Inspect `_prisma_migrations` first; `migrate deploy` (never `dev`); backup |
| Losing encryption keys post-launch = all users re-auth | Keys persisted in server .env + flagged for user backup |
| Webhook unreachable through tunnel | Verify GET challenge manually + Strava subscription list API |
| OAuth authorize step needs real Strava account login in browser | User performs 1 authorize click OR provides Strava test account creds at E2E time |
| 10-slot cap on Strava side may already have connections counted (dev testing) | Check via Strava API `athlete` count; deauthorize stale test athletes |

## Success Criteria

- Real user: login → profile → Connect Strava → authorize → activities synced → visible in dashboard + MAF Lab auto-fill → disconnect works
- Admin: credentials management, connections overview, manual sync all functional on prod
- Slot guard: connect blocked with friendly message when cap reached
- All E2E scenarios pass on https://app.maf.run; zero console errors (ngoài cosmetic)
- Webhook subscription active + event processing verified

## Unresolved Questions

1. STRAVA_CLIENT_ID/SECRET values — user will paste at deploy step
2. Strava account for OAuth authorize during E2E — user click or test account creds
3. Server compose file may have drifted from repo — resolve in pre-deploy discovery
