---
phase: 3
title: "Fixes — Hide Card, Scope, Frontend Env + E2E Test"
status: completed
effort: 0.5d
priority: P1
depends_on: []
completed: 2026-05-18
---

# Phase 3 — Bundled Fixes + E2E Verification

## Context Links

- Plan overview: [plan.md](plan.md)
- Related fix reference: commit `1b2bd76` (Garmin "hide card when disabled" fix)

## Overview

Three small fixes that block end-to-end Strava use, plus a documented manual test pass. Independent of Phases 1-2 — can ship in parallel.

## Key Insights

- Garmin already had this exact "hide card" fix — pattern is proven; just port it
- Scope mismatch evidence: user's Strava developer portal screenshot shows `scope: read`; code at [strava-auth.service.ts:82](../../api/src/strava/strava-auth.service.ts) requests `read,activity:read_all`. The existing connected athlete granted only `read` — sync calls fetching activity details will 401
- `VITE_FEATURE_STRAVA` is read at **build time** by Vite — must be present in build args, not just runtime env
- Frontend currently uses [Vite](https://vitejs.dev/) — `import.meta.env.VITE_*` is statically replaced during build

## Requirements

**3.1 Hide card when disabled**
- `StravaConnectCard` returns `null` if backend reports feature unavailable
- Detection: `getStravaStatus()` returns `null` (HTTP 404 on `/strava/status` when module not registered, or 403 when feature flag off)

**3.2 Scope mismatch resolution**
- Verify the current connected athlete (Client ID 221736) has `activity:read_all` scope
- If not: re-authorize once to upgrade scope
- Confirm code requests both scopes correctly
- Document this in `docs/deployment-guide.md` under "Strava setup"

**3.3 `VITE_FEATURE_STRAVA` build arg**
- Frontend Dockerfile (if any) accepts `VITE_FEATURE_STRAVA` build arg
- `docker-compose.yml` passes it through to frontend service
- Without this, `useStravaAutoFill` always no-ops in production

**3.4 E2E manual test**
- Full path: admin enters credentials → user connects → activity syncs → admin sees connection

## Architecture

```
[Fix 3.1] strava-connect-card.tsx
  useEffect → getStravaStatus()
    if (null) setAvailable(false)
  render → if (!loading && !available) return null

[Fix 3.2] strava-auth.service.ts:82
  scope: 'read,activity:read_all'   ← already correct; re-verify post-connect

[Fix 3.3] docker-compose.yml + frontend Dockerfile
  build:
    args:
      VITE_FEATURE_STRAVA: ${VITE_FEATURE_STRAVA:-false}
```

## Related Code Files

**Modify:**
- `src/components/strava-connect-card.tsx` — add `available` state + early-return
- `docker-compose.yml` — frontend service build args for `VITE_FEATURE_STRAVA`
- `Dockerfile` (frontend) — `ARG VITE_FEATURE_STRAVA` + `ENV VITE_FEATURE_STRAVA=$VITE_FEATURE_STRAVA` before `npm run build`
- `api/.env.example` — add `VITE_FEATURE_STRAVA=false` note (or `.env.example` at repo root if exists)
- `docs/deployment-guide.md` — Strava setup section

**Create:** (none)

**Delete:** (none)

## Implementation Steps

### 1. Fix `StravaConnectCard` ([strava-connect-card.tsx](../../src/components/strava-connect-card.tsx))

> 🔴 **RED TEAM #6 (Critical):** `strava.enabled` (DB toggle) was originally described as "UI-only flag to hide card" but no frontend code read it. Below is the wired-up version.

**Backend addition (Phase 1, `/strava/status` endpoint):** extend response with `featureEnabled` read from `getStravaRuntimeConfig().enabled`. Update `StravaStatus` type to include `featureEnabled: boolean`.

**Frontend:**

```typescript
export default function StravaConnectCard() {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  // ... other state

  useEffect(() => {
    // ... existing query-param parsing
    getStravaStatus().then((s) => {
      // Hide if backend module unavailable OR admin toggled feature off
      if (s === null || !s.featureEnabled) setAvailable(false);
      setStatus(s);
      setLoading(false);
    });
  }, []);

  // ... handlers

  if (!loading && !available) return null;

  if (loading) { /* existing */ }
  // ... rest unchanged
}
```

**Precedence rule (documented):** `FEATURE_STRAVA` env (backend wiring, boot-time, mandatory for module load) > `strava.enabled` DB (UI gate, runtime, admin-controlled). If env is false, the module isn't loaded → `/strava/status` 404s → card hidden regardless of DB toggle.

### 2. Scope check + re-authorize

**Verify code is correct:**
- Open [api/src/strava/strava-auth.service.ts:82](../../api/src/strava/strava-auth.service.ts) — confirm `scope: 'read,activity:read_all'`. **Already correct, no code change needed.**

**Re-authorize the test user:**

> 🔴 **RED TEAM #7 (Critical):** Original instructions disconnected production athlete with no rollback / no backfill plan. If anything in Phase 1 broke (lazy creds, async cascade, state-binding bug), the athlete is disconnected indefinitely AND activities uploaded during the broken window are lost (webhook delivery falls back to no-op since no CONNECTED user exists).
>
> **Resolution — staged re-auth with safety net:**
> 1. **Test with a NEW Strava account FIRST** (sandbox or a second test athlete; do NOT touch the production connection). Walk the full Connect → Sync → Activity-import flow end-to-end. Only proceed once green.
> 2. Take a snapshot of the production athlete's current `StravaConnection` row: `SELECT * FROM "StravaConnection" WHERE "userId" = '<prod-athlete>'` — paste to a notes file. This lets you restore manually if needed.
> 3. Communicate to the athlete: "Re-connect required, expect ~5 min activity-import lag" via release notes / direct message.
> 4. Athlete clicks Disconnect on `/profile`.
> 5. Athlete clicks Connect → consent screen shows BOTH scopes (read + activity:read_all) → Authorize.
> 6. Verify in DB: `SELECT "stravaAthleteId", status, "lastSyncAt" FROM "StravaConnection" WHERE "userId" = '<prod-athlete>'`.
> 7. **Backfill recovery:** If activities are missing from the disconnect window, run `StravaSyncService.syncRecent(userId, daysBack=7)` (or equivalent existing manual-sync endpoint). Document the exact command in the deployment guide.

**Add note to deployment-guide.md** under a new "Strava OAuth setup" subsection:
```markdown
### Strava OAuth Setup

1. Create app at https://www.strava.com/settings/api
2. Set Authorization Callback Domain to `api.maf.run` (or your backend domain)
3. Required scopes (granted at user consent time): `read,activity:read_all`
4. Copy Client ID + Client Secret into Admin → Cài đặt chung → Strava section
5. Generate webhook verify token (any random string) and paste into the same form
6. Toggle "Enabled" on, save
7. Frontend build must set `VITE_FEATURE_STRAVA=true` for MAF Lab auto-fill
```

### 3. Wire `VITE_FEATURE_STRAVA` into docker-compose

Locate frontend service in `docker-compose.yml`. Add to its `build` section:
```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile
    args:
      VITE_FEATURE_STRAVA: ${VITE_FEATURE_STRAVA:-false}
      VITE_FEATURE_GARMIN: ${VITE_FEATURE_GARMIN:-false}   # add if missing too
```

In frontend `Dockerfile` at repo root (confirmed via scout — frontend builder stage starts at `FROM node:20-alpine AS builder`, `RUN npm run build` is on line 46), add these lines **inside the `builder` stage, before `RUN npm run build`**:

```dockerfile
# In the builder stage (NOT deps, NOT production)
ARG VITE_FEATURE_STRAVA=false
ENV VITE_FEATURE_STRAVA=$VITE_FEATURE_STRAVA
ARG VITE_FEATURE_GARMIN=false
ENV VITE_FEATURE_GARMIN=$VITE_FEATURE_GARMIN
```

> 🔴 **RED TEAM #15 (Medium):** Vite statically replaces `import.meta.env.VITE_*` at build time. If ARG/ENV are added to the wrong stage (e.g., `production` or final nginx stage), the values never reach the build step — `useStravaAutoFill` silently no-ops in production with no error.
>
> **Verification:** After build, run `docker run --rm <image> grep -r "VITE_FEATURE_STRAVA" /usr/share/nginx/html` — should find the inlined value in built JS chunks. If it shows `__VITE_FEATURE_STRAVA__` placeholder, ARG was in wrong stage.

Document in `.env.example` (repo root) — append:
```env
# Frontend build-time feature flags (must be set BEFORE docker compose build)
VITE_FEATURE_STRAVA=false
VITE_FEATURE_GARMIN=false
```

**Note:** Investigate whether root-level `.env.example` exists separate from `api/.env.example`. If not, document in `api/.env.example` and `docs/deployment-guide.md` instead.

### 4. E2E Manual Test (run after Phases 1 + 2 + 3.1-3.3 merged)

**Setup:**
```env
# .env (production)
FEATURE_STRAVA=true
STRAVA_ENCRYPTION_KEY=<openssl rand -hex 32>
VITE_FEATURE_STRAVA=true
BACKEND_URL=https://api.maf.run
```

Redeploy. Then:

1. Log in as ADMIN → `/admin/settings`
2. Strava section → enter Client ID `221736`, Client Secret `d710...`, Webhook Verify Token (any string)
3. Toggle Enabled → Save → expect status: "Strava OAuth đang hoạt động"
4. Navigate to `/admin/strava` → expect empty connections, feature status "Đang bật"
5. Log out, log in as a regular USER
6. Visit `/profile` → Strava card visible → click "Kết nối Strava"
7. Strava OAuth screen shows BOTH scopes ("View data about your public profile" + "View data about your activities") → click Authorize
8. Redirects back to `/profile?strava_connected=1` → green success banner, status shows "Đã kết nối"
9. Click "Đồng bộ" → wait ~10s → activity list endpoint returns recent runs
10. Switch back to admin → `/admin/strava` → connection row appears with activity count > 0
11. Click admin "Sync" button → check API logs for `Admin-triggered Strava sync` → activity count refreshes
12. Visit `/plan` → MAF Lab tab → expect Strava activity auto-fill banner appears (if last run < 7 days)
13. Webhook test: upload a new activity to Strava → wait < 60s → activity appears in app without manual sync

**Expected log markers (in api container):**
- `Strava connection saved for user X (athlete Y)`
- `Refreshing Strava access token for user X` (after 6h or on first sync near expiry)
- `Webhook event processing ...` (on real-time push)

## Todo List

- [ ] Patch `strava-connect-card.tsx` (hide when unavailable)
- [ ] Verify scope string in `strava-auth.service.ts` (no change expected)
- [ ] Add `VITE_FEATURE_STRAVA` build arg to `docker-compose.yml` frontend service
- [ ] Add `ARG/ENV VITE_FEATURE_STRAVA` to frontend `Dockerfile`
- [ ] Document in `.env.example` (root) or `api/.env.example` + `docs/deployment-guide.md`
- [ ] Run full E2E checklist on staging
- [ ] If E2E fails: document failure, file follow-up plan
- [ ] If E2E passes: update `docs/development-roadmap.md` + `docs/project-changelog.md`

## Success Criteria

- Profile page does NOT show Strava card when `FEATURE_STRAVA=false`
- Profile page shows Strava card and connect button works when `FEATURE_STRAVA=true`
- OAuth consent screen requests both `read` and `activity:read_all` scopes
- Synced activity contains avg HR (proves activity:read_all granted)
- `VITE_FEATURE_STRAVA=true` → MAF Lab auto-fill activates with Strava data
- E2E checklist 1-13 all pass

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Re-authorizing test user breaks production session | Tell user to expect re-connect prompt; communicate in release notes |
| Webhook subscription was created with old verify token | If admin changes token, must re-subscribe — add follow-up note (out of scope) |
| VITE env var needs container rebuild not just restart | Document explicitly: "rebuild frontend image after toggling" |
| Strava developer app's authorized scopes drift | Verify in https://www.strava.com/settings/api — should show no restrictions |

## Security Considerations

- Re-authorize flow does not leak old tokens (DB upsert overwrites)
- VITE feature flag only controls UI presence — NOT a security boundary; backend gates with `FEATURE_STRAVA`
- Webhook verify token rotation requires admin action — secure on transport (HTTPS only)

## Next Steps

After all 3 phases:
- Update `docs/development-roadmap.md` (mark Strava integration → 100%)
- Update `docs/project-changelog.md` (Strava admin UI shipped)
- Update `docs/codebase-summary.md` (admin section gains Strava)
- Mark `260407-1549-strava-integration` plan status → `completed` (this plan finishes its outstanding gaps)
- Mark THIS plan status → `completed`

## Open Questions

- Should webhook re-subscription happen automatically when admin saves new verify token, or require a manual button in admin UI? (Defer — current behavior: env-set at boot. Acceptable.)
- Is there a root-level `Dockerfile` for the frontend? Need to inspect during impl. If frontend is served by a different container path, adjust step 3 accordingly.
