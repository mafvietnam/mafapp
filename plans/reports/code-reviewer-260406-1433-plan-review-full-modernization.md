# Plan Review: Full Modernization Refactor (Assumption Destroyer)

**Plan:** `plans/260330-1924-full-modernization-refactor/plan.md`
**Status:** Plan has been EXECUTED. Review is post-mortem: verifying plan claims against actual outcomes.
**Reviewer:** code-reviewer (hostile/assumption-destroyer perspective)

---

## Finding 1: `use-maf-calculator.ts` is 367 lines -- 83% over the 200-line limit

- **Severity:** Critical
- **Location:** Phase 2, section "Architecture" / "Target File Structure"
- **Flaw:** The plan estimated `use-maf-calculator.ts` at "~120 lines: calculateMAF, helpers". The actual implementation is 367 lines -- the single largest non-test file in the codebase. The plan simply moved the 300-line `calculateMAF` monolith from App.tsx into a hook without decomposing it. The hook's `calculateMAF` method alone runs ~290 lines and handles: MAF formula, children special case, BMI-based pace selection, schedule generation, pace comparison/volume adjustment, smart long run, volume cap enforcement, note generation, and result assembly. This is not "extracting a hook" -- it is relocating a monolith.
- **Failure scenario:** The 200-line rule exists in this project's `CLAUDE.md` for LLM context management. Any agent editing this file will need to load 367 lines of tightly coupled orchestration logic, well past the intended context boundary.
- **Evidence:** Plan says `use-maf-calculator.ts (~120 lines: calculateMAF, helpers)`. Actual: `wc -l` returns 367.
- **Suggested fix:** Extract `calculateMAF` body into a pure function (e.g., `src/utils/maf-calculator.ts`) that takes inputs and returns `MafResult`. The hook becomes a thin wrapper: state + calling the pure function. This would also make the core calculation testable without React, which the plan's Phase 5 entirely missed (tests only cover `src/utils/` modules, not the orchestration logic in `calculateMAF`).

## Finding 2: `user-input-form.tsx` is 340 lines -- 70% over the 200-line limit

- **Severity:** Critical
- **Location:** Phase 2, section "Risk Assessment"
- **Flaw:** The plan estimated this at "~180 lines" and pre-emptively dismissed the risk: "JSX-heavy forms are acceptable at ~180; split further only if needed". The actual file is 340 lines, nearly double the estimate. The plan's own success criteria state "All new files under 200 lines."
- **Failure scenario:** This file violates the project's own modularization rule. It signals the plan's estimation methodology was fundamentally unreliable -- if the largest component was off by 89%, other estimates are untrustworthy.
- **Evidence:** Plan Risk Assessment: `user-input-form.tsx over 200 lines | Medium | Low | JSX-heavy forms are acceptable at ~180`. Actual: 340 lines.
- **Suggested fix:** Split into logical sections: personal-info form, health-checkboxes section, long-run-history section. Each is a self-contained form group.

## Finding 3: 8 ESLint errors remain -- plan claimed "zero errors"

- **Severity:** High
- **Location:** Phase 6, section "Success Criteria" / "Non-Functional Requirements"
- **Flaw:** Phase 6 claims: "Zero errors on current codebase after refactor phases complete." The actual state is 8 errors (plus 23 warnings). Errors include:
  - `set-state-in-effect` in `welcome-modal.tsx` and `use-user-profile.ts` (React Hooks rule violations)
  - `no-useless-assignment` in `use-maf-calculator.ts` (dead code at line 171)
  - 5x `no-misleading-character-class` in test files (regex with emoji surrogate pairs)
- **Failure scenario:** The `set-state-in-effect` errors in `welcome-modal.tsx` and `use-user-profile.ts` are real React correctness issues. `useState(false)` + `useEffect(() => setState(true))` causes an unnecessary extra render on mount. In `use-user-profile.ts`, the safety effect calling `setUserProfile` inside `useEffect` with `userProfile.commitment` in the dependency array creates a render loop risk (the effect sets the value it depends on).
- **Evidence:** Plan Phase 6 Non-Functional: `Zero errors on current codebase after refactor phases complete`. `npx eslint src/` returns `31 problems (8 errors, 23 warnings)`.
- **Suggested fix:** For `welcome-modal.tsx`, initialize state from localStorage synchronously: `useState(() => !localStorage.getItem('hasSeenWelcome'))`. For `use-user-profile.ts` safety effect, refactor commitment auto-adjustment out of an effect and into the handlers that change age/recovery state.

## Finding 4: Dead code -- `app-footer.tsx` exists but is never imported

- **Severity:** High
- **Location:** Phase 2, section "Implementation Steps" / Step 5
- **Flaw:** The plan explicitly lists `app-footer.tsx` as a component to extract (Step 5, lines 142-143). The file was created (12 lines), but `app.tsx` inlines the footer JSX at lines 110-115 instead of importing the component. No file in the codebase imports `app-footer.tsx`.
- **Failure scenario:** Dead code that contradicts the plan's stated decomposition. A future developer reads the plan, sees `AppFooter` listed as an extracted component, searches for its usage, and finds none -- creating confusion about whether the component was intentionally abandoned or accidentally orphaned.
- **Evidence:** `grep -r "AppFooter\|app-footer" src/app.tsx` returns no matches. `src/components/app-footer.tsx` exists with 12 lines.
- **Suggested fix:** Either import and use `AppFooter` in `app.tsx`, or delete the file.

## Finding 5: `calculateMAF` orchestration logic is completely untested

