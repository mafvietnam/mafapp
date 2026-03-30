# Phase 4: Split MafLab.tsx

## Context
- [plan.md](./plan.md) | [Phase 1](./phase-01-project-structure-migration.md)
- `src/components/maf-lab.tsx` is 314 lines — over 200-line limit

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 1h
- **Depends on:** Phase 1
- **Description:** Extract step sub-components from MafLab

## Key Insights

### Analysis of MafLab.tsx Structure (314 lines)
| Section | Lines | Content |
|---------|-------|---------|
| 1-10 | Imports + interface | ~10 lines |
| 10-100 | State + handlers (handleProcessData, step logic) | ~90 lines |
| 101-314 | JSX: 3 steps rendered conditionally | ~213 lines |

### Split Strategy
MafLab has 3 distinct steps. Extract each step's JSX into a sub-component. Keep state + handlers in parent.

## Architecture

### Target File Structure
```
src/components/
├── maf-lab.tsx                     (~100 lines: state + handlers + step orchestration)
├── maf-lab-step-checklist.tsx      (~60 lines: Step 1 - pre-test checklist)
├── maf-lab-step-data-entry.tsx     (~80 lines: Step 2 - distance/time/HR input)
└── maf-lab-step-results.tsx        (~70 lines: Step 3 - pace result + save)
```

## Related Code Files

### Files to Create
- `src/components/maf-lab-step-checklist.tsx`
- `src/components/maf-lab-step-data-entry.tsx`
- `src/components/maf-lab-step-results.tsx`

### Files to Modify
- `src/components/maf-lab.tsx` — keep state/handlers, delegate JSX to sub-components

## Implementation Steps

1. Read full `maf-lab.tsx` to identify exact JSX boundaries for each step
2. Create `maf-lab-step-checklist.tsx`:
   - Props: `checklist`, `onCheck`, `allChecked`, `onProceed`, `targetMafHr`
   - JSX: Step 1 checklist UI
3. Create `maf-lab-step-data-entry.tsx`:
   - Props: `distance`, `hours`, `minutes`, `seconds`, `avgHr`, `targetMafHr`, setters, `onProcess`, `onBack`
   - JSX: Step 2 input form
4. Create `maf-lab-step-results.tsx`:
   - Props: `calculatedPace`, `finalPace`, `isMafCompliant`, `avgHr`, `targetMafHr`, `onComplete`, `onBack`
   - JSX: Step 3 results display
5. Update `maf-lab.tsx`: replace inline JSX with component references
6. Verify build

## Todo List
- [ ] Create maf-lab-step-checklist.tsx
- [ ] Create maf-lab-step-data-entry.tsx
- [ ] Create maf-lab-step-results.tsx
- [ ] Update maf-lab.tsx to use sub-components
- [ ] All files under 200 lines
- [ ] npm run build passes
- [ ] Browser smoke test (MAF Lab flow)

## Success Criteria
- `maf-lab.tsx` under 120 lines
- All sub-components under 100 lines
- 3-step flow works identically
- `npm run build` passes

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Props interface too complex | Low | Low | Steps are self-contained; each gets only what it needs |
| Step transition breaks | Low | Medium | State stays in parent; only JSX extracted |

## Rollback
- Delete new step files, restore original `maf-lab.tsx` from git
