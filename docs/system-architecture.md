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
├─ Protected Routes (AuthGuard, checks isActive status)
│   ├─ /login → LoginPage
│   │  ├─ Direct login: username + password
│   │  └─ SSO: "Login with WordPress" button
│   │
│   ├─ /auth/callback → SsoCallbackPage
│   │  └─ Exchange WP one-time code for JWT cookies
│   │
│   ├─ /dashboard → DashboardPage (authenticated)
│   │  └─ User's MAF zone, recent results, training history
│   │
│   ├─ /profile → ProfilePage (authenticated)
│   │  ├─ User profile management, server-side sync
│   │  └─ Garmin device connection (if FEATURE_GARMIN enabled)
│   │
│   ├─ /admin → AdminPage (authenticated, ADMIN role)
│   │  ├─ User management with isActive toggle
│   │  ├─ Account status badges (Hoạt động/Đã khóa)
│   │  ├─ Strava settings card: Client ID/Secret/Webhook config
│   │  ├─ Admin sync trigger + sync history
│   │  └─ Self-protection: cannot disable own account
│   │
│   ├─ /admin/strava → AdminStravaPage (authenticated, ADMIN role)
│   │  ├─ Detailed Strava OAuth config management
│   │  ├─ Client ID, Secret (masked), Webhook Verify Token
│   │  ├─ Enable/disable toggle, save button
│   │  ├─ Webhook resubscription status
│   │  └─ Admin sync trigger + history
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
│   │        │  └─ GarminAutoFillBanner (if Garmin connected)
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
  - Strava data: StravaConnection (encrypted OAuth2 tokens), StravaActivity (synced runs)
  
- **Redis 7:**
  - JWT token storage (RS256 signed)
  - OAuth2 PKCE state + verifier (5min TTL)
  - Session management
  - Garmin sync mutex locks (per-user + global)
  - Caching for frequently accessed profiles

### Authentication
- **Two Login Methods:**
  - **Direct:** POST `/auth/login` with username+password → validates via WordPress REST API
  - **SSO:** POST `/auth/wp-sso` with one-time code → exchanges code from WordPress redirect
- **WordPress SSO Flow:**
  - User logs in at maf.run/wp-login.php with `redirect_to=app.maf.run/auth/callback`
  - WP generates single-use HMAC-SHA256 code (5min TTL, only used once)
  - Frontend exchanges code for JWT cookies via `/auth/wp-sso`
  - Profile synced from WordPress on each login (name, email, avatar)
- **JWT (RS256):** Asymmetric signing, RS256 private/public keys
  - Access token: 15min (httpOnly cookie: `maf_access`)
  - Refresh token: 7 days (httpOnly cookie: `maf_refresh`, path=/auth/refresh)
- **Account Status Check:**
  - `isActive` field checked on login, SSO, and token refresh
  - Disabled accounts rejected immediately
  - Redis revocation set (`revoked:user:{id}`) for instant JWT invalidation when admin disables account
