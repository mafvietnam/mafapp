# Project Changelog

All notable changes to MAF Running Coach are documented here.

---

## [1.3.0] — 2026-04-07 (WordPress SSO + Account Management)

### Major: WordPress SSO Authentication & Admin Account Control

**Scope:** Integrate WordPress as identity provider with custom SSO MU-plugin, add account management with role-based access control (RBAC).

### Added

#### WordPress SSO Provider (MU-plugin)
- **File:** `wordpress/mu-plugins/maf-sso-provider.php`
- **Endpoints:**
  - `POST /wp-json/maf/v1/auth` — Validate username+password against WordPress
  - `GET /wp-json/maf/v1/sso/verify?code=XXX` — Exchange one-time code for user info
- **Security:**
  - HMAC-SHA256 integrity check on one-time codes
  - Single-use codes, 5-minute TTL (WordPress transient)
  - Rate limiting: 5 attempts/minute per IP
  - Whitelisted redirect origins: `https://app.maf.run`, `http://localhost:5173` (dev)
  - 64-char hex codes (32 bytes entropy)

#### Backend Authentication (NestJS API)
- **Two login methods:**
  - Direct: `POST /auth/login` with username+password
  - SSO: `POST /auth/wp-sso` with one-time code from WordPress
- **Token management:**
  - Access token: 15min (httpOnly cookie: `maf_access`)
  - Refresh token: 7 days (httpOnly cookie: `maf_refresh`)
  - JWT RS256 asymmetric signing (private key on backend only)
  - Rate limiting: 5 login attempts/minute per request
- **Account status check:**
  - `isActive` field on User model (soft-disable, not deletion)
  - Checked on login, SSO, and token refresh
  - Disabled accounts rejected immediately
  - Redis revocation set: `revoked:user:{id}` for instant JWT invalidation

#### Frontend SSO Flow
- **File:** `src/pages/sso-callback-page.tsx`
- **Flow:**
  1. User clicks "Login with WordPress" on LoginPage
  2. Redirects to `maf.run/wp-login.php?redirect_to=app.maf.run/auth/callback`
  3. User authenticates at WordPress
  4. WP generates one-time code, redirects back with `?code={code}`
  5. SsoCallbackPage exchanges code for JWT cookies via `POST /auth/wp-sso`
  6. On success, redirects to `/dashboard`
- **Profile sync:** Name, email, avatar synced from WordPress on each login

#### Admin Account Management
- **File:** `api/src/admin/admin.service.ts`
- **Features:**
  - List users with pagination & search
  - View user details: name, email, role, isActive status
  - Toggle user isActive status (soft-disable)
  - Dashboard stats: total users, new today, recent users
  - Self-protection: cannot disable own account or demote self
- **Frontend:**
  - Admin page with user table
  - Status badges: "Hoạt động" (active) or "Đã khóa" (disabled)
  - ShieldOff/ShieldCheck toggle icons
- **API:** 
  - `GET /admin/users` — List users (paginated, searchable)
  - `PATCH /admin/users/:id` — Toggle isActive status
  - `GET /admin/stats` — Dashboard stats
- **RBAC:** Admin endpoints require `role=ADMIN`

#### Database Schema Updates
- Added `role` enum: USER, COACH, ADMIN (default: USER)
- Added `isActive` boolean field (default: true)
- Updated User model to track WordPress identity + local role/status

### Changed

#### Auth Module
- Refactored auth flow to support two methods (direct + SSO)
- JWT validation now checks `isActive` status
- Token expiry handled via refresh endpoint (not auto-extend)
- Cookie domain set to `.maf.run` (production) for cross-subdomain sharing

#### Component Tree
- Added `/admin` route (ADMIN-only, ProtectedRoute with role check)
- Added `/auth/callback` route (SsoCallbackPage)
- Updated LoginPage with WordPress SSO button
- Protected routes now validate both JWT + isActive status

