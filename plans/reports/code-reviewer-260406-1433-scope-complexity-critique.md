# Scope & Complexity Critique: Full Modernization Refactor Plan

**Reviewer:** code-reviewer (Scope & Complexity Critic / YAGNI Enforcer)
**Date:** 2026-04-06
**Plan:** `plans/260330-1924-full-modernization-refactor/`
**Target:** ~2,000 LOC client-side SPA, single developer

---

## Finding 1: Plan is stale -- describes a codebase that no longer exists

- **Severity:** Critical
- **Location:** All phases (plan.md, phase-01 through phase-07)
- **Flaw:** Every phase describes the pre-refactor state as "Current State" with status "Pending," but the refactor has already been executed. App.tsx is 128 lines (plan says 1,113). maf-lab.tsx is 143 lines (plan says 314). Tests, ESLint, docs -- all exist. The plan is a historical artifact masquerading as a live work item.
- **Failure scenario:** Anyone consulting this plan (including automated orchestration that reads `status: pending` and `blocks: [260331-0121-maf-platform-sp2-sp7]`) will conclude the refactor hasn't started. The SP2-SP7 roadmap is gated on this plan completing. If a controller agent reads `plan.md` literally, it may re-execute phases 1-7 on already-refactored code, causing destructive overwrites or duplicating work.
- **Evidence:** `plan.md` line 4: `status: pending`. All 7 phases show `Status: Pending`. Meanwhile: `src/app.tsx` = 128 lines, `src/utils/__tests__/` has 5 test files, `eslint.config.js` exists, `docs/` has 9 markdown files. Git log shows implementation commits from 2026-03-30 onward.
- **Suggested fix:** Mark all phases as completed. Set `plan.md` status to `completed`. Remove the `blocks` relationship if SP2-SP7 work has already begun (git log confirms it has: commit `86be72c` from April 5).

---

## Finding 2: 12h budget to reorganize 2,000 lines of working code is 6x/line the cost of writing it

- **Severity:** High
- **Location:** plan.md, effort estimate "12h"
- **Flaw:** This is a pure refactor with zero feature value, zero user-facing change, on a ~2,000 LOC app with one developer. The plan budgets 12 hours. That is 0.36 minutes per line of existing code -- a ratio typical of large team legacy rewrites, not solo micro-apps. A competent developer with IDE refactoring tools can do extract-to-file + rename + update-imports for the entire codebase in 2-3 hours. The plan gold-plates the remaining 9 hours into documentation nobody will read, test infrastructure for pure functions that TypeScript already type-checks, and ESLint config for a solo developer.
- **Failure scenario:** 12 hours of zero-feature work on a weekend project delays actual feature delivery (SP2-SP7 roadmap) by 1.5 full working days. The single developer context means there is no team to amortize onboarding costs against -- half the docs targets (deployment guide, code standards, design guidelines) serve no audience.
- **Evidence:** Phase 7 alone (1.5h for 8 documentation files) produces docs that describe the codebase to... the only person who wrote it. Phase 6 (1h for ESLint) adds linting to a project where the developer is the only committer.
- **Suggested fix:** For a solo-dev micro-app, the plan should have been: Phase 1 (structure, 30min) + Phase 2 (split App.tsx, 1.5h) + Phase 3 (split mafLogic, 1h) = 3 hours total. Phases 4-7 are YAGNI until the project has a second contributor.

---

## Finding 3: Phase 7 creates 8 documentation files for a codebase a developer can read in 20 minutes

- **Severity:** High
- **Location:** Phase 7, "Docs to Create/Update" table
- **Flaw:** 8 new markdown files for a 2,000-line SPA with no API, no backend, no database. The plan calls for `system-architecture.md`, `design-guidelines.md`, `deployment-guide.md`, `code-standards.md`, `codebase-summary.md`, `development-roadmap.md`, `project-changelog.md`, and `project-overview-pdr.md`. Most of these will be stale within one sprint and provide near-zero value for a single developer. The codebase IS the documentation at this scale.
- **Failure scenario:** Documentation maintenance becomes overhead. Every future feature now triggers "update 8 doc files" as a follow-up task per the documentation-management rules. For a micro-app, this is negative ROI -- time spent maintaining docs > time docs save.
- **Evidence:** Phase 7 lists: "design-guidelines.md: Tailwind usage, color palette, responsive approach" -- this is literally reading `tailwind.config.js`. "deployment-guide.md: Docker build, nginx config, production deploy" -- the Dockerfile and docker-compose.yml are self-documenting at this scale.
- **Suggested fix:** One README.md with: what it does, how to run, how to deploy. That's it. Add architecture docs when the second developer joins or the app exceeds 5,000 LOC.

