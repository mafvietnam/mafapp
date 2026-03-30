# Phase 2: Split App.tsx Monolith

## Context
- [plan.md](./plan.md) | [Phase 1](./phase-01-project-structure-migration.md)
- `src/app.tsx` is 1,113 lines containing ALL state, handlers, calculation logic, and rendering

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Phase 1
- **Description:** Extract hooks, handlers, and UI sections into separate files

## Key Insights

### Analysis of App.tsx Structure (1,113 lines)
| Section | Lines | Content |
|---------|-------|---------|
| 1-11 | Imports | 11 lines |
| 12-55 | State + helpers (`calculateRawMaf`, `getBMI`, `parsePaceToSeconds`) | ~44 lines |
| 56-460 | Handlers + `calculateMAF()` (~300 lines of business logic) | ~405 lines |
| 461-511 | Effects + side-effect helpers | ~50 lines |
| 514-1112 | JSX rendering (~600 lines) | ~600 lines |

### Extraction Strategy
1. **Custom hooks** for state + handlers + effects
2. **UI section components** for large JSX blocks
3. App.tsx becomes thin orchestrator (~100 lines)

## Architecture

### Target File Structure (all under `src/`)
```
src/
├── app.tsx                          (~80-100 lines, orchestrator)
├── hooks/
│   ├── use-user-profile.ts          (~80 lines: state, handlers, effects)
│   ├── use-maf-calculator.ts        (~120 lines: calculateMAF, helpers)
│   └── use-probation.ts             (~40 lines: probation state + auto-unlock)
├── components/
│   ├── app-header.tsx               (~40 lines)
│   ├── tab-navigation.tsx           (~35 lines)
│   ├── user-input-form.tsx          (~180 lines: personal info + health + commitment)
│   ├── result-display.tsx           (~60 lines: orchestrates result sub-components)
│   ├── result-heart-rate-card.tsx   (~40 lines)
│   ├── result-alerts-section.tsx    (~50 lines)
│   ├── result-mindset-card.tsx      (~50 lines)
│   ├── result-schedule-table.tsx    (~80 lines)
│   ├── result-children-display.tsx  (~60 lines)
│   ├── probation-alert.tsx          (~40 lines)
│   ├── volume-adjustment-card.tsx   (~40 lines)
│   └── app-footer.tsx               (~10 lines)
│   ... (existing components unchanged)
```

## Related Code Files

### Files to Create
- `src/hooks/use-user-profile.ts`
- `src/hooks/use-maf-calculator.ts`
- `src/hooks/use-probation.ts`
- `src/components/app-header.tsx`
- `src/components/tab-navigation.tsx`
- `src/components/user-input-form.tsx`
- `src/components/result-display.tsx`
- `src/components/result-heart-rate-card.tsx`
- `src/components/result-alerts-section.tsx`
- `src/components/result-mindset-card.tsx`
- `src/components/result-schedule-table.tsx`
- `src/components/result-children-display.tsx`
- `src/components/probation-alert.tsx`
- `src/components/volume-adjustment-card.tsx`
- `src/components/app-footer.tsx`

### Files to Modify
- `src/app.tsx` — reduce to thin orchestrator

### Files NOT to Touch
- `src/types.ts`
- `src/constants.ts`
- `src/utils/maf-logic.ts` (handled in Phase 3)
- `src/components/commitment-selector.tsx`
- `src/components/maf-lab.tsx` (handled in Phase 4)
- `src/components/recovery-modal.tsx`
- `src/components/welcome-modal.tsx`

## Implementation Steps

### Step 1: Create hooks directory
```
mkdir src/hooks
```

### Step 2: Extract `use-user-profile.ts`
Extract from App.tsx:
- `userProfile` state + `setUserProfile`
- `handleInputChange`, `handleBlur`, `handleCheckboxChange`
- `handleCommitmentSelect`
- `handleRecoveryConfirm`
- `showRecoveryModal` state
- `verifiedMafPace` state + `handleLabComplete`
- `activeTab` state
- Computed values: `ageNum`, `isSenior`, `isChild`, `isNewbie`
- Helper: `getBMI()`
- Safety effect (commitment auto-adjust for age/recovery)

Returns: all state, computed values, handlers