- **Cookies:** HTTP-only, Secure, SameSite=Lax, domain=.maf.run (production)
- **CORS:** Restricted to app.maf.run
- **Rate Limiting:**
  - WP auth endpoint: 5/minute per IP (WordPress transient-based)
  - Direct login: 5/minute per request
  - SSO code exchange: verified by WP plugin directly

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
│  ├─ auth/ (WordPress SSO + JWT)
│  │  ├─ auth.controller.ts (POST /auth/login, POST /auth/wp-sso, POST /auth/refresh)
│  │  ├─ auth.service.ts (WP credential validation, SSO code exchange, JWT generation)
│  │  ├─ auth.types.ts (TokenPayload, WpUserInfo interfaces)
│  │  ├─ jwt.strategy.ts (JWT RS256 validation + isActive check)
│  │  ├─ auth.guard.ts (JwtAuthGuard with Redis revocation check)
│  │  └─ auth.module.ts
│  │
│  ├─ user/ (User management)
│  │  ├─ user.controller.ts (GET /users/:id, etc.)
│  │  ├─ user.service.ts (findOrCreateFromWp, CRUD operations)
│  │  └─ user.module.ts
│  │
│  ├─ admin/ (Account management + Integration settings, RBAC)
│  │  ├─ admin.controller.ts (GET users list, PATCH user status, Strava/Garmin settings endpoints)
│  │  ├─ admin.service.ts (toggle isActive, query users, stats; saveStravaSettings, saveGarminSettings)
│  │  ├─ admin.guard.ts (requires ADMIN role)
│  │  ├─ admin-strava-settings.dto.ts (clientId, clientSecret, webhookVerifyToken, enabled)
│  │  ├─ admin-stats.dto.ts, admin-user-query.dto.ts, admin-update-user.dto.ts
│  │  └─ admin.module.ts
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
│  ├─ strava/ (Strava activity sync + webhook — gated by FEATURE_STRAVA)
│  │  ├─ strava.controller.ts (GET/POST /strava/webhook, connect/disconnect/sync endpoints)
│  │  ├─ strava.service.ts (business logic, connection management)
│  │  ├─ strava-sync.service.ts (sync engine — fetch + upsert from Strava API)
│  │  ├─ strava-webhook.service.ts (webhook subscription, event processing)
│  │  ├─ strava-encryption.service.ts (AES-256 for token encryption)
│  │  ├─ strava.module.ts
│  │  └─ types/ (TypeScript types for Strava API contracts)
│  │
│  ├─ shared/
│  │  ├─ app-settings.service.ts (DB-backed config for Garmin + Strava; 30s TTL cache)
│  │  ├─ garmin-encryption.service.ts (AES-256-GCM; shared by Garmin + Strava modules)
│  │  ├─ prisma.service.ts (PostgreSQL ORM)
│  │  ├─ redis.service.ts (session + cache + revocation management + OAuth nonce store)
│  │  └─ shared.module.ts
│  │
│  └─ main.ts (entry point, bootstrap NestJS)
│
├─ prisma/
│  ├─ schema.prisma (User[role,isActive], UserProfile, GarminConnection, GarminActivity, GarminDailySummary)
│  └─ migrations/
│
└─ Dockerfile (Node Alpine, pm2)
```

### API Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/auth/login` | ❌ | — | Direct login: username+password → JWT cookies |
| POST | `/auth/wp-sso` | ❌ | — | SSO callback: exchange one-time code for JWT cookies |
| POST | `/auth/refresh` | ✅ | — | Refresh access token using refresh cookie |
| GET | `/health` | ❌ | — | Health check (Docker healthcheck) |
| GET | `/profile` | ✅ | — | Get current user's profile |
| POST | `/profile` | ✅ | — | Create profile for authenticated user |
| PATCH | `/profile/:id` | ✅ | — | Update profile (age, commitment, history) |
| GET | `/users/:id` | ✅ | — | Fetch user details |
| GET | `/admin/users` | ✅ | ADMIN | List users (paginated, searchable) |
| GET | `/admin/users/:id` | ✅ | ADMIN | Get user details with role + isActive |
| PATCH | `/admin/users/:id` | ✅ | ADMIN | Toggle user isActive status (self-protection) |
| GET | `/admin/stats` | ✅ | ADMIN | Dashboard stats: total users, new today, recent users |
| GET | `/admin/garmin/settings` | ✅ | ADMIN | Retrieve masked Garmin OAuth config (Client ID only) |
| POST | `/admin/garmin/settings` | ✅ | ADMIN | Save Garmin Client ID/Secret (auto-validates) |
| GET | `/admin/strava/settings` | ✅ | ADMIN | Retrieve masked Strava OAuth config (Client ID only) |
| POST | `/admin/strava/settings` | ✅ | ADMIN | Save Strava Client ID/Secret/Webhook Verify Token (auto-resubscribe) |
| GET | `/admin/strava/status` | ✅ | ADMIN | Check Strava subscription + webhook status |
| POST | `/admin/strava/sync` | ✅ | ADMIN | Trigger immediate Strava sync (all users, returns errors + duration) |
| GET | `/strava/webhook` | ❌ | — | Strava webhook challenge validation (public) |
| POST | `/strava/webhook` | ❌ | — | Strava webhook event push handler (public, async) |
| POST | `/strava/connect` | ✅ | — | Initiate Strava OAuth2 connection flow |
| POST | `/strava/disconnect` | ✅ | — | Disconnect Strava account |
| GET | `/strava/status` | ✅ | — | Check Strava connection status |
| POST | `/strava/sync` | ✅ | — | Manual sync: fetch and upsert activities |
| GET | `/strava/activities` | ✅ | — | List synced Strava activities (paginated) |

