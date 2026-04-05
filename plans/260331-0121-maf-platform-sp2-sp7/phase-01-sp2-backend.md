# Phase 1: SP2 Backend — Foundation + Auth + Strava

## Context
- [Brainstorm Report](../reports/brainstorm-260331-0100-sprint-roadmap-sp2-sp7.md)
- [Scaling Architecture Research](../reports/researcher-260405-1101-scaling-architecture-40k.md)
- [WP OAuth + Job Systems Research](../reports/researcher-260405-1101-wp-oauth-job-systems.md)
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
- PostgreSQL 15 already exists on VPS — create new `maf` database (N8N removed from stack)
- WordPress at maf.run needs OAuth2 plugin installed (WP OAuth Server recommended over miniOrange for control)
- Strava allows 100 req/15min, 1000/day — at 40K users, need distributed rate limiter + priority queue
- MAF calculation logic exists in `src/utils/` — port to backend, keep frontend version for offline
- **Tier 1 infra (validated):** Single Redis 2-4GB, direct Prisma→PG, single BullMQ queue. No PgBouncer, no Prometheus/Grafana in SP2.
- **DB:** Dedicated `maf` database (N8N removed — clean up its DB/Docker services in Phase 0)
- **Pre-sprint:** 1-day WP OAuth Server + PKCE validation spike before SP2 starts
- **Auth:** WordPress OAuth2 with PKCE + `state` param for CSRF; cache WP user data in PostgreSQL
- **Strava rate limit (validated):** 100 req/15min, 1000/day (conservative, default tier)
- **Token encryption:** AES-256-GCM via Prisma middleware for Strava tokens (env var key)
- **API-first (validated):** Create OpenAPI spec in Week 1, not Week 4
- **Strava refresh tokens are SINGLE-USE:** Each refresh returns new token, old dies immediately. Need Redis lock to prevent concurrent refresh race condition.
- **Deauthorization is LEGAL REQUIREMENT:** Strava suspends API access if you don't delete user data on deauth webhook.
- **Track rate limit via response headers:** Read `X-RateLimit-Usage` from every Strava response, circuit-break at 90%.
- **Cache access tokens in Redis (5min TTL):** Avoid PostgreSQL read on every API call.
- **Request elevated rate limit tier** after beta: 600/15min + 30,000/day (requires proving webhook usage).
<!-- Updated: Validation Session 1 + Strava best practices research - token lock, deauth, rate headers, caching -->

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
├── JobModule (in-process with API — Tier 1, no separate container)
│   ├── CriticalProcessor (Strava webhooks, token refresh — priority 1)
│   ├── DefaultProcessor (activity sync, MAF analysis — priority 10)
│   ├── LowProcessor (aggregation, cleanup — priority 50)
│   └── CronService (token refresh 6h, stats aggregation 1h, cleanup daily)
│
├── CacheModule
│   ├── CacheService (Redis cache-aside pattern)
│   ├── cache keys: dashboard:{userId}, profile:{userId}
│   └── TTLs: dashboard 5min, profile 15min
│
├── RateLimiterModule
│   ├── StravaRateLimiter (Redis token bucket, app-wide: 100/15min, 1000/day)
│   ├── ApiRateLimiter (per-user: 100 req/min, per-IP: 200 req/min)
│   └── Budget allocation: 60% webhooks, 30% scheduled, 10% manual
│
└── SharedModule
    ├── PrismaService (direct → PostgreSQL, pool_size=5)
    ├── RedisService (Redis 7 standalone, 1-2GB)
    ├── QueueModule (BullMQ single queue, priority-based)
    └── ConfigModule (env vars, Joi validation)