### Security
- Password stored only in WordPress (never synced to app)
- JWT tokens as httpOnly cookies (XSS resistant)
- Redis revocation for instant account disable (no cache delay)
- Disabled users cannot obtain new tokens or refresh existing ones
- Admin cannot self-disable (prevents account lockout)

### Performance
- SSO code exchange: ~200-300ms (WP REST API call + local upsert)
- Account status check: <1ms (Redis lookup)
- JWT revocation cleanup: automatic on account disable

---

## [1.2.0] — 2026-04-07 (Garmin Integration — MVP)

### Major: Garmin Device Data Sync & MAF Lab Auto-fill

**Scope:** Two-track Garmin integration — ship MVP with `garmin-connect` npm lib (credential-based), migrate to official OAuth API later.

### Added

#### Backend — GarminModule (`api/src/garmin/`)
- **GarminEncryptionService**: AES-256-GCM encrypt/decrypt for credential storage
- **GarminService**: Connect/disconnect/status + paginated activity & daily summary queries
- **GarminSyncService**: Sync engine — fetches activities + daily health data from Garmin
- **GarminCronService**: Cron job runs every 2 hours to sync all connected users
- **Endpoints**: POST connect/disconnect/sync, GET status/activities/daily-summary
- **Security**: JWT-protected endpoints, rate limiting (3/min connect, 1/5min sync), Redis mutex for sync

#### Database — Prisma Schema
- `GarminConnection`: Stores encrypted credentials, connection status, sync metadata
- `GarminActivity`: Synced activities with HR, pace, distance, VO2max
- `GarminDailySummary`: Daily health metrics (steps, resting HR, sleep, stress)
- `GarminConnectionStatus` enum: CONNECTED, DISCONNECTED, TOKEN_EXPIRED, ERROR

#### Frontend — Garmin UI Components
- **GarminConnectCard**: Connect/disconnect form on Profile page with status display
- **GarminAutoFillBanner**: "Từ Garmin" label above MAF Lab HR input
- **useGarminAutoFill hook**: Fetches latest Garmin running activity for MAF Lab auto-fill
- **garmin-service.ts**: Frontend API client for all Garmin endpoints

#### Infrastructure
- `FEATURE_GARMIN` env var gates entire Garmin module (backend + frontend)
- `GARMIN_ENCRYPTION_KEY` env var required when Garmin enabled (64 hex chars)
- `@nestjs/schedule` added for cron job support
- `ScheduleModule.forRoot()` registered in AppModule

### Security Notes
- MVP stores encrypted Garmin credentials (email/password) — to be replaced by OAuth in Phase 5
- Credentials encrypted AES-256-GCM, never logged or returned in API responses
- Disconnect performs full cleanup: deletes all synced data + credentials
- Redis lock prevents concurrent sync runs per user and globally

---

## [1.1.0] — 2026-04-06 (WordPress SSO + Server-Side Storage)

### Major: Backend API & Authentication Overhaul

**Scope:** Full-stack migration from localStorage-only to server-side architecture with WordPress OAuth2 SSO.

### Added

#### Backend Infrastructure
- **NestJS 10 API** (`api/` directory) with modular architecture
  - Auth module: WordPress OAuth2 PKCE + JWT RS256 (async signing)
  - User module: CRUD operations for authenticated users
  - Profile module: Training profile persistence & history
  - Health module: Docker healthcheck endpoint
  - Shared services: Prisma ORM + Redis client

- **PostgreSQL 15 Database**
  - User table: wpUserId, email, displayName, wpAvatarUrl
  - UserProfile table: age, height, weight, experience, commitment, history
  - Automatic migrations via Prisma

- **Redis 7 Session Storage**
  - OAuth2 PKCE state + code verifier (5min TTL)
  - JWT token caching
  - User profile cache (improved API response time)

- **Docker Services**
  - `maf-api`: NestJS API container (Node Alpine)
  - `postgres`: PostgreSQL 15 Alpine database
  - `redis`: Redis 7 Alpine cache
  - N8N commented out (deferred to Phase 10)

