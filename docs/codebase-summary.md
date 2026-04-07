# Codebase Summary

## Overview

**Full-Stack Architecture:**
- **Frontend:** React 19 SPA (Vite, TypeScript, Tailwind) — `/src` directory
- **Backend:** NestJS 10 API (PostgreSQL, Redis, JWT RS256) — `/api` directory
- **Total Files:** 60+ source files (frontend + backend) + tests
- **Total LOC:** ~6,500 lines (frontend + backend combined)
- **Frontend Entry:** `src/index.tsx` (React), `src/app.tsx` (root component)
- **Backend Entry:** `api/src/main.ts` (NestJS bootstrap)
- **Build:** Vite (frontend) + NestJS (backend), Docker multi-stage

## Directory Structure

### Frontend (`src/` ~3,800 lines)

├── index.tsx (16 lines)
│   React 19 entry point. Mounts App to #root.
│
├── app.tsx (119 lines)
│   Root component. Manages activeTab ('PLAN'|'LAB'), verifiedMafPace state.
│   Orchestrates: UserInputForm, ResultDisplay, MafLab, modal components.
│   Hooks: useUserProfile, useMafCalculator, useProbationAutoUnlock.
│   NOTE: Protected by AuthGuard, redirects to /login if not authenticated.
│
├── types.ts (56 lines)
│   Interfaces: UserProfile, MafResult, ScheduleItem
│   Enums: ExperienceLevel (NONE, INCONSISTENT, REGULAR_NEW, ADVANCED)
│          CommitmentLevel (HEALTH, BASE, PERFORMANCE)
│
├── constants.ts (71 lines)
│   EXPERIENCE_OPTIONS: scoring for each level
│   COMMITMENT_CARDS: Heart/Flame/Zap icons + descriptions
│   SCHEDULES: 3 weekly templates (7-day each)
│
├── index.css
│   Tailwind imports + minimal global styles.
│
├── components/ (~1,100 lines, 30+ files)
│   Functional React components (no class components):
│   
│   Auth:
│   ├── auth/login-button.tsx — WP OAuth2 PKCE flow trigger
│   ├── auth/logout-button.tsx — Clear JWT cookie, redirect /login
│   
│   Layout & Navigation:
│   ├── app-header.tsx — Logo + title bar, auth status
│   ├── app-footer.tsx — Bottom footer
│   ├── tab-navigation.tsx — PLAN | LAB tabs
│   ├── dashboard/ — Dashboard cards (maf-zone-card, etc.)
│   ├── ui/dashboard-card.tsx — Reusable card component
│
│   User Input & Selectors:
│   ├── user-input-form.tsx — Orchestrator (104L), imports sub-forms
│   ├── form-personal-info.tsx — Age, height, weight inputs (81L)
│   ├── form-health-checklist.tsx — Health condition checkboxes (79L)
│   ├── form-pace-and-long-run.tsx — Pace comparison, long-run history (168L)
│   ├── commitment-selector.tsx — 3-card selector (HEALTH/BASE/PERFORMANCE)
│   
│   Results Display:
│   ├── result-display.tsx — Container for all result components
│   ├── result-heart-rate-card.tsx — MAF zone + BMI category
│   ├── result-schedule-table.tsx — 7-day training plan
│   ├── result-alerts-section.tsx — Notes + warnings
│   ├── result-mindset-card.tsx — Motivational message by experience
│   ├── result-children-display.tsx — Children mode (<16) guidance
│   ├── volume-adjustment-card.tsx — Progress/regression indicator
│   ├── probation-alert.tsx — Injury recovery 14-day countdown
│   
│   MAF Lab (Verification):
│   ├── maf-lab.tsx — 3-step wizard container
│   ├── maf-lab-step-checklist.tsx — Warmup instructions
│   ├── maf-lab-step-data-entry.tsx — Pace + HR input form
│   ├── maf-lab-step-results.tsx — Verified pace display
│   
│   Guide Page:
│   ├── guide/guide-getting-started.tsx — Welcome section
│   ├── guide/guide-plan-tab.tsx — Schedule explanation
│   ├── guide/guide-lab.tsx — Lab instructions
│   ├── guide/guide-results.tsx — Results interpretation
│   ├── guide/guide-special-cases.tsx — Children, seniors, injured
│   
│   Modals:
│   ├── welcome-modal.tsx — First-visit info (localStorage-gated)
│   └── recovery-modal.tsx — Injury recovery info
│
├── hooks/ (~500 lines, 5 files)
│   Custom React hooks (state management):
│
│   ├── use-user-profile.ts (181 lines)
│   │   State: userProfile (localStorage persisted)
│   │   Handlers: handleInputChange, handleBlur, handleCheckboxChange,
│   │            handleCommitmentSelect, handleRecoveryConfirm
│   │   Computed: ageNum, isSenior, isChild, isNewbie, getBMI()
│   │
│   ├── use-maf-calculator.ts (93 lines, thin wrapper)
│   │   Wraps pure calculateMAF() from utils/maf-calculator-orchestrator.ts
│   │   Manages result state, calls setState, handles scroll-to-result
│   │   Exports: calculateMAF(), calculateRawMaf(), getVolumeCapText()
│   │
│   ├── use-probation.ts (38 lines)
│   │   Auto-unlock injury probation after 14 days
│   │
│   ├── use-garmin-auto-fill.ts (~80 lines)
│   │   Fetches latest Garmin running activity (HR, distance, duration)
│   │   Returns null if no recent activity or on error
│   │   Gated by FEATURE_GARMIN env var
│   │
│   └── use-strava-auto-fill.ts (~80 lines)
│       Fetches latest Strava running activity (HR, distance, duration)
│       Returns null if no recent activity or on error
│       Gated by VITE_FEATURE_STRAVA env var (mirrors Garmin hook)
│
├── contexts/
│   ├── auth-context.tsx — Global auth state (user, token, loading)
│   └── user-context.tsx — User profile state (synced with backend)
│
├── pages/
│   ├── login-page.tsx — WordPress SSO login screen
│   ├── dashboard-page.tsx — Authenticated user dashboard (dark theme)
│   ├── profile-page.tsx — User profile management, server sync
│   └── guide-page.tsx (121 lines) — /guide route with 5 guide sections
│
├── types.ts (55 lines) — TypeScript interfaces & enums
├── constants.ts (70 lines) — Schedules, commitment cards, experience options
│
└── utils/ (~1,050 lines, 9 files + 6 tests)
    Pure functions (no state, no side effects):

    ├── maf-logic.ts (12 lines) — Barrel export for all utilities
    ├── maf-types.ts (31 lines) — VOLUME_CAPS, type enums
    ├── maf-calculator-orchestrator.ts (197 lines) — Pure calculateMAF() function
    ├── maf-calculator-schedule-builder.ts (198 lines) — Schedule building logic extracted
    ├── maf-schedule-generator.ts (54 lines) — getWeeklySchedule(commitment)
    ├── maf-safety-adjustments.ts (92 lines) — BMI ≥30 walking swap, age 60+ caps
    ├── maf-smart-long-run.ts (177 lines) — History-based long-run ±10% adjustment
    ├── maf-volume-cap.ts (128 lines) — Enforce weekly minute caps per commitment
    ├── maf-session-formatter.ts (40 lines) — 15/15 warmup/main/cool breakdown
    │
    └── __tests__/ (6 files, ~600 LOC)
        ├── maf-calculator-orchestrator.test.ts (15 tests)
        ├── maf-safety-adjustments.test.ts
        ├── maf-schedule-generator.test.ts
        ├── maf-session-formatter.test.ts
        ├── maf-smart-long-run.test.ts
        └── maf-volume-cap.test.ts
