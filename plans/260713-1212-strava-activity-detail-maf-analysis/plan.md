---
title: "Strava Activity Detail Page with MAF Analysis"
description: "Lazy-hydrated Strava detail cache + full activity page with MAF zone, HR chart, splits, cardiac drift."
status: pending
priority: P2
effort: 15h
branch: dev
tags: [strava, maf, frontend, backend, prisma, recharts]
created: 2026-07-13
---

# Strava Activity Detail Page with MAF Analysis

Click any synced Strava activity → full detail page with MAF-first analysis (verdict, time-in-zone,
HR-over-time chart, per-km splits, cardiac drift, aerobic efficiency). Detailed data (streams, splits,
laps) fetched from Strava on first open and cached in a new `StravaActivityDetail` table (lazy hydration,
2 API calls per activity lifetime). MAF zone computed client-side (profile-dependent, must stay live).

## Architecture (decided — see brainstorm report; hardened by red-team below)
- **Backend**: new `StravaActivityDetail` Prisma model (1-1 via `stravaActivityId`, `user` FK cascade);
  `strava-detail.service.ts` hydrates on first request, downsamples streams ≤1000 pts, upserts cache;
  `GET /strava/activities/:id/detail` (JwtAuthGuard, throttle 30/min, ownership-checked, userId-scoped cache
  read, `Cache-Control: private, no-store`). Error tiers + thrown timeout/network + P2002 → `hydrated:false +
  reason`, never 500. `disconnect()` purges detail rows. 30d `fetchedAt` TTL.
- **Frontend**: lazy route `/activities/:id` inside ProtectedRoute+AppLayout; `recharts@^3` (React 19 native);
  pure `maf-activity-analysis.ts` utils; Vietnamese UI, dark maf-red/maf-violet theme.

Detailed data (streams, splits) fetched from Strava on first open and cached in a new `StravaActivityDetail`
table (lazy hydration, ~2 API calls per activity once, TTL-bounded). MAF zone computed client-side
(profile-dependent, must stay live). `laps` cut for v1 (≈ splits).

## Data flow
`click Link` → `/activities/:id` → `use-strava-activity-detail(id)` → `GET .../detail`
→ [userId-scoped cache hit within TTL? serve : fetch Strava detail+streams → whitelist+downsample → upsert → serve]
→ page computes MAF zone from live profile (`calculateRawMaf`) → renders analysis or degradation state.

## Phases
| # | File | Scope | Status |
|---|------|-------|--------|
| 01 | [phase-01-backend-detail-service-endpoint.md](phase-01-backend-detail-service-endpoint.md) | DB migration + detail service + endpoint + unit tests | pending |
| 02 | [phase-02-frontend-data-layer-route-page-skeleton.md](phase-02-frontend-data-layer-route-page-skeleton.md) | service fn, hook, types, route, page skeleton + stats grid | pending |
| 03 | [phase-03-maf-analysis-utils.md](phase-03-maf-analysis-utils.md) | pure MAF analysis utils + vitest | pending |
| 04 | [phase-04-maf-ui-components-degradation.md](phase-04-maf-ui-components-degradation.md) | MAF UI components + degradation + dashboard Links | pending |
| 05 | [phase-05-local-verification.md](phase-05-local-verification.md) | lint, tsc, vitest, api build+tests, manual smoke | pending |
| 06 | [phase-06-prod-deploy-e2e.md](phase-06-prod-deploy-e2e.md) | VPS deploy + prisma migrate deploy + prod E2E + fix loop | pending |

## Key dependencies
- 01 blocks 02 (endpoint contract). 03 independent of 01/02 (pure utils, can run parallel).
- 04 needs 02 (page skeleton, types) + 03 (analysis utils). 05 needs 01-04. 06 needs 05 green.
- MAF zone source: `useMafCalculator().calculateRawMaf(userProfile)` = MAF ceiling (upper);
  lower = ceiling − 10. Zone `[mafHr−10, mafHr]`. This is a RICHER 3-state model than dashboard `hrZone`
  (which only flags `avgHr > mafHr`); `below` state is informational, not a warning. Do NOT claim parity.

## Out of scope (deferred — YAGNI)
- Map / route polyline view (not MAF-relevant; polyline NOT stored v1).
- MAF pace trend chart across activities (future dashboard feature).
- Garmin activity detail parity.
- Laps section (≈ splits — cut in red-team).
- App-global Strava-quota token bucket (user base connection-capped; per-user throttle + cache + transient-no-write bound blast radius).

## Assumptions (Strava API shapes — validated in brainstorm, verify on first real hydration)
- `splits_metric[]` item: `{ distance, elapsed_time, elevation_difference, moving_time, split, average_speed, average_heartrate?, pace_zone }`
- streams `key_by_type=true` → `{ time:{data:[]}, heartrate:{data:[]}, velocity_smooth:{data:[]}, altitude:{data:[]}, distance:{data:[]} }` — arrays may differ in length (dropped HR strap) → truncate to shortest common length.
- OAuth scope granted `read,activity:read_all` (verified) → private/manual readable; 401/403 = genuine token-revoked.
- Rate limits: 100 read/15min, 1000/day (app-level, shared). Per-user `@Throttle` does NOT protect this — cache-first + transient-no-write + retry-cooldown + ≤5-activity E2E keep it safe.

