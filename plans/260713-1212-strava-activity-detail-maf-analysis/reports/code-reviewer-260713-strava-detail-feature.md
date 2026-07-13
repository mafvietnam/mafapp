# Code Review — Strava Activity Detail + MAF Analysis

Date: 2026-07-13
Reviewer: code-reviewer
Scope: new/changed files for the "Strava Activity Detail + MAF Analysis" feature (backend hydration/cache + FE detail page). Production-readiness pass.
Gates already green (not re-run): FE lint, vite build, vitest 231/231, nest build, jest 57/57.

## Verdict

Ship-blocking: **2 High findings** must be fixed before prod. Everything else is Medium/Low. Of the 11 red-team fixes, **10/11 are present-and-correct**; #2 (no-500 guarantee) is violated by an unhandled null/HTML Strava body, and #1's data-deletion intent is re-opened on the webhook-deauth path (a sibling of the purge it hardened).

---

## HIGH

### H1 — No-500 guarantee broken: 200-with-null/HTML Strava body throws in `whitelistDetail(null)` → 500 (violates red-team fix #2)
**File:** `api/src/strava/strava-detail.service.ts:92` (transform), `api/src/strava/strava-detail.service.ts:174` (json source), `api/src/strava/strava-detail-transform.ts:67-74`

`fetchStrava` collapses an unparseable body to `null`:
```ts
const json: unknown = await res.json().catch(() => null);   // line 174
return { ok: res.ok, status: res.status, json };
```
On a **2xx response whose body is not JSON** (empty body, `204`, a Strava/edge maintenance or Cloudflare HTML page served with a 200/`text/html`), `res.json()` rejects → `json = null` while `ok = true`. `hydrate` then skips both `!detailResult` and `!detailResult.ok` guards and calls:
```ts
const detail = whitelistDetail(detailResult.json as StravaDetailRaw);  // line 92 — whitelistDetail(null)
```
`whitelistDetail(null)` dereferences `raw.description` on `null` → `TypeError`. This throw is **outside any try/catch** in `hydrate`/`getDetail`, and there is **no global Nest exception filter** (confirmed: no `APP_FILTER`/`ExceptionFilter`/`useGlobalFilters` in `api/src`). Result: **HTTP 500**, directly violating red-team guarantee #2 ("EVERY Strava fetch wrapped … thrown/network → reason:'error' NO write").

The fetches ARE wrapped; the gap is the **post-fetch transform on a successful-but-unparseable body**. The streams path is safe (a `null` streams body flows to `downsampleStreams(null)` → `null`), so only the **detail** path 500s. The unit suite never exercises a 200-with-`null`-json detail body (every success test uses `fetchResponse(200, detailRaw)`), so this is a genuine untested gap.

Also covered by the same class: a 200 body where `splits_metric` is a truthy non-array would make `(raw.splits_metric ?? []).map(...)` throw (line 73). Unlikely from Strava, but the fix below closes it too.

**Failure scenario:** Strava edge returns a 200 HTML maintenance page (or empty body) during an incident → user opens any un-cached activity → 500 instead of the graceful `reason:'error'` retry card.

**Fix (either):**
- Guard the body right after the `!detailResult.ok` check:
```ts
if (detailResult.json === null || typeof detailResult.json !== 'object') {
  this.logger.warn(`Detail body unparseable id=${activity.id}`);
  return this.errorResponse(activity, 'error');
}
```
- Or wrap the transform+write block (lines 92-100) in try/catch mapping any throw to `errorResponse(activity, 'error')`. The transform guard is preferred (also self-documents the invariant). Add a spec: `fetchResponse(200, null)` on the detail fetch → `reason:'error'`, no upsert.

### H2 — Webhook athlete-deauth path leaves `StravaActivityDetail` orphaned (re-opens red-team fix #1's data-deletion + resurrection intent)
**File:** `api/src/strava/strava-webhook.service.ts:195-209` (`handleAthleteDeauth`)

`disconnect()` was hardened to purge the detail cache (`strava.service.ts:168 stravaActivityDetail.deleteMany({ where: { userId } })`). The **webhook deauth path is not**:
```ts
await this.prisma.$transaction([
  this.prisma.stravaActivity.deleteMany({ where: { userId: conn.userId } }),
  this.prisma.stravaConnection.delete({ where: { userId: conn.userId } }),
]);
// StravaActivityDetail rows for this user are NOT deleted
```
The `StravaActivityDetail` FK cascades on **User** delete only — neither `StravaConnection` nor `StravaActivity` deletion cascades to it, and there is no FK from `StravaActivityDetail.stravaActivityId` → `StravaActivity`. When an athlete revokes access on Strava's side (a legitimate, destructive data-deletion trigger — same H6c intent as disconnect), their heart-rate time-series + free-text `description` (health data + PII) **remain in the DB**.