<!-- Updated: Red Team Session 2 - Tier 1 validated: no PgBouncer, no Redis Cluster, no Prometheus, no separate worker -->
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
  stravaAthleteId Int    @unique  // Strava's athlete ID (separate from internal userId)
  accessToken   String            // Encrypted via Prisma middleware (AES-256-GCM)
  refreshToken  String            // Encrypted. SINGLE-USE: each refresh returns new token, old dies.
  expiresAt     Int               // Unix timestamp — refresh if < now() + 3600
  scope         String
  lastSyncAt    DateTime?
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([expiresAt])            // For token refresh cron (find expiring tokens)
}

model Activity {
  id              String   @id @default(uuid())
  userId          String
  stravaId        BigInt   @unique
  type            String   // Run, Walk, Ride, Swim, etc.
  name            String
  distance        Float    // meters
  duration        Int      // seconds
  averageHr       Float?
  maxHr           Float?
  averagePace     Float?   // sec/km
  startDate       DateTime // WITH TIME ZONE — Strava returns UTC, store TZ for local display
  hasHeartrate    Boolean  @default(false)
  syncedFrom      String   @default("strava") // strava | garmin | manual | import — provider-agnostic
  mafZonePercent  Float?   // % time in MAF zone
  cardiacDrift    Float?   // % HR increase
  isInMafZone     Boolean?
  rawData         Json?    // Strava response — MUST strip start_latlng/end_latlng before storage (GPS privacy)
  // Red Team: rawData stores GPS tracks → home addresses inferable. Strip coordinates, keep only needed fields.
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])

  // Indexes for 40K+ user scale (4M+ activities/year)
  @@index([userId, startDate(sort: Desc)]) // Dashboard queries: recent activities per user
  @@index([userId, isInMafZone])            // Zone compliance filtering
  @@index([userId, type, startDate])        // Activity type + date filtering
  @@index([startDate])                      // Global date-range queries (admin/leaderboard)
}

// Job tracking for monitoring and debugging
model JobLog {
  id          String   @id @default(uuid())
  jobType     String   // strava_sync, maf_analysis, aggregation, token_refresh
  userId      String?
  status      String   // queued, processing, completed, failed, dead_letter
  attempts    Int      @default(0)
  error       String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())

  @@index([jobType, status])
  @@index([userId, jobType])
  @@index([createdAt])
}

