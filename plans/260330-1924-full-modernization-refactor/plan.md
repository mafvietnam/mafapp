---
title: "Full Modernization Refactor"
description: "Restructure monolith into src/, split giant files, add testing + linting + docs"
status: completed
priority: P1
effort: 12h
branch: dev
tags: [refactor, structure, testing, linting, docs]
blocks: [260331-0121-maf-platform-sp2-sp7]
created: 2026-03-30
completed: 2026-04-06
---

# Full Modernization Refactor

## Goal
Pure refactor: no UI changes, no new features, no behavior changes. App compiles and works identically after each phase.

## Current State
| File | Lines | Problem |
|------|-------|---------|
| App.tsx | 1,113 | Monolith: state + logic + handlers + all JSX |
| utils/mafLogic.ts | 552 | All calc logic in one file |
| components/MafLab.tsx | 314 | Over 200-line limit |
| Root dir | - | No src/, source mixed with Docker/nginx configs |
| Tests | 0 | No test runner, no tests |
| Linting | 0 | No ESLint config |
| docs/ | 1 file | Only MAF_RULES_SUMMARY.md |

## Duplicate Files to Remove
- `Dockerfile.txt` (duplicate of `Dockerfile`)
- `dockerignore.txt` (duplicate of `.dockerignore`)
- `nginx.txt` (duplicate of `nginx.conf`)

## Phases

| # | Phase | Status | Effort | Blocks |
|---|-------|--------|--------|--------|
| 1 | [Project structure migration](./phase-01-project-structure-migration.md) | Done | 1.5h | - |
| 2 | [Split App.tsx](./phase-02-split-app-monolith.md) | Done (concerns) | 3h | Phase 1 |
| 3 | [Split mafLogic.ts](./phase-03-split-maf-logic.md) | Done | 2h | Phase 1 |
| 4 | [Split MafLab.tsx](./phase-04-split-maf-lab.md) | Done | 1h | Phase 1 |
| 5 | [Add Vitest + unit tests](./phase-05-add-vitest-unit-tests.md) | Done (concerns) | 2h | Phase 3 |
| 6 | [Add ESLint](./phase-06-add-eslint-config.md) | Done (concerns) | 1h | Phase 1 |
| 7 | [Update docs](./phase-07-update-documentation.md) | Done | 1.5h | Phase 2,3,4 |
| 8 | [Red team remediation](./phase-08-red-team-remediation.md) | Done | 3h | Phase 2,5,6 |

## Dependency Graph
```
Phase 1 (structure)
  |---> Phase 2 (split App.tsx)
  |---> Phase 3 (split mafLogic.ts) ---> Phase 5 (tests)
  |---> Phase 4 (split MafLab.tsx)
  |---> Phase 6 (ESLint)
  Phase 2,3,4 ---> Phase 7 (docs)
  Phase 2,5,6 ---> Phase 8 (red team remediation)
```

## Invariant
After EVERY phase: `npm run build` succeeds, app behavior unchanged.

## Red Team Review

### Session — 2026-04-06
**Findings:** 15 (8 accepted, 7 rejected)
**Severity breakdown:** 4 Critical, 4 High, 0 Medium (accepted only)
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Dockerfile COPY paths broken after src/ migration | Critical | Accept | Phase 1 |
| 2 | All 7 phase statuses stale ("Pending" but done) | Critical | Accept | plan.md |
| 3 | Plan invariant misses `docker build` — only checks local build | Critical | Accept | plan.md |
| 4 | `use-maf-calculator.ts` (367L) and `user-input-form.tsx` (340L) violate 200-line limit | Critical | Accept | Phase 2 |
| 5 | 8 ESLint errors remain including real React bugs (`set-state-in-effect`) | High | Accept | Phase 6 |
| 6 | Render loop risk: `use-user-profile.ts` effect watches+sets `commitment` | High | Accept | Phase 2 |
| 7 | `app-footer.tsx` created but never imported — dead code | High | Accept | Phase 2 |
| 8 | `calculateMAF` (290L orchestration) has zero test coverage | High | Accept | Phase 5 |
| 9 | CSP allows unsafe-inline/unsafe-eval | High | Reject | Out of refactor scope |
| 10 | No runtime input validation at module boundaries | High | Reject | TypeScript provides compile-time safety |
| 11 | Phase 2/3 parallel execution write conflict | High | Reject | Both phases complete; moot |
| 12 | Rollback strategy (`git checkout .`) is wrong | High | Reject | Phases complete; moot |
| 13 | 8 documentation files is overkill | High | Reject | Project policy decision |
| 14 | 12h budget is 4x reasonable | High | Reject | Historical; plan complete |
| 15 | Over-splitting into 39 files | High | Reject | Architecture working in production |

### Action Items (from accepted findings)
→ All tracked in [Phase 8: Red Team Remediation](./phase-08-red-team-remediation.md)

## Validation Log

### Session 1 — 2026-04-06
**Trigger:** Post red-team validation of completed plan with 8 accepted findings
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture]** The red team found `use-maf-calculator.ts` (367L) has a monolithic `calculateMAF` function. How should it be decomposed?
   - Options: Extract to pure util function | Split hook into smaller hooks | Leave as-is, just add tests
   - **Answer:** Extract to pure util function
   - **Rationale:** Moving `calculateMAF` body to `src/utils/maf-calculator-orchestrator.ts` makes it testable without React and reduces the hook to a thin wrapper.

2. **[Risk]** The render loop risk in `use-user-profile.ts`: an effect watches `commitment` and sets `commitment`. How should this be fixed?
   - Options: Move to event handlers | Guard with ref flag | Defer
   - **Answer:** Move to event handlers
   - **Rationale:** Commitment auto-adjustment belongs in `handleInputChange`/`handleCheckboxChange` where the triggering state change originates. Effects should sync with external systems, not cascade internal state.

3. **[Scope]** The Dockerfile COPY paths reference old root-level files. How should this be handled?
   - Options: Fix now as part of this plan | Create separate deployment fix plan
   - **Answer:** Fix now as part of this plan
   - **Rationale:** Quick fix, prevents broken Docker builds. No need for a separate plan.

4. **[Scope]** Should the 8 red team action items be addressed in this plan or tracked separately?
   - Options: Add Phase 8 to this plan | Create new follow-up plan | Cherry-pick critical only
   - **Answer:** Add Phase 8 to this plan
   - **Rationale:** Keeps everything in one place since the plan is already completed-with-concerns.

#### Confirmed Decisions
- `calculateMAF` decomposition: extract to pure util function in `src/utils/`
- Render loop fix: move commitment logic to event handlers
- Dockerfile: fix inline as Phase 8
- Scope: all 8 action items addressed in Phase 8

#### Impact on Phases
- Phase 2: Updated with concerns about file sizes and render loop
- Phase 5: Updated with concern about missing orchestration tests
- Phase 8: New phase created for all remediation work
