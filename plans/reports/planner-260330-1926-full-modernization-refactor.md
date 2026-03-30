# Planner Report: Full Modernization Refactor

**Date:** 2026-03-30
**Plan:** `plans/260330-1924-full-modernization-refactor/`

## Summary

Created 7-phase modernization plan for MAF Running Coach app. Pure refactor — no UI/feature changes.

## Codebase Analysis

| File | Lines | Core Problem |
|------|-------|-------------|
| App.tsx | 1,113 | Monolith: state + logic + 600 lines JSX |
| utils/mafLogic.ts | 552 | All calc logic in one file, 6 distinct concerns |
| components/MafLab.tsx | 314 | Over 200-line limit, 3 distinct steps |
| Root dir | — | Source mixed with Docker/nginx configs |

Duplicates found: `Dockerfile.txt`, `dockerignore.txt`, `nginx.txt`

## Phase Plan

| # | Phase | Effort | Blocks | Key Output |
|---|-------|--------|--------|------------|
| 1 | Structure migration (src/) | 1.5h | — | Move 10 files, update 4 configs, delete 3 dupes |
| 2 | Split App.tsx | 3h | P1 | 3 hooks + 12 UI components, app.tsx -> ~100 lines |
| 3 | Split mafLogic.ts | 2h | P1 | 6 focused modules + barrel re-export |
| 4 | Split MafLab.tsx | 1h | P1 | 3 step sub-components |
| 5 | Vitest + tests | 2h | P3 | ~37 unit tests for all calc logic |
| 6 | ESLint config | 1h | P1 | Flat config, TypeScript + React rules |
| 7 | Documentation | 1.5h | P2,3,4 | 8 docs in docs/ |

**Total effort:** ~12h

## Key Decisions

1. **Barrel re-export** for maf-logic.ts split — existing imports don't break
2. **Hooks pattern** for App.tsx — `useUserProfile`, `useMafCalculator`, `useProbation`
3. **No external state lib** — app is small enough for hooks
4. **Vitest** over Jest — native Vite integration, zero config
5. **ESLint 9 flat config** — modern, minimal rules
6. **user-input-form.tsx may reach ~180 lines** — acceptable for JSX-heavy form; split only if needed

## File Ownership (No Parallel Conflicts)

- Phase 1: config files + file moves (all files)
- Phase 2: `src/app.tsx` + new hooks + new UI components
- Phase 3: `src/utils/` modules only
- Phase 4: `src/components/maf-lab*.tsx` only
- Phase 5: `src/utils/__tests__/` + package.json + vite.config.ts
- Phase 6: `eslint.config.js` + package.json
- Phase 7: `docs/` only

Phases 2, 3, 4 can run in parallel after Phase 1. Phase 5 needs Phase 3. Phase 7 needs 2+3+4.

## Invariant
After EVERY phase: `npm run build` succeeds, app behavior unchanged.

---

**Status:** DONE
**Summary:** 7-phase plan created with phase files, dependency graph, test matrix (~37 tests), and file ownership. All phases designed for incremental safety — build must pass after each.
