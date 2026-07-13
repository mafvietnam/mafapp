# Phase 01 — Backend: Detail Cache Model + Hydration Service + Endpoint

## Context Links
- Brainstorm: `plans/reports/brainstorm-260713-1212-strava-activity-detail-maf-analysis.md`
- Existing patterns: `api/src/strava/strava-sync.service.ts` (Strava API call + 429 handling), `strava-token.service.ts` (token), `strava.service.ts` (ownership `getActivity`), `strava.controller.ts` (endpoint + `@Throttle`), `strava-sync.service.spec.ts` (unit test style)

## Overview
- **Priority:** P1 (blocks phase-02 contract)
- **Status:** pending
- **Description:** Add `StravaActivityDetail` model + migration. New `StravaDetailService` lazily hydrates detail+streams from Strava, whitelists + downsamples, upserts cache, serves cached thereafter. New ownership-checked endpoint. Never returns tokens or 500s for edge cases.

## Key Insights
- **Lazy hydration ≈ 2 Strava calls per activity, once.** Cache-first read on subsequent opens, bounded by a `fetchedAt` TTL (30d) so privatized/edited activities self-heal. Rate-limit safe (100/15min, 1000/day).
- Strava API host `www.strava.com`, path `/api/v3/activities/{stravaActivityId}` and `/api/v3/activities/{stravaActivityId}/streams`. `:id` param in URL = **internal DB cuid**, but Strava calls use `activity.stravaActivityId` (numeric-as-string). OAuth scope granted is `read,activity:read_all` (verified in `strava-auth.service.ts:63`) → private + manual activities are readable, so a 401/403 genuinely means token revoked, not scope-gap.
- Reuse `StravaTokenService.getValidAccessToken(userId)` — auto-refreshes.
- Use global `fetch` + `AbortSignal.timeout(10000)` (same style as `strava.service.ts` `deauthorizeBestEffort`). Simpler than `https.request` and consistent. **Every fetch MUST be wrapped in try/catch** — `AbortSignal.timeout` and network errors THROW (no `.status`), and there is NO global Nest exception filter (verified), so an uncaught throw = raw 500. Map thrown errors → `reason:'error'`, no write.
- **Split transforms into a pure util** (`strava-detail-transform.ts`) so whitelist + downsample are unit-testable without HTTP (mirrors how `upsertActivity` mapping is tested in isolation). Keeps service <200 LOC.
- **Deleted (404) → return `hydrated:false, reason:'deleted'` WITHOUT persisting a row.** [Red-team: dropped the `{gone:true}` sentinel — a re-fetch of a deleted activity is cheap+rare and self-correcting; avoids a JSON-collision branch and a spec case.] 401/429/network are transient → also NO write (retry re-hydrates).
- **Concurrency:** `getValidAccessToken` and the read-then-upsert are unlocked. Two overlapping first-opens both INSERT → the 2nd hits `@unique stravaActivityId` → `P2002`. Wrap the `upsert`/write in try/catch: on `P2002` re-read the cache and serve it (idempotent). Do NOT add a Redis lock (YAGNI for connection-capped user base) — the catch is sufficient.
- **Cross-user safety (Critical):** cache read MUST be scoped `findFirst({ where: { stravaActivityId, userId } })`, the new model MUST have `user User @relation(onDelete: Cascade)`, and `StravaService.disconnect()` MUST purge detail rows. Without all three, a disconnected user's cached HR/description survives and can be served to a later account that re-syncs the same global `stravaActivityId`.

## Requirements
### Functional
- First `GET /strava/activities/:id/detail` for an activity with no cache row → fetch Strava detail + streams, whitelist, downsample streams to ≤1000 pts, upsert row, return hydrated payload.
- Subsequent requests → read cache only (no Strava call).
- Response: `{ activity, detail, streams, hydrated, reason? }`.
- Ownership: only the owning `userId` can read; unknown/other-user id → 404.
- Streams may legitimately be absent (manual entry, no HR strap) → `streams:null`, `hydrated:true`.
### Non-functional
- No token/secret ever in response. Endpoint throttled 30/min (raised from 10 — cache hits are cheap and a user clicking through history can open >10/min; throttle exists to cap hydration abuse, not normal browsing). Response sets `Cache-Control: private, no-store` (private HR/PII behind Cloudflare must not be edge-cached). Detail service file + transform file each <200 LOC.