- **Severity:** High
- **Location:** Phase 5, section "Key Insights" / "Test Matrix"
- **Flaw:** Phase 5 claims "All functions in `src/utils/` are pure (input -> output) -- no React, no DOM" and writes tests only for `src/utils/` modules. But the most complex business logic -- the `calculateMAF` function in `use-maf-calculator.ts` -- is 290 lines of orchestration that chains 6+ utility functions with conditional branching (children path, BMI categories, pace comparison, probation mode, smart long run, volume cap). None of this orchestration is tested.
- **Failure scenario:** A developer changes the order of operations in `calculateMAF` (e.g., applying probation BEFORE volume cap instead of after), and no test catches the regression. The individual utility functions pass, but the integration produces wrong schedules.
- **Evidence:** Phase 5 test coverage config: `include: ['src/utils/**/*.ts']`. `calculateMAF` lives in `src/hooks/use-maf-calculator.ts` -- excluded by pattern. The test matrix lists 37 tests total (actual: 162), but zero test the orchestration sequence.
- **Suggested fix:** Extract `calculateMAF` body into a pure function in `src/utils/maf-calculator-orchestrator.ts`. It takes `UserProfile`, `verifiedMafPace`, `ageNum`, etc. and returns `MafResult`. Test the orchestration paths: children shortcircuit, BMI-based pace fallback, probation + regression combo, volume cap after smart long run.

## Finding 6: 7 of 9 docs exceed the 200-line limit

- **Severity:** Medium
- **Location:** Phase 7, section "Success Criteria"
- **Flaw:** Phase 7 claims "No doc exceeds 200 lines." Actual sizes: `codebase-summary.md` (338), `code-standards.md` (325), `design-guidelines.md` (307), `MAF_RULES_SUMMARY.md` (309), `system-architecture.md` (233), `deployment-guide.md` (236), `user-guide.md` (318). Only `project-overview-pdr.md` (123), `development-roadmap.md` (107), and `project-changelog.md` (166) meet the criteria.
- **Evidence:** `wc -l docs/*.md` shows 7 of 10 files over 200 lines.
- **Suggested fix:** Either split large docs or acknowledge that the 200-line rule is a code file rule, not a docs rule. Update the plan's success criteria to reflect reality.

## Finding 7: `useMafCalculator` API contract diverged from plan design

- **Severity:** Medium
- **Location:** Phase 2, section "Implementation Steps" / Step 3
- **Flaw:** The plan states: `use-maf-calculator.ts` "Accepts: userProfile, verifiedMafPace, computed values from use-user-profile. Returns: result, resultRef, calculateMAF, calculateRawMaf, getVolumeCapText." The actual implementation takes ZERO arguments -- `useMafCalculator()` is called with no parameters. Instead, `calculateMAF` receives 6 arguments at call-time from `app.tsx`. The plan described a hook that receives its dependencies as constructor-time injection. The implementation uses function-call-time injection instead. This means the hook holds result state but has no dependency relationship with the profile hook -- `useMafCalculator` could be called from any component with any random arguments.
- **Failure scenario:** A developer reads the plan, sees "Accepts: userProfile..." and assumes the hook is parameterized. They try `useMafCalculator(profile)` and get a type error. The plan is now misleading documentation.
- **Evidence:** Plan Step 3: "Accepts: userProfile, verifiedMafPace, computed values from use-user-profile". Actual: `export function useMafCalculator(): UseMafCalculatorReturn` (zero parameters).
- **Suggested fix:** Update the plan to match the implementation, or refactor the hook to accept dependencies. The current pattern (stateful hook with parameter-less constructor and 6-arg method) is a code smell -- the hook is just a `useState` wrapper with utility methods.

## Finding 8: Render loop risk in `use-user-profile.ts` safety effect

- **Severity:** High
- **Location:** Phase 2, section "Implementation Steps" / Step 2
- **Flaw:** The safety effect at lines 139-163 watches `userProfile.commitment` in its dependency array and calls `setUserProfile(prev => ({...prev, commitment: CommitmentLevel.HEALTH}))`. If the conditions match, the effect sets `commitment`, which triggers the effect again. React batches this, but the pattern is fragile: any future change to the conditions could create an infinite loop. ESLint already flags this as an error (`set-state-in-effect`).
- **Failure scenario:** A developer adds a new condition (e.g., if `isChild` and commitment is anything other than HEALTH, downgrade) without realizing the effect re-fires on commitment changes. Infinite render loop in production, only caught when a user enters a specific age.
- **Evidence:** Lines 156-163 dependency array includes `userProfile.commitment`. Line 148-154 calls `setUserProfile(prev => ({...prev, commitment: CommitmentLevel.HEALTH}))`. This is the classic "effect that sets its own dependency" anti-pattern.
- **Suggested fix:** Move commitment auto-adjustment into `handleInputChange` and `handleCheckboxChange` handlers where the triggering state change originates. Effects should synchronize with external systems, not cascade internal state.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 4 |
| Medium | 2 |

The plan was executed but diverged significantly from its own specifications. Two files exceed the 200-line limit by 70-83%. The most complex business logic function (290 lines of orchestration) was relocated rather than decomposed and has zero test coverage. ESLint errors remain despite a "zero errors" success criterion. A component was created but never wired up (dead code). The plan's documentation for hook APIs does not match the implementation.

The fundamental flaw: the plan treated "extract into separate file" as equivalent to "decompose." Moving a 300-line function from one file to another is not modularization -- it is file reorganization.

**Status:** DONE
**Summary:** 8 findings (2 critical, 4 high, 2 medium). Core issues: `use-maf-calculator.ts` and `user-input-form.tsx` violate 200-line rule; orchestration logic untested; ESLint errors remain; dead code; render loop risk.
**Concerns:** The plan is now stale documentation that actively misleads (estimates wrong, API contracts wrong). Either update it to reflect reality or archive it.
