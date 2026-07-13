# Phase 02 — Journal analytics utils (pure, tested)

## Context links
- Brainstorm: `plans/reports/brainstorm-260713-1452-running-journal.md` (Frontend → analytics)
- Reuse: `src/utils/maf-activity-analysis.ts` (`verdict`, `aerobicEfficiency`, `MafZone`)
- Reuse/extend: `src/utils/format-strava-activity.ts` (`formatPace` internals)
- Type: `src/services/strava-service.ts` → `StravaActivity`
- Test conventions: `src/utils/__tests__/maf-activity-analysis.test.ts` (vitest)

## Overview
- **Priority:** P1 (blocks Phase 03)
- **Status:** pending
- Pure, unit-tested TS: weekly grouping, monthly summary, MAF trend series, 6-month fetch-window math. No React, no I/O. Reuse MAF verdict + efficiency — do NOT re-derive the formula.

## Key insights
- Week starts **MONDAY** (VN convention) — must be consistent in `groupByWeek` label AND bucket key AND trend bucketing.
- `%MAF` denominator = sessions **with HR only**; runs without HR excluded (not counted as failures). No-HR runs still count toward `totalKm` / `sessionCount`.
- `mafHr <= 0` (profile not configured) → `verdict()` already returns `null`; surface `inZonePct: null` so UI hides the metric rather than showing 0%.
- Numeric pace not currently exported — `formatPace` computes sec/km internally then formats. Extract that numeric step to `paceSecPerKm()` and have `formatPace` consume it (DRY, one pace formula).
- Split into two files to stay < 200 LOC each and separate pure date math from analytics.

## Requirements
**Functional**
- `groupByWeek(activities, mafHr)`: → `WeekGroup[]` sorted newest week first.
- `monthlySummary(activities, mafHr, now?)`: current-month km, session count, `%` verdict-`in`.
- `mafTrendSeries(activities, mafHr)`: per-week points — primary = avg pace (sec/km) of verdict-`in` runs; secondary = avg `aerobicEfficiency` of all runs with HR.
- `windowRange(now, index)`: `{ since, until }` ISO strings for the Nth back 6-month window (index 0 = most recent).
- `mondayOf(date)`, `weekRangeLabel(monday)` helpers (exported for test).

**Non-functional**
- Deterministic, null-safe (never NaN/Infinity). Each file < 200 LOC.

## Architecture
```
StravaActivity[]  ┌─ journal-date-utils.ts ─┐
       │          │ mondayOf, weekRangeLabel │
       │          │ windowRange              │
       ▼          └──────────┬───────────────┘
 journal-analytics.ts ◀──────┘  (+ verdict, aerobicEfficiency, paceSecPerKm)
   groupByWeek ──▶ WeekGroup[]  { weekStart, weekEnd, label, activities,
                                  totalKm, sessionCount, inZonePct }
   monthlySummary ──▶ { totalKm, sessionCount, inZonePct }
   mafTrendSeries ──▶ TrendPoint[] { weekStart, label, paceAtMaf, efficiency }
```
zone built inline `{ lower: mafHr - 10, upper: mafHr }` (matches `activity-detail-page.tsx:23`).

## Related code files
**Create**
- `src/utils/journal-date-utils.ts` — `mondayOf`, `weekRangeLabel`, `windowRange`.
- `src/utils/journal-analytics.ts` — `groupByWeek`, `monthlySummary`, `mafTrendSeries` + types.
- `src/utils/__tests__/journal-date-utils.test.ts`
- `src/utils/__tests__/journal-analytics.test.ts`

**Modify**
- `src/utils/format-strava-activity.ts` — export `paceSecPerKm(activity)`; refactor `formatPace` to call it.
- `src/utils/__tests__/format-strava-activity.test.ts` — add `paceSecPerKm` cases.

**Delete:** none.

## Implementation steps
1. **`format-strava-activity.ts`** — extract numeric pace:
   ```ts
   /** sec/km from avgPace (min/km) or movingTime/distance; null if underivable. */
   export function paceSecPerKm(a: Pick<StravaActivity,'avgPace'|'movingTime'|'distance'>): number | null {
     if (a.avgPace != null && a.avgPace > 0) return a.avgPace * 60;
     if (a.distance > 0 && a.movingTime > 0) return a.movingTime / (a.distance / 1000);
     return null;
   }
   ```
   Rewrite `formatPace` to `const secPerKm = paceSecPerKm(activity);` then keep existing null-guard + `m:ss /km` formatting. Behavior identical.
