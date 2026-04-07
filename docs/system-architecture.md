# System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      MAF RUNNING COACH                   │
├─────────────────────────────────────────────────────────┤
│  Frontend (React 19 SPA)      Backend (NestJS API)       │
│  ├─ /app.maf.run             ├─ /api.maf.run             │
│  ├─ React 19, Vite, Tailwind │ ├─ PostgreSQL 15          │
│  └─ Cloudflare Tunnel        │ ├─ Redis 7 (sessions)     │
│                              └─ JWT RS256 auth           │
│  Data: localStorage           Data: server-side profiles │
│        (legacy, deprecated)        + history             │
└─────────────────────────────────────────────────────────┘
```

## Frontend: MAF Calculation Flow

```
UserInputForm (React component)
    ↓ userProfile state
useUserProfile hook
    ├─ localStorage persistence (for offline MAF calculation)
    └─ Server-side profile via API (when authenticated)
    ↓
[Calculate button]
    ↓
useMafCalculator hook
    ├─ 1. Parse & validate inputs
    ├─ 2. Calculate base MAF (180 - age)
    ├─ 3. Apply adjustments (recovery, injury, experience, probation)
    ├─ 4. Get base schedule (HEALTH|BASE|PERFORMANCE)
    ├─ 5. Apply BMI safety (walking if BMI ≥ 30)
    ├─ 6. Compare pace vs. previous month
    ├─ 7. Smart long-run adjustment (history-based)
    ├─ 8. Enforce volume caps
    ├─ 9. Apply 15/15 session formatting
    └─ 10. Return MafResult object
    ↓
ResultDisplay component
    ├─ ResultHeartRateCard (MAF zone + BMI)
    ├─ VolumeAdjustmentCard (progress/regression message)
    ├─ ResultScheduleTable (weekly plan)
    └─ ResultAlertsSection (notes + warnings)
