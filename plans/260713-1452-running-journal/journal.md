# Journal — Running Journal (`/journal`) shipped to prod

**Date:** 2026-07-13 | **Prod SHA:** 1c6851c | **Status:** LIVE + verified

## What shipped
`/journal` page: full Strava run history grouped by week (Monday-start), current-month stats (km / sessions / %-in-MAF-zone), long-term MAF trend chart (pace@MAF + aerobic efficiency, per-series gated). Read-only from existing sync — no new DB model/migration. Backend `GET /strava/activities` gained optional `since`/`until` half-open filter + `@Throttle`/`Cache-Control`/`@Max` guards. 3 nav placeholders repointed.

## Flow followed (per goal)
brainstorm → ck:plan → **red-team (3 hostile reviewers)** → self-validate → cook --auto (4 phases) → code-review → ship (staged, backend-first) → prod E2E test → clean loop exit.

## Red-team payoff (12 findings applied, 4 rejected)
The pagination hook was the weak spot — reviewers caught: double-click skips a window (→ synchronous `loadingRef` lock), loadMore failure clobbers loaded weeks (→ separate non-clobbering `loadMoreError`), unstable `new Date()` per call → window overlap + unpopulated `seenIds` (→ single `nowRef` + seeded/populated dedupe), empty-window strands connected users (→ auto-advance to 2yr cap). Two facts flipped severities on verification: sync stores runs-only (`RUN_TYPES`) → rejected the `type='Run'` filter; `forbidNonWhitelisted:true` → confirmed backend-first deploy mandatory.

## Code-review catch (fixed pre-ship)
recharts v3 passes null series values to the tooltip formatter → `value.toFixed()` crash + bogus "0:00 /km". Added null guard. Verified no crash on prod (week with null efficiency hovered fine).

## Verification
FE 257 tests + build green; API 72 tests + build green. Prod backend E2E: valid window→200 (7 real activities, `cache-control: private, no-store`), invalid date→400, limit=366→400, no-auth→401. Prod UI (Playwright, injected owner JWT cookie): all weeks/verdicts/%MAF/chart render correctly, 0 journal console errors.

## Deploy topology learned
Live compose is `/opt/maf-tool/full-maf-coaching-tool/docker-compose.yml` (has `.env`), building from source repo `/opt/maf-tool/repo`. Staged `up -d maf-api` then `maf-app`; never bare `up -d` (would recreate tunnel/wordpress). Captured in VPS memory.

## Follow-ups (non-blocking)
- `api/src/strava/strava.service.ts` now 210 LOC (>200 guideline) — extract where-builder later.
- CF Tunnel collapses per-IP throttle to one bucket (pre-existing app-wide) — trust-proxy + custom tracker is a separate infra task.
- v2 backlog: subjective notes/feeling, manual entry, Garmin merge, feed DesktopStatsRow real numbers.