2. **`journal-date-utils.ts`**:
   - `mondayOf(d)`: clone, `getDay()` (Sun=0→treat as 7), subtract `(day===0?6:day-1)` days, zero the time → local Monday 00:00.
   - `weekRangeLabel(monday)`: `sunday = monday + 6d`; return ``${dd}/${M} – ${dd}/${M}`` (no leading-zero month, `dd` 2-digit). Use `getDate()`/`getMonth()+1`.
   - `windowRange(now, index)`: `until = subMonths(now, index*6)`; `since = subMonths(now, (index+1)*6)`; return ISO strings. `subMonths` via `new Date(y, m-6, d)`. index 0 `until` = `now` (include today). Half-open matches backend `gte/lt`.
3. **`journal-analytics.ts`**:
   - Types `WeekGroup`, `MonthlySummary`, `TrendPoint`.
   - Local `zoneOf(mafHr) = { lower: mafHr-10, upper: mafHr }` and `inPct(runs, mafHr)`: filter runs with `avgHeartRate != null` → denom; count `verdict(hr, zone)?.status === 'in'` → num; `denom === 0 ? null : Math.round(num/denom*100)`.
   - `groupByWeek`: bucket by `mondayOf(startDate).getTime()`; per bucket compute `totalKm = Σ distance/1000`, `sessionCount`, `inZonePct = inPct(...)`, `label = weekRangeLabel`; sort buckets by `weekStart` desc; sort activities within by `startDate` desc.
   - `monthlySummary`: filter to `now`'s calendar month+year; same aggregates over that slice.
   - `mafTrendSeries`: reuse week buckets; per week `paceAtMaf = avg(paceSecPerKm)` over verdict-`in` runs (null if none); `efficiency = avg(aerobicEfficiency(avgSpeed, avgHeartRate))` over runs with HR (null if none); output ascending by `weekStart` (chronological for chart), include a point only if it has ≥1 non-null series value.
4. **Tests**
   - **[RedTeam RT-6] Pin timezone for determinism:** week bucketing uses runtime-local getters on UTC `startDate`; a UTC CI runner flips week boundaries vs a VN dev machine. Add `TZ=UTC` to the vitest test env (or set at top of the date-utils spec) so `mondayOf` tests are reproducible in CI. Product rule: group by viewer-local time (all users are VN/UTC+7, consistent) — document this in the file header. `windowRange` tests pass a FIXED `now` (never `new Date()`); the hook owns the single-`now` capture (RT-3).
   - `journal-date-utils.test.ts`: `mondayOf` for a Wed/Sun/Mon input lands on correct Monday; `weekRangeLabel` format; `windowRange(now,0)` until==now & since 6mo back; index 1 tiles exactly onto index 0's `since`.
   - `journal-analytics.test.ts`: fixed `StravaActivity[]` fixtures →
     - grouping across a Mon boundary (Sun vs next Mon land in different weeks);
     - `totalKm`/`sessionCount` sums;
     - `inZonePct`: 2 in-zone of 3 HR runs + 1 no-HR run → 67 (no-HR excluded);
     - `mafHr<=0` → `inZonePct === null`;
     - `mafTrendSeries` primary only counts `in` runs, secondary counts all HR runs; week with no HR run → both null → point omitted.
   - `format-strava-activity.test.ts`: `paceSecPerKm` from `avgPace`, from movingTime/distance fallback, null when both missing.
5. **Verify:** `npx tsc --noEmit && npm test -- journal-analytics journal-date-utils format-strava-activity`.

## Todo
- [ ] `paceSecPerKm` extracted; `formatPace` refactored (no behavior change)
- [ ] `journal-date-utils.ts` (mondayOf/weekRangeLabel/windowRange)
- [ ] `journal-analytics.ts` (groupByWeek/monthlySummary/mafTrendSeries)
- [ ] 3 test files green; each source file < 200 LOC
- [ ] `tsc --noEmit` clean

## Success criteria
- Hand-summed weekly km/sessions match `groupByWeek` on fixtures.
- Monday-week boundary provably correct in tests.
- `%MAF` excludes no-HR runs; `null` when `mafHr<=0`.
- Trend omits empty weeks; chronological order.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Timezone drift on Monday calc | Med | Med | Use local-time getters consistently (dates from ISO → local); test with explicit dates |
| Duplicating MAF formula | Low | High | Reuse `verdict()`/`aerobicEfficiency()`; zone inline matches existing convention |
| `formatPace` regression from refactor | Low | Med | Keep formatting branch identical; existing `formatPace` tests must still pass |
| File > 200 LOC | Med | Low | Two-file split (date-utils vs analytics) |

## Security considerations
- Pure functions on already-authorized data (fetched under `JwtAuthGuard`). No I/O, no PII egress, no injection surface.

## Next steps
- Unblocks **Phase 03**: hook imports `windowRange`; page/components import grouping + summary + trend.
- Independent of Phase 01 (can build in parallel, but plan runs sequentially).
</content>
