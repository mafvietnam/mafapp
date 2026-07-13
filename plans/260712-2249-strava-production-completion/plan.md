---
title: "Strava Production Completion — Enable + Complete UX + E2E"
description: "Ship 3 small UX gaps (dashboard real data, athlete slot cap guard, callback error UX), enable Strava on prod via big-bang deploy, verify end-to-end."
status: completed
priority: P1
effort: 2.3d
branch: dev
tags: [strava, oauth, deploy, production, e2e, dashboard]
created: 2026-07-12
completed: 2026-07-13
related: [260407-1549-strava-integration, 260517-2232-strava-admin-ui]
---

> **Outcome (2026-07-13):** All 4 phases done — code shipped, big-bang deploy live (SHA 958e8c5+4418c24), 14/20 E2E scenarios PASS, 2 bugs fixed+redeployed (reCAPTCHA login block, OAuth scope force). 5 data-sync scenarios blocked by an EXTERNAL non-code cause: Strava moved API to **subscriber-only** and the owner account is Free → app "Inactive", all data APIs 403. Requires a paid Strava subscription (user action). See `reports/e2e-260713-strava-prod.md`.

# Strava Production Completion

Strava code complete on `dev` but never enabled/verified on prod. Strava app granted **10 athlete slots**. Goal: real users connect Strava + see activities on https://app.maf.run. Closes 3 user-visible gaps, then big-bang deploys months of unshipped code (SSO, admin, garmin, strava, shared) at once.

Context: `plans/reports/brainstorm-260712-2249-strava-production-completion.md`. Security invariants to preserve: `plans/260517-2232-strava-admin-ui/plan.md` (Red Team) — HMAC state, single-use Redis nonce, no secrets in logs/git, webhook resubscribe-on-save.

## Phases

| # | Phase | Deliverable | Effort | Status |
|---|-------|-------------|--------|--------|
| 1 | [Backend — slot guard + status + ledger align](phase-01-backend-slot-guard-and-status.md) | 409 cap guard, boolean status, `?strava_error=full`, deauthorize | 0.5d | pending |
| 2 | [Frontend — dashboard real data + slot UX + errors](phase-02-frontend-dashboard-and-slot-ux.md) | Real activities (single fetch), "hết slot" state, VN error translation | 0.5d | pending |
| 3 | [Ship prep + server enablement](phase-03-ship-prep-and-server-enablement.md) | Hygiene, discovery, backup, keys, bridge-migrate, staged up, admin-enable, verify | 0.7d | pending |
| 4 | [E2E prod + fix-redeploy loop](phase-04-e2e-prod-and-fix-loop.md) | Full feature matrix green on prod, zero console errors | 0.6d | pending |

## Dependency Graph

- P1 ⟂ P2 develop in parallel against agreed API contract; **P2 integration-tests after P1 merged**.
- P3 blocked by P1 **and** P2 (ships their code) + WP SSO commit.
- P4 blocked by P3 (needs live prod).
- File ownership: P1 = `api/src/**`; P2 = `src/**`; P3 = server + `.env` + `wordpress/mu-plugins/*` + `.gitignore`; P4 = read-only + targeted redeploy. No file overlaps.

## Data Flow (new/changed)

```
Slot guard:   Connect click → GET /strava/connect (JWT)
                → existing conn? reconnect allowed
                → else count ALL rows >= maxAthletes → 409 "hết slot"
                → else authUrl → Strava → /callback → (race + capacity re-check) → save → ?strava_connected=1
Slot UX:      card mount → GET /strava/status → {connected, featureEnabled, connectionLimitReached}  (boolean only)
                → not connected & limitReached → Connect disabled + "hết slot"
Ledger align: disconnect → best-effort Strava /oauth/deauthorize → delete row
                athlete-deauth webhook (authorized=false) → delete row
Dashboard:    dashboard-page → useStravaActivities() ONCE → passes props to both ActivitySection mounts
                → format util → mobile cards + desktop table; mafHr prop → HR-zone warn
Callback err: Strava error/denied/full/invalid → redirect ?strava_error=<code> → card → VN message
Deploy:       commits (hygiene first) → clean-tree rsync → migrate diff→bridge.sql→apply→resolve --applied both
                → staged up (api→app→tunnel) → admin enable (strava.enabled ON + creds save → resubscribe)
                → verify subscription on Strava push_subscriptions API
```

## Env Vars (server `.env` only — never committed)

| Var | Scope | Value | Notes |
|-----|-------|-------|-------|
| `FEATURE_STRAVA` | api (boot) | `true` | conditional module load |
| `VITE_FEATURE_STRAVA` | app (build arg) | `true` | rebuild `maf-app` required |
| `STRAVA_CLIENT_ID` / `_SECRET` | api + DB | `<user-paste>` | never commit; DB (`/admin/settings`) is the real enable path |
| `STRAVA_ENCRYPTION_KEY` | api | `<64-hex gen>` | required when FEATURE_STRAVA=true (token AES) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | api | `<random gen>` | webhook challenge |
| `GARMIN_ENCRYPTION_KEY` | api | `<64-hex gen>` | **always** required (Joi) + Strava OAuth-state HMAC |
| `strava.enabled` | DB `AppSetting` | `true` (admin toggle) | 🔴 C3: default `false`, NO env fallback → **must** enable via `/admin/settings` |
| `strava.maxAthletes` | DB `AppSetting` | `10` (default) | slot cap; `>=0` allowed (0 = pause); no env, no schema change |

