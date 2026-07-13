# Phase 01 Backend Report — Strava Activity Detail (Detail Cache + Hydration Service + Endpoint)

Date: 2026-07-13
Plan: `plans/260713-1212-strava-activity-detail-maf-analysis/phase-01-backend-detail-service-endpoint.md`

## Files Changed

### Created
- `api/prisma/migrations/0003_strava_activity_detail/migration.sql` — hand-authored (no local DB, per orchestrator instruction, NOT `prisma migrate dev`). CREATE TABLE StravaActivityDetail, unique idx on stravaActivityId, idx on userId, FK to User ON DELETE CASCADE. Mirrors 0001_init/0002 SQL style exactly (no DEFAULT on updatedAt, matching existing @updatedAt columns).
- `api/src/strava/strava-detail-transform.ts` (149 LOC) — pure: `whitelistDetail(raw)`, `computeStride(len,cap)`, `downsampleStreams(rawStreams,cap=1000)`. No `laps`. Truncates all present streams to shortest common length before striding (dropped-HR-strap safety). Exports raw/typed interfaces (`StravaDetailRaw`, `StravaStreamSet`, `WhitelistedDetail`, `DownsampledStreams`) for the service + specs to share.
- `api/src/strava/strava-detail.service.ts` (199 LOC) — `StravaDetailService.getDetail(userId, activity)`. Guard regex, userId-scoped cache read, 30d TTL, hydrate w/ try/catch on every fetch, streams transient-vs-genuine-404 split, P2002 upsert-race recovery, Prisma.DbNull for nullable Json field.
- `api/src/strava/strava-detail-transform.spec.ts` — whitelist (drops laps/athlete/map/unlisted split keys), computeStride, downsampleStreams (null-guards, alignment, HR-shorter-than-time truncation, ≤cap enforcement).
- `api/src/strava/strava-detail.service.spec.ts` — guard, userId-scoping, cache-hit/stale-TTL, detail tiers (404/401/403/429/500 + thrown), token-fetch failure, streams tiers (success/404-write/429-no-write/5xx-no-write/thrown-no-write), P2002 recovery.

### Modified
- `api/prisma/schema.prisma` — added `StravaActivityDetail` model (cascade FK, `@@index([userId])`) + `User.stravaActivityDetails[]` back-ref.
- `api/src/strava/strava.controller.ts` — added `GET activities/:id/detail` (JwtAuthGuard, Throttle 30/60s, `res.set('Cache-Control','private, no-store')`, ownership via `getActivity` → 404). Injected `StravaDetailService`.
- `api/src/strava/strava.service.ts` — `disconnect()`: added `stravaActivityDetail.deleteMany({where:{userId}})` alongside existing `stravaActivity.deleteMany`.
- `api/src/strava/strava.module.ts` — registered `StravaDetailService` in providers.
- `api/src/strava/strava.controller.spec.ts` — added `detailService` mock to `buildController` (pre-existing test broken by new ctor param; fixed to keep suite green).
- `api/src/strava/strava.service.spec.ts` — added `stravaActivityDetail.deleteMany` mock to prisma stub (pre-existing test broken by new `disconnect()` call; fixed to keep suite green).

## Verify Results
```
cd api
npx prisma generate   # OK — StravaActivityDetail now in generated client
npm run build          # OK — nest build (tsc), zero errors
npm test                # OK — 7 suites, 57 tests, all green (new + existing)
npx eslint <all touched files>   # OK — zero errors (ran extra, not in the mandated verify list)
```

## Deviations / Assumptions
1. **Migration authored by hand, not `prisma migrate dev`** — per orchestrator instruction (no local DB assumed). SQL mirrors 0001/0002 conventions exactly. Not applied against a live DB in this session — needs to run on deploy via the normal migrate-deploy path.
2. **`Prisma.DbNull` for nullable streamsJson** — plain JS `null` on a Prisma `Json?` field write is a **TS compile error** (confirmed via websearch + node repro), not just a style choice. Used `Prisma.DbNull` when `streams === null`, `Prisma.InputJsonValue` cast otherwise. Read-back naturally deserializes to JS `null` either way, so response shape is unaffected.
3. **File-size discipline (<200 LOC) required real restructuring, not just prettier**. First draft compiled/tested clean at 212 LOC but ballooned to 258 after `eslint --fix` (project's 80-col prettier reflowed every multi-field return object to 5-7 lines). Iteratively refactored: extracted `errorResponse`/`fromCacheRow`/`toJsonInput`/`readStreams` helpers, dropped return-type annotations that pushed signatures over 80 cols (TS still infers correctly, verified via build), shortened log message wording (functionally same info: reason/status codes + activity id, never tokens). Landed at 199 LOC, lint-clean.
4. **Legacy `@types/jest` generic style** — this repo's `jest.fn<T, Y>()` uses the old 2-generic (return, args-tuple) signature, not the newer single-function-type generic from `jest-mock`/`@jest/globals`. Typed `findFirst`/`upsert` mocks accordingly in the spec to eliminate `no-unsafe-any` lint findings (all real production `any` escapes also fixed: `res.json()` cast to `unknown` explicitly).
5. **Fixed 2 pre-existing spec files** (`strava.controller.spec.ts`, `strava.service.spec.ts`) — not in this phase's "Create" list, but their manual `new StravaController(...)` / prisma mock shape broke as a direct, mechanical consequence of the phase's own required changes (new ctor param, new prisma model call in `disconnect()`). Fixes were minimal (add one mock/arg each), no behavioral test changes. Required to satisfy "all api tests pass (new + existing untouched)".
6. Did not touch Garmin code or frontend (`src/`), per instruction.

## Unresolved Questions
- None. Migration SQL has not been run against a real Postgres instance (no local DB available) — recommend a dry-run/`prisma migrate deploy` verification on the next env with DB access before phase-02 frontend work depends on live data.

**Status:** DONE
**Summary:** StravaActivityDetail model+migration, StravaDetailService (userId-scoped cache, 30d TTL, all-tiers error mapping, transient-streams/P2002 handling), GET activities/:id/detail endpoint, disconnect() purge — all implemented per hardened spec; build+lint+57/57 tests green.
**Files changed:** see above (5 created + 6 modified, all under `api/`)
**Verify results:** `prisma generate` OK, `npm run build` OK (0 errors), `npm test` OK (7/7 suites, 57/57 tests), `eslint` OK (0 errors) on all touched files
**Concerns/Blockers:** none blocking. Migration untested against live Postgres (no local DB in this environment) — recommend verifying `prisma migrate deploy` on next DB-accessible env before frontend (phase-02) integration testing against real data.