---

## Finding 4: Phase 2 over-splits -- 12 new components + 3 hooks from a single 1,113-line file

- **Severity:** High
- **Location:** Phase 2, "Target File Structure"
- **Flaw:** The plan extracts 15 new files from one file. Components like `app-footer.tsx` (~10 lines), `result-alerts-section.tsx` (~50 lines), and `probation-alert.tsx` (~40 lines) are too small to justify the import/export/prop-interface ceremony. Each extraction adds: a new file, a prop interface, import statements in the parent, and cognitive overhead for navigation. The plan optimizes for the 200-line rule at the expense of locality of behavior.
- **Failure scenario:** The refactored codebase has 39 source files (confirmed). Finding where a piece of UI lives now requires checking `result-display.tsx` which delegates to `result-heart-rate-card.tsx`, `result-alerts-section.tsx`, `result-mindset-card.tsx`, `result-schedule-table.tsx`, `result-children-display.tsx`. This is a prop-drilling + file-hopping tax on a solo developer. For 1,113 lines, 5-7 extractions would have been sufficient (the 3 hooks + user-input-form + result-display + maf-lab).
- **Evidence:** Phase 2 creates `app-footer.tsx` at "~10 lines." That is: 1 import, 1 function signature, 1 return, 1 JSX element, 1 export. Five lines of ceremony to avoid putting a `<footer>` tag inline.
- **Suggested fix:** Extract only files that exceed 100 lines or have genuine reuse. `app-footer`, `app-header`, `tab-navigation`, `probation-alert`, `volume-adjustment-card` should stay inline in their parent.

---

## Finding 5: Phase 5 targets 37 tests for pure functions that have no known bugs

- **Severity:** Medium
- **Location:** Phase 5, "Test Matrix"
- **Flaw:** 37 unit tests for functions that have been running in production without reported bugs. The plan says "currently zero tests" but does not cite any production bugs or regressions that testing would have caught. Tests have ongoing maintenance cost. For pure calculation functions, the TypeScript type system already catches the most common class of errors (wrong argument order, missing fields, type mismatches). The plan tests boundary conditions that are unlikely to regress in a solo-dev project.
- **Failure scenario:** 37 tests become 37 maintenance points. Every time the MAF calculation formula is adjusted (which is the nature of the app -- it implements an evolving sports science methodology), tests must be updated in lockstep. The solo developer now spends time updating test expectations instead of iterating on the product. Tests for `formatSessionDetails` and `formatWeeklyVolumeSummary` test string formatting output -- the most fragile, least valuable test category.
- **Evidence:** Phase 5 test matrix: `session-formatter: 6 tests`, `schedule-generator: 4 tests`. These are testing output formatting and schedule shape -- things that change every time the UX requirements change.
- **Suggested fix:** Write 10-15 tests for the core calculation pipeline (`maf-safety-adjustments`, `maf-smart-long-run`, `maf-volume-cap`) where incorrect output could cause a runner to train at a dangerous heart rate. Skip string formatting tests. Add snapshot tests only if formatting stability matters.

---

## Finding 6: Phase 3 barrel re-export is unnecessary indirection

- **Severity:** Medium
- **Location:** Phase 3, Step 7 "Convert maf-logic.ts to barrel"
- **Flaw:** The plan keeps `maf-logic.ts` as a barrel re-export "for backwards compatibility." In a 2,000-line app with one developer, there is no backwards compatibility concern -- the developer can update all 3-4 import sites in 60 seconds. The barrel adds: one extra file, `export *` re-exports that obscure where functions actually live, and tree-shaking ambiguity. The plan even documents this risk ("Barrel re-export tree-shaking: Low impact") then proceeds to add it anyway.
- **Evidence:** Phase 3 risk table: "Barrel re-export tree-shaking | Low | Low". The plan's own import graph shows only `app.tsx` (or hooks) imports from `maf-logic`. That is 1-3 import sites.
- **Failure scenario:** Future developers `Ctrl+Click` on an import from `maf-logic` and land in the barrel file instead of the actual implementation. Minor annoyance, but entirely self-inflicted.
- **Suggested fix:** Delete the barrel. Update the 1-3 import sites to point directly to the specific module files.

