# Phase 3: Split mafLogic.ts

## Context
- [plan.md](./plan.md) | [Phase 1](./phase-01-project-structure-migration.md)
- `src/utils/maf-logic.ts` is 552 lines — all MAF calculation logic in one file

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 2h
- **Depends on:** Phase 1
- **Description:** Split into focused modules by domain concern

## Key Insights

### Analysis of maf-logic.ts Structure (552 lines)
| Section | Lines | Concern |
|---------|-------|---------|
| 1-50 | Interfaces: `VolumeCap`, `SmartLongRunResult`, `WeeklyVolumeCapResult` + `VOLUME_CAPS` constant | Types + constants |
| 52-88 | `formatSessionDetails()` | Session formatting |
| 90-137 | `getWeeklySchedule()` | Schedule generation |
| 139-233 | `adjustForProbation()`, `adjustScheduleForSafety()` | Safety adjustments |
| 236-433 | `calculateSmartLongRun()` | Smart long run calc (~200 lines) |
| 436-531 | `enforceWeeklyVolumeCap()` | Volume cap enforcement |
| 534-552 | `calculateTotalWeeklyMinutes()`, `formatWeeklyVolumeSummary()` | Volume helpers |

### Split Strategy
Split by domain concern. Each module exports pure functions — easy to test.

## Architecture

### Target File Structure
```
src/utils/
├── maf-types.ts                    (~30 lines: interfaces only)
├── maf-session-formatter.ts        (~45 lines: formatSessionDetails)
├── maf-schedule-generator.ts       (~55 lines: getWeeklySchedule)
├── maf-safety-adjustments.ts       (~100 lines: adjustForProbation, adjustScheduleForSafety)
├── maf-smart-long-run.ts           (~200 lines: calculateSmartLongRun — largest, acceptable)
├── maf-volume-cap.ts               (~120 lines: enforceWeeklyVolumeCap, helpers, VOLUME_CAPS)
└── maf-logic.ts                    (~20 lines: barrel re-export for backwards compat)
```

## Related Code Files

### Files to Create
- `src/utils/maf-types.ts`
- `src/utils/maf-session-formatter.ts`
- `src/utils/maf-schedule-generator.ts`
- `src/utils/maf-safety-adjustments.ts`
- `src/utils/maf-smart-long-run.ts`
- `src/utils/maf-volume-cap.ts`

### Files to Modify
- `src/utils/maf-logic.ts` — replace with barrel re-export

### Files NOT to Touch (imports stay the same due to barrel)
- `src/app.tsx` (or hooks from Phase 2) — imports from `./utils/maf-logic` still work

## Implementation Steps

### Step 1: Create `maf-types.ts`
Move interfaces:
- `VolumeCap`
- `SmartLongRunResult`
- `WeeklyVolumeCapResult`

### Step 2: Create `maf-session-formatter.ts`
Move:
- `formatSessionDetails()` function
- Import `ScheduleItem` from `../types`

### Step 3: Create `maf-schedule-generator.ts`
Move:
- `getWeeklySchedule()` function
- Import `CommitmentLevel`, `ScheduleItem` from `../types`

### Step 4: Create `maf-safety-adjustments.ts`
Move:
- `adjustForProbation()` function
- `adjustScheduleForSafety()` function
- Import `ExperienceLevel`, `ScheduleItem`, `UserProfile` from `../types`

### Step 5: Create `maf-smart-long-run.ts`
Move:
- `calculateSmartLongRun()` function
- Import `SmartLongRunResult` from `./maf-types`
- Import `VOLUME_CAPS` from `./maf-volume-cap`
- Import `CommitmentLevel`, `ExperienceLevel` from `../types`

### Step 6: Create `maf-volume-cap.ts`
Move:
- `VOLUME_CAPS` constant
- `enforceWeeklyVolumeCap()` function
- `calculateTotalWeeklyMinutes()` helper
- `formatWeeklyVolumeSummary()` helper
- Import `VolumeCap`, `WeeklyVolumeCapResult` from `./maf-types`
- Import `CommitmentLevel`, `ScheduleItem` from `../types`

### Step 7: Convert `maf-logic.ts` to barrel
```ts
// Barrel re-export for backwards compatibility
export * from './maf-types';
export * from './maf-session-formatter';
export * from './maf-schedule-generator';
export * from './maf-safety-adjustments';
export * from './maf-smart-long-run';
export * from './maf-volume-cap';
```

### Step 8: Verify build

## Data Flow (Import Graph)
```
../types.ts (ScheduleItem, UserProfile, CommitmentLevel, ExperienceLevel)
   |
   v
maf-types.ts (VolumeCap, SmartLongRunResult, WeeklyVolumeCapResult)
   |
   +---> maf-session-formatter.ts (uses ScheduleItem)
   +---> maf-schedule-generator.ts (uses CommitmentLevel, ScheduleItem)
   +---> maf-safety-adjustments.ts (uses UserProfile, ScheduleItem, ExperienceLevel)
   +---> maf-volume-cap.ts (uses VOLUME_CAPS, ScheduleItem, CommitmentLevel)
   +---> maf-smart-long-run.ts (uses VOLUME_CAPS from volume-cap, types)
   |
   v
maf-logic.ts (barrel re-export)
```

No circular dependencies: `maf-smart-long-run` imports `VOLUME_CAPS` from `maf-volume-cap`, but not vice versa.

## Todo List
- [ ] Create maf-types.ts with interfaces
- [ ] Create maf-session-formatter.ts
- [ ] Create maf-schedule-generator.ts
- [ ] Create maf-safety-adjustments.ts
- [ ] Create maf-smart-long-run.ts
- [ ] Create maf-volume-cap.ts
- [ ] Convert maf-logic.ts to barrel re-export
- [ ] Verify no circular imports
- [ ] npm run build passes
- [ ] All files under 200 lines

## Success Criteria
- Original `maf-logic.ts` reduced to barrel (~20 lines)
- All modules under 200 lines
- No circular dependencies
- All existing imports of `maf-logic` still resolve (barrel)
- `npm run build` passes

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Circular import between smart-long-run and volume-cap | Medium | High | volume-cap exports VOLUME_CAPS; smart-long-run imports it — one-way only |
| Barrel re-export tree-shaking | Low | Low | Vite handles this; no runtime impact |
| Missing export in barrel | Low | Medium | TypeScript compiler catches immediately |

## Rollback
- Delete new files, restore original `maf-logic.ts` from git
