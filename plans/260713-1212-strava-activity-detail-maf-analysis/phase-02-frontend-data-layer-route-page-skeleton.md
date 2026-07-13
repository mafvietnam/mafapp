# Phase 02 — Frontend: Data Layer, Route, Page Skeleton + Stats Grid

## Context Links
- Depends on phase-01 endpoint contract `{ activity, detail, streams, hydrated, reason? }`.
- Existing patterns: `src/services/strava-service.ts` (api client + types), `src/hooks/use-strava-activities.ts` (fetch hook, never-throws), `src/app.tsx` (routes ~line 170-181), `src/pages/dashboard-page.tsx` (mafHr via `useUserProfile`+`useMafCalculator`), `src/utils/format-strava-activity.ts` (formatters, reuse), `src/components/strava-logo.tsx` (`PoweredByStrava`).

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Add typed service fn + hook + route + lazy-loaded detail page. Page renders header + full stats grid from the summary `activity` alone, so it works even when `hydrated:false`. MAF analysis + charts land in phase-04.

## Key Insights
- `getStravaActivities` already returns `StravaActivity`; reuse that interface. Add detail/stream/response types alongside.
- Follow the never-throws hook contract from `use-strava-activities.ts`: null response → `error:true`, no exceptions.
- MAF zone: replicate dashboard exactly — `const { userProfile } = useUserProfile(); const mafHr = useMafCalculator().calculateRawMaf(userProfile);` (ceiling). Lower = `mafHr - 10`. Pass a `zone = { lower: mafHr-10, upper: mafHr }` down. Do NOT invent a new calc.
- **Lazy-load the page** via `React.lazy` (recharts is heavy, added phase-04) — wrap route element in `<Suspense fallback={spinner}>`.
- Route lives inside `ProtectedRoute` → `AppLayout` (same block as `/dashboard`).
- `useParams<{ id: string }>()` — id is internal DB cuid (from `activity.id`, the Link target).

## Requirements
### Functional
- `getStravaActivityDetail(id)` → `StravaActivityDetailResponse | null` (null on network/HTTP error).
- `useStravaActivityDetail(id)` → `{ data, loading, error, refetch }`. `refetch` re-calls endpoint (for the hydrated:false retry button in phase-04).
- Route `/activities/:id` renders page; unknown/other-user id (endpoint 404 → service null) → error state with "back to dashboard".
- Page skeleton shows: header (name, date, type, "Xem trên Strava" link, `PoweredByStrava`) + full stats grid (distance, moving/elapsed time, pace, avg/max HR, elevation, calories, avg/max speed) computed from `activity` summary — renders regardless of `hydrated`.
### Non-functional
- Vietnamese copy. Dark theme (glass-card / desktop-card classes, maf-red/maf-violet). Each component <200 LOC. No new deps this phase (recharts deferred to phase-04).

## Architecture / Data flow
```
Link(to=`/activities/${activity.id}`)
  → ActivityDetailPage: id=useParams; { data, loading, error, refetch }=useStravaActivityDetail(id)
    mafHr = calculateRawMaf(userProfile); zone={lower:mafHr-10, upper:mafHr}
    loading → <DetailSkeleton/>;  error||!data → <DetailErrorState/>
    else → <ActivityDetailHeader activity=data.activity/>
           <ActivityStatsGrid activity=data.activity/>
           {/* phase-04 slots: verdict, time-in-zone, chart, splits, drift, degradation (rendered via <ActivityDetailSections/>) */}
```

## Related Code Files
### Create
- `src/hooks/use-strava-activity-detail.ts`
- `src/pages/activity-detail-page.tsx`
- `src/components/activity-detail/activity-detail-header.tsx` (name/date/type + Strava link + PoweredByStrava)
- `src/components/activity-detail/activity-stats-grid.tsx` (summary stats, reuse `formatPace`/`formatDistanceKm`/`formatActivityDate`)
- `src/components/activity-detail/detail-states.tsx` (loading skeleton + error state; small, shared)
### Modify
- `src/services/strava-service.ts` — add types + `getStravaActivityDetail(id)`
- `src/app.tsx` — import `React.lazy(() => import('./pages/activity-detail-page'))`; add `<Route path="/activities/:id" element={<Suspense fallback={...}><ActivityDetailPage/></Suspense>} />` inside AppLayout block
### Delete
- none

