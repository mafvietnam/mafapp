# Phase 1: SP2 Backend — Foundation + Auth + Strava

## Context
- [Brainstorm Report](../reports/brainstorm-260331-0100-sprint-roadmap-sp2-sp7.md)
- [System Architecture](../../docs/system-architecture.md)
- [Code Standards](../../docs/code-standards.md)

## Overview
- **Priority:** P1 (Critical Path)
- **Owner:** Dev A (Backend)
- **Status:** Pending
- **Effort:** 4 weeks
- **Runs parallel with:** Phase 2 (Frontend)

Dev A builds the entire backend: NestJS API, PostgreSQL schema, WordPress SSO, Strava integration, MAF analysis engine. Dev B works on frontend simultaneously — they sync on API contract before starting.

## Key Insights
- PostgreSQL 15 already exists (N8N uses it) — add new schemas, don't create new DB instance
- WordPress at maf.run needs OAuth2 plugin installed (miniOrange or WP OAuth Server)
- Strava allows 100 req/15min, 1000/day — need job queue for bulk sync
- MAF calculation logic exists in `src/utils/` — port to backend, keep frontend version for offline

## Requirements

### Functional
- NestJS API serving at api.maf.run
- User registration/login via WordPress SSO (OAuth2)
- JWT-based session management (access + refresh tokens)
- Strava OAuth2 connect/disconnect
- Strava webhook receiver for new activities
- Activity sync (bulk initial + incremental)
- MAF analysis per activity (zone compliance, cardiac drift, pace efficiency)
- Dashboard aggregation API (trends, weekly stats)

### Non-Functional
- API response <200ms (p95)
- Rate limiting (100 req/min per user)
- CORS configured for app.maf.run
- Health check endpoint for Docker
- Structured JSON logging
- Graceful shutdown handling

## Architecture

```
api.maf.run (NestJS)
├── AuthModule
│   ├── WPOAuthStrategy (passport)
│   ├── JwtStrategy
│   ├── AuthController (/auth/login, /auth/callback, /auth/refresh, /auth/logout)
│   └── AuthGuard (JWT validation)
│
├── UserModule
│   ├── UserService (CRUD)
│   ├── UserController (/users/me, /users/:id)
│   └── User entity (Prisma)
│
├── StravaModule
│   ├── StravaOAuthService (token exchange, refresh)
│   ├── StravaWebhookController (/strava/webhook)
│   ├── StravaSyncService (bulk + incremental)
│   ├── StravaApiClient (wrapper with rate limiting)
│   └── StravaConnection entity
│
├── ActivityModule
│   ├── ActivityService (CRUD + analysis)
│   ├── ActivityController (/activities, /activities/:id)
│   ├── MafAnalysisService (zone check, cardiac drift, efficiency)
│   └── Activity entity
│
├── DashboardModule
│   ├── DashboardService (aggregation queries)
│   └── DashboardController (/dashboard/stats, /dashboard/trends)
│
└── SharedModule
    ├── PrismaService (DB connection)
    ├── RedisService (cache + sessions)
    ├── QueueModule (BullMQ for Strava sync jobs)
    └── ConfigModule (env vars)
```

### Database Schema (Prisma)

```prisma
model User {
  id            String   @id @default(uuid())
  wpUserId      Int      @unique
  email         String   @unique
  name          String
  avatar        String?
  province      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  stravaConnection  StravaConnection?
  activities        Activity[]
  profile           UserProfile?
}

model UserProfile {
  id                String   @id @default(uuid())
  userId            String   @unique
  age               Int
  height            Float
  weight            Float
  experience        String   // ExperienceLevel enum
  commitment        String   // CommitmentLevel enum
  isRecovering      Boolean  @default(false)
  isMedicated       Boolean  @default(false)
  isProbation       Boolean  @default(false)
  probationStart    DateTime?
  user              User     @relation(fields: [userId], references: [id])
}

model StravaConnection {
  id            String   @id @default(uuid())
  userId        String   @unique
  stravaId      Int      @unique
  accessToken   String
  refreshToken  String
  expiresAt     DateTime
  scope         String
  lastSyncAt    DateTime?
  user          User     @relation(fields: [userId], references: [id])
}

model Activity {
  id              String   @id @default(uuid())
  userId          String
  stravaId        BigInt   @unique
  type            String   // Run, Walk, Ride
  name            String
  distance        Float    // meters
  duration        Int      // seconds
  averageHr       Float?
  maxHr           Float?
  averagePace     Float?   // sec/km
  startDate       DateTime
  hasHeartrate    Boolean  @default(false)
  mafZonePercent  Float?   // % time in MAF zone
  cardiacDrift    Float?   // % HR increase
  isInMafZone     Boolean?
  rawData         Json?    // full Strava response
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
}
```

## Related Code Files

### Files to Create
- `api/` — entire NestJS project directory
  - `api/src/main.ts` — app bootstrap
  - `api/src/app.module.ts` — root module
  - `api/src/auth/` — auth module (controller, service, strategies, guards)
  - `api/src/user/` — user module
  - `api/src/strava/` — strava module (oauth, webhook, sync, api-client)
  - `api/src/activity/` — activity module (service, controller, maf-analysis)
  - `api/src/dashboard/` — dashboard module
  - `api/src/shared/` — prisma, redis, config, queue
  - `api/prisma/schema.prisma` — DB schema
  - `api/Dockerfile` — multi-stage build
  - `api/.env.example` — env template
  - `api/package.json` — dependencies
  - `api/tsconfig.json` — TS config
  - `api/nest-cli.json` — NestJS CLI config