Two concrete consequences:
1. **Data-deletion/privacy:** user revoked access expecting purge; HR streams/description persist (until 30d TTL or a later `disconnect`, which may never happen since the connection is already gone).
2. **Stale resurrection:** if the same user reconnects (same `userId`, same `stravaAthleteId`) and re-syncs the same `stravaActivityId` within 30d, `findFirst({stravaActivityId, userId})` returns the **pre-deauth** cached row and serves it without re-fetching — exactly the resurrection red-team fix #1 set out to prevent, just on the sibling path.

Not a cross-user leak (rows stay `userId`-scoped, and the endpoint 404s once the `StravaActivity` row is gone), so not Critical — but it is a destructive-path retention bug on health PII that the codebase explicitly guards elsewhere.

**Fix:** add the purge to the same transaction:
```ts
await this.prisma.$transaction([
  this.prisma.stravaActivity.deleteMany({ where: { userId: conn.userId } }),
  this.prisma.stravaActivityDetail.deleteMany({ where: { userId: conn.userId } }),
  this.prisma.stravaConnection.delete({ where: { userId: conn.userId } }),
]);
```
Add a spec asserting `stravaActivityDetail.deleteMany` is called on deauth.

---

## MEDIUM

### M1 — FE hook: shared `cancelledRef` is reset on `id` change → slow stale response overwrites the new activity
**File:** `src/hooks/use-strava-activity-detail.ts:25,38,56-62`

`cancelledRef` is a single ref shared across renders. On an in-place `id` change (navigating `/activities/A` → `/activities/B` while `ActivityDetailPage` stays mounted), React runs cleanup (`cancelledRef.current = true`) then the new effect (`cancelledRef.current = false`). Both the old (A) and new (B) in-flight fetches then observe `cancelledRef.current === false`, so **neither is actually cancelled** — the last one to resolve wins. Because a cold/un-hydrated detail can take up to the 10 s fetch timeout, an A→B navigation where A resolves last renders **activity A's header/stats/MAF on URL `/activities/B`**.

Same-user, so no security impact — a correctness/UX bug that shows the wrong activity. Unmount is handled correctly (only in-place id-change breaks).

**Fix:** gate state updates per effect-run instead of via a reset shared ref, e.g. capture a local flag and pass it into the fetch, or compare the resolved id against the current `id`:
```ts
useEffect(() => {
  let active = true;
  (async () => {
    const result = await getStravaActivityDetail(id);
    if (!active) return;
    /* setState */
  })();
  return () => { active = false; };
}, [id]);
```
Keep `refetch` by bumping a `reloadKey` state in the dep array rather than calling `fetchDetail` directly.

---

## LOW

### L1 — Streams rate-limit/5xx surfaces as "no heart-rate data" instead of a transient hint
**File:** `strava-detail.service.ts:88-100` + `activity-detail-sections.tsx:67-74`

When the detail fetch succeeds but the **streams** fetch is 429/5xx/thrown (`missing:true`), the response is `{ detail, streams:null, hydrated:true }` with **no `reason`**. The FE (`streams ? … : <NoHrNotice/>`) then tells the user "hoạt động này không có dữ liệu nhịp tim" — misleading when it was actually rate-limited/transient. Self-heals on next open. Low. Optional: thread a `streamsReason` through so the FE can show a "try again shortly" hint for transient streams failures.

### L2 — Transient streams failure re-fetches the (already-successful) detail on every open
**File:** `strava-detail.service.ts:95-100`

On `missing:true` no row is written, so the next open is a full cache-miss that re-fetches **both** detail and streams. Intended ("retry next open"), but it doubles Strava detail calls on every retry until streams succeed, against the shared rate quota. Acceptable for v1; if quota pressure appears, consider caching detail-only and re-attempting streams separately.

### L3 — Cross-user `stravaActivityId` collision causes cache thrash (no leak)
**File:** `strava-detail.service.ts:59-66,133-147`; unique index on `stravaActivityId` alone (`migration.sql:19`)

