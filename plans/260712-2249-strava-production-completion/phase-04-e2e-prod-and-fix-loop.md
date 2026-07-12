# Phase 4 — E2E on Prod (Playwright MCP) + Fix-Redeploy Loop

## Context Links

- Plan: [plan.md](plan.md) · blocked by Phase 3 (needs live prod)
- Target: https://app.maf.run (frontend), https://api.maf.run (API), https://maf.run (WordPress SSO)
- Admin login: WordPress creds for user `madm` (obtain at runtime; never store in report — 🔴 C4).

## Overview

- **Priority:** P1 · **Status:** pending · **Effort:** 0.6d
- Drive the full feature matrix on production with Playwright MCP. Each bug → classify → fix locally → **targeted** redeploy → retest failed scenario + regression. Loop until every scenario is green with zero non-cosmetic console errors.

## Key Insights

- The OAuth **authorize** step requires a real Strava login in-browser → user-assisted (one click) or a Strava test account. Flag as a checkpoint, not an automated step.
- Slot-cap needs a **second, never-connected prod account** (🔴 H9): the connected test user is exempt (reconnect). Exercise without 11 real athletes by setting `strava.maxAthletes` to the current row count (or `0`), waiting ≥30s (cache TTL), testing with the second account, then restoring.
- 🔴 **RED TEAM #H9:** Phase 1 now parses `maxAthletes >= 0`, so `'0'` is a valid "pause all" value for the sim. **Prefer the admin path** to change it (invalidates the 30s cache immediately) over raw SQL. Raw fallback against `"AppSetting"` (no `@@map`):
  ```sql
  INSERT INTO "AppSetting"(key,value,"createdAt","updatedAt")
  VALUES('strava.maxAthletes','0',now(),now())
  ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,"updatedAt"=now();
  ```
- Targeted redeploy = which container rebuilds; the rsync itself is **always the full Phase 3 command** (🔴 M12 — partial rsync builds hybrid trees). Loop-exit does a final full rsync + rebuild both so prod == local HEAD.

## Requirements

- Every scenario in the matrix passes on prod.
- No non-cosmetic console errors (network 4xx/5xx, unhandled exceptions).
- Slot guard verified proactively (disabled button) + reactively (409 / `?strava_error=full`) using the second account.
- Prod left clean: `strava.maxAthletes` restored to `10` (asserted, unconditional); any stale test athlete deauthorized; `DEPLOYED_SHA` == local HEAD.

## Test Matrix

| # | Scenario | Steps | Expected | Layer |
|---|----------|-------|----------|-------|
| 1 | SSO login (direct) | app.maf.run → login modal → WP creds | Authed, redirected to dashboard | e2e |
| 2 | SSO gateway + no-cache | enter via maf.run gateway link | Redirect-back works (no stale cache), modal auto-opens | e2e |
| 3 | Logout | logout | Session cleared, no stale cached page | e2e |
| 4 | Guide page | open guide | Renders, no console errors | e2e |
| 5 | MAF calculator | enter age/HR inputs | Correct MAF zone shown | e2e |
| 6 | MAF Lab + auto-fill | open MAF Lab (Strava connected) | Latest run (<7d) auto-fills fields | integ |
| 7 | Dashboard real activities | open dashboard | Real synced runs render; **exactly one** `/strava/activities` request (🔴 M15); empty/error states behave | integ |
| 8 | Profile connect | profile → Connect Strava → **authorize (user click)** | Redirect back `?strava_connected=1`, card shows connected | e2e |
| 9 | Sync | card → Đồng bộ | 202; activities appear after sync | integ |
| 10 | Activities visible | dashboard + MAF Lab post-sync | Data consistent across views | integ |
| 11 | Disconnect | card → Ngắt kết nối | Local row + activities removed; Strava deauthorize logged (🔴 H6) | e2e |
| 12 | Reconnect | Connect again | Fresh row re-consumes a slot | e2e |
| 13 | Slot guard — proactive | maxAthletes=0, **second account** reloads profile | Connect disabled + "Hết slot Strava" | integ |
| 14 | Slot guard — reactive | second account attempts connect while full | 409 / `?strava_error=full` → VN message | integ |
| 15 | Admin users | /admin/users | List renders, actions work | e2e |
| 16 | Admin settings | /admin/settings | Strava creds masked, `hasClientSecret=true` | e2e |
| 17 | Admin strava overview | /admin/strava | Connections table + feature enabled | e2e |
| 18 | Admin manual sync | /admin/strava → per-user Sync | Sync triggers; timestamps update | integ |
| 19 | Webhook event | create/verify an activity for the connected athlete | Webhook processes; activity appears (or logged) | integ |
| 20 | Console cleanliness | all above | Zero non-cosmetic console/network errors | e2e |

## Implementation Steps

