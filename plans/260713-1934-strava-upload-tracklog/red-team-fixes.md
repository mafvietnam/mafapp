# Red Team Fixes (ACCEPTED — apply during cook)

3 hostile reviewers (security / assumption / failure-mode). Findings deduped + adjudicated.
**All below ACCEPTED.** Refuted items listed at bottom (do NOT spend effort).

## CRITICAL

### RT-C1 — userId-scope the upsert (cross-tenant poisoning) [phase-03]
`stravaActivityId` is **globally `@unique`**, not userId-scoped (schema.prisma:138,166). Bare
`upsert({where:{stravaActivityId}})` can overwrite another user's row (UPDATE branch keeps original
userId but replaces name/hr/streams/description = attacker-controlled). Gated today only by userId
being in the hash preimage (secret), but the app serializes userId to clients → latent Critical.
**Fix (both StravaActivity AND StravaActivityDetail):**
```ts
const n = await prisma.stravaActivity.updateMany({ where: { stravaActivityId, userId }, data });
if (n.count === 0) {
  try { await prisma.stravaActivity.create({ data: { userId, stravaActivityId, source:'UPLOAD', ...data } }); }
  catch (e) { if (isP2002(e)) throw new ConflictException('Activity id conflict'); throw e; }
}
```
NEVER put userId in an update branch (would allow ownership theft). Same pattern for detail upsert.

### RT-C2 — Symmetric dedup across {STRAVA, UPLOAD, Garmin} [phase-03 + strava-sync.service.ts]
Dedup is one-directional → double-counts (both rows `isDuplicate=false`) in dashboard + journal +
MAF trends (all sum raw rows, only filter `isDuplicate=true`). Two vectors:
- **C1 (order):** upload-then-sync. Sync `checkAndMarkDuplicate` (strava-sync.service.ts:196-218) only
  scans `garminActivity` — never UPLOAD rows.
- **C2 (cross-format):** same run as GPX(haversine ~4987m) + TCX(DistanceMeters 5000m) → different
  `round(distance)` → different hash → 2 UPLOAD rows; overlap check doesn't scan other UPLOAD.
**Fix:** make reconciliation source-inclusive with fixed precedence **STRAVA > Garmin > UPLOAD**:
- On UPLOAD ingest (`markDuplicateIfOverlap`): search ±5min, **userId-scoped**, across StravaActivity
  (any source) + GarminActivity. If a STRAVA sync OR another (older) UPLOAD or Garmin overlaps → mark
  the appropriate lower-precedence row `isDuplicate=true` (the new upload loses to STRAVA/Garmin; for
  UPLOAD-vs-UPLOAD mark the newer one duplicate).
- In sync `checkAndMarkDuplicate`: after upserting a STRAVA row, ALSO find overlapping `source=UPLOAD`
  StravaActivity (±5min, same userId) and set its `isDuplicate=true`.
- Keep it userId-scoped everywhere (also fixes RT-H3 cross-tenant inference).

## HIGH

### RT-H1 — Compute avgSpeed for uploads (silent MAF-efficiency death) [phase-02/03]
`ParsedTracklog` omits avgSpeed; `aerobicEfficiency(avgSpeed,hr)` returns null when avgSpeed null
(maf-activity-analysis.ts:177) → efficiency tile + CH-efficiency coaching finding + journal MAF-trend
efficiency line (journal-analytics.ts:128) all silently empty for EVERY upload. Renders w/o error →
E2E passes while half the feature purpose is dead.
**Fix:** compute `avgSpeed = distance>0 && movingTime>0 ? distance/movingTime : null` (m/s), write to
StravaActivity data (mirrors strava-sync.service.ts:178). Also set maxSpeed=null (ok).