## Red Team Review

### Session — 2026-07-13
**Findings:** 22 raw across 4 hostile lenses (Security, Failure Mode, Assumption Destroyer, Scope Critic) → deduped to 18 distinct. **15 accepted, 3 rejected.**
**Severity:** 3 Critical, 6 High, 9 Medium.

| # | Finding | Sev | Disposition | Applied To |
|---|---------|-----|-------------|------------|
| 1 | Cross-user cache leak — unscoped read + no cascade + disconnect no purge | Crit | Accept | Ph01 (userId-scoped read, `user` cascade, disconnect purge) |
| 2 | Thrown timeout/network bypasses status tiers → 500 (no global filter) | Crit | Accept | Ph01 (try/catch every fetch → reason:error) |
| 3 | Concurrent first-open → P2002 → 500 | Crit | Accept | Ph01 (try/catch upsert → re-read) |
| 4 | Streams transient 429/5xx permanently caches streams:null | High | Accept | Ph01 (404=absent vs transient=no-write) |
| 5 | Deploy serves new code before migration → 500 storm | High | Accept | Ph06 (`run --rm migrate deploy` before `up -d`) |
| 6 | Migration rename-after-apply desyncs Prisma history | High | Accept | Ph01 (`--create-only`→rename→apply) |
| 7 | recharts v2 + `--legacy-peer-deps` → blank chart under React 19 | High | Accept | Ph04 (pin `recharts@^3`, verify render) |
| 8 | Downsample assumes equal-length streams → NaN | High | Accept | Ph01 (truncate to shortest common length) |
| 9 | App-wide Strava quota exhaustible; retry hammering | High | Partial | Ph01/04 (transient-no-write + retry cooldown; app-bucket deferred) |
| 10 | `stravaActivityId` injected raw into Strava URL | Med | Accept | Ph01 (`/^\d+$/` guard + encodeURIComponent) |
| 11 | GET /detail no Cache-Control behind Cloudflare | Med | Accept | Ph01 (`private, no-store`) |
| 12 | No cache TTL — privatized/edited data served forever | Med | Accept | Ph01 (30d `fetchedAt` TTL) |
| 13 | pg_dump plaintext PII to /root, no cleanup | Med | Accept | Ph06 (-Fc, mode-600, off-tree, shred after) |
| 14 | Throttle 10/min blocks normal browsing → generic error | Med | Accept | Ph01 (raise to 30/min) |
| 15 | `calories` summary = kJ mislabeled "Calo" | Med | Accept | Ph01/02/04 (render detail.calories kcal) |
| 16 | "matches hrZone exactly" false — below state disagreement | Med | Accept | Ph03/plan (document 3-state; below=neutral) |
| 17 | Cardiac drift math spurious (stops/warmup/pause) | Med | Accept | Ph03 (moving-filter + gap-cap + "ước tính" label) |
| 18 | page >200 LOC (8 sections + 3 tiers) | Med | Accept | Ph04 (extract `<ActivityDetailSections/>`) |
| R1 | Cut the cache table entirely (premature) | — | **Reject** | Cache is correct for repeat views/offline; brainstorm-decided; fixed its bugs instead |
| R2 | Hand-roll SVG instead of recharts | — | **Reject** | recharts@^3 gives axes/tooltip/band correctly; one dep, lazy-chunked |
| R3 | Cut cardiac drift + aerobic efficiency (gold-plating) | — | **Reject** | Goal explicitly wants rich MAF analysis; kept WITH correctness guards (#17) |

Cut for scope (accepted from Scope Critic): `laps` section, `{gone:true}` sentinel persistence, per-trivial-tile file fragmentation.

## Validation Log

### Session — 2026-07-13 (autonomous — best-judgment, goal-constrained)
Interview skipped per active goal directive ("do not pause to ask user"); decisions derived from the goal
("đầy đủ thông tin và mọi thứ + phân tích theo maf") + red-team. All are reversible implementation choices.

| Decision point | Choice | Rationale |
|---|---|---|
| Cache TTL length | 30 days | Balances Strava-quota (rare re-fetch) vs privacy/edit freshness; low enough to reflect deletions within a month |
| Show "below MAF" state | Yes, informational (neutral color) | Goal wants full analysis; below-MAF is not a fault, only `above` warns |
| Keep cardiac drift + aerobic efficiency | Keep, labeled "ước tính" + moving-filter guards | Goal explicitly wants rich MAF analysis; guards address correctness concern |
| Chart lib | `recharts@^3` | React 19 native; axes/tooltip/band correct out-of-box; lazy-chunked |
| Deploy branch | `dev` (matches current + prior Strava deploys) | Consistent with repo's established prod flow from `dev` |
| App-global quota bucket | Deferred | User base connection-capped + small; per-user throttle + transient-no-write bound blast radius |

**Recommendation:** Proceed to implementation (`/ck:cook --auto`). No blocking unknowns.