## Architecture / Data flow
```
Controller GET :id/detail (JwtAuthGuard, @Throttle 30/min, res Cache-Control: private, no-store)
  → StravaService.getActivity(userId, id)  // ownership + summary row; null → 404
  → StravaDetailService.getDetail(userId, activity)
       0. GUARD: if !/^\d+$/.test(activity.stravaActivityId) → return hydrated:false reason:'error' (never interpolate untrusted id into URL)
       1. cache = prisma.stravaActivityDetail.findFirst({ where: { stravaActivityId, userId } })   // userId-scoped (cross-user safety)
       2. if cache AND (now - cache.fetchedAt) < TTL(30d):
            return { activity, detail: cache.detailJson, streams: cache.streamsJson, hydrated:true }
          (stale cache → fall through to re-hydrate)
       3. hydrate() — ALL fetches in try/catch (thrown timeout/network → return hydrated:false reason:'error', NO write):
            token = tokenService.getValidAccessToken(userId)
            const safeId = encodeURIComponent(activity.stravaActivityId)
            detailRaw = fetch `${HOST}/api/v3/activities/${safeId}`
              - 404 → return hydrated:false reason:'deleted'          (NO write — no {gone} sentinel)
              - 401/403 → return hydrated:false reason:'unauthorized' (NO write)
              - 429 → return hydrated:false reason:'rate_limited'     (NO write)
              - !ok(other) → return hydrated:false reason:'error'     (NO write, log status)
            streamsRaw = fetch `${HOST}/api/v3/activities/${safeId}/streams?...&key_by_type=true`
              - 404 → genuine "no streams" → streams = null
              - 429/5xx/thrown → TRANSIENT → set streamsMissing=true, streams=null, but DO NOT write the row this call
                (else a transient blip permanently caches streams:null; return detail-only hydrated:true and let next open retry streams)
            detail = whitelistDetail(detailRaw)            // transform util
            streams = downsampleStreams(streamsRaw, 1000)  // transform util (null if empty/absent)
            if NOT streamsMissing:
              try { upsert { stravaActivityId, userId, detailJson: detail, streamsJson: streams, fetchedAt: now } }
              catch P2002 { /* concurrent insert won — re-read + serve */ }
            return { activity, detail, streams, hydrated:true }
```

## Related Code Files
### Create
- `api/prisma/migrations/0003_strava_activity_detail/migration.sql` (follow `000N_name` convention seen in `0001_init`, `0002_strava_admin_sync_columns`)
- `api/src/strava/strava-detail.service.ts` — orchestration (cache read, hydrate, error tiers, response build)
- `api/src/strava/strava-detail-transform.ts` — pure: `whitelistDetail(raw)`, `downsampleStreams(rawStreams, cap)`, `computeStride(len, cap)`
- `api/src/strava/strava-detail.service.spec.ts` — cache-hit / gone / 401 / 429 / hydrate-success paths (mock prisma+token+fetch)
- `api/src/strava/strava-detail-transform.spec.ts` — whitelist strips non-listed fields; downsample stride + alignment + ≤1000 + null-empty
### Modify
- `api/prisma/schema.prisma` — add `StravaActivityDetail` model (after `StravaActivity`, ~line 158) WITH `user User @relation(onDelete: Cascade)`; add back-reference field `stravaActivityDetails StravaActivityDetail[]` on the `User` model
- `api/src/strava/strava.controller.ts` — add `GET activities/:id/detail`; set `res.set('Cache-Control','private, no-store')` (inject `@Res({ passthrough: true })`)
- `api/src/strava/strava.service.ts` — `disconnect()`: add `this.prisma.stravaActivityDetail.deleteMany({ where: { userId } })` alongside the existing activity delete (privacy + prevents stale-cache resurrection on reconnect)
- `api/src/strava/strava.module.ts` — register `StravaDetailService` in `providers`
### Delete
- none

## Implementation Steps
1. **Prisma model** — add to `schema.prisma` (exact fields from brainstorm, no extra columns):
   ```prisma
   model StravaActivityDetail {
     id               String   @id @default(cuid())
     stravaActivityId String   @unique   // 1-1 with StravaActivity.stravaActivityId
     userId           String
     detailJson       Json                // { description, deviceName, gearName, calories, splitsMetric[] }
     streamsJson      Json?               // { time[], heartrate[], velocitySmooth[], altitude[], distance[] } | null
     fetchedAt        DateTime @default(now())
     createdAt        DateTime @default(now())
     updatedAt        DateTime @updatedAt
     user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@index([userId])
   }
   ```
   Also add `stravaActivityDetails StravaActivityDetail[]` to the `User` model (mirrors `stravaActivities`).