### Step 3: Extract `use-maf-calculator.ts`
Extract from App.tsx:
- `result` state + `resultRef`
- `calculateRawMaf()` helper
- `parsePaceToSeconds()` helper
- `calculateMAF()` — the main 300-line calculation function
- `getVolumeCapText()` helper

Accepts: userProfile, verifiedMafPace, computed values from use-user-profile
Returns: result, resultRef, calculateMAF, calculateRawMaf, getVolumeCapText

### Step 4: Extract `use-probation.ts`
Extract from App.tsx:
- `calculateDaysSinceStart()` helper
- Probation auto-unlock effect

Accepts: userProfile, setUserProfile
Returns: calculateDaysSinceStart

### Step 5: Extract UI section components
Each component receives props, renders JSX. No logic duplication.

- **app-header.tsx**: Header with image + title (lines 529-548)
- **tab-navigation.tsx**: PLAN/LAB tab buttons (lines 551-576)
- **user-input-form.tsx**: Personal info form + health checkboxes + commitment selector + analyze button (lines 590-784). This is the largest UI section (~180 lines) — acceptable since it's mostly JSX form fields.
- **result-display.tsx**: Orchestrator that renders heart-rate, alerts, mindset, schedule sub-components
- **result-heart-rate-card.tsx**: MAF HR display with zone + BMI (lines 844-873)
- **result-alerts-section.tsx**: Explanation + warning notes (lines 876-900)
- **result-mindset-card.tsx**: Mindset quote + golden rules (lines 933-973)
- **result-schedule-table.tsx**: Weekly schedule table (lines 1012-1096)
- **result-children-display.tsx**: Special children display (lines 787-838)
- **probation-alert.tsx**: Probation progress bar (lines 902-931)
- **volume-adjustment-card.tsx**: Volume adjustment message (lines 975-1010)
- **app-footer.tsx**: Footer (lines 1104-1107)

### Step 6: Rewrite `app.tsx` as orchestrator
```tsx
// ~80-100 lines
import { useUserProfile } from './hooks/use-user-profile';
import { useMafCalculator } from './hooks/use-maf-calculator';
import { useProbation } from './hooks/use-probation';
// + component imports

const App: React.FC = () => {
  const profile = useUserProfile();
  const calculator = useMafCalculator(profile);
  const probation = useProbation(profile);

  return (
    <>
      <WelcomeModal />
      <RecoveryModal ... />
      <div>
        <AppHeader />
        <TabNavigation ... />
        <main>
          {activeTab === 'LAB' && <MafLab ... />}
          {activeTab === 'PLAN' && (
            <>
              <UserInputForm ... />
              {result && isChild && <ResultChildrenDisplay ... />}
              {result && !isChild && <ResultDisplay ... />}
            </>
          )}
        </main>
        <AppFooter />
      </div>
    </>
  );
};
```

### Step 7: Verify build + smoke test

## Todo List
- [ ] Create src/hooks directory
- [ ] Extract use-user-profile.ts
- [ ] Extract use-maf-calculator.ts
- [ ] Extract use-probation.ts
- [ ] Extract app-header.tsx
- [ ] Extract tab-navigation.tsx
- [ ] Extract user-input-form.tsx
- [ ] Extract result-display.tsx + sub-components
- [ ] Extract result-children-display.tsx
- [ ] Extract probation-alert.tsx
- [ ] Extract volume-adjustment-card.tsx
- [ ] Extract app-footer.tsx
- [ ] Rewrite app.tsx as orchestrator
- [ ] Verify all files under 200 lines
- [ ] npm run build passes
- [ ] Browser smoke test

## Success Criteria
- `src/app.tsx` under 100 lines
- All new files under 200 lines
- No logic duplication between hooks
- `npm run build` passes
- UI identical in browser

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Props drilling too deep | Medium | Low | Max 2 levels; hooks handle state |
| Circular imports | Low | High | Hooks import from types/utils only, components import from hooks |
| Missing re-renders | Medium | High | Keep state ownership in hooks; pass setters only where needed |
| user-input-form.tsx over 200 lines | Medium | Low | JSX-heavy forms are acceptable at ~180; split further only if needed |

## Rollback
- Revert commit; `src/app.tsx` is the only file modified (others are new files that can be deleted)