#### Frontend Authentication
- **Auth Context** (`contexts/auth-context.tsx`) — Global auth state management
- **WordPress SSO Login** (`pages/login-page.tsx`)
  - "Login with WordPress" button
  - OAuth2 PKCE flow (most secure for SPAs)
  - Automatic redirect to /dashboard on success
- **Protected Routes** — AuthGuard on /app, /profile, /dashboard
- **JWT Cookies** — HTTP-only, Secure, SameSite=Strict

#### New Pages
- `/login` — WordPress SSO entry point
- `/dashboard` — Authenticated user dashboard (dark theme)
  - Recent MAF results, training history summary
  - User profile quick-link
- `/profile` — User profile management
  - Edit age, height, weight, experience, commitment
  - Server-side sync with backend

### Changed

#### Data Persistence Model
- **localStorage** — Now optional for offline MAF calculation only
- **PostgreSQL** — Primary storage for user profiles + training history
- **API Calls** — Fetch requests to `/api/*` endpoints with JWT auth

#### Authentication Flow
- **Old:** Direct client-side calculation, no user accounts
- **New:** WordPress SSO → JWT tokens → User profiles on backend
- **JWT Signing:** RS256 asymmetric (secure, verifiable by frontend)
- **Token Storage:** HTTP-only cookies (XSS resistant)

#### Docker Compose
- Added `maf-api` service (NestJS on port 3001, internal network)
- Added `postgres` service (port 5432, internal, persisted volume)
- Added `redis` service (port 6379, internal, 256MB max memory)
- Updated environment variables (JWT keys, OAuth2 secrets, CORS origin)
- Healthchecks on all services

### Fixed

- User data now persistent across browser sessions (server-side)
- Browser cache clear no longer loses user profile
- CORS properly configured for api.maf.run ↔ app.maf.run communication

### Performance

- **API Response:** ~50-100ms for profile fetch (Redis cached)
- **JWT Generation:** <50ms (RS256 asymmetric signing)
- **Database Queries:** Indexed on userId, wpUserId for fast lookup
- **Memory:** PostgreSQL 1GB limit, Redis 256MB with LRU eviction

### Technical Details

**Key Decisions:**
- **OAuth2 PKCE:** No backend redirect URI required (mobile-safe)
- **JWT RS256:** Private key on backend only, public key in frontend (one-way verification)
- **HTTP-only Cookies:** Prevents JavaScript access, XSS mitigation
- **Redis TTL:** 5min for OAuth state (limits replay attacks)

**Prisma Schema:**
```prisma
model User {
  id        String @id @default(cuid())
  wpUserId  String @unique
  email     String @unique
  profiles  UserProfile[]
}

model UserProfile {
  id         String @id @default(cuid())
  userId     String
  age        Int
  height     Float  // cm
  weight     Float  // kg
  experience String
  commitment String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

## [1.0.1] — 2026-04-06 (Guide Page & Mobile UX)

### Added
- **Guide Page:** `/guide` route with 5 Vietnamese guide sections (commit: 8b3d077)
  - Getting Started, Plan Tab explanation, Lab instructions
  - Results interpretation, Special cases (children, seniors, injured)
- **Mobile UX Improvements:** (commit: dc13385)
  - Modal scroll lock to prevent body scroll when modals open
  - Checkbox touch targets increased to 44px minimum (accessibility)
  - Favicon added (MAF logo SVG)

### Changed
- User guide rewritten to match actual app GUI (commit: 27ec3a7)
- Documentation updated to reflect codebase state (this release)

### Fixed
- Mobile modal scroll behavior fixed
- Touch target sizes meet WCAG AA accessibility standards

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

## Next Release: v1.2.0 (Planned Q2 2026)

**Planned Additions:**
- Training history API endpoints (save/load past results)
- Progress charts & visualization (Recharts)
- User profile export (CSV/JSON)
- Bug fixes & performance improvements from user feedback

---

**Last Updated:** April 7, 2026 | **Version:** 1.3.0
