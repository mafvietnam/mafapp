# Scout Report — Docs Init Codebase Analysis

**Date:** 2026-04-06 | **Project:** app.maf.run (MAF Running Coach)

## Tech Stack
- React 19.2 + TypeScript 5.8 + Vite 6.2
- Tailwind CSS 3.4 + Lucide React 0.554 (pure Tailwind, no shadcn/ui)
- React Router v7.13.2 (2 routes: `/`, `/guide`)
- Vitest 3.0 (unit tests), ESLint 9.39
- Docker (multi-stage: node:20-alpine → nginx:1.25-alpine)
- Production: Cloudflare Tunnel + Nginx + N8N + PostgreSQL

## Architecture
- **Client-side SPA** — all MAF calculations in-browser, localStorage persistence
- **No backend dependency** for core features; N8N on api.maf.run for future automation
- **State:** 3 custom hooks (use-maf-calculator, use-user-profile, use-probation)
- **UI:** 24 components, prop drilling (no Redux/Context), mobile-first responsive

## Source Files (35 .ts/.tsx, ~4000 LOC excl. tests)

### Components (24 files, ~2000 LOC)
| Category | Files | Purpose |
|----------|-------|---------|
| Layout | app-header, app-footer, tab-navigation | Shell, nav |
| Form | user-input-form (341), commitment-selector (175) | User input, commitment gating |
| Modals | welcome-modal (102), recovery-modal (172), probation-alert (40) | Onboarding, recovery protocol |
| MAF Lab | maf-lab (143) + 3 step components | Multi-step test workflow |
| Results | result-display + 6 card components | HR zones, schedule, mindset |
| Guide | guide-page + 5 sub-sections (~670 LOC) | Vietnamese user documentation |

### Utils (7 files, ~850 LOC)
| File | LOC | Purpose |
|------|-----|---------|
| maf-smart-long-run.ts | 177 | HR-based long-run adjustment (core intelligence) |
| maf-volume-cap.ts | 128 | Weekly volume caps per commitment level |
| maf-safety-adjustments.ts | 92 | BMI/age/experience/recovery safety rules |
| maf-schedule-generator.ts | 54 | Template schedules (HEALTH/BASE/PERFORMANCE) |
| maf-session-formatter.ts | 40 | Session warm-up/cool-down formatting |
| maf-types.ts | 31 | Domain types (VolumeCap, SmartLongRunResult) |
| maf-logic.ts | 12 | Barrel re-export |

### Hooks (3 files, ~580 LOC)
| Hook | LOC | Purpose |
|------|-----|---------|
| use-maf-calculator | 367 | Orchestrates full MAF pipeline: raw HR → schedule → safety → volume cap → format |
| use-user-profile | 181 | Form state, validation, commitment gating, recovery flow |
| use-probation | 38 | 14-day auto-unlock after injury recovery |

### Config
| File | Key Details |
|------|-------------|
| package.json | React 19.2, Vite 6.2, Vitest 3.0, Tailwind 3.4 |
| Dockerfile | 3-stage build, ~50-60MB final image |
| docker-compose.yml | 4 services: maf-app, postgres, n8n, cloudflared |
| nginx.conf | Security headers, gzip, SPA routing, caching strategy |
| tsconfig.json | ES2022, @/* path alias |
| tailwind.config.js | Custom maf colors (purple/pink/orange), Inter font |

## Data Flow
```
UserInput → use-user-profile (validation/gating)
  → use-maf-calculator.calculateMAF()
    → calculateRawMaf (180 - age ± adjustments)
    → getWeeklySchedule (template by commitment)
    → adjustScheduleForSafety (BMI/age/experience/recovery rules)
    → adjustForProbation (30% reduction if recovering)
    → calculateSmartLongRun (HR zone analysis + 10% rule)
    → enforceWeeklyVolumeCap (reduce easy runs first)
    → formatSessionDetails (15/15 warm-up/cool-down)
  → MafResult → ResultDisplay (cards, schedule, mindset)
```

## Test Suite (5 files, ~500 LOC)
- Vitest with v8 coverage targeting src/utils/**
- Tests: smart-long-run, volume-cap, safety-adjustments, schedule-generator, session-formatter

## Key Patterns
1. Pure functional utilities (no side effects), testable in isolation
2. Safety-first rules engine: 6+ rules with proper precedence
3. Vietnamese-only UI (no i18n library)
4. Component hierarchy: App → tabs → form/results/lab
5. 13-chapter Maffetone methodology integration
6. Progressive validation: bounds on blur, commitment gating, pre-calc validation