// Audit log for compliance + debugging (token ops, deauth, sync events)
model AuditLog {
  id        String   @id @default(uuid())
  action    String   // token_refresh, strava_deauth, activity_sync, login, logout
  userId    String?
  metadata  Json?    // Contextual data (athleteId, error, source)
  createdAt DateTime @default(now())

  @@index([userId, action])
  @@index([createdAt])
}
```
<!-- Updated: Strava best practices - stravaAthleteId, expiresAt as Unix int, syncedFrom field, AuditLog model -->

## Related Code Files

### Files to Create
- `api/` — entire NestJS project directory
  - `api/src/main.ts` — API app bootstrap (HTTP server + in-process BullMQ)
  - `api/src/app.module.ts` — root module (API + jobs + cron, all in-process)
  - `api/src/auth/` — auth module (controller, service, wp-oauth-strategy, jwt-strategy, guards)
  - `api/src/user/` — user module
  - `api/src/strava/` — strava module (oauth, webhook-controller, sync-service, api-client, rate-limiter)
  - `api/src/activity/` — activity module (service, controller, maf-analysis-service)
  - `api/src/dashboard/` — dashboard module (service with caching, aggregation job)
  - `api/src/shared/` — prisma, redis, config, queue, cache
  - `api/src/jobs/` — BullMQ job processors (strava-sync, maf-analysis, aggregation, token-refresh, cleanup)
  - `api/src/cron/` — CronService (token refresh, stats aggregation, cleanup)
  - `api/prisma/schema.prisma` — DB schema with indexes
  - `api/Dockerfile` — multi-stage build (target: api or worker)
  - `api/.env.example` — env template
  - `api/package.json` — dependencies
  - `api/tsconfig.json` — TS config
  - `api/nest-cli.json` — NestJS CLI config
### Files to Modify
- `docker-compose.yml` — remove N8N services, add `maf-api`, `redis` services
- `docker-compose.dev.yml` — add `maf-api`, `redis` dev services
- `config/tunnel-config.yml` — add api.maf.run route

## Implementation Steps

### Week 1: Project Setup + DB + Scaling Infrastructure
1. Initialize NestJS project: `npx @nestjs/cli new api --strict`
2. Install deps: `@nestjs/passport`, `passport-jwt`, `@prisma/client`, `prisma`, `@nestjs/config`, `@nestjs/bullmq`, `bullmq`, `ioredis`, `@nestjs/terminus` (health)
3. **Create dedicated `maf` database** in PostgreSQL (N8N removed — `n8n` DB can be archived/dropped)
4. Set up Prisma with PostgreSQL connection (direct, no PgBouncer)
5. Create DB schema (User, UserProfile, StravaConnection, Activity, JobLog)
6. Run `prisma migrate dev` to create tables + indexes
6. Set up ConfigModule with `.env` validation (Joi)
7. Set up PrismaService as global provider
8. **Remove N8N** from stack (non-standard, third-party dependency):
   - Remove N8N service from `docker-compose.yml`
   - Update `config/tunnel-config.yml`: reassign `api.maf.run` to NestJS (port 3001)
   - Archive N8N database: `pg_dump n8n > n8n-archive.sql` then optionally drop
   <!-- Updated: N8N removed entirely per user direction -->
9. **Add Redis standalone** Docker service:
   - `redis:7-alpine` with `--maxmemory 2gb --maxmemory-policy allkeys-lru`
   - Single instance for sessions + cache + BullMQ (Tier 1)
10. Add Docker service for `maf-api` in docker-compose.dev.yml
11. BullMQ runs in-process with API (Tier 1 — no separate worker container)
12. **Add OpenAPI spec** (`api/openapi.yaml`):
    - Define all endpoint contracts BEFORE implementation
    - Share with Dev B immediately for frontend type generation
13. **Docker `mem_limit`** on every container (OOM protection for shared VPS):
    - `maf-api`: 1GB | `postgres`: 2GB | `redis`: 2GB | WordPress+MySQL: 1.5GB
    - Set `oom_score_adj` to protect PostgreSQL (lowest score = killed last)
14. **Docker network isolation** — separate WordPress from API stack:
    - `wp_network`: WordPress + MySQL + Cloudflared
    - `maf_network`: NestJS + PostgreSQL + Redis + Cloudflared
    - Cloudflared bridges both networks (routes traffic to correct service)
15. **Automated backups** — add to docker-compose:
    - Daily `pg_dump maf` + MySQL dump via cron (retain 7 days)
    - Rsync backups to external storage or object storage (S3/Backblaze B2)
    - Redis RDB `save` config enabled (default, verify)
    - RPO for beta: max 24h data loss
16. Verify: `docker-compose up` → API health at localhost:3001/health (N8N removed)
<!-- Updated: Red Team Session 2 - Docker mem_limits, network isolation, automated backups -->

### Week 2: WordPress SSO (PKCE Flow)
14. Install **WP OAuth Server** plugin on maf.run (free tier supports Authorization Code + PKCE)
    - Alternative: miniOrange OAuth if WP OAuth Server lacks features
    - Configure: client_id, redirect_uri=`https://api.maf.run/auth/callback`, scope=`openid profile email`
15. Register OAuth2 client app with PKCE enabled (no client_secret needed for public clients)
16. Implement `AuthModule` (confidential client model — backend handles PKCE):
    - `GET /auth/login` → backend generates PKCE `code_verifier` + `code_challenge` + `state` param (random, stored in Redis 5min TTL) → redirect to maf.run/oauth/authorize
    <!-- Updated: Red Team - PKCE model clarified as backend-initiated, state param for CSRF -->
    - `GET /auth/callback` → validate `state` param (CSRF check) → exchange code + code_verifier for WP access token → fetch user info from WP REST API → create/find local user → issue JWT pair
    - `POST /auth/refresh` → refresh JWT using refresh token (stored in Redis with rotation)
    - `POST /auth/logout` → invalidate refresh token in Redis, clear cookie