```

---

## Frontend: Component Tree & Routes

```
App (App.tsx)
├─ Auth Context (checks JWT cookie)
├─ Protected Routes (AuthGuard)
│   ├─ /login → LoginPage
│   │  └─ WP SSO OAuth2 PKCE flow
│   │
│   ├─ /dashboard → DashboardPage (authenticated)
│   │  └─ User's MAF zone, recent results, training history
│   │
│   ├─ /profile → ProfilePage (authenticated)
│   │  └─ User profile management, server-side sync
│   │
│   ├─ /app → AppPageWrapper (with nav)
│   │  ├─ PLAN Tab ──────────────────────────
│   │  │  ├─ UserInputForm (orchestrator)
│   │  │  │  ├─ FormPersonalInfo (Age/Height/Weight)
│   │  │  │  ├─ FormHealthChecklist (Recovery, medicated, etc.)
│   │  │  │  ├─ CommitmentSelector (3 cards: HEALTH/BASE/PERFORMANCE)
│   │  │  │  ├─ FormPaceAndLongRun (Pace comparison, long-run history)
│   │  │  │  └─ Calculate button
│   │  │  │
│   │  │  └─ ResultDisplay (conditional render)
│   │  │     ├─ ResultHeartRateCard (MAF zone + BMI)
│   │  │     ├─ VolumeAdjustmentCard (progress/regression)
│   │  │     ├─ ResultScheduleTable (7-day plan)
│   │  │     ├─ ResultAlertsSection (notes + warnings)
│   │  │     ├─ ResultChildrenDisplay (if age <16)
│   │  │     └─ ResultMindsetCard (motivational)
│   │  │
│   │  └─ LAB Tab ──────────────────────────
│   │     └─ MafLab (3-step wizard)
│   │        ├─ Step 1: MafLabStepChecklist (warmup instructions)
│   │        ├─ Step 2: MafLabStepDataEntry (pace + HR input)
│   │        └─ Step 3: MafLabStepResults (verified pace display)
│   │
│   └─ /guide → GuidePage (public)
│      └─ 5 Vietnamese guide sections
│         ├─ GuideGettingStarted
│         ├─ GuidePlanTab
│         ├─ GuideLab
│         ├─ GuideResults
│         └─ GuideSpecialCases
```

---

## State Management

**App-level:**
- `activeTab` — 'PLAN' or 'LAB'
- `verifiedMafPace` — Pace from lab, used to override auto-selection

**useUserProfile hook:**
- Manages: age, height, weight, experience, commitment, health flags
- Stores in localStorage
- Returns: userProfile, handlers, computed flags (ageNum, isSenior, isChild, isNewbie, getBMI)

**useMafCalculator hook:**
- Manages: result (MafResult object)
- Calculates MAF when triggered
- Returns: result, calculateMAF function, helper utilities

**useProbationAutoUnlock hook:**
- Watches probation status
- Auto-clears after 14 days

---

## MAF Calculation Steps

### 1. Formula
```
MAF = 180 - age
if recovering:       MAF -= 10
if medicated/injury: MAF -= 5
if probation:        MAF -= 10
experience:          ±5
Zone = MAF ± 10 bpm
```

### 2. Schedule Selection
Choose base from constants based on commitment level:
- HEALTH: 3 runs/week, 45-60 min, 1 long-run
- BASE: 4-5 runs/week, 45-90 min, 1 long-run
- PERFORMANCE: 6 runs/week, 45-120 min, 1 long-run

### 3. BMI Safety Adjustments
- BMI ≥ 30: Replace all "Chạy" → "Đi bộ" (walking mode)
- BMI 25-29: Add "Jogging/" option, suggest walking
- Obese runners: Low-impact only

### 4. Pace Comparison Logic
If BOTH current + previous month pace exist:
```
delta = currentPace - previousPace
if delta < -10s:  Progress    → Long-run +10%
if delta > +10s:  Regression  → All activities -30%
else:             Stable      → Keep as-is
```

### 5. Smart Long-Run (History-based)
Check: lastLongRunDuration, lastLongRunHeartRate, lastLongRunFeeling
- HR > MAF + 5bpm: Tired → Reduce 10%
- HR < MAF - 5bpm: Good → Can maintain or +5%
- Age 60+: Cap at 90 min
- Newbie: Cap at 60 min

### 6. Volume Caps (Weekly Max)
- HEALTH: 240 min
- BASE: 360 min
- PERFORMANCE: 720 min

Reduce durations evenly if exceeded.

### 7. Probation Mode
If injury recovery active:
- All durations × 0.7 (70% volume)
- Auto-unlock after 14 days
- Separate -10 bpm MAF penalty

### 8. Session Formatting (15/15 Rule)
Each run/walk broken into:
```
Warmup 5min (50% MAF zone)
Main X min (100% MAF zone)
Cool 5min (50% MAF zone)
```

---

## Key Utilities

| File | Purpose |
|------|---------|
| `maf-calculator-orchestrator.ts` | Pure calculateMAF(profile) → MafResult (core logic) |
| `maf-calculator-schedule-builder.ts` | Schedule assembly, safety + volume adjustments |
| `maf-schedule-generator.ts` | getWeeklySchedule(level) → base ScheduleItem[] |
| `maf-safety-adjustments.ts` | Swap activities based on BMI/age |
| `maf-session-formatter.ts` | Add warmup/main/cool breakdown |
| `maf-smart-long-run.ts` | History-based long-run adjustment |
| `maf-volume-cap.ts` | Enforce weekly minute caps |
| `maf-types.ts` | VOLUME_CAPS constant |

---

## Data Structures

```typescript
interface UserProfile {
  age, height, weight: string
  experience: ExperienceLevel
  isRecovering, isMedicatedOrInjured: boolean
  commitment: CommitmentLevel
  previousMonthPace?: string
  isProbation?: boolean
  probationStartDate?: string
  lastLongRunDuration, lastLongRunHeartRate?: number
  lastLongRunFeeling?: 'GOOD' | 'TIRED' | 'VERY_TIRED'
}