2. **Generate migration — `--create-only` FIRST, then rename, then apply** (avoids Prisma history desync — renaming an *already-applied* migration orphans its `_prisma_migrations` row and wedges the next `migrate dev`). Dev DB must be running:
   ```bash
   cd api
   npx prisma migrate dev --create-only --name strava_activity_detail   # generates but does NOT apply
   # rename folder <timestamp>_strava_activity_detail → 0003_strava_activity_detail
   npx prisma migrate dev                                               # applies 0003_ (recorded name == folder)
   npx prisma generate
   ```
3. **Transform util** `strava-detail-transform.ts`:
   - `whitelistDetail(raw)` → `{ description: raw.description ?? null, deviceName: raw.device_name ?? null, gearName: raw.gear?.name ?? null, calories: raw.calories ?? null, splitsMetric: (raw.splits_metric ?? []).map(pickSplit) }`. **NOTE `calories` here is real kcal** (the summary `StravaActivity.calories` column stores `kilojoules` — see `strava-sync.service.ts:181` — so the FE stats grid must prefer `detail.calories` when hydrated). `pickSplit` copies ONLY whitelisted keys (keep Strava snake_case inside items). Never spread raw. **`laps` dropped** [Red-team scope: Strava auto-laps at 1km ≈ `splits_metric`; redundant. Cut from whitelist + UI for v1].
   - `computeStride(len, cap)` → `len <= cap ? 1 : Math.ceil(len / cap)`.
   - `downsampleStreams(rawStreams, cap=1000)`: read `.time.data` as reference; if no time/heartrate arrays → return `null`. **Truncate all present streams to the shortest common length BEFORE striding** (a dropped HR strap yields `heartrate` shorter than `time` → naive same-index sampling injects interior `undefined` → NaN downstream). Compute stride from that common length; sample same indices across `time, heartrate, velocity_smooth, altitude, distance` (missing type → omit that key). Output `{ time, heartrate, velocitySmooth, altitude, distance }` arrays (only present ones). Guarantee result length ≤ cap.
4. **Detail service** `strava-detail.service.ts`: `@Injectable`, ctor `(prisma: PrismaService, tokenService: StravaTokenService)`. Implement `getDetail(userId, activity)` per data-flow above. Two private fetch helpers returning `{ status, json }`. Use `Logger` for warns (log status codes, NOT tokens). Constants: `STRAVA_API_HOST='www.strava.com'`, `STREAM_KEYS='time,heartrate,velocity_smooth,altitude,distance'`, `STREAM_CAP=1000`, `FETCH_TIMEOUT_MS=10000`.
5. **Controller** — add after existing `getActivity`:
   ```ts
   @Get('activities/:id/detail')
   @UseGuards(JwtAuthGuard)
   @Throttle({ default: { limit: 30, ttl: 60000 } })
   async getActivityDetail(
     @Req() req: Request,
     @Param('id') id: string,
     @Res({ passthrough: true }) res: Response,
   ) {
     res.set('Cache-Control', 'private, no-store');
     const userId = (req.user as { id: string }).id;
     const activity = await this.stravaService.getActivity(userId, id);
     if (!activity) throw new NotFoundException('Activity not found');
     return this.detailService.getDetail(userId, activity);
   }
   ```
   Inject `private readonly detailService: StravaDetailService` in ctor. Import from `./strava-detail.service.js`. `Response` from `express`.
6. **Module** — add `StravaDetailService` to `providers` (export not required; only controller uses it).
7. **Disconnect purge** — in `strava.service.ts` `disconnect()`, add `await this.prisma.stravaActivityDetail.deleteMany({ where: { userId } })` next to the existing `stravaActivity.deleteMany`. Wrap both in the same best-effort flow.
8. **Tests** — mirror `strava-sync.service.spec.ts` style (plain `new Service(mocks)`, `jest.fn()` mocks). Mock global `fetch` via `jest.spyOn(global, 'fetch')`. Cover: fresh cache-scoped read is userId-filtered; cache-hit (within TTL) returns no-fetch; stale cache (fetchedAt > 30d) re-hydrates; Strava 404 → reason:'deleted' NO write; 401 → reason:'unauthorized' no write; 429 → reason:'rate_limited' no write; thrown timeout/network → reason:'error' no write; success upserts + returns hydrated:true; streams 404 → streams:null hydrated:true row written; streams 429/5xx → streams:null but NO row written (retryable); P2002 on upsert → re-read + serve. Transform spec: whitelist drops unlisted keys + no `laps`; downsample 3600→≤1000 correct stride + aligned arrays; **HR shorter than time → truncated to common length, no interior undefined**; empty streams → null.
8. **Compile + test**:
   ```bash
   cd api
   npm run build        # tsc via nest build — must pass
   npm test             # jest — all specs incl new + existing green
   ```