```

---

## Component Hierarchy

```
App
├─ activeTab: 'PLAN' | 'LAB'
├─ verifiedMafPace: string | null
├─ WelcomeModal
├─ RecoveryModal
├─ AppHeader
├─ TabNavigation
└─ main
   ├─ PLAN Tab
   │  ├─ UserInputForm
   │  │  ├─ Age/Height/Weight inputs
   │  │  ├─ ExperienceLevel selector
   │  │  ├─ Health checkboxes (recovery, medicated, etc.)
   │  │  ├─ CommitmentSelector (3 cards)
   │  │  ├─ PaceComparison section
   │  │  ├─ LongRunHistory inputs
   │  │  └─ Calculate button
   │  │
   │  └─ ResultDisplay (conditional)
   │     ├─ ResultHeartRateCard
   │     ├─ VolumeAdjustmentCard (if progress/regression)
   │     ├─ ResultScheduleTable
   │     ├─ ResultAlertsSection
   │     └─ ResultMindsetCard
   │
   └─ LAB Tab
      └─ MafLab (3-step wizard)
         ├─ Step 1: Warmup checklist
         ├─ Step 2: Pace + HR entry
         └─ Step 3: Verified results
```

---

## Key Files & Responsibilities

### Core Application Files

**`app.tsx` (119 lines)**
- Root component: orchestrates PLAN and LAB tabs
- Manages tab state + verified pace state
- Delegates to hooks for business logic
- Minimal—mostly JSX composition

**`types.ts`**
```typescript
interface UserProfile {
  age, height, weight, experience, commitment
  isRecovering, isMedicatedOrInjured, isMedicalClearanceConfirmed
  previousMonthPace, lastLongRunDuration/HR/Feeling
  isProbation, probationStartDate
}