---

## Finding 7: No rollback verification plan -- "git checkout ." is not a tested rollback

- **Severity:** Medium
- **Location:** Phase 1 "Rollback", Phase 2 "Rollback", Phase 3 "Rollback", Phase 4 "Rollback"
- **Flaw:** Every phase lists `git checkout .` or "revert commit" as the rollback strategy. But there is no step to verify the rollback actually works. The plan also says "commit before starting phase" (Phase 1) but does not make this an explicit implementation step in any phase. If the developer starts Phase 2 without committing Phase 1, `git checkout .` reverts both phases.
- **Failure scenario:** Developer is halfway through Phase 2 (3 hours of work), discovers a subtle rendering bug from a missed prop. Runs `git checkout .` and loses all Phase 2 work because Phase 1 was committed but Phase 2's partial state was not.
- **Evidence:** Phase 1 line 148: "Commit before starting phase" -- this instruction appears only in Phase 1's rollback section, not in the implementation steps of any phase. Phase 2's implementation steps have no "git commit" step.
- **Suggested fix:** Add an explicit step 0 to each phase: "Commit current state with message 'checkpoint: before phase N'." Or just accept that `git stash` exists and drop the rollback theater.

---

## Finding 8: user-input-form.tsx violates the plan's own 200-line rule

- **Severity:** Medium
- **Location:** Phase 2, Step 5
- **Flaw:** The plan estimates `user-input-form.tsx` at "~180 lines" and acknowledges this is close to the limit: "JSX-heavy forms are acceptable at ~180; split further only if needed." The actual file is 340 lines -- nearly double the plan estimate and 70% over the 200-line rule. The plan's risk assessment did not flag this as a likely outcome despite the component aggregating personal info + health checkboxes + commitment selector + analyze button.
- **Failure scenario:** The plan was used to execute the refactor, and the result violates the plan's own success criterion ("All new files under 200 lines"). This indicates the plan underestimated component complexity at design time.
- **Evidence:** Phase 2 architecture table: `user-input-form.tsx (~180 lines)`. Actual: `340 lines` (verified via `wc -l`). Phase 2 success criteria: "All new files under 200 lines."
- **Suggested fix:** The plan should have split the form into sub-sections at design time: `personal-info-section.tsx`, `health-checkboxes-section.tsx`, and `commitment-section.tsx`. Or it should have set the form's estimated size at 300+ and explicitly exempted it from the 200-line rule with justification.

---

## Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | Plan is stale, describes non-existent codebase state | Critical | Staleness |
| 2 | 12h budget is 4x reasonable for this codebase size | High | Over-engineering |
| 3 | 8 documentation files for a micro-app | High | Gold plating |
| 4 | Over-splitting into 15 files from one | High | Premature decomposition |
| 5 | 37 tests for bug-free pure functions | Medium | YAGNI |
| 6 | Barrel re-export for 1-3 import sites | Medium | Unnecessary abstraction |
| 7 | Rollback strategy is untested hand-waving | Medium | Missing verification |
| 8 | user-input-form.tsx blew past plan estimate by 89% | Medium | Estimation failure |

**Bottom line:** This plan treats a 2,000-line solo weekend project like a team legacy system rewrite. The 200-line rule, while reasonable as a guideline, was applied mechanically to produce a codebase with 39 source files including 10-line components. The documentation phase alone (8 files for one developer) is pure gold plating. The plan has been fully executed but never marked complete, creating a dangerous staleness trap for any automation that reads plan status.

---

**Status:** DONE
**Summary:** Identified 8 findings (1 critical, 3 high, 4 medium) in the modernization refactor plan. Critical issue is that the plan is fully executed but still marked pending, creating automation hazards. High-priority issues center on over-engineering for the codebase scale.
**Concerns:** The critical staleness issue (Finding 1) should be resolved immediately to prevent re-execution by orchestration agents.