### Database Schema (Prisma)

```prisma
enum Role {
  USER
  COACH
  ADMIN
}

model User {
  id        String   @id @default(uuid())
  wpUserId  Int?     @unique
  googleId  String?  @unique
  email     String   @unique
  name      String
  avatar    String?
  role      Role     @default(USER)
  isActive  Boolean  @default(true)          // Account status: true=active, false=disabled
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  profile              UserProfile?
  garminConnection     GarminConnection?
  garminActivities     GarminActivity[]
  garminDailySummaries GarminDailySummary[]
  stravaConnection     StravaConnection?
  stravaActivities     StravaActivity[]
}

model UserProfile {
  id                         String   @id @default(uuid())
  userId                     String   @unique
  user                       User     @relation(fields: [userId], references: [id])
  age                        Int
  height                     Float    // cm
  weight                     Float    // kg
  experience                 String   // NONE|INCONSISTENT|REGULAR_NEW|ADVANCED
  commitment                 String   // HEALTH|BASE|PERFORMANCE
  isRecovering               Boolean  @default(false)
  isMedicatedOrInjured       Boolean  @default(false)
  previousMonthPace          String?
  probationStartDate         DateTime?
  lastLongRunDuration        Int?
  lastLongRunHeartRate       Int?
  lastLongRunFeeling         String?  // GOOD|TIRED|VERY_TIRED
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
}

model StravaConnection {
  id                    String   @id @default(uuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id])
  stravaAthleteId       Int      @unique
  accessToken           String   // AES-256 encrypted
  refreshToken          String?  // AES-256 encrypted
  expiresAt             DateTime?
  status                String   // CONNECTED|DISCONNECTED|TOKEN_EXPIRED|ERROR
  lastSyncAt            DateTime?
  lastSyncStartedAt     DateTime?  // Admin sync tracking
  lastSyncFinishedAt    DateTime?  // Admin sync tracking
  lastSyncError         String?    // Audit + error history
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  stravaActivities      StravaActivity[]
}

model StravaActivity {
  id                    String   @id @default(uuid())
  stravaConnectionId    String
  stravaConnection      StravaConnection @relation(fields: [stravaConnectionId], references: [id])
  stravaActivityId      Int      @unique
  name                  String
  type                  String   // Run|TrailRun|VirtualRun|etc.
  startDate             DateTime
  distance              Float    // meters
  movingTime            Int      // seconds
  elapsedTime           Int      // seconds
  avgHeartRate          Float?
  maxHeartRate          Float?
  avgPace               Float?   // min/km
  maxSpeed              Float?   // m/s
  totalElevationGain    Float?   // meters
  calories              Float?
  isDuplicate           Boolean  @default(false)  // Duplicate with Garmin activity
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

---

---

## WordPress SSO Integration Details

### MU-Plugin: maf-sso-provider.php
Located at `wordpress/mu-plugins/maf-sso-provider.php`

**Endpoints:**
- `POST /wp-json/maf/v1/auth` — Validate username+password, return WP user info
- `GET /wp-json/maf/v1/sso/verify?code=XXX` — Exchange one-time code for user info

**Login Flow:**
1. User logs in at maf.run/wp-login.php with `redirect_to=app.maf.run/auth/callback`
2. On successful WP login, `login_redirect` hook generates HMAC-SHA256 code
3. Code is single-use (transient), expires in 5 minutes
4. Redirects to `app.maf.run/auth/callback?code={code}`
5. Frontend exchanges code for JWT cookies

**Security:**
- HMAC-SHA256 integrity check on code payload
- Rate limiting: 5 login attempts/minute per IP (WordPress transient)
- Codes are 64-char hex (32 bytes entropy), single-use only
- Whitelisted redirect origins: `https://app.maf.run`, `http://localhost:5173` (dev)
- `allowed_redirect_hosts` filter prevents open redirects