## Implementation Steps
1. **Types** in `strava-service.ts` (append; keep snake_case inside split/lap items to match backend passthrough):
   ```ts
   export interface StravaSplitMetric { distance: number; elapsed_time: number; elevation_difference: number; moving_time: number; split: number; average_speed: number; average_heartrate?: number; pace_zone?: number; }
   // NOTE: `laps` dropped for v1 (red-team scope — auto-laps ≈ splitsMetric). `calories` here = real kcal (summary activity.calories is kJ).
   export interface StravaActivityDetailData { description: string | null; deviceName: string | null; gearName: string | null; calories: number | null; splitsMetric: StravaSplitMetric[]; }
   export interface StravaStreams { time: number[]; heartrate?: number[]; velocitySmooth?: number[]; altitude?: number[]; distance?: number[]; }
   export interface StravaActivityDetailResponse { activity: StravaActivity; detail: StravaActivityDetailData | null; streams: StravaStreams | null; hydrated: boolean; reason?: 'deleted' | 'unauthorized' | 'rate_limited' | 'error'; }
   ```
2. **Service fn** `getStravaActivityDetail(id: string): Promise<StravaActivityDetailResponse | null>` — mirror `getStravaActivities` (try/catch, `res.ok` guard, return json | null). Path `/strava/activities/${id}/detail`.
3. **Hook** `use-strava-activity-detail.ts` — mirror `use-strava-activities.ts` but keyed on `id` in deps, plus a `refetch` callback (extract fetch into a `useCallback`, call in `useEffect` + expose). Guard against unmounted `setState` (cancelled flag). Return `{ data, loading, error, refetch }`.
4. **Header** `activity-detail-header.tsx` — props `{ activity }`. Show `activity.name`, `formatActivityDate(activity.startDate)`, `activity.type`. "Xem trên Strava" anchor → `https://www.strava.com/activities/${activity.stravaActivityId}` (target=_blank, rel=noopener) with `<StravaLogo/>`. Add `<PoweredByStrava/>` (Strava API compliance). Back link → `/dashboard`.
5. **Stats grid** `activity-stats-grid.tsx` — props `{ activity, detailCalories? }`. Tiles: Khoảng cách (`formatDistanceKm`), Thời gian chạy (movingTime), Tổng thời gian (elapsedTime), Pace TB (`formatPace(activity)`), Nhịp tim TB/Max, Độ cao (totalElevationGain m), Calo, Tốc độ TB/Max. **Calo tile:** use `detailCalories` (real kcal from detail endpoint, passed by phase-04 when hydrated); do NOT use `activity.calories` (that column is kilojoules — see phase-01/phase-04). Show "—" until hydrated or if null. Format seconds→`h:mm:ss` via a local helper (or add `formatDuration` to `format-strava-activity.ts` — reuse if you add it). Show "—" for null.
6. **States** `detail-states.tsx` — `DetailSkeleton` (spinner, matches dashboard loader) + `DetailErrorState` (message + back-to-dashboard link).
7. **Page** `activity-detail-page.tsx` — `default export`. `useParams`, hook, mafHr calc, branch loading/error/data. Compose header + stats grid inside AppLayout content width (reuse dashboard container classes `max-w-[1440px] mx-auto px-4/px-8`). Leave clearly-commented slots for phase-04 sections.
8. **Route** in `app.tsx` — add lazy import near top-level imports; add route inside the `<Route element={<AppLayout/>}>` block. Wrap element in `<Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-maf-violet border-t-transparent rounded-full animate-spin"/></div>}>`.
9. **Compile**:
   ```bash
   npm run lint
   npx tsc --noEmit
   ```

## Todo List
- [ ] Add detail/stream/response types to `strava-service.ts`
- [ ] Add `getStravaActivityDetail(id)` service fn
- [ ] Create `use-strava-activity-detail.ts` hook with `refetch`
- [ ] Create header, stats-grid, detail-states components
- [ ] Create `activity-detail-page.tsx` with phase-04 slots
- [ ] Wire lazy route `/activities/:id` in `app.tsx`
- [ ] `npm run lint` + `npx tsc --noEmit` clean

## Success Criteria
- Navigating `/activities/<valid-id>` shows header + full stats from summary, even if `hydrated:false`.
- Invalid/other-user id → graceful error state (no crash, no console error).
- Page chunk lazy-loads (separate Vite chunk); dashboard bundle unaffected.
- No TS/lint errors; existing dashboard + tests untouched.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Double-fetch on id change / StrictMode | Med | Low | cancelled flag + id in deps (matches existing hook) |
| `useUserProfile` not populated (no profile) → mafHr null | Med | Med | Guard `mafHr>0` before MAF sections; stats grid independent of mafHr |
| Suspense fallback flashes on fast cache hits | Low | Low | Acceptable; spinner matches app style |
| AppLayout width/padding mismatch mobile vs desktop | Low | Low | Reuse dashboard container classes |

## Security Considerations
- Route inside `ProtectedRoute` (auth required) — same guard as dashboard.
- Service relies on backend ownership check; never trust id client-side.
- External Strava link uses `rel="noopener noreferrer"`.

## Next Steps
- Provides page skeleton + typed data for phase-04 (MAF sections plug into slots).
- Dashboard Link click-targets added in phase-04 (they route here).
</content>
