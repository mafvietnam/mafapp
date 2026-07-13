# Phase 03 — MAF Analysis Pure Utils + Vitest

## Context Links
- Existing test pattern: `src/utils/__tests__/*.test.ts` (vitest, `describe/it/expect`), `src/utils/format-strava-activity.ts` (pure-fn style + JSDoc).
- Consumes stream types from phase-02 (`StravaStreams`), but functions take plain arrays so they are dependency-free and testable standalone.

## Overview
- **Priority:** P1 (parallelizable with phase-01/02 — pure, no endpoint dependency)
- **Status:** pending
- **Description:** Pure, unit-tested functions computing the MAF metrics the UI renders: time-in-zone, cardiac drift (decoupling), aerobic efficiency, and MAF verdict. No React, no I/O.

## Key Insights
- **MAF zone convention (locked):** `zone = { lower: mafHr - 10, upper: mafHr }`. `avgHr <= upper && >= lower` = in zone; `> upper` = above (over-training); `< lower` = below. **NOTE [Red-team]: this is a RICHER 3-state model than dashboard `hrZone`** (`format-strava-activity.ts` only flags `avgHr > mafHr` = warn, no lower bound). So an easy run below `lower` shows emerald "OK" on the dashboard but "Dưới vùng MAF" here — intended. UI must present `below` as **informational/neutral (not a warning)** — running below MAF is fine, only `above` is the concern. Do NOT claim parity with `hrZone`.
- **Time-in-zone must weight by time deltas**, not sample count — Strava streams may have non-uniform `time[]` (esp. after downsample). Accumulate `dt = time[i] - time[i-1]` into buckets by `heartrate[i]`.
- **Cardiac drift (Pw:Hr decoupling)** = standard aerobic-fitness metric: split run into first/second half by elapsed time; efficiency factor `EF = meanSpeed / meanHr` per half; `drift% = (EF_first - EF_second) / EF_first * 100`. Positive = HR drifted up relative to pace (fatigue/heat) — key MAF signal. Needs `velocitySmooth` + `heartrate`.
  - **[Red-team correctness] Moving-samples only + gap cap.** Raw `velocity_smooth` includes stops (0 m/s at lights) and warmup; and Strava `time[]` includes paused time so a mid-run stop skews the midpoint split and time-weighting. Filter to moving samples (`speed > 0.5 m/s`) before computing EF; cap per-interval `dt` at a threshold (e.g. ignore `dt > 30s`, treating it as a pause) in `timeInZone` too. Label the metric in UI as **"ước tính" (approximate)** — it is directional, not clinical.
- Every function returns `null` when inputs insufficient (missing/empty streams, zero HR, <2 moving samples per half) — callers render degradation UI. Never throw.

## Requirements
### Functional — `src/utils/maf-activity-analysis.ts`
```ts
export interface MafZone { lower: number; upper: number; }
export interface TimeInZone { belowSec: number; inSec: number; aboveSec: number; belowPct: number; inPct: number; abovePct: number; totalSec: number; }
export type VerdictStatus = 'below' | 'in' | 'above';
export interface MafVerdict { status: VerdictStatus; deltaBpm: number; } // deltaBpm ≥0, distance from nearest zone edge (0 when in-zone)

/** Weight HR samples by time deltas into below/in/above MAF band buckets. Returns null if hr/time missing or empty. */
export function timeInZone(hr: number[] | undefined, time: number[] | undefined, zone: MafZone): TimeInZone | null;

/** Aerobic decoupling % (EF first-half vs second-half). Positive = drift. Null if speed/hr streams insufficient. */
export function cardiacDrift(speed: number[] | undefined, hr: number[] | undefined, time: number[] | undefined): number | null;

/** Meters covered per heartbeat-minute: (avgSpeed m/s * 60) / avgHr. Higher = more efficient. Null if avgHr≤0. */
export function aerobicEfficiency(avgSpeed: number | null, avgHr: number | null): number | null;

/** Compare avg HR to zone → status + delta bpm from nearest edge. Null if avgHr null or zone invalid (mafHr≤0). */
export function verdict(avgHr: number | null, zone: MafZone): MafVerdict | null;
```
### Non-functional
- File <200 LOC. Pure (no imports beyond types). JSDoc WHY-comments. 70%+ util coverage (project target).