If the same Strava athlete is connected to two app accounts (both hold a `StravaActivity` with the same `stravaActivityId`), the single-column unique constraint means one detail row is repeatedly reassigned between users (`upsert where:{stravaActivityId}` flips `userId`; each user's `findFirst({stravaActivityId, userId})` then misses and re-hydrates). No data leak — reads stay `userId`-scoped and each hydrate uses the requester's own token — but wasted Strava calls. Very unlikely; documented here for completeness. If it ever matters, make the unique key composite `(stravaActivityId, userId)`.

---

## Red-team fix verification (per item)

1. **Cross-user cache safety** — PRESENT (with sibling gap H2). `findFirst({stravaActivityId, userId})` scoped ✓ (`detail.service.ts:59`); model `user … onDelete: Cascade` ✓ (`schema.prisma`, `migration.sql:25`); `disconnect()` `stravaActivityDetail.deleteMany({userId})` ✓ (`strava.service.ts:168`). The three enumerated mechanisms all hold — but the webhook-deauth path does NOT purge (see **H2**).
2. **No-500 guarantee** — **FAILED.** Fetches are wrapped, but a 200-with-null/HTML body throws in `whitelistDetail(null)` outside try/catch → 500. See **H1**.
3. **Concurrency (P2002)** — PRESENT/correct. `writeCache` try/catch → `isUniqueConstraintError` → re-read `findFirst({stravaActivityId, userId})` (`detail.service.ts:132-147`); non-P2002 errors return `null` → serve fresh (no 500). Tested.
4. **Streams transient vs genuine-absent** — PRESENT/correct. `readStreams`: `null`(thrown)/429/5xx → `missing:true` (no write); `404` → `missing:false` (row written, streams null) (`detail.service.ts:104-117`). Tested for all tiers.
5. **Injection** — PRESENT/correct. `/^\d+$/` guard (`detail.service.ts:55`) AND `encodeURIComponent` (`:77`) before URL interpolation.
6. **Cache-Control + throttle** — PRESENT/correct. `res.set('Cache-Control','private, no-store')` (`controller.ts:164`); `@Throttle({default:{limit:30,ttl:60000}})` (`:158`).
7. **TTL 30d** — PRESENT/correct. `CACHE_TTL_MS = 30d`; `Date.now() - fetchedAt < TTL` → fresh (`detail.service.ts:19,62`). Tested (31d re-hydrates).
8. **Whitelist** — PRESENT/correct. Response carries only `{description, deviceName, gearName, calories, splitsMetric}` — no raw blob/tokens/polyline/laps (`strava-detail-transform.ts:67-75`). `calories = raw.calories` (kcal), documented distinct from summary-row kJ.
9. **Downsample shortest-common-length before striding** — PRESENT/correct. `commonLength = Math.min(present lengths)`, stride over `commonLength`, `src[i]` always in-bounds → no interior `undefined`/`NaN` (`strava-detail-transform.ts:120-149`). Tested (dropped-strap case).
10. **FE hardening** — PRESENT/correct. HR chart gated on `streams.heartrate?.length` (`hr-chart.tsx:48`); description plain text `whitespace-pre-wrap`, no `dangerouslySetInnerHTML` (`activity-detail-sections.tsx:55`); external Strava link `rel="noopener noreferrer"` (`activity-detail-header.tsx:34`); Calo tile uses `detailCalories` not `activity.calories` (`activity-stats-grid.tsx:83`, page passes `data.detail?.calories`); `rate_limited` retry `disableRetry` (`degradation-notices.tsx:18-21`); below-MAF verdict neutral (maf-violet), only above is maf-red (`maf-verdict-card.tsx:19-23`).
11. **MAF math never NaN/Infinity** — PRESENT/correct. `verdict` null on `avgHr==null || zone.upper<=0`, `deltaBpm>=0`; `timeInZone` null on empty/`totalSec<=0`, gap-cap `dt>30` + `undefined`/`NaN` skip; `cardiacDrift` gap-cap + `speed>0.5` moving filter, `ef1===0` guard + `Number.isFinite`; `aerobicEfficiency` null on `!avgHr`/`avgHr<=0`/`avgSpeed==null` (`maf-activity-analysis.ts`).

**Score: 10/11 present-and-correct** (#2 failed; #1 present but see H2).

---

## Also-checked (clean)

- **IDOR / ownership:** `controller.getActivityDetail` → `getActivity(userId, id)` → `findFirst({id, userId})` → 404 if not owned; hydration is scoped to that activity + userId. No IDOR.
- **Prisma Json null handling:** `toJsonInput` uses `Prisma.DbNull` for null streams (SQL NULL) and reads back `?? null` — correct. `detailJson` is always a whitelisted object (never null when written).
- **Token errors:** `getValidAccessToken` throw is caught in `hydrate` → `reason:'error'`. Correct.
- **N+1:** none — one `findFirst`, then bounded token/2 fetch/1 upsert per request.
- **Cache-Control on 404 path:** header set before the `NotFoundException` throw; harmless (404 body carries no sensitive data).
- **React cleanup on unmount:** correct (only the in-place id-change case is racy — M1).
- **`format-strava-activity` / `splits-table` formatters:** divide-by-zero and non-finite guarded, em-dash fallbacks. Clean.

## Unresolved questions

1. Is the same Strava athlete ever legitimately connected to two app accounts? If never, L3 is moot; if possible, prefer a composite unique key.
2. Confirm intended behavior on athlete-deauth: should detail cache be purged immediately (H2 fix) — assumed yes to match `disconnect()` and the H6c data-deletion intent.