17. Implement JwtStrategy (passport) + AuthGuard:
    - **Generate RSA-256 key pair:** `openssl genrsa -out jwt-private.pem 2048 && openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem`
    - Store private key in `JWT_PRIVATE_KEY` env var (base64 encoded), public key in `JWT_PUBLIC_KEY`
    - Access token: 15min TTL, signed with RS256 using private key
    - Refresh token: **7-day TTL** (long enough for WP SSO degradation), stored in Redis (one per user, rotation on use)
    - **Auth degradation if WordPress goes down:** existing sessions stay valid for up to 7 days (refresh token TTL). WP user data cached in PostgreSQL — no WP round-trip for /users/me. Only new logins fail.
    - **Race condition handling:** 30-60s grace period — old refresh token still returns already-issued new pair
<!-- Updated: Red Team Session 2 - Auth degradation path for WP SPOF -->
    <!-- Updated: Red Team - JWT key management, refresh token race condition -->
18. Set JWT in httpOnly cookie (secure, sameSite: lax, domain: .maf.run)
19. **Cache WP user data locally** in PostgreSQL User table:
    - On first login: store name, email, avatar from WP
    - On subsequent logins: update if changed (compare WP response)
    - Avoids hitting WordPress for every auth check (critical at 40K users)
20. Test: Login flow end-to-end with WordPress
21. Add `GET /users/me` endpoint (returns from local cache, not WP)

### Week 3: Strava Integration + Job Pipeline
22. Register Strava API application (get client_id, client_secret)
22b. **Implement Strava token encryption** (Prisma middleware):
    - AES-256-GCM encrypt `accessToken` + `refreshToken` before write, decrypt after read
    - Key from `STRAVA_ENCRYPTION_KEY` env var (`openssl rand -hex 32`)
    <!-- Updated: Validation Session 1 - token encryption -->
23. Implement StravaModule:
    - `GET /strava/connect` → generate `state` param (random, Redis 5min TTL) → redirect to Strava OAuth with `state`
    - `GET /strava/callback` → **validate `state` param (CSRF check)** → exchange code, store tokens in DB (encrypted)
    - `DELETE /strava/disconnect` → revoke token, delete connection