## Architecture / Data flow
- UI passes `data.streams.heartrate/velocitySmooth/time` + `data.activity.avgSpeed/avgHeartRate` + `zone` → functions → render props. No state.
- `timeInZone`: iterate `i=1..n`, `dt=time[i]-time[i-1]`; **skip if `dt<=0` or `dt>GAP_CAP(30s)`** (auto-pause gap must not credit one HR sample a huge block); **skip if `hr[i]` is undefined/NaN**; classify `hr[i]` vs zone, accumulate; pct = bucket/total*100 (guard total=0). Backend guarantees aligned+truncated arrays; still defensively use `min(hr.length, time.length)` and the undefined-skip.
- `cardiacDrift`: need aligned `speed,hr,time`; **filter to moving samples (`speed[i] > 0.5`)** first; find `midTime` from the moving subset's elapsed midpoint; partition by `time[i] < midTime`; require ≥2 moving samples each half and mean speed/hr > 0; compute EF per half; return `(ef1-ef2)/ef1*100` rounded to 1 decimal.

## Related Code Files
### Create
- `src/utils/maf-activity-analysis.ts`
- `src/utils/__tests__/maf-activity-analysis.test.ts`
### Modify / Delete
- none

## Implementation Steps
1. Create `maf-activity-analysis.ts` with the 4 functions + interfaces above. Round percentages so `belowPct+inPct+abovePct` ≈ 100 (compute two, derive third, or round-and-adjust largest) to avoid 99.9/100.1 display drift.
2. `verdict`: `if (avgHr==null || zone.upper<=0) return null; if (avgHr>zone.upper) return {status:'above', deltaBpm: avgHr-zone.upper}; if (avgHr<zone.lower) return {status:'below', deltaBpm: zone.lower-avgHr}; return {status:'in', deltaBpm:0}`.
3. `aerobicEfficiency`: `if(!avgHr||avgHr<=0||avgSpeed==null) return null; return (avgSpeed*60)/avgHr` (round 2 decimals).
4. Create vitest test file. Cases:
   - **timeInZone**: uniform 1s samples all in-zone → inPct 100; mixed below/in/above with known dts → exact secs + pcts sum 100; non-uniform dt weighting; undefined/empty hr → null; mismatched lengths → uses min length.
   - **cardiacDrift**: constant EF both halves → ~0%; second-half HR higher → positive %; too few samples → null; zero speed → null; **asymmetric mid-run pause (block of 0 m/s + large dt gap in one half) does NOT distort the result** (moving-filter + gap handling); all-stopped stream → null.
   - **aerobicEfficiency**: known values (e.g. avgSpeed 2.5 m/s, avgHr 140 → 1.07); avgHr 0/null → null.
   - **verdict**: below/in/above boundaries (avgHr = lower, = upper exactly → in); avgHr null → null; mafHr 0 zone → null.
5. Run:
   ```bash
   npm test                 # vitest run — all pass
   npm run test:coverage    # confirm util covered ≥70%
   npx tsc --noEmit
   ```

## Todo List
- [ ] Create `maf-activity-analysis.ts` (4 pure fns + interfaces)
- [ ] Percentage rounding sums to 100
- [ ] Create `__tests__/maf-activity-analysis.test.ts` (all cases above)
- [ ] `npm test` green; coverage ≥70% for the util; `tsc --noEmit` clean

## Success Criteria
- All 4 functions covered incl. null/edge paths; vitest green.
- `timeInZone` percentages always sum to 100 (±0). Boundary HR (== lower / == upper) classified as in-zone.
- `cardiacDrift` returns null (not NaN/Infinity) for degenerate input.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Division by zero (avgHr 0, empty halves) | Med | Med | Explicit guards → null |
| NaN from undefined stream indices | Med | Med | Clamp to min length; skip undefined dt with `max(0,...)` |
| Percentage rounding drift (99.9%) | Med | Low | Derive third bucket / round-largest-remainder |
| Drift sign confusion (fatigue = which sign?) | Low | Low | JSDoc + test asserts positive when 2nd-half HR higher |

## Security Considerations
- None (pure client math, no I/O, no user-controlled code paths beyond numeric arrays).

## Next Steps
- Phase-04 imports these into verdict card, time-in-zone bar, drift card, efficiency stat.
</content>