### RT-H2 — FE multipart: api-client forces JSON + auth is cookie, `postForm` missing [phase-05]
`api-client.ts:27` hardcodes `Content-Type: application/json` on every call → Multer sees 0 files.
`api.postForm` doesn't exist. Auth = httpOnly cookie via `credentials:'include'` (api-client.ts:26),
NOT Authorization header — plan's "keep Authorization" note is wrong.
**Fix:** add `postForm(path, fd)` in api-client that: omits Content-Type (browser sets boundary),
keeps `credentials:'include'`, reuses the 401→refresh retry path (api-client.ts:30-34). Do NOT set
`'Content-Type': undefined` (malformed header) — just don't add the key.

### RT-H3 — Sync XML parse is CPU/mem DoS; cap trackpoints + limits [phase-02/03]
Real risk is NOT XXE (refuted) — it's `fast-xml-parser` **synchronous full-tree build** blocking the
event loop. 20×5MB, no trackpoint cap, full `points[]` built before downsample.
**Fix:** (a) hard-cap trackpoint count — reject > ~50k pts with clear error BEFORE building arrays;
(b) lower batch to **8 files** (from 20); (c) parse files **sequentially** (not Promise.all);
(d) Multer `limits: { fileSize:5MB, files:8, fields:2, parts:12 }`.

### RT-H4 — Validate/clamp all attacker-controlled parsed values [phase-02]
Every field is file-controlled. Fixes needed at parse boundary:
- `name`/`description`: trim + cap length (name ≤256, desc ≤4000), strip control chars.
- `distance` finite & 0–1e6 m; `hr` 0–300; `ele` sane; reject `!Number.isFinite`.
- `startDate`: must be valid Date within 2000-01-01 .. now+1d, else `EmptyTracklogError`
  ("file thiếu thời gian điểm") — **before** any `.toISOString()` (RT-M3 route-GPX invalid-date throw).

### RT-H5 — Migration deploy order + name derivation [phase-07]
`migrate resolve` at step-5 runs in OLD container (migration dir absent) → "not found"; hand-typed
timestamp risks `_prisma_migrations` divergence → future `CREATE TYPE already exists`.
**Fix:** reorder — (1) apply SQL via psql, (2) `up -d maf-api` (NEW image, no auto-migrate, boots
against present column), (3) `migrate resolve` **inside NEW container**. Derive name:
`NAME=$(ls api/prisma/migrations | grep add_activity_source)`; use `$NAME` for both .sql path & --applied.

### RT-H6 — Wrap summary+detail write in transaction (orphan rows) [phase-03]
Two sequential upserts, no txn. Detail upsert throws after summary commits → orphan activity shows on
dashboard while UI reported "error"; detail page → bare page (RT-M4).
**Fix:** `prisma.$transaction([...])` around summary + detail writes (use interactive txn since
create/updateMany branch from RT-C1 needs logic). Reported "error" ⇒ nothing persisted.

## MEDIUM

- **RT-M1 — HR partial:** emit `heartrate[]` when **≥1** point has HR (not "every point"); let
  `downsampleStreams` common-length truncation handle ragged arrays (it already does,
  strava-detail-transform.ts:128-134). [phase-03 toStreamSet]
- **RT-M2 — Multer error mapping:** `MulterError(LIMIT_FILE_SIZE/LIMIT_UNEXPECTED_FILE)` surfaces as
  500. Add exception filter → 413/400. Note oversize aborts whole batch; update phase-07 E2E to expect
  clean 4xx. [phase-03]
- **RT-M3 — Hide Strava link + attribution for UPLOAD:** activity-detail-header.tsx:32 builds
  `strava.com/activities/upload_...` (404) + Strava logo on non-Strava data (brand/ToS). Branch on
  `activity.source==='UPLOAD'` to hide external link + PoweredByStrava. [phase-05]
- **RT-M4 — Derive velocity stream:** build `velocity_smooth` in toStreamSet from consecutive
  distance/time deltas (uploads have both) so cardiac-drift + CH4 finding fire (else permanently
  hidden). [phase-03]
- **RT-M5 — movingTime from moving samples:** estimate by summing dt where inter-point speed >
  threshold (~0.5 m/s) instead of `movingTime=elapsed`; avoids false overreach gate
  (maf-coaching-insights.ts:117) + efficiency understatement. Fallback elapsed only if no coords. [phase-02]