## Success Criteria

- Real user: login → profile → Connect Strava → authorize → activities synced → visible on **dashboard** (single fetch) + MAF Lab auto-fill → disconnect (deauthorizes on Strava) → reconnect.
- 2nd account (simulated cap): Connect blocked with VN "hết slot"; button disabled proactively.
- Admin enabled `strava.enabled` + creds on prod; connections overview + manual sync work.
- Webhook subscription present on Strava's `push_subscriptions` list; new-activity event processed.
- All E2E scenarios pass; zero non-cosmetic console errors.

## Rollback

- **P1/P2 (code):** additive; `git revert` commits + rebuild affected container. Low risk.
- **P3 (big-bang deploy):** before build, `docker image tag maf-api:latest maf-api:prev` + same for `maf-app`. Rollback = retag `prev`→`latest` + `up -d`. Schema bridge is additive-only (reviewed) → old image tolerates extra objects. If `migrate`/bridge fails → restore from `/root/maf-backups` pg_dump; un-wedge with `prisma migrate resolve --rolled-back <name>`.
- **WP mu-plugin (🔴 M13):** restore `/root/maf-backups/maf-sso-provider.php.pre` via `docker cp` back into `mafweb`.
- **Keys:** once users connect, `GARMIN_/STRAVA_ENCRYPTION_KEY` must persist forever (loss = forced re-auth). Back up `.env` off-server after deploy.

## Red Team Review

### Session — 2026-07-12
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer
**Findings:** 15 accepted / 0 rejected · **Severity:** 4 Critical, 6 High, 5 Medium (user approved applying ALL)

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| C1 | rsync `--delete` destroys backups written under sync root | Critical | Accept | phase-03 C9 / E14 |
| C2 | Migration branches don't cover real prod state (P3009 wedge / missing tables) | Critical | Accept | phase-03 B6 / E16 |
| C3 | Feature dead-on-arrival — `strava.enabled` + creds are DB-only, no env fallback | Critical | Accept | phase-03 F20; plan Env table |
| C4 | Secrets transit into git-tracked `.claude` hook logs | Critical | Accept | phase-03 A1 / F22; phase-04 S1 |
| H5 | pg_dump/psql broken — `$MAF_DB_USER` empty in remote shell | High | Accept | phase-03 B6 / C9 |
| H6 | Slot ledger divergence — no Strava deauthorize; deauth webhook dropped; wrong count filter | High | Accept | phase-01 S2/S3/S6 |
| H7 | Webhook boot registration deterministically fails first boot | High | Accept | phase-03 F20 / F22 |
| H8 | Tunnel restart coupling + compose drift + redis session wipe | High | Accept | phase-03 B5 / E17 |
| H9 | Cap-sim `0` defeated by parse guard; no restore on abort; needs 2nd account | High | Accept | phase-01 S1; phase-04 S4/S6 |
| H10 | WP SSO fix defeated by Cloudflare Cache-Everything | High | Accept | phase-03 E19; phase-04 S3 |
| M11 | `.env` seeding greps match substrings / empty values | Medium | Accept | phase-03 D11 / D12 |
| M12 | Dirty-tree rsync, ships `.claude/plans/docs`, partial-sync hybrid trees | Medium | Accept | phase-03 A1 / E14; phase-04 S6/S7 |
| M13 | No WP mu-plugin rollback | Medium | Accept | phase-03 E18; plan Rollback |
| M14 | `slotsAvailable` numeric leaked to all users | Medium | Accept | phase-01 S4; phase-02 S1 |
| M15 | `ActivitySection` mounted twice → double fetch | Medium | Accept | phase-02 S2/S4/S6 |

## Validation Log

### Session 1 — 2026-07-12
**Trigger:** Post-red-team validation interview before implementation kickoff
**Questions asked:** 4

1. **[Risk] Deploy timing** — big-bang restarts tunnel (minutes of downtime, all sites) + possible Redis session wipe (all users re-login). **Answer:** Deploy ngay khi code xong — user base nhỏ, downtime chấp nhận được; cook chạy liên tục không dừng giữa chừng.
2. **[Dependency] Strava OAuth authorize (E2E scenario 8)** — needs real Strava login. **Answer:** User tự click authorize khi được báo (checkpoint thủ công, không share mật khẩu Strava). Phase 4 step 1 xác nhận approach này.
3. **[Secrets] STRAVA_CLIENT_ID/SECRET entry** — **Answer:** User paste qua chat (ô Other). Nếu chưa nhận được giá trị khi Phase 3 đến bước cần creds → hỏi lại 1 lần duy nhất. C4 mitigations áp dụng (không echo trong command, .claude logs untracked, rotate option post-launch).
4. **[Dependency] Cloudflare cache purge + Bypass rule (H10)** — no CF access. **Answer:** User tự purge/kiểm tra rule trên CF dashboard khi được báo (sau khi mu-plugin deploy); agent verify lại bằng `cf-cache-status`. Phase 3 step 19 là user-action checkpoint.

**Impact:** No phase-structure changes. Phase 3 runs uninterrupted after P1+P2; Phase 3 step 19 + Phase 4 scenario-8 marked as user-action checkpoints.

## Reports

- Brainstorm: `plans/reports/brainstorm-260712-2249-strava-production-completion.md`
</content>
