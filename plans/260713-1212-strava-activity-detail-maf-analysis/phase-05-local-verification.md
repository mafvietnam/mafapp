# Phase 05 — Local Verification (Lint, Types, Tests, Build, Smoke)

## Context Links
- Gate before phase-06 deploy. Verifies phases 01-04 integrate cleanly.
- Scripts: root `package.json` (`lint`, `test`, `build`), `api/package.json` (`build`, `test`, `lint`).

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Full local quality gate — frontend lint/tsc/vitest/build, api build/tests, then manual smoke against dev servers with a real synced Strava activity. No deploy until all green.

## Key Insights
- Two separate npm projects: root (Vite/React) and `api/` (NestJS). Run each project's checks in its own dir.
- api uses `jest`; frontend uses `vitest`. `tsc --noEmit` for FE type safety (build also type-checks).
- Manual smoke is where lazy hydration + real Strava shapes are first exercised end-to-end — watch the api log line on first open to confirm whitelist keys match assumptions (phase-01 risk).

## Requirements
### Functional
- All automated checks pass. Manual smoke confirms: click activity → detail page loads; first open hydrates (api log shows Strava fetch), reload serves from cache (no fetch log); MAF sections render; degradation paths behave.
### Non-functional
- Zero failing tests. No lint errors. No console errors on the detail page (except known-benign).

## Implementation Steps
1. **Frontend checks** (repo root):
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build          # ensure Vite build + lazy chunk succeed
   ```
2. **API checks**:
   ```bash
   cd api
   npm run lint
   npm run build          # nest build (tsc)
   npm test               # jest: new detail specs + existing green
   ```
3. **Start dev stack** (per deployment-guide): ensure Postgres + Redis up (Docker or local), then:
   ```bash
   cd api && npx prisma migrate dev && npm run start:dev   # applies 0003 migration locally, API :3001
   # separate shell:
   npm run dev                                             # FE :5173
   ```
4. **Manual smoke matrix** (browser, logged-in user with synced Strava activities):
   | Step | Expected |
   |---|---|
   | Dashboard → click a mobile card | Routes to `/activities/:id` |
   | Dashboard → click a desktop row | Routes to `/activities/:id` |
   | First open of an activity | Header + stats + MAF sections; api log shows Strava detail+streams fetch |
   | Reload same activity | Instant; NO Strava fetch log (cache hit) |
   | Open activity with HR | Time-in-zone bar + HR chart w/ MAF band + splits HR flags |
   | Open manual/no-HR activity | NoHrNotice; HR sections hidden; stats/splits/laps shown |
   | Profile with no age (or clear) | MAF sections hidden, ProfileNotice; stats shown |
   | "Xem trên Strava" link | Opens correct `strava.com/activities/{stravaActivityId}` |
   | Invalid id in URL | Error state, back-to-dashboard, no crash |
5. **Force a degradation** (optional): temporarily point one activity's cache to `{gone:true}` via psql, or disconnect/re-simulate 401, to confirm HydrationNotice + retry. Revert after.
6. Record any Strava shape mismatch (e.g. `gear.name` vs `gear_id`) and loop back to phase-01 whitelist if needed.

## Todo List
- [ ] FE: lint + tsc + vitest + build all pass
- [ ] API: lint + build + jest all pass
- [ ] Local migration 0003 applies
- [ ] Smoke matrix all rows pass
- [ ] Cache-hit confirmed (no 2nd Strava fetch)
- [ ] Degradation (no-HR, hydrated:false, no-profile) confirmed
- [ ] No unexpected console errors

## Success Criteria
- Every automated command exits 0. Smoke matrix fully green. First-open hydrates, reload is cache-only. All degradation states behave. No regressions in dashboard.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Strava real shape differs from assumption | Med | Med | Smoke step 6 catches; whitelist is one file to patch |
| Local Postgres/Redis not running | Med | Low | deployment-guide `docker-compose.dev.yml up` |
| Vitest lacks React component env | Med | Low | Component tests are manual per code-standards; only util tests automated |
| recharts SSR/measure warning in console | Low | Low | ResponsiveContainer needs sized parent; give chart a fixed height |

## Security Considerations
- Confirm network tab: `/detail` response has NO token fields, NO raw Strava blob (only whitelisted keys).
- Confirm 401/deleted paths never surface a 500 or stack trace to the client.

## Next Steps
- All green → phase-06 production deploy.
</content>