### Files to Modify
- `docker-compose.yml` — add `maf-api`, `redis` services
- `docker-compose.dev.yml` — add `maf-api` dev service
- `config/tunnel-config.yml` — add api.maf.run route

## Implementation Steps

### Week 1: Project Setup + DB + Auth
1. Initialize NestJS project: `npx @nestjs/cli new api --strict`
2. Install deps: `@nestjs/passport`, `passport-jwt`, `@prisma/client`, `prisma`, `@nestjs/config`, `@nestjs/bull`, `bull`, `ioredis`
3. Set up Prisma with PostgreSQL connection
4. Create DB schema (User, UserProfile, StravaConnection, Activity)
5. Run `prisma migrate dev` to create tables
6. Set up ConfigModule with `.env` validation (Joi)
7. Set up PrismaService as global provider
8. Add Docker service for `maf-api` in docker-compose.dev.yml
9. Add Redis service in docker-compose
10. Verify: `docker-compose up` → API health check at localhost:3001/health

### Week 2: WordPress SSO
11. Install WP OAuth Server plugin on maf.run (or miniOrange OAuth)
12. Register OAuth2 client app (client_id, client_secret, redirect_uri)
13. Implement `AuthModule`:
    - `GET /auth/login` → redirect to maf.run/oauth/authorize
    - `GET /auth/callback` → exchange code for WP token → fetch user info → create/find user → issue JWT
    - `POST /auth/refresh` → refresh JWT using refresh token
    - `POST /auth/logout` → invalidate refresh token in Redis
14. Implement JwtStrategy (passport) + AuthGuard
15. Set JWT in httpOnly cookie (secure, sameSite: lax)
16. Test: Login flow end-to-end with WordPress
17. Add `GET /users/me` endpoint (returns current user)

### Week 3: Strava Integration
18. Register Strava API application (get client_id, client_secret)
19. Implement StravaModule:
    - `GET /strava/connect` → redirect to Strava OAuth
    - `GET /strava/callback` → exchange code, store tokens in DB
    - `DELETE /strava/disconnect` → revoke token, delete connection
20. Implement StravaApiClient:
    - Auto-refresh expired tokens
    - Rate limit tracking (100/15min)
    - Retry with backoff
21. Implement StravaSyncService:
    - `syncInitial(userId)` → fetch last 3 months activities via BullMQ job
    - `syncActivity(stravaActivityId)` → fetch single activity + streams
    - Parse: distance, duration, avg_hr, max_hr, pace, splits
22. Implement StravaWebhookController:
    - `GET /strava/webhook` → subscription validation (hub.challenge)
    - `POST /strava/webhook` → receive new/update/delete events → queue sync job
23. Register webhook with Strava API
24. Test: Connect Strava → bulk sync → verify activities in DB

### Week 4: MAF Analysis + Dashboard API
25. Implement MafAnalysisService:
    - `analyzeActivity(activity, userProfile)`:
      - Calculate MAF HR from user profile
      - % time in MAF zone (avg_hr vs MAF ± 10)
      - Cardiac drift: compare first-half avg HR vs second-half
      - Pace efficiency: pace at given HR
    - `detectMafTest(activity)`: identify consistent-pace runs as MAF tests
26. Run analysis on all synced activities (background job)
27. Implement DashboardModule:
    - `GET /dashboard/stats` → weekly volume, zone compliance %, activity count
    - `GET /dashboard/trends` → MAF pace trend (weekly averages, last 12 weeks)
    - `GET /dashboard/maf-tests` → detected MAF test results over time
    - `GET /activities?page=1&limit=20` → paginated activities with analysis data
28. Add Swagger/OpenAPI documentation (`@nestjs/swagger`)
29. Generate OpenAPI spec → share with Dev B for frontend types
30. Final: Deploy to Docker, verify api.maf.run works via Cloudflare Tunnel

## Todo List
- [ ] NestJS project initialized with Prisma + Redis
- [ ] DB schema migrated (users, profiles, strava, activities)
- [ ] Docker services running (api, redis)
- [ ] WordPress OAuth2 plugin configured on maf.run
- [ ] Auth flow working (login → callback → JWT → /users/me)
- [ ] Strava OAuth connect/disconnect
- [ ] Strava webhook receiving events
- [ ] Bulk sync (3 months history)
- [ ] MAF analysis running on activities
- [ ] Dashboard API returning trends + stats
- [ ] OpenAPI spec generated and shared with Dev B
- [ ] api.maf.run accessible via Cloudflare Tunnel

## Success Criteria
- `POST /auth/login` → redirects to WP → callback → JWT cookie set
- `GET /users/me` → returns logged-in user profile
- `GET /strava/connect` → OAuth flow → activities synced
- `GET /activities` → returns paginated activities with MAF analysis
- `GET /dashboard/trends` → returns MAF pace trend data
- All endpoints documented in Swagger
- Docker health checks passing

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| WP OAuth plugin issues | Test miniOrange free tier first; fallback: direct WP REST API + application passwords |
| Strava token refresh failures | Exponential backoff, alert on 3+ failures, re-auth flow |
| BullMQ job failures | Dead letter queue, retry 3x, admin endpoint to re-trigger |
| Schema migration conflicts | Prisma migration files in git, dev reviews before merge |

## Security Considerations
- JWT secrets in env vars, never in code
- Strava tokens encrypted at rest (Prisma middleware or DB-level)
- Rate limiting on all public endpoints
- CORS whitelist: only app.maf.run
- Webhook signature validation for Strava
- No raw SQL — Prisma only
- Input validation with class-validator + class-transformer

## Next Steps
- Phase 3: Integration testing with frontend (Dev B's auth UI + dashboard)
- Phase 4 (SP3): Add nutrition module to NestJS API