interface MafResult {
  mafHeartRate: number
  lowerZone, upperZone: number
  schedule: ScheduleItem[]
  notes: string[]
  explanation?: string
  volumeAdjustmentMessage?: string
  longRunAdjustmentMessage?: string
  scheduleTitle: string
  mindset: string
  bmi: number
  bmiCategory: string
}
```

---

## Data Persistence

### Frontend (localStorage)
- **Legacy:** userProfile (age, height, weight, experience, commitment, health flags, probation status)
- **Session state:** Verified pace, temporary calculation results
- **MAF calculation:** 100% client-side (works offline)

### Backend (NestJS API)
- **PostgreSQL 15:**
  - User profiles (from WordPress SSO)
  - Training history (results, schedules)
  - User settings & preferences
  - Garmin data: GarminConnection (encrypted credentials), GarminActivity, GarminDailySummary
  
- **Redis 7:**
  - JWT token storage (RS256 signed)
  - OAuth2 PKCE state + verifier (5min TTL)
  - Session management
  - Garmin sync mutex locks (per-user + global)
  - Caching for frequently accessed profiles

### Authentication
- **WordPress OAuth2:** PKCE flow (most secure for SPAs)
- **JWT (RS256):** Asymmetric signing, RS256 private/public keys
- **Cookies:** HTTP-only, Secure, SameSite=Strict
- **CORS:** Restricted to app.maf.run

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| First paint | <500ms | Vite optimized build |
| TTI (Time to Interactive) | <1s (4G) | Mobile-first |
| MAF calculation | <100ms | Pure JS, no blocking |
| Re-render | <50ms | React batching, no Context API |
| Bundle size | <200KB gzipped | Excluding public assets |

---

## Edge Cases & Safety

| Scenario | Action |
|----------|--------|
| Age < 16 | Show "children mode" — no structured plan, play naturally |
| Age > 120 | Clamp to 120, alert user |
| BMI = 0 | Alert: invalid height/weight |
| BMI ≥ 30 | Force walking activities, joint health warning |
| Recovery flag unchecked | Alert: medical clearance required |
| In probation | -10 bpm MAF, 70% volume, 14-day auto-unlock countdown |
| No verified pace | Auto-select based on BMI (safe default) |

---

## Backend: NestJS API Architecture

```
api/ (NestJS 10)
├─ src/
│  ├─ app.module.ts (root)
│  │
│  ├─ auth/ (OAuth2 + JWT)
│  │  ├─ auth.controller.ts (POST /auth/initiate, GET /auth/callback)
│  │  ├─ auth.service.ts (PKCE, token generation, user creation)
│  │  ├─ auth.types.ts (TokenPayload, WpUserInfo interfaces)
│  │  ├─ jwt.strategy.ts (JWT RS256 validation)
│  │  ├─ auth.guard.ts (JwtAuthGuard)
│  │  └─ auth.module.ts
│  │
│  ├─ user/ (User management)
│  │  ├─ user.controller.ts (GET /users/:id, etc.)
│  │  ├─ user.service.ts (CRUD operations)
│  │  └─ user.module.ts
│  │
│  ├─ profile/ (Training profiles)
│  │  ├─ profile.controller.ts (POST /profile, PATCH /profile/:id)
│  │  ├─ profile.service.ts (profile persistence, history)
│  │  ├─ profile.dto.ts (CreateProfileDto, UpdateProfileDto)
│  │  └─ profile.module.ts
│  │
│  ├─ health/ (Liveness checks)
│  │  ├─ health.controller.ts (GET /health)
│  │  └─ health.module.ts
│  │
│  ├─ garmin/ (Garmin device sync — gated by FEATURE_GARMIN)
│  │  ├─ garmin.controller.ts (connect/disconnect/status/sync/activities/daily-summary)
│  │  ├─ garmin.service.ts (business logic, data queries)
│  │  ├─ garmin-sync.service.ts (sync engine — fetch + upsert from Garmin)
│  │  ├─ garmin-cron.service.ts (2-hour cron job)
│  │  ├─ garmin-encryption.service.ts (AES-256-GCM for credentials)
│  │  ├─ garmin-connect.dto.ts (connect request DTO)
│  │  ├─ garmin-activity.dto.ts (query DTOs)
│  │  └─ garmin.module.ts
│  │
│  ├─ shared/
│  │  ├─ prisma.service.ts (PostgreSQL ORM)
│  │  ├─ redis.service.ts (session + cache management)
│  │  └─ shared.module.ts
│  │
│  └─ main.ts (entry point, bootstrap NestJS)
│
├─ prisma/
│  ├─ schema.prisma (User, UserProfile, GarminConnection, GarminActivity, GarminDailySummary)
│  └─ migrations/
│
└─ Dockerfile (Node Alpine, pm2)
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/initiate` | ❌ | Start OAuth2 PKCE → redirect to WordPress |
| GET | `/auth/callback` | ❌ | OAuth2 callback, create JWT, set cookie |
| GET | `/health` | ❌ | Health check (Docker healthcheck) |
| GET | `/profile` | ✅ | Get current user's profile |
| POST | `/profile` | ✅ | Create profile for authenticated user |
| PATCH | `/profile/:id` | ✅ | Update profile (age, commitment, history) |
| GET | `/users/:id` | ✅ | Fetch user details |

### Database Schema (Prisma)

```prisma
model User {
  id              String      @id @default(cuid())
  wpUserId        String      @unique
  email           String      @unique
  displayName     String?
  wpAvatarUrl     String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  profiles        UserProfile[]
}

model UserProfile {
  id                    String      @id @default(cuid())
  userId                String
  user                  User        @relation(fields: [userId], references: [id])
  age                   Int
  height                Float       // cm
  weight                Float       // kg
  experience            String      // NONE|INCONSISTENT|REGULAR_NEW|ADVANCED
  commitment            String      // HEALTH|BASE|PERFORMANCE
  isRecovering          Boolean     @default(false)
  isMedicatedOrInjured  Boolean     @default(false)
  previousMonthPace     String?
  probationStartDate    DateTime?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
}
```

---

**Version:** 1.1.0 | **Last Updated:** April 6, 2026 (Phase 9 - WordPress SSO + API complete)
