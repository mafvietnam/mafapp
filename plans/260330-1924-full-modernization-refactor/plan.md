---
title: "Full Modernization Refactor"
description: "Restructure monolith into src/, split giant files, add testing + linting + docs"
status: pending
priority: P1
effort: 12h
branch: dev
tags: [refactor, structure, testing, linting, docs]
created: 2026-03-30
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
| 1 | [Project structure migration](./phase-01-project-structure-migration.md) | Pending | 1.5h | - |
| 2 | [Split App.tsx](./phase-02-split-app-monolith.md) | Pending | 3h | Phase 1 |
| 3 | [Split mafLogic.ts](./phase-03-split-maf-logic.md) | Pending | 2h | Phase 1 |
| 4 | [Split MafLab.tsx](./phase-04-split-maf-lab.md) | Pending | 1h | Phase 1 |
| 5 | [Add Vitest + unit tests](./phase-05-add-vitest-unit-tests.md) | Pending | 2h | Phase 3 |
| 6 | [Add ESLint](./phase-06-add-eslint-config.md) | Pending | 1h | Phase 1 |
| 7 | [Update docs](./phase-07-update-documentation.md) | Pending | 1.5h | Phase 2,3,4 |

## Dependency Graph
```
Phase 1 (structure)
  |---> Phase 2 (split App.tsx)
  |---> Phase 3 (split mafLogic.ts) ---> Phase 5 (tests)
  |---> Phase 4 (split MafLab.tsx)
  |---> Phase 6 (ESLint)
  Phase 2,3,4 ---> Phase 7 (docs)
```

## Invariant
After EVERY phase: `npm run build` succeeds, app behavior unchanged.