## Todo List
- [ ] Add `StravaActivityDetail` model (+ `user` cascade relation + `User.stravaActivityDetails[]` back-ref) to schema.prisma
- [ ] Migration via `--create-only` → rename to `0003_strava_activity_detail` → apply → `prisma generate`
- [ ] Create `strava-detail-transform.ts` (whitelist no-laps + calories-kcal + shortest-common-length downsample, pure)
- [ ] Create `strava-detail.service.ts` (userId-scoped cache read, TTL, try/catch all fetches, streams transient vs absent, P2002 catch, id regex guard + encodeURIComponent)
- [ ] Add endpoint to `strava.controller.ts` (30/min, Cache-Control private no-store); inject service
- [ ] Add `stravaActivityDetail.deleteMany` to `strava.service.ts` `disconnect()`
- [ ] Register provider in `strava.module.ts`
- [ ] Write `strava-detail-transform.spec.ts` + `strava-detail.service.spec.ts` (incl. transient-streams, P2002, stale-TTL, userId scoping)
- [ ] `npm run build` + `npm test` in api/ green

## Success Criteria
- Migration applies cleanly; `StravaActivityDetail` table exists with unique `stravaActivityId` + FK cascade to `User`.
- Endpoint returns correct shape for: fresh (hydrates), cached-within-TTL (no Strava call), stale-cache (re-hydrates), deleted, unauthorized, rate_limited, network-error, no-streams, transient-streams-failure (retryable).
- Zero 500s for ALL edge tiers incl. thrown timeout/network + P2002. All api tests pass (new + existing untouched).
- Cache read is userId-scoped; `disconnect()` purges detail rows; response contains no `accessToken`/`refreshToken`/raw Strava blob — only whitelisted fields.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-user cache leak on reconnect (global unique `stravaActivityId`) | Med | **High** | userId-scoped read + `onDelete: Cascade` + `disconnect()` purge (all three) |
| Thrown timeout/network bypasses status tiers → 500 | High | High | try/catch every fetch → `reason:'error'`, no write; no global filter exists |
| Concurrent first-open → P2002 → 500 | Med | High | try/catch upsert on P2002 → re-read + serve |
| Transient streams 429/5xx permanently caches `streams:null` | Med | Med | Distinguish 404 (absent, cache) vs 429/5xx/throw (transient, no write → retry) |
| Migration history desync from rename-after-apply | Med | Med | `--create-only` → rename → apply (never rename applied) |
| Strava field-key mismatch (`device_name` vs `deviceName`) | Med | Low | Whitelist reads snake_case per API; log raw keys once on first hydrate; single-file patch |
| Stale/privatized activity served forever | Med | Med | `fetchedAt` 30d TTL → re-hydrate reflects deletion/privacy |
| Ultra-long stream (36k pts) memory | Low | Med | Downsample cap 1000 before upsert |

## Security Considerations
- `JwtAuthGuard` on endpoint. Ownership enforced via `getActivity(userId, id)` (`findFirst where {id,userId}`) BEFORE any Strava call — prevents IDOR. **Cache read ALSO userId-scoped** — ownership is not delegated to the global-unique `stravaActivityId`.
- `stravaActivityId` regex-guarded (`/^\d+$/`) + `encodeURIComponent` before URL interpolation — no path/query injection into the authenticated Strava call.
- `@Throttle 30/min` + `Cache-Control: private, no-store` — caps hydration abuse; prevents Cloudflare edge from caching one user's private HR/PII for another.
- `disconnect()` purges `StravaActivityDetail` — honors Strava data-deletion + prevents stale resurrection.
- Response whitelists JSON — never spread raw Strava payload (avoids leaking athlete/token-ish fields, polyline, etc.). Logs never print tokens; only status codes + activity id.
- **Deferred (documented, not v1):** app-global Strava-quota token bucket. User base is connection-capped + small; per-user throttle + cache-first + transient-no-write + retry-cooldown (phase-04) bound the blast radius. Revisit if daily quota (1000) bites.

## Next Steps
- Unblocks phase-02 (frontend consumes this contract). Provide the exact response TS shape to phase-02.
- Phase-03 (utils) can proceed in parallel — independent of this endpoint.
</content>