interface MafResult {
  mafHeartRate, lowerZone, upperZone
  schedule: ScheduleItem[], notes, mindset
  explanation, volumeAdjustmentMessage, longRunAdjustmentMessage
}

interface ScheduleItem {
  day, activity, duration, type: RUN|LONG_RUN|REST|WALK|CROSS_TRAIN|RECOVERY
}

enum CommitmentLevel { HEALTH, BASE, PERFORMANCE }
enum ExperienceLevel { NONE, INCONSISTENT, REGULAR_NEW, ADVANCED }
```

**`constants.ts`**
- `EXPERIENCE_OPTIONS`: Score adjustments per experience level
- `COMMITMENT_CARDS`: UI config for 3 commitment levels
- `SCHEDULES`: Base weekly schedules (3 commitment levels × 7 days)

### Hooks (State Management)

**`use-user-profile.ts`**
- Manages runner profile (age, weight, commitment, etc.)
- localStorage persistence
- Input validation (age range, BMI calculation)
- Computed values (isSenior, isChild, isNewbie, getBMI)
- Handles all input change events

**`use-maf-calculator.ts`**
- Core calculation logic
- `calculateRawMaf`: Base formula (180 - age) + adjustments
- `calculateMAF`: Full pipeline including schedule generation, adjustments, formatting
- Scrolls result into view on completion
- Returns `MafResult` state + helper functions

**`use-probation.ts`**
- Monitors injury recovery probation status
- Auto-unlocks after 14 days
- Updates user profile when timer expires

### Components (UI)

**Data Input Layer:**
- `user-input-form.tsx`: Collects all inputs (age, weight, health status, etc.)
- `commitment-selector.tsx`: 3 card selector (HEALTH, BASE, PERFORMANCE)
- `maf-lab.tsx`: Verification lab in 3 steps

**Display Layer:**
- `result-display.tsx`: Container combining all result cards
- `result-heart-rate-card.tsx`: Shows MAF zones + BMI category
- `result-schedule-table.tsx`: Renders 7-day plan with session details
- `result-alerts-section.tsx`: Displays all notes + warnings
- `result-mindset-card.tsx`: Motivational quote customized to experience level
- `volume-adjustment-card.tsx`: Progress/regression indicator

**Modals:**
- `welcome-modal.tsx`: First-visit info (localStorage-gated)
- `recovery-modal.tsx`: Injury guidance modal

### Utilities (Calculation)

**`maf-logic.ts`**
- Barrel re-export for backward compatibility
- Imports all submodules

**`maf-schedule-generator.ts`**
- `getWeeklySchedule(commitment)`: Returns base schedule from constants

**`maf-safety-adjustments.ts`**
- `adjustScheduleForSafety(schedule, userProfile, bmi)`:
  - Swap Run → Walk if BMI ≥ 30
  - Swap Wed intensity if age ≥ 60
  - Add senior-specific messaging

**`maf-session-formatter.ts`**
- `formatSessionDetails(duration, mafHR, type)`:
  - Generate "Warm Xmin | Main Ymin | Cool Zmin"
  - Applies 15/15 rule (warm/cool = duration/3 up to 10min)

**`maf-smart-long-run.ts`**
- `calculateSmartLongRun(lastDuration, lastHR, maf, commitment, age, experience, feeling)`:
  - Check if last long-run was hard (HR > MAF + 5)
  - Suggest ±10% adjustment
  - Age/experience caps

**`maf-volume-cap.ts`**
- `enforceWeeklyVolumeCap(schedule, commitment)`:
  - Calculate total weekly minutes
  - Compare to VOLUME_CAPS[commitment]
  - Reduce if exceeds (preserve rest days)

**`maf-types.ts`**
- `VOLUME_CAPS`: Max weekly minutes + max long-run minutes per level

---

## Data Flow Example

```
User enters age=40, weight=70kg, height=175cm, commits to BASE
  ↓
