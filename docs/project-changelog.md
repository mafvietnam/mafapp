# Project Changelog

All notable changes to MAF Running Coach are documented here.

---

## [1.0.0] — 2026-03-30 (Release)

### Major: Full Modernization Refactor

**Scope:** Complete restructuring of codebase to improve maintainability, testability, and developer experience.

### Changed

#### Architecture & File Organization
- Migrated from flat structure to modular `src/` organization
  - New: `src/components/`, `src/hooks/`, `src/utils/`
  - Old: `components/`, `utils/` at root
- Split monolithic `App.tsx` (1,113 lines) → thin orchestrator (119 lines)
  - Extracted state management → `use-user-profile.ts`, `use-maf-calculator.ts`
  - Extracted features → `use-probation.ts`
- Refactored `mafLogic.ts` (552 lines) into modular utilities
  - `maf-schedule-generator.ts` — base schedule logic
  - `maf-safety-adjustments.ts` — BMI/age safety adjustments
  - `maf-session-formatter.ts` — workout detail formatting
  - `maf-smart-long-run.ts` — history-based long-run calculation
  - `maf-volume-cap.ts` — weekly volume enforcement
  - `maf-types.ts` — shared constants
  - `maf-logic.ts` — barrel re-export for backward compatibility

#### Component Split
- Split `MafLab.tsx` (314 lines) into focused components
  - `maf-lab.tsx` — main container (143 lines)
  - `maf-lab-step-checklist.tsx` — warmup instructions
  - `maf-lab-step-data-entry.tsx` — pace/HR input form
  - `maf-lab-step-results.tsx` — verified pace display
- Split `ResultDisplay.tsx` into reusable cards
  - `result-heart-rate-card.tsx`
  - `result-schedule-table.tsx`
  - `result-alerts-section.tsx`
  - `result-mindset-card.tsx`
  - `volume-adjustment-card.tsx`
  - `result-children-display.tsx`
  - `probation-alert.tsx`

#### Tooling & Quality
- Upgraded to **ESLint 9** (from older config)
  - Added `@eslint/js`, `typescript-eslint/8.57.2`
  - Enforces React hooks rules, no unused variables
  - Auto-fix with `npm run lint:fix`
- Added **Vitest 3.0.0** testing framework
  - Unit tests for utility functions
  - Coverage target: 70%+ on utils
  - Watch mode: `npm run test:watch`
  - Coverage report: `npm run test:coverage`
- All files now <200 lines per file (optimal context)
- Import ordering standardized (React → types → hooks → utils → components)

#### TypeScript Improvements
- Explicit return types on all public functions
- Consistent use of enums for fixed sets
- Strict null checks enabled
- Better error messages in calculations

### Added

#### Documentation Suite (NEW)
- `docs/project-overview-pdr.md` — Product vision & tech stack
- `docs/code-standards.md` — File naming, patterns, conventions
- `docs/codebase-summary.md` — Directory tree with descriptions
- `docs/system-architecture.md` — Data flow & component hierarchy
- `docs/design-guidelines.md` — Tailwind colors, typography, components
- `docs/deployment-guide.md` — Docker, Nginx, Cloudflare setup
- `docs/development-roadmap.md` — Phases 1-7 done, future roadmap
- `docs/project-changelog.md` — This file

#### New Utility Modules
- `src/utils/maf-session-formatter.ts` — Extracts 15/15 rule logic
- `src/utils/maf-smart-long-run.ts` — Smart long-run calculation
- `src/utils/maf-volume-cap.ts` — Weekly volume enforcement

#### Testing Infrastructure
- Vitest configuration in `vite.config.ts`
- Test files: `src/utils/*.test.ts`
- Coverage exclusions: `maf-logic.ts`, `maf-types.ts`

### Fixed

- Removed dead code paths in App.tsx
- Improved error messages for invalid BMI/age
- Resolved prop drilling (consolidated into hooks)
- Fixed race condition in probation auto-unlock (use useEffect deps)

### Performance

- **Bundle size:** Unchanged (~200KB gzipped post-minification)
- **Initial load:** <500ms first paint (maintained)
- **Calculation speed:** <100ms MAF calculation (improved with modular math)
- **Re-renders:** Optimized with hook memoization

### Deprecated

- Old file structure (flat root) — use `src/` from now on
- Direct imports from `utils/mafLogic.ts` still work via barrel re-export

### Technical Details

**Key Principles Applied:**
- **DRY:** No repeated logic; utilities extracted
- **KISS:** Components small & focused
- **YAGNI:** Only code we know we need (no "future-proofing")

**File Size Reductions:**
- App.tsx: 1,113 → 119 lines (-89%)
- MafLab.tsx: 314 → 143 lines (-54%)
- Total: Avg file size now 100-150 lines (was 300+)

**Developer Experience:**
- Faster onboarding (smaller files, clear responsibilities)
- Easier debugging (modular code, pure functions)
- Better testing (isolated logic in utils)
- Faster CI/CD (smaller diffs per commit)

---

## [0.9.0] — 2025-11-27 (Pre-modernization)

### Last Monolithic Release

**Features:**
- ✅ MAF calculator (base formula + adjustments)
- ✅ Training schedule generation (3 commitment levels)
- ✅ Lab mode (heart-rate verification)
- ✅ Pace comparison (progress detection)
- ✅ Probation mode (injury recovery)
- ✅ BMI-based adjustments
- ✅ Volume caps & smart long-run

**Status:** Functional but high technical debt
- Large components (300+ lines)
- Complex interdependencies
- Limited test coverage
- Difficult to modify

---

## Versioning

Following Semantic Versioning (MAJOR.MINOR.PATCH):
- **MAJOR:** Breaking changes (auth, database schema)
- **MINOR:** New features (history tracking, visualization)
- **PATCH:** Bug fixes, documentation updates

---

## Next Release: v1.1.0 (Planned Q2 2026)

**Planned Additions:**
- User authentication (email/OAuth)
- Training history persistence
- Cloud backup (AWS S3 or similar)
- Bug fixes from v1.0 feedback

---

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
