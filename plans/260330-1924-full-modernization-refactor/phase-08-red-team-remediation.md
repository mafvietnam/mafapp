# Phase 8: Red Team Remediation

## Context
- [plan.md](./plan.md) | [Red Team Review](./plan.md#red-team-review)
- Addresses 8 accepted findings (4 Critical, 4 High) from red team session 2026-04-06
- Validation confirmed: extract to pure util, move effects to handlers, fix Dockerfile inline

## Overview
- **Priority:** P1
- **Status:** Done
- **Effort:** 3h
- **Depends on:** Phase 2, 5, 6 (all complete)
- **Description:** Fix all accepted red team findings in one pass

## Implementation Steps

### Step 1: Fix Dockerfile COPY paths [Critical]
Update Dockerfile to reference `src/` directory instead of old root-level paths.
```dockerfile
# Replace granular COPY lines with:
COPY package*.json ./
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY src/ ./src/
```
Verify: `docker build .` succeeds.

### Step 2: Extract `calculateMAF` to pure util [Critical]
- Create `src/utils/maf-calculator-orchestrator.ts`
- Move `calculateMAF` function body from `use-maf-calculator.ts` into it as a pure function
- Hook becomes thin wrapper: holds `result` state, calls the pure function, sets state
- Target: `use-maf-calculator.ts` under 80 lines, orchestrator under 200 lines
- If orchestrator exceeds 200 lines, split further by concern (children path, adult path)

### Step 3: Split `user-input-form.tsx` (340L) [Critical]
Split into logical form sections:
- `src/components/form-personal-info.tsx` — age, weight, height inputs
- `src/components/form-health-checklist.tsx` — health condition checkboxes
- `src/components/form-long-run-history.tsx` — long run history inputs (if applicable)
- `user-input-form.tsx` becomes orchestrator importing sub-forms
- Target: all files under 200 lines

### Step 4: Fix render loop in `use-user-profile.ts` [High]
- Remove the safety effect that watches `userProfile.commitment` and sets `commitment`
- Move commitment auto-adjustment logic into `handleInputChange` and `handleCheckboxChange`
- When age/recovery/health conditions change, immediately compute correct commitment in the handler
- Verify: no `set-state-in-effect` ESLint error remains

### Step 5: Fix remaining ESLint errors [High]
- Fix `set-state-in-effect` in `welcome-modal.tsx` — initialize state from localStorage synchronously:
  ```tsx
  const [show, setShow] = useState(() => !localStorage.getItem('hasSeenWelcome'));
  ```
- Fix `no-useless-assignment` in `use-maf-calculator.ts` line 171
- Fix `no-misleading-character-class` in test files (emoji surrogate pairs)
- Target: `npm run lint` exits with 0 errors (warnings OK)

### Step 6: Resolve dead code `app-footer.tsx` [High]
- Check if `app.tsx` has inline footer JSX
- If yes: replace inline JSX with `<AppFooter />` import
- If no footer needed: delete `app-footer.tsx`

### Step 7: Add `calculateMAF` orchestration tests [High]
- After Step 2 extracts it to a pure function, write tests in `src/utils/__tests__/maf-calculator-orchestrator.test.ts`
- Test cases:
  - Children shortcircuit path (age < 16)
  - Adult standard path (healthy, no adjustments)
  - BMI-based pace fallback
  - Probation + safety adjustments combined
  - Volume cap enforcement after smart long run
- Target: 8-12 tests covering main orchestration branches

### Step 8: Verify everything
- `npm run lint` — 0 errors
- `npm test` — all tests pass (existing + new)
- `npm run build` — succeeds
- `docker build .` — succeeds
- Browser smoke test — app works identically

## Todo List
- [x] Fix Dockerfile COPY paths
- [x] Extract `calculateMAF` to `src/utils/maf-calculator-orchestrator.ts`
- [x] Reduce `use-maf-calculator.ts` to thin wrapper (<80 lines)
- [x] Split `user-input-form.tsx` into sub-form components
- [x] Move commitment auto-adjustment from effect to handlers
- [x] Fix `set-state-in-effect` in `welcome-modal.tsx`
- [x] Fix remaining ESLint errors
- [x] Resolve `app-footer.tsx` dead code
- [x] Write orchestration tests for `calculateMAF`
- [x] `npm run lint` — 0 errors
- [x] `npm test` — all pass
- [x] `npm run build` — succeeds
- [x] `docker build .` — succeeds

## Success Criteria
- All 8 red team findings resolved
- No file exceeds 200 lines (code files)
- `npm run lint` has 0 errors
- `calculateMAF` orchestration has test coverage
- Docker build works with current src/ structure
- App behavior unchanged

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Extracting calculateMAF breaks state updates | Medium | High | Keep hook as wrapper; pure function returns result object, hook calls setState |
| Form splitting breaks tab order/accessibility | Low | Medium | Test form flow in browser after split |
| Handler-based commitment logic misses edge case | Low | Medium | Port exact same conditions from effect; add test coverage |

## Rollback
- Revert commit(s) for this phase
- Previous phases remain intact