1. **Setup (🔴 C4):** open Playwright MCP against https://app.maf.run. Obtain WP creds for `madm` + a **second never-connected** prod account (for scenarios 13-14) + confirm the Strava authorize approach (test account vs user click). **Never write any credential into the report** — reference by role.
2. **Run matrix 1→20 in order** (auth first — later scenarios depend on session). Capture screenshot + console log per scenario.
3. **🔴 RED TEAM #H10 — scenario 2 contingency:** if a stale gateway/logout page persists, that is a **Cloudflare cache issue** (Cache-Everything rule), NOT a code bug — re-purge + confirm the Bypass rule from Phase 3 step 19 instead of burning a fix-loop iteration.
4. **Slot-guard block (13-14, 🔴 H9):** set `strava.maxAthletes=0` (admin path preferred; else SQL), wait ≥30s, test proactive disable + reactive 409 with the **second account**. **Restore `strava.maxAthletes='10'` immediately after (unconditional)** and wait ≥30s; assert via `/admin/strava` or status. This restore also runs on any abort/escalation path (step 6).
5. **Webhook (19):** with a connected athlete, trigger a new activity (or replay a create event); confirm via `ssh $SRV "cd $DIR && docker compose logs maf-api | grep 'Webhook: synced'"` and dashboard appearance.
6. **Fix-redeploy loop** per bug:
   - **Classify:** frontend | api | config/env | data.
   - **Fix locally**, re-run the phase gates (`tsc/lint/test/build`), **commit** (clean tree).
   - **Redeploy — 🔴 RED TEAM #M12: ALWAYS run the full Phase 3 rsync command** (never a partial `src/**`-only sync → avoids hybrid trees), then rebuild only the affected container:
     - frontend-only: full rsync → `docker compose build maf-app && docker compose up -d maf-app`.
     - api-only: full rsync → `docker compose build maf-api && docker compose up -d maf-api` (add `migrate deploy` ONLY if schema changed — it won't for these fixes).
     - config/env: edit server `.env` → restart affected container.
     - Update `DEPLOYED_SHA` each redeploy.
   - **Retest** the failed scenario **+ its regression set** (e.g. a card fix re-runs 8-14; a slot fix re-runs 11-14).
   - Repeat until green. If a scenario fails 3× → stop, escalate with logs — **and still restore `maxAthletes='10'`** before pausing.
7. **Cleanup:** assert `strava.maxAthletes='10'`; deauthorize any stale test athlete on Strava to free slots; remove throwaway test data; **final full rsync + rebuild both images** so prod == local HEAD (`DEPLOYED_SHA` matches).
8. **Report:** write `plans/reports/e2e-260712-strava-prod.md` — matrix pass/fail, bugs+fixes+redeploy type, residual issues. No credentials in the report (🔴 C4).

## Todo List

- [ ] Playwright MCP session + admin creds + **second never-connected account** + authorize approach (🔴 H9/C4)
- [ ] Scenarios 1-12 (auth, guide, calculator, MAF Lab, dashboard single-fetch, connect→sync→disconnect(+deauth)→reconnect)
- [ ] Scenarios 13-14 slot guard via second account (cap-sim, unconditional restore to 10)
- [ ] Scenarios 15-18 admin (users/settings/strava/manual sync)
- [ ] Scenario 19 webhook event processed; 20 console clean
- [ ] Fix-redeploy loop: FULL rsync every redeploy (🔴 M12), targeted rebuild, `DEPLOYED_SHA` updated
- [ ] Cleanup: maxAthletes=10 asserted, stale athletes deauthorized, final full rsync + rebuild both; E2E report (no creds)

## Success Criteria

- All 20 scenarios pass on prod; dashboard fetches activities exactly once (🔴 M15).
- Slot guard confirmed proactively + reactively via the second account; `strava.maxAthletes` restored to `10` (asserted).
- Zero non-cosmetic console/network errors.
- Webhook event processed end-to-end (log + UI); disconnect deauthorizes on Strava (🔴 H6).
- E2E report filed (no credentials); prod state clean; `DEPLOYED_SHA` == local HEAD.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Authorize step blocks automation | High×Low | Pre-arranged user click or Strava test account; manual checkpoint |
| 🔴 H9: cap-sim leaves prod at wrong maxAthletes | Med×High | Unconditional restore step 4 + escalation-path restore step 6 + final assert step 7 |
| 🔴 H9: scenario 13 needs a 2nd account (connected user exempt) | Med×Med | Provision second never-connected account in setup |
| 🔴 M12: partial rsync builds hybrid tree | Med×High | Always full Phase 3 rsync; loop-exit full rsync + rebuild both |
| 🔴 H10: stale SSO page mistaken for code bug | Med×Low | Scenario 2 contingency note — re-purge CF, not a fix-loop |
| Fix introduces regression elsewhere | Med×Med | Retest regression set, not just failed scenario |
| Webhook event needs a real activity | Med×Med | Strava test-account activity or replay create event; verify via logs |
| 10-slot exhaustion from prior dev testing | Med×Med | Check athlete count via Strava API; deauthorize stale athletes first |

## Security Considerations

- No credentials (WP `madm`, Strava, second account) written to the report or logs — reference by role only (🔴 C4).
- Cap-sim prefers the admin API; raw SQL fallback uses quoted `"AppSetting"`; restore verified.
- Confirm no tokens/secrets surface in browser console or network payloads during E2E (scenario 20).

## Next Steps

- On all-green: mark plan `completed`; update `docs/project-changelog.md` + `docs/system-architecture.md` (Strava live on prod, athlete slot cap + deauthorize, webhook active) via `docs-manager`.
- Backlog (out of scope, YAGNI now): admin "force disconnect + deauthorize" slot-reclaim action (🔴 M14/H6); PKCE (deferred per 260517 validation); merged Garmin+Strava timeline; activity detail pages; charts.
</content>
