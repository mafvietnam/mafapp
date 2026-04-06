# Failure Mode Analysis: Full Modernization Refactor Plan

**Plan:** `plans/260330-1924-full-modernization-refactor/plan.md`
**Reviewer perspective:** Failure Mode Analyst (Murphy's Law)
**Date:** 2026-04-06
**Note:** This plan has already been executed. Findings below identify flaws in the plan document that either caused real defects or would cause failures if the plan were re-executed on a similar project.

---

## Finding 1: Dockerfile COPY paths break after src/ migration — production deploy fails silently

- **Severity:** Critical
- **Location:** Phase 1, "Related Code Files > Files to Modify"
- **Flaw:** Phase 1 moves all source files from root into `src/` but the plan explicitly lists the Dockerfile as "stays in root" without flagging that its COPY instructions reference the old root-level paths. The Dockerfile is not in the "Files to Modify" list.
- **Failure scenario:** After Phase 1, `docker build` fails at `COPY index.tsx ./` (line 39), `COPY App.tsx constants.ts types.ts ./` (line 43), `COPY components/ ./components/` (line 46). Production deployment is broken. The plan's invariant ("npm run build succeeds") only checks local build, not containerized build. Since the plan says "Docker/nginx/config files stay in root" and never revisits them, this breakage persists through all 7 phases.
- **Evidence:** Dockerfile lines 39, 43, 46-47 reference `index.tsx`, `App.tsx`, `constants.ts`, `types.ts`, `components/`, `utils/` — all moved to `src/` by Phase 1. Phase 1's "Files to Modify" list: `index.html`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `package.json`. Dockerfile is absent. Confirmed: current Dockerfile on `dev` branch still has stale paths.
- **Suggested fix:** Add Dockerfile to Phase 1's "Files to Modify" list. Replace granular COPY lines with `COPY src/ ./src/` and keep `COPY index.html ./`. Add `docker build .` to the Phase 1 verification step alongside `npm run build`.

---

## Finding 2: Plan invariant is insufficient — only checks local build, not deployment build

- **Severity:** Critical
- **Location:** plan.md, "Invariant" section
- **Flaw:** The invariant is "After EVERY phase: `npm run build` succeeds, app behavior unchanged." This checks Vite's local build only. The app is deployed via Docker (multi-stage Dockerfile + nginx). A passing `npm run build` does not guarantee `docker build` succeeds or that the nginx-served app works.
- **Failure scenario:** Finding 1 is a direct consequence — Dockerfile breaks but the invariant does not catch it. Similarly, if Phase 1 introduces a path change that Vite resolves correctly but nginx's `try_files` does not serve (e.g., a new SPA route), the invariant misses it.
- **Evidence:** `docker-compose.yml` exists, `Dockerfile` is the production build path, `nginx.conf` handles routing. None are tested by `npm run build`.
- **Suggested fix:** Extend invariant to: "`npm run build` succeeds AND `docker build -t maf-coach:test .` succeeds AND container health check passes." At minimum, add `docker build .` as a verification step after Phase 1.

---

## Finding 3: Phase 1 rollback claim is wrong — `git checkout .` does not undo the migration

- **Severity:** High
- **Location:** Phase 1, "Rollback" section
- **Flaw:** The rollback plan says "`git checkout .` restores all files to pre-migration state." This is incorrect. `git checkout .` restores tracked file contents but does NOT: (a) remove newly created directories (`src/`, `src/components/`, `src/hooks/`), (b) restore deleted files unless they were staged, (c) undo `git rm` operations. After Phase 1, the old root-level files are gone and new `src/` files are untracked — `git checkout .` leaves orphaned `src/` files alongside restored root files, creating duplicate sources and ambiguous imports.
- **Failure scenario:** Developer runs Phase 1, build fails, runs `git checkout .` thinking it's a clean rollback. Both old root files AND new `src/` files now exist. `npm run build` may succeed but compile the wrong entry point, or fail with duplicate module errors.
- **Evidence:** Phase 1 Rollback: "git checkout . restores all files to pre-migration state" and "Commit before starting phase". If committed before starting, `git checkout .` only undoes uncommitted changes — but the instructions say to commit before starting, so there would be no uncommitted changes to restore.
- **Suggested fix:** Rollback should be `git reset --hard HEAD~1` (after committing the phase work) or `git stash && git checkout -b rollback-phase1 <pre-phase-commit>`. Document that `src/` directory must be manually deleted if rollback occurs mid-phase without a commit.

---

## Finding 4: Phase 2 and Phase 3 have a hidden write conflict when executed in parallel

- **Severity:** High
- **Location:** plan.md, "Dependency Graph"; Phase 2 and Phase 3
- **Flaw:** The dependency graph shows Phase 2 (split App.tsx) and Phase 3 (split mafLogic.ts) can run in parallel after Phase 1. But Phase 2 creates `use-maf-calculator.ts` which imports from `'../utils/maf-logic'`. Phase 3 replaces `maf-logic.ts` content with a barrel re-export. If Phase 2 runs first and creates a hook importing specific functions from `maf-logic.ts` (the original 552-line file), and Phase 3 then replaces that file with a barrel — it works. But if Phase 3 runs first, Phase 2's extracted hook must import from a barrel that re-exports from modules that may not exist yet (since Phase 3 is still creating them). In a true parallel execution, file system state is nondeterministic.
- **Failure scenario:** Two developers or agents execute Phase 2 and Phase 3 simultaneously. Phase 3 deletes the body of `maf-logic.ts` and writes the barrel before all sub-modules exist. Phase 2's hook file references a function from the barrel that doesn't resolve yet. Build fails with "export not found" for the parallel worker.
- **Evidence:** Phase 3 explicitly says "Files NOT to Touch: src/app.tsx (or hooks from Phase 2) — imports from ./utils/maf-logic still work." This assumes sequential or atomic completion, not parallel mid-execution overlap. Phase 2 hook imports: `from '../utils/maf-logic'`.
- **Suggested fix:** Mark Phase 2 as blocked by Phase 3 (not just Phase 1). Or: specify that Phase 3 must complete its barrel re-export before Phase 2's hooks can import from `maf-logic`. At minimum, add an ordering constraint note.

---

## Finding 5: Plan is stale — does not account for guide pages, routing, or react-router-dom

- **Severity:** High
- **Location:** Phase 1 "Target Directory Structure"; Phase 2 "Files NOT to Touch"
- **Flaw:** The plan's file inventory is incomplete. The current codebase has `src/pages/guide-page.tsx` (121 lines), 5 guide sub-components in `src/components/guide/` (791 lines total), and `react-router-dom` as a dependency. None of these appear in any phase. Phase 1's "Target Directory Structure" does not list `pages/` or `components/guide/`. Phase 2's App.tsx decomposition does not account for router setup.
- **Failure scenario:** If the plan were used as a migration checklist on a fresh branch, the implementer would not move the `pages/` directory or guide components, leaving them orphaned. The app.tsx orchestrator sketch (Phase 2, Step 6) shows no `<Router>` or `<Routes>` wrapper, which would break the `/guide` route.
- **Evidence:** `src/pages/guide-page.tsx` exists. `react-router-dom: ^7.13.2` is in package.json. Zero mentions of "guide", "route", "router", or "pages" in any plan phase file.
- **Suggested fix:** Update Phase 1 file inventory to include `pages/` and `components/guide/`. Update Phase 2's orchestrator sketch to include router setup. If these files were added after the plan was written, the plan should be marked as superseded or updated.

---

## Finding 6: Phase 6 success criterion violated — 8 lint errors remain on dev branch

- **Severity:** Medium
- **Location:** Phase 6, "Success Criteria"
- **Flaw:** Phase 6 states: "`npm run lint` runs without errors (warnings acceptable)." The current `dev` branch has 8 lint errors (5 `no-misleading-character-class` in test file, 1 `no-useless-assignment` in hook, 2 `react-hooks/set-state-in-effect` in components). The phase's implementation step 5 says "Fix only actual errors" but this was not done completely.
- **Failure scenario:** CI/CD pipeline configured to fail on lint errors would block deployments. More importantly, the `react-hooks/set-state-in-effect` errors in `welcome-modal.tsx` and `use-user-profile.ts` indicate potential cascading render bugs in production — these are real React anti-patterns, not false positives.
- **Evidence:** `npm run lint` output: "31 problems (8 errors, 23 warnings)". Errors in `welcome-modal.tsx:11` (setState in effect), `use-user-profile.ts:148` (setState in effect), `use-maf-calculator.ts:171` (useless assignment), and 5 surrogate pair errors in test file.
- **Suggested fix:** The plan should specify which lint rules are acceptable to suppress vs. must-fix. The `react-hooks/set-state-in-effect` errors indicate actual code quality issues that should be addressed during Phase 2's hook extraction, not deferred.

---

## Finding 7: Phase 5 test count estimate is off by 4x — indicates shallow requirements analysis

- **Severity:** Medium
- **Location:** Phase 5, "Test Matrix"
- **Flaw:** The plan estimates ~37 tests total. The actual implementation produced 162 tests. A 4.4x underestimate suggests the plan author did not deeply analyze the functions' branching complexity when writing test scenarios. The test matrix lists only high-level categories without examining actual branch paths.
- **Failure scenario:** If this plan were used for sprint planning or resource allocation, the 2-hour effort estimate for Phase 5 would be wrong. An implementer who writes only the 37 listed tests would have significantly lower coverage than needed.
- **Evidence:** Plan: "~37 tests". Actual: 162 tests (19+32+28+43+40). The plan's smart-long-run entry says "~13 tests" but 43 were needed. Volume-cap says "~6 tests" but 40 were needed.
- **Suggested fix:** For complex business logic, the plan should enumerate distinct code paths per function (using branch count from the source), not estimate from test category names. Or mark estimates with explicit uncertainty: "~37-150 tests depending on branch coverage depth."

---

## Finding 8: No integration or E2E test strategy — pure function tests miss hook/component interaction bugs

- **Severity:** Medium
- **Location:** Phase 5, "Key Insights" and overall plan scope
- **Flaw:** Phase 5 explicitly scopes testing to pure functions only: "no React, no DOM." The plan has zero strategy for testing hooks (`use-user-profile`, `use-maf-calculator`, `use-probation`) or component integration. The Phase 2 risk table identifies "Missing re-renders" as Medium/High risk, but there is no test phase that would catch this.
- **Failure scenario:** Phase 2 extracts hooks and components. A re-render dependency is broken (e.g., `useMafCalculator` doesn't recalculate when `userProfile` changes because the dependency array is wrong). Pure function tests pass. Lint passes. Build passes. The bug only manifests when a user changes their age and the MAF heart rate does not update.
- **Evidence:** Phase 5 Key Insights: "All functions in src/utils/ are pure (input -> output) — no React, no DOM." Phase 2 Risk: "Missing re-renders | Medium | High." No Phase addresses testing hooks with `@testing-library/react-hooks` or component rendering with `@testing-library/react`.
- **Suggested fix:** Add a Phase 5b or expand Phase 5 to include at minimum: hook unit tests using `renderHook` for the 3 custom hooks, verifying that state changes propagate correctly. This directly addresses the Phase 2 "Missing re-renders" risk.

---

## Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Dockerfile COPY paths broken after src/ migration | Critical | Confirmed defect on dev branch |
| 2 | Invariant only checks local build, not Docker/production | Critical | Design gap |
| 3 | Phase 1 rollback claim (`git checkout .`) is wrong | High | Incorrect documentation |
| 4 | Phase 2/3 parallel execution has write conflict | High | Race condition in dependency graph |
| 5 | Plan missing guide pages, router, react-router-dom | High | Stale plan |
| 6 | Phase 6 success criterion violated — 8 lint errors | Medium | Confirmed defect on dev branch |
| 7 | Test count estimate off by 4.4x | Medium | Estimation quality |
| 8 | No integration/E2E tests for hooks and components | Medium | Coverage gap |

**Critical action items:**
1. Fix Dockerfile COPY paths immediately — production deploy is broken
2. Add `docker build` to CI/validation steps
3. Update plan status to reflect actual execution state (all phases show "Pending" but all are complete)

---

**Status:** DONE
**Summary:** 8 findings identified across the plan. 2 critical (Dockerfile breakage confirmed on dev, invariant gap), 3 high (rollback claim wrong, parallel conflict, stale plan), 3 medium (lint violations, test underestimate, no integration tests). Finding 1 is a confirmed production-impacting defect.
**Concerns:** Finding 1 (broken Dockerfile) needs immediate remediation before next production deployment.