- **RT-M6 — calories unit:** summary `StravaActivity.calories` is **kJ** (sync writes kilojoules);
  TCX calories are **kcal**. Put kcal only in `detailJson.calories`; leave summary `calories=null` for
  uploads to avoid unit mixing. [phase-03]
- **RT-M7 — Prisma.DbNull:** `streamsJson` when null must use `Prisma.DbNull` (reuse
  strava-detail.service.ts:156-160 `toJsonInput`), not JS null. [phase-03]
- **RT-M8 — detail fallback:** phase-04 fallback should return `hydrated:false, reason:'error'` when
  the detail row is genuinely MISSING (offers FE retry); `hydrated:true` only when a row exists (with
  txn RT-H6 this is rare, but keep the distinction). Intentional no-HR upload still writes a detail
  row with streamsJson=null → hydrated:true. [phase-04]
- **RT-M9 — TCX multisport:** normalize `Activities>Activity` to array, pick first `Sport="Running"`
  (else first). [phase-02]
- **RT-M10 — migration SQL transactional:** wrap CREATE TYPE + ALTER + CREATE INDEX in `BEGIN;…COMMIT;`
  (plain CREATE INDEX ok on tiny table). [phase-01/07]
- **RT-M11 — upload type:** parse type; if not run-like, still store (dashboard shows) but coaching
  gates correctly exclude. Default `'Run'` when type absent/unmappable. [phase-02]

## Verify during implementation (unresolved questions) — RESOLVED
1. **ThrottlerGuard global?** ✅ VERIFIED — `APP_GUARD: ThrottlerGuard` in app.module.ts:57
   (global 100/60s, overridable). `@Throttle 10/min` on upload controller WILL be enforced.
2. **Dockerfile `prisma generate`?** ✅ VERIFIED — api/Dockerfile:13 runs `prisma generate` at build;
   runtime copies `.prisma`, `@prisma/client`, `prisma/` (migrations). Prod client gets `source` after
   rebuild; `migrate resolve` inside NEW container finds the migration dir (reinforces RT-H5).
3. **markDuplicateIfOverlap userId-scoped** — still MUST include `userId` in every dedup `where` (RT-H3).
   (also: main.ts global ValidationPipe validates only @Body DTOs → multipart @UploadedFiles unaffected;
   no global body-parser limit set → 5MB multipart reaches Multer fine.)

## Post-implementation code review (code-reviewer, 2026-07-13) — FIXED + follow-up
- **H1 FIXED:** HR stream in `tracklog-streams.fillAligned` wasn't range-clamped (summary was) → 0/glitch
  HR polluted time-in-zone + contradicted avgHR. Now clamps via `inRangeHr` (forward-fill). Test added.
- **M1 FIXED:** `markDuplicate` ran after the txn; a throw there failed ingest while the row stayed
  committed. Now wrapped in try/catch (row kept, badge omitted on dedup failure).
- **M2 FOLLOW-UP (not blocking — Garmin OAuth not live in prod):** `garmin-sync.service` has NO dedup;
  upload-then-Garmin-sync would double-count. Mirror `checkAndMarkDuplicate` into garmin-sync (flag
  overlapping `source=UPLOAD` ±5min) BEFORE Garmin OAuth goes live. See [[garmin-integration-status]].
- Ship verdict: conditional ship → H1+M1 fixed → **cleared to ship**.

## REFUTED — do NOT act
XXE / billion-laughs (fast-xml-parser doesn't resolve DTD/entities); phase-04 guard-bypass injection
(no URL built, userId-scoped); path traversal (memoryStorage); avgPace min/km (already correct, matches
sync); FilesInterceptor needs MulterModule (works via @nestjs/platform-express); ValidationPipe
forbidNonWhitelisted trips multipart (only validates @Body DTOs); detail page assumes numeric IDs
(routes on internal cuid); ADD COLUMN NOT NULL DEFAULT rewrite (PG11+ fast default, metadata-only).