[Calculate] clicked
  ↓
use-maf-calculator.calculateMAF() starts:
  ├─ calculateRawMaf({...}) → 140 (180-40)
  ├─ getBMI() → 22.9 (normal)
  ├─ getWeeklySchedule(BASE) → 7 default items
  ├─ adjustScheduleForSafety(...) → no change (BMI normal, age <60)
  ├─ parsePaceToSeconds(verifiedMafPace) → if compared
  ├─ calculateSmartLongRun(...) → if history exists
  ├─ enforceWeeklyVolumeCap(...) → cap at 360min max
  ├─ formatSessionDetails(...) for each run
  └─ setResult({...}) → re-render
  ↓
ResultDisplay renders:
  ├─ "YOUR MAF HEART RATE: 140"
  ├─ "7-DAY TRAINING SCHEDULE"
  └─ Alerts: "Your schedule is capped at 360 min/week"
```

---

### Backend (`api/` ~2,700 lines)

```
api/
├── src/
│   ├── main.ts (NestJS bootstrap)
│   ├── app.module.ts (root module, imports all feature modules)
│   │
│   ├── auth/ (OAuth2 + JWT RS256)
│   │   ├── auth.controller.ts — POST /auth/initiate, GET /auth/callback
│   │   ├── auth.service.ts — PKCE flow, token generation, WP user fetch
│   │   ├── auth.types.ts — TokenPayload, WpUserInfo interfaces
│   │   ├── jwt.strategy.ts — JWT RS256 validation strategy
│   │   ├── auth.guard.ts — JwtAuthGuard for protected routes
│   │   └── auth.module.ts
│   │
│   ├── user/ (User management)
│   │   ├── user.controller.ts — GET /users/:id, POST /users
│   │   ├── user.service.ts — CRUD operations
│   │   └── user.module.ts
│   │
│   ├── profile/ (Training profiles)
│   │   ├── profile.controller.ts — GET/POST/PATCH /profile
│   │   ├── profile.service.ts — Profile persistence, history
│   │   ├── profile.dto.ts — CreateProfileDto, UpdateProfileDto
│   │   └── profile.module.ts
│   │
│   ├── health/ (Docker healthcheck)
│   │   ├── health.controller.ts — GET /health
│   │   └── health.module.ts
│   │
│   ├── garmin/ (Garmin device sync — gated by FEATURE_GARMIN)
│   │   ├── garmin.controller.ts — endpoints: connect, disconnect, status, sync, activities, daily-summary
│   │   ├── garmin.service.ts — business logic, connection queries
│   │   ├── garmin-sync.service.ts — sync engine (fetch + upsert from Garmin)
│   │   ├── garmin-cron.service.ts — 2-hour cron job
│   │   ├── garmin-encryption.service.ts — AES-256-GCM encrypt/decrypt credentials
│   │   ├── garmin-connect.dto.ts — connect request DTO
│   │   ├── garmin-activity.dto.ts — activity query DTOs
│   │   └── garmin.module.ts
│   │
│   ├── strava/ (Strava activity sync + webhook — gated by FEATURE_STRAVA)
│   │   ├── strava.controller.ts — GET/POST /webhook, GET /activities, GET /activities/:id, connect, disconnect, sync
│   │   ├── strava.service.ts — business logic, connection management, getActivities()
│   │   ├── strava-sync.service.ts — sync engine (paginated fetch + upsert, dedup, rate-limit handling)
│   │   ├── strava-webhook.service.ts — webhook subscription, event processing, challenge validation
│   │   ├── strava-cron.service.ts — daily 3am cron fallback (25h threshold, Redis global lock)
│   │   ├── strava-encryption.service.ts — AES-256 encrypt/decrypt OAuth2 tokens
│   │   ├── dto/strava-activity-query.dto.ts — page, limit, type, excludeDuplicates filters
│   │   └── strava.module.ts
│   │
│   └── shared/
│       ├── prisma.service.ts — PostgreSQL ORM (User, UserProfile, GarminConnection, GarminActivity, StravaConnection, StravaActivity)
│       ├── redis.service.ts — Session + cache (PKCE state, JWT, profiles, sync locks)
│       └── shared.module.ts
│
├── prisma/
│   ├── schema.prisma (User, UserProfile models + migrations)
│   └── migrations/
│
├── package.json (NestJS 10, @nestjs/jwt, prisma, redis)
├── Dockerfile (Node Alpine, pm2 process manager)
├── .env.example (DATABASE_URL, REDIS_URL, JWT keys, OAuth2 secrets)
└── tsconfig.json (ES2022, strict mode)
```

---

## Technology Stack

### Frontend Dependencies
```json
{
  "react": "19.2.0",           // UI framework
  "react-dom": "19.2.0",       // DOM rendering
  "lucide-react": "0.554.0",   // Icons (tree-shaken)
  "vite": "6.2.0",             // Build tool
  "tailwindcss": "3.4.15",     // Styling
  "typescript": "5.8.2",       // Type checking
  "eslint": "9.39.4",          // Linting
  "vitest": "3.0.0"            // Testing
}
```

No external state management (Redux, Zustand) — hooks + Context API.
No API client (axios) — fetch + HTTPS cookies only.

### Backend Dependencies
```json
{
  "@nestjs/common": "10.x",     // Core framework
  "@nestjs/jwt": "12.x",        // JWT signing/verification
  "@nestjs/passport": "10.x",   // Auth strategies
  "passport-jwt": "4.x",        // JWT strategy
  "prisma": "5.x",              // ORM for PostgreSQL
  "redis": "4.x",               // Session storage
  "@nestjs/config": "3.x",      // Environment config
  "typescript": "5.8.2"
}
```

**Infrastructure:**
- PostgreSQL 15 Alpine — User + Profile storage
- Redis 7 Alpine — Session + PKCE state cache
- Node Alpine — PM2 process manager for NestJS

---

## Testing

**Framework:** Vitest 3.0.0 + v8 coverage

**Coverage:** 162 tests, 98% on src/utils/ (commit: 83d57ca)

Test files: `src/utils/__tests__/*.test.ts`
- `maf-safety-adjustments.test.ts` — BMI safety logic
- `maf-schedule-generator.test.ts` — Schedule generation per level
- `maf-session-formatter.test.ts` — Warmup/main/cool breakdown
- `maf-smart-long-run.test.ts` — History-based adjustments
- `maf-volume-cap.test.ts` — Weekly cap enforcement

Excluded: `maf-logic.ts`, `maf-types.ts` (barrel + constants)

---

## Build & Deployment

**Development:**
```bash
npm run dev → http://localhost:5173 (Vite dev server)
```

**Production:**
```bash
npm run build → dist/ (optimized, chunked, source maps removed)
```

**Docker:**
- Multi-stage: build in Node Alpine, serve with Nginx Alpine
- Image size: ~50-60MB
- Non-root user security

**Server:**
- Nginx serves SPA from `/dist`
- CSP + security headers active
- Cloudflare Tunnel frontend (token-based, no exposed ports)

---

## Configuration Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Build config, test setup, sourcemap removal |
| `tsconfig.json` | ES2022 target, module resolution |
| `tailwind.config.js` | Custom colors (maf-purple, maf-pink, maf-orange) |
| `Dockerfile` | Multi-stage build (deps → builder → nginx runtime) |
| `docker-compose.yml` | Production services (maf-app, postgres, n8n, cloudflared) |
| `nginx.conf` | SPA routing, CSP headers, gzip compression |
| `.eslintrc.cjs` | ESLint 9 rules (hooks, no console in prod) |

---

---

## Authentication Flow: WordPress SSO + JWT

```
User clicks "Login with WordPress"
  ↓
Frontend calls POST /api/auth/initiate
  ↓ API generates PKCE code verifier + challenge
Backend stores in Redis (5min TTL)
  ↓ Returns WordPress OAuth2 authorize URL
Frontend redirects to WordPress SSO
  ↓
User authenticates @ maf.run (WordPress)
  ↓ WordPress redirects back with auth code + state
Frontend redirects to GET /api/auth/callback?code=X&state=Y
  ↓
Backend verifies state, exchanges code for access token (PKCE)
  ↓ Fetches user info from WordPress API
Backend creates/updates User in PostgreSQL
  ↓ Generates JWT RS256 signed token
Backend sets HTTP-only cookie (JWT)
  ↓ Redirects to frontend /dashboard
Frontend reads cookie, hydrates AuthContext
  ↓
User is authenticated for next 24h (JWT exp)
```

---

**Last Updated:** April 7, 2026 (Strava Integration Phase 4 — Cron Fallback & MAF Lab) | **Version:** 1.5.0