<!-- Updated: Red Team Session 2 - Strava OAuth state param for CSRF -->
24. Implement **StravaApiClient** with rate limiting + token management:
    - **Token caching:** Cache access token in Redis (`strava:token:{userId}`, TTL 5min). Avoid PG read per API call.
    - **Refresh token lock:** Single-use tokens require Redis lock (`strava:refresh-lock:{userId}`, 10s TTL) to prevent concurrent refresh race condition.
    - **Auto-refresh:** If token expires within 1 hour, proactively refresh BEFORE API call (not on 401 failure).
    - **CRITICAL (validated):** Strava limit is 100 req/15min, 1000 req/day PER APP (conservative default tier)
    - At scale → **webhook-first architecture essential** (webhooks don't count against limit)
    - **Rate limit tracking via response headers:**
      ```
      Read X-RateLimit-Limit and X-RateLimit-Usage from EVERY Strava response
      Key: strava:rate:15min → counter (100 max)
      Key: strava:rate:daily → counter (1000 max)
      Circuit-break at 90% usage, pause at 95%
      Budget: webhooks don't count (free) → API reserved for bulk sync + enrichment
      ```
    - **Elevated tier:** After beta proves webhook-first, request 600/15min + 30,000/day from Strava
    - Retry with exponential backoff (2s, 4s, 8s, max 3 retries, then dead letter)
    - **Audit log:** Record every token refresh and API error in AuditLog table
<!-- Updated: Strava best practices - token caching, refresh lock, response header tracking, audit log -->
25. Implement **Job Pipeline** (BullMQ, runs in-process with API):
    ```
    Strava Webhook → [critical queue] Activity Fetch Job
                        ↓
                   [default queue] MAF Analysis Job
                        ↓
                   [low queue] Dashboard Aggregation Job
                        ↓
                   [low queue] Notification Job (future)
    ```
    - Each job type in its own processor file
    - Job chaining: on `fetch.completed` → add `analysis` job → on `analysis.completed` → add `aggregation` job
    - Job options: `removeOnComplete: 100`, `removeOnFail: 500`, `attempts: 3`, `backoff: exponential`
26. Implement StravaSyncService:
    - `syncInitial(userId)` → queue bulk fetch (**last 1 month**, paginated, ~10 API calls — reduced from 3 months to conserve API budget)
    - **Stagger initial syncs:** add per-user delay (30s between users) to avoid blowing daily budget on launch day
    - **"Sync pending" UI state:** return sync progress to frontend so users see status, not errors
    - `syncActivity(stravaActivityId)` → single fetch + streams (2 API calls)
    - Parse: distance, duration, avg_hr, max_hr, pace, splits, stream data
27. Implement StravaWebhookController:
    - `GET /strava/webhook` → subscription validation (hub.challenge)
    - `POST /strava/webhook` → validate signature → queue to **critical** queue → respond 200 within 2s
    - Events: create/update → sync job, delete → soft-delete activity
    - **Deauthorize event (LEGAL REQUIREMENT):** Delete tokens + all activity data + audit log entry. Strava suspends API access if you don't comply.
    - Handle null polyline gracefully (indoor activities have no GPS data)
28. Implement **CronService** (runs in-process):
    - Every 6h: refresh Strava tokens expiring within 1h (batch, rate-limited)
    - Every 1h: aggregate dashboard stats for active users (incremental, not full recompute)
    - Every 24h: cleanup old job logs, stale sessions, orphaned data
    - Weekly: re-sync users with stale data (last sync > 7 days)
29. Register webhook with Strava API
30. Test: Connect Strava → bulk sync → verify activities + analysis in DB

### Week 4: MAF Analysis + Dashboard API + Caching
31. Implement MafAnalysisService (runs as BullMQ job in worker):
    - `analyzeActivity(activity, userProfile)`:
      - Calculate MAF HR from user profile (180 - age ± adjustments)
      - % time in MAF zone (avg_hr vs MAF ± 10)
      - Cardiac drift: compare first-half avg HR vs second-half
      - Pace efficiency: pace at given HR
    - `detectMafTest(activity)`: identify consistent-pace runs as MAF tests
32. Run analysis on all synced activities (default queue background job)
33. Implement **DashboardModule with caching**:
    - `GET /dashboard/stats` → weekly volume, zone compliance %, activity count
      - **Redis cache:** key `dashboard:stats:{userId}`, TTL 5min
    - `GET /dashboard/trends` → MAF pace trend (weekly averages, last 12 weeks)
      - **Redis cache:** key `dashboard:trends:{userId}`, TTL 5min
    - `GET /dashboard/maf-tests` → detected MAF test results over time
    - `GET /activities?page=1&limit=20` → paginated activities with analysis data
      - **No cache** (paginated, user-specific, low cost with indexes)
    - Cache invalidation: on new activity sync, delete `dashboard:*:{userId}` keys
34. Implement **DashboardAggregationJob** (low queue, runs hourly):
    - Pre-compute: weekly totals, zone compliance %, MAF pace average
    - Store in `UserDashboardCache` table (materialized view alternative)
    - Dashboard API reads from cache table → near-instant response
35. Add Swagger/OpenAPI documentation (`@nestjs/swagger`)
36. Generate OpenAPI spec → share with Dev B for frontend types
37. **AES-256-GCM key rotation plan** — document rotation procedure for SP3+ (not implemented in SP2, but have a plan):
    - Envelope encryption: data key encrypted by master key. Rotate master key without re-encrypting data.
    - Store key version in StravaConnection row for gradual migration.
38. Final: Deploy to Docker, verify api.maf.run works via Cloudflare Tunnel
<!-- Updated: Red Team Session 2 - Grafana removed (Tier 1), key rotation plan added -->

## Todo List
- [ ] NestJS project initialized with Prisma + BullMQ (in-process)
- [ ] DB schema migrated with indexes (users, profiles, strava, activities, job_logs)
- [ ] Prisma direct → PostgreSQL (pool_size=5, no PgBouncer)
- [ ] Redis 7 standalone running (single instance, 1-2GB)
- [ ] Docker services running (api, redis) — N8N removed
- [ ] Docker `mem_limit` set on all containers (api: 1GB, pg: 2GB, redis: 2GB)
- [ ] Docker network isolation (wp_network + maf_network)
- [ ] Automated daily backups (pg_dump + MySQL dump, 7-day retention, off-VPS)
- [ ] WordPress OAuth2 plugin configured on maf.run (PKCE)
- [ ] Auth flow working (login → WP OAuth PKCE + state → callback → JWT → /users/me)
- [ ] Auth degradation: 7-day refresh token, WP user cache in PostgreSQL
- [ ] Strava OAuth connect/disconnect (with `state` CSRF param)
- [ ] Strava rate limiter working (Redis token bucket, 100/15min, 1000/day)
- [ ] BullMQ job pipeline: webhook → fetch → analyze → aggregate (in-process)
- [ ] Strava webhook receiving events (< 2s response)
- [ ] Initial sync (1 month history, staggered per-user, rate-limited)
- [ ] Cron jobs running: token refresh, stats aggregation, cleanup
- [ ] MAF analysis running on activities (background job)
- [ ] Dashboard API returning cached trends + stats
- [ ] Dashboard aggregation job running hourly
- [ ] OpenAPI spec generated and shared with Dev B
- [ ] api.maf.run accessible via Cloudflare Tunnel
<!-- Updated: Red Team Session 2 - Tier 1 todo, Docker limits, backups, auth degradation -->

## Success Criteria
- `POST /auth/login` → redirects to WP OAuth (PKCE) → callback → JWT cookie set
- `GET /users/me` → returns logged-in user from local cache (not WP)
- `GET /strava/connect` → OAuth flow → activities synced via job pipeline
- `GET /activities` → returns paginated activities with MAF analysis, < 200ms
- `GET /dashboard/trends` → returns cached MAF pace trend data, < 100ms
- All endpoints documented in Swagger
- Docker health checks passing (api + redis)
- BullMQ job pipeline: webhook → fetch → analyze completes in < 30s
- Strava rate limiter respects 100/15min budget allocation
- Docker `mem_limit` enforced on all containers
- Automated backup cron running (daily pg_dump + MySQL dump)
<!-- Updated: Red Team Session 2 - removed Prometheus/Grafana, added Docker limits + backups -->

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| WP OAuth plugin issues | Test WP OAuth Server first; fallback: WP REST API + application passwords |
| Strava token refresh failures | Exponential backoff, cron re-check every 6h, alert on 3+ failures |
| BullMQ job failures | Dead letter queue, retry 3x with backoff, JobLog tracking, admin re-trigger |
| Schema migration conflicts | Prisma migration files in git, dev reviews before merge |
| Prisma pool exhaustion (<1K users) | Low risk at beta scale. Default pool=5 handles <1K. Monitor connection count. |
| Redis standalone failure | Single point of failure at Tier 1. Docker restart policy=always. Acceptable for beta. |
| Strava rate limit at 40K users | Distributed Redis token bucket, budget allocation per job type |
| Worker OOM on bulk sync | Job timeout 30s, batch 100 activities max, Docker memory limits |

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
