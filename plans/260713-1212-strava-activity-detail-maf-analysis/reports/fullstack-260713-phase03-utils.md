# Phase 03 — MAF Analysis Utils + Vitest — Report

## Executed Phase
- Phase: phase-03-maf-analysis-utils
- Plan: D:\Data\Projects\app.maf.run\plans\260713-1212-strava-activity-detail-maf-analysis
- Status: completed

## Files Modified (created only, per file-ownership scope)
- `src/utils/maf-activity-analysis.ts` (185 LOC) — 4 pure fns (`timeInZone`, `cardiacDrift`, `aerobicEfficiency`, `verdict`) + interfaces (`MafZone`, `TimeInZone`, `VerdictStatus`, `MafVerdict`) + 2 private helpers (`distributePercentages`, `efficiencyFactor`).
- `src/utils/__tests__/maf-activity-analysis.test.ts` (28 tests) — all cases from phase spec.

No other files touched.

## Tasks Completed
- [x] `maf-activity-analysis.ts` — 4 pure fns + interfaces, no imports beyond own types
- [x] Percentage rounding: largest-remainder method, `belowPct+inPct+abovePct` always exactly 100 when total>0
- [x] `timeInZone`: time-weighted (dt-based), `min(hr.length,time.length)`, skips `dt<=0`/`dt>30` gap-cap, skips undefined/NaN hr, boundary (==lower/==upper) → in-zone
- [x] `cardiacDrift`: filters to moving samples (`speed>0.5`) first, gap-cap applied to interval selection, midpoint from moving subset's elapsed time (not wall-clock) so asymmetric pauses don't skew split, requires ≥2 moving samples/half + positive mean speed/hr, rounds to 1 decimal, never NaN/Infinity (guarded via `Number.isFinite`)
- [x] `aerobicEfficiency` / `verdict`: exact guard logic per spec
- [x] Test file covers all required cases incl. edge/null paths
- [x] `npm test` green (231/231 repo-wide); coverage ≥70% for the util; `tsc --noEmit` clean re: new files

## Tests Status
- Type check: **pass** (for new files — 0 errors referencing `maf-activity-analysis`; repo-wide `tsc --noEmit` has 140 pre-existing errors unrelated to this phase, see Concerns)
- Unit tests: **pass** — 28/28 new tests, 231/231 repo-wide (`npm test`)
- Coverage (`npm run test:coverage`): `maf-activity-analysis.ts` = **100% stmts / 89.85% branch / 100% funcs / 100% lines** (target was ≥70%)

## Verify Results
```
npm test                 → 8 files, 231 tests passed
npm run test:coverage    → maf-activity-analysis.ts: 100/89.85/100/100
npx tsc --noEmit         → 0 errors in new files; 140 pre-existing repo errors (unrelated)
```

## Issues Encountered
None blocking. One correction made during test-authoring: the original `timeInZone` boundary test only exercised the upper-bound sample (hr[1], since index 0 is only the dt baseline and is never classified) — fixed by using a 3-sample array so both lower (hr[1]=140) and upper (hr[2]=150) boundaries are explicitly hit.

## Concerns
- Repo-wide `npx tsc --noEmit` reports 140 pre-existing errors, none touching my 2 files:
  - `api/src/strava/strava.service.spec.ts`, `api/test/app.e2e-spec.ts` — root `tsconfig.json` lacks Jest types for the NestJS `api/` subproject (`Cannot find name 'describe'/'expect'`, `Cannot use namespace 'jest'`).
  - `src/hooks/use-strava-auto-fill.ts`, `src/services/api-client.ts`, `src/services/auth-service.ts`, `src/utils/wp-login-url.ts` — missing `vite/client` types (`Property 'env' does not exist on type 'ImportMeta'`).
  - Verified pre-existing (not introduced by this phase) via `git stash` / `git status` round-trip — same error count and content whether my 2 new files are present or stashed away. Out of scope for phase-03 (file ownership is the 2 new files only); flagging for whichever phase/owner controls root `tsconfig.json`.

## Next Steps
Phase-04 can import `timeInZone`, `cardiacDrift`, `aerobicEfficiency`, `verdict` from `src/utils/maf-activity-analysis.ts` for the verdict card, time-in-zone bar, drift card, efficiency stat.
