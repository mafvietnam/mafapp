# Brainstorm: Strava Activity Detail + MAF Analysis

**Date:** 2026-07-13 | **Mode:** autonomous (goal hook) | **Status:** decided

## Problem

Strava history synced (summary only). User clicks activity → needs full detail view + MAF-focused analysis. Current state:
- DB `StravaActivity`: summary fields only (no HR streams, splits, laps, polyline)
- Backend: NestJS, `GET /strava/activities` + `GET /strava/activities/:id` exist (summary), token refresh via `strava-token.service.ts`, sync engine works
- Frontend: React 19 + RRD 7 + Tailwind + lucide, NO chart lib. Dashboard `ActivitySection` (mobile cards + desktop table) already receives `mafHr` prop. MAF calc client-side in `maf-calculator-orchestrator.ts` (mafHeartRate, upperZone, lowerZone from age + health factors)
- Strava API limits: 100 req/15min, 1000/day (app-level)

## Evaluated Approaches

### D1: How to get detailed data (streams/splits/laps)
| Option | Verdict |
|---|---|
| A. On-demand fetch + DB cache (lazy hydration) | ✅ CHOSEN |
| B. Prefetch all at sync time | ❌ 200 activities × 2 calls = 400 req, blows 100/15min; most never viewed |
| C. Pure proxy, no cache | ❌ repeat views burn quota, slow, breaks if disconnected |

A: first open → backend calls Strava `GET /activities/{id}` (splits_metric, laps, description, gear, device_name, calories) + `GET /activities/{id}/streams?keys=time,heartrate,velocity_smooth,altitude,distance&key_by_type=true` → store in new table → subsequent opens served from DB. Cost: 2 calls per activity lifetime. Rate-limit safe.

### D2: Where to store
New table `StravaActivityDetail` (1-1 with StravaActivity, JSONB `detailJson` + `streamsJson`, `fetchedAt`). Separate table keeps list queries lean vs adding JSONB columns to main table. ✅

### D3: Where to compute MAF analysis
Client-side. Rationale: MAF HR depends on profile (age/health) which changes over time — precomputed server-side values go stale. Backend serves raw cached data; frontend computes zone stats with current mafHr. Streams downsampled server-side at cache time to ≤1000 points (stride sampling, keep time deltas) — time-in-zone error <2%, acceptable.

### D4: UI shape
Route `/activities/:id` full page (inside ProtectedRoute + AppLayout) vs modal. ✅ Page: deep-linkable, chart space, mobile-first. Click targets: mobile card + desktop table row → `<Link>`.

### D5: Charts
recharts vs hand-rolled SVG. ✅ recharts (~40KB gz): correct-by-default, fast to build, tree-shakes. Hand-rolled = higher bug risk for autonomous pipeline.

### D6: Map
❌ Defer (YAGNI). Not MAF-relevant, adds leaflet + external tiles. Polyline NOT stored v1.

## Final Solution

### Backend
1. Prisma: add `StravaActivityDetail` model + migration
2. New service `strava-detail.service.ts`: hydrate logic (fetch detail + streams from Strava, downsample streams, upsert cache). Reuse `StravaTokenService` for auth. Handle: 404 from Strava (activity deleted), 401 (token revoked), 429 (rate limited) → return summary + `hydrated:false` + reason, never 500
3. Endpoint `GET /strava/activities/:id/detail` (JwtAuthGuard, throttle 10/min) → `{ activity, detail, streams, hydrated, reason? }`

### Frontend
1. Route `/activities/:id` → `activity-detail-page.tsx`
2. Sections (all MAF-first):
   - Header: name, date, type, "Xem trên Strava" link (API compliance)
   - MAF verdict card: avgHR vs zone (in/below/above + delta bpm)
   - Time-in-zone bar: % below/in/above MAF band (from HR stream, colored)
   - HR-over-time chart (recharts) with MAF zone band overlay
   - Splits table: per-km pace + avg HR + MAF flag per split (splits_metric has average_heartrate)
   - Cardiac drift card: 1st-half vs 2nd-half pace:HR decoupling % (aerobic fitness indicator, key MAF metric)
   - Aerobic efficiency: speed-per-beat ratio
   - Full stats grid: distance, moving/elapsed time, pace, HR avg/max, elevation, calories, speeds
   - Laps (collapsible, if >1)
3. Graceful degradation: no HR monitor → hide HR analyses, show notice; hydration failed → summary + retry button
4. New utils: `maf-activity-analysis.ts` (time-in-zone, drift, efficiency — pure functions + vitest tests)

### Data shapes
- `detailJson`: `{ description, deviceName, gearName, calories, splitsMetric[], laps[] }` (whitelisted fields only, not raw Strava blob)
- `streamsJson`: `{ time[], heartrate[], velocitySmooth[], altitude[], distance[] }` downsampled ≤1000 pts

## Risks
| Risk | Mitigation |
|---|---|
| Strava rate limit during E2E burst | cache-first; throttle endpoint; E2E hits ≤5 activities |
| Streams missing (no HR strap, manual activity) | tiered degradation Tier1 summary-only analyses |
| Token revoked mid-flow | hydrated:false + reason, UI notice + summary view |
| Large runs (ultra 10h = 36k pts) | server downsample cap 1000 pts |
| recharts bundle | lazy-load detail page via React.lazy |

## Success Metrics
- Click any activity → detail page <2s first load (hydration), instant cached
- MAF verdict + time-in-zone + HR chart render with real synced data on prod
- Zero 500s for edge cases (no-HR, deleted, revoked)
- All existing tests + new unit tests pass; E2E on prod passes

## Next Steps
→ `/ck:plan` → red-team → validate → `/ck:cook --auto` → tony-ship deploy → prod E2E → fix/redeploy loop

## Unresolved Questions
- None blocking. Deferred: map view, MAF pace trend across activities (future dashboard feature), Garmin detail parity.