### Frontend SSO Flow
Files: `src/utils/wp-login-url.ts`, `src/pages/sso-callback-page.tsx`, `src/pages/login-page.tsx`

1. **LoginPage:** Renders "Login with WordPress" button
2. **On click:** Navigate to WordPress login with `redirect_to=app.maf.run/auth/callback`
3. **User authenticates** at maf.run (WordPress handles password)
4. **SsoCallbackPage:** Receives code from URL, calls `POST /auth/wp-sso` with code
5. **API exchanges code:** Verifies with WP, upserts User, issues JWT cookies
6. **On success:** Redirects to `/dashboard`

**Profile Sync:**
- Name, email, avatar synced from WordPress on each login
- Local User record upserted via `findOrCreateFromWp()`
- WordPress is source of truth for identity

### Account Management (Admin)
File: `api/src/admin/admin.service.ts`

**Features:**
- `isActive` field soft-disables accounts (boolean, not deletion)
- Admin can toggle any user's isActive status
- Self-protection: cannot disable own account or demote self
- Disabled accounts rejected immediately on login/SSO/refresh
- Redis revocation set: `revoked:user:{id}` for instant JWT invalidation
- Admin UI shows status badge: "Hoạt động" (active) or "Đã khóa" (disabled)

---

## Integration Settings Pattern (Admin-Managed Credentials)

### AppSettingsService (Shared across Garmin & Strava)

**Purpose:** Centralized DB-backed OAuth2 credential management with environment fallback and redis caching.

**Key Features:**
- **Lazy DB-backed config:** Admin can supply credentials via UI; env vars optional (fallback only)
- **30s TTL cache:** Redis caches all reads (`getGarminRuntimeConfig()`, `getStravaRuntimeConfig()`)
- **Cache invalidation:** `setMany()` clears cache for changed keys (prefix-based)
- **Credential masking:** Admin GET endpoints return only first 4 chars of secrets (security)
- **Encryption:** Secrets encrypted at rest via `GarminEncryptionService` (AES-256-GCM)
- **Validation:** Joi schema enforces hex + length checks at boot

**Usage:**
- **Garmin Module:** `constructor(private appSettings: AppSettingsService)` → `getGarminRuntimeConfig()` for OAuth2 client ID/secret
- **Strava Module:** Same pattern; `StravaService` uses `getStravaRuntimeConfig()` for API calls
- **Admin Service:** `setGarminSettings()`, `setStravaSettings()` update DB + invalidate cache

**Flow Example:**
1. Admin saves Strava Client ID via `/admin/strava/settings`
2. `AdminService.saveStravaSettings()` encrypts + stores in DB
3. `AppSettingsService.setMany()` invalidates cache
4. Next Strava API call reads fresh config from DB (not cache)
5. `StravaWebhookService.refreshSubscription()` auto-triggered (returns result to UI)

**Rationale:** Avoids container restart for credential rotation; decouples credential lifecycle from deployment.

---

**Version:** 1.6.0 | **Last Updated:** May 18, 2026 (Strava Integration Phase 5 — Admin UI & DB-backed Config Complete)
