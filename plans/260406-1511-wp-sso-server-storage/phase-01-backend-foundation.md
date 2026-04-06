# Phase 1: Backend Foundation

## Context
- [WP OAuth Research](../reports/researcher-260405-1101-wp-oauth-job-systems.md)
- [Scaling Architecture](../reports/researcher-260405-1101-scaling-architecture-40k.md)
- [System Architecture](../../docs/system-architecture.md)
- [SP2 Backend Phase](../260331-0121-maf-platform-sp2-sp7/phase-01-sp2-backend.md) (reference)

## Overview
- **Priority:** P1 (Critical Path)
- **Status:** Complete
- **Effort:** 3 days

Set up NestJS API project at `api/`, configure PostgreSQL `maf` database, add Redis 7, update Docker compose. Remove N8N from stack.

## Key Insights
- PostgreSQL 15 already runs on VPS — create new `maf` database alongside existing `n8n` DB
- N8N will be removed from docker-compose (replaced by NestJS API)
- Redis standalone sufficient for beta (sessions + cache)
- Prisma direct connection (no PgBouncer at this scale)
- api.maf.run route in Cloudflare tunnel reassigned from N8N to NestJS

## Requirements

### Functional
- NestJS API running at api.maf.run (port 3001 internally)
- PostgreSQL `maf` database with Prisma ORM
- Redis 7 for sessions/cache
- Health check endpoint: `GET /health`
- ConfigModule with env validation (Joi)

### Non-Functional
- API response <200ms (p95)
- Docker containers with memory limits
- Structured JSON logging
- Graceful shutdown

## Architecture

```
api/ (NestJS project)
├── src/
│   ├── main.ts              — Bootstrap, CORS, Swagger
│   ├── app.module.ts        — Root module
│   ├── shared/
│   │   ├── prisma.service.ts    — PrismaClient singleton
│   │   ├── redis.service.ts     — ioredis client
│   │   └── config.module.ts     — Env validation (Joi)
│   └── health/
│       └── health.controller.ts — GET /health
├── prisma/
│   └── schema.prisma        — DB schema
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Related Code Files

### Files to Create
- `api/` — entire NestJS project directory
- `api/src/main.ts` — bootstrap with CORS for app.maf.run
- `api/src/app.module.ts` — root module
- `api/src/shared/prisma.service.ts` — Prisma singleton
- `api/src/shared/redis.service.ts` — Redis client
- `api/src/shared/config.module.ts` — env validation
- `api/src/health/health.controller.ts` — health endpoint
- `api/prisma/schema.prisma` — initial schema (User model)
- `api/Dockerfile` — multi-stage build
- `api/.env.example` — env template
- `api/package.json`, `api/tsconfig.json`, `api/nest-cli.json`

### Files to Modify
- `docker-compose.yml` — remove N8N, add `maf-api` + `redis`
- `docker-compose.dev.yml` — add `maf-api` + `redis` dev services

## Implementation Steps

1. Initialize NestJS: `npx @nestjs/cli new api --strict --package-manager npm`
2. Install deps:
   ```
   @nestjs/config @nestjs/terminus @nestjs/throttler
   @prisma/client prisma ioredis joi
   ```
   <!-- Red Team: Added @nestjs/throttler for rate limiting on auth endpoints -->
3. Set up ConfigModule with Joi validation:
   - `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`, `JWT_PRIVATE_KEY`
   - `WP_OAUTH_CLIENT_ID`, `WP_OAUTH_REDIRECT_URI`, `WP_OAUTH_URL`
   - `CORS_ORIGIN` (default: https://app.maf.run)
4. Create PrismaService (extends PrismaClient, implements OnModuleInit)
5. Create RedisService (ioredis wrapper)
6. Create HealthController: `GET /health` returns `{ status: "ok" }` only (no internal topology details)
   <!-- Red Team: Don't expose DB/Redis status publicly — reveals attack surface -->
7. Create `maf` database and dedicated user before Prisma setup:
   - Connect to PostgreSQL: `docker exec -it maf-postgres psql -U n8n`
   - Run: `CREATE DATABASE maf;`
   - Run: `CREATE USER maf_user WITH PASSWORD '...'; GRANT ALL ON DATABASE maf TO maf_user;`
   - Set `DATABASE_URL=postgresql://maf_user:password@postgres:5432/maf` in api/.env
   - For docker dev: add init SQL script at `api/init-db.sql` mounted to `/docker-entrypoint-initdb.d/`
   <!-- Red Team: Explicit DB creation step + dedicated user (not shared n8n superuser) -->
8. Set up Prisma schema with initial User model:
   ```prisma
   model User {
     id        String   @id @default(uuid())
     wpUserId  Int      @unique
     email     String   @unique
     name      String
     avatar    String?
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```
8. Run `npx prisma migrate dev --name init`
9. Create `api/Dockerfile` (multi-stage: deps → build → runtime on node:20-alpine)
10. Configure global rate limiting in `main.ts` using `@nestjs/throttler`:
    - Default: 100 req/min per IP
    - Auth endpoints: stricter limits (see Phase 2)
    <!-- Red Team: Rate limiting infrastructure must exist from Phase 1 -->
11. Update `docker-compose.yml`:
    - **Keep N8N commented out** (do NOT remove yet — removal in Phase 6 deploy only)
    - Add `maf-api` service (port 3001, depends_on postgres + redis)
    - Add `redis` service (redis:7-alpine, maxmemory 256mb)
    - Set `mem_limit`: api=1GB, redis=512MB
    - Update cloudflared `depends_on`: add maf-api, keep n8n until Phase 6
    <!-- Red Team: N8N removal deferred to Phase 6 to prevent accidental production downtime -->
    <!-- Red Team: Redis reduced from 2GB to 256MB — YAGNI for beta -->
11. Create `docker-compose.dev.yml` with api + redis for local dev
12. Configure CORS: allow `https://app.maf.run` + `http://localhost:5173`
13. Verify: `docker-compose up` → API health at localhost:3001/health

## Todo List
- [x] NestJS project initialized at `api/`
- [x] Prisma configured with PostgreSQL `maf` database
- [x] Redis 7 service running
- [x] ConfigModule with env validation
- [x] Health endpoint returning DB + Redis status
- [x] Dockerfile for api (multi-stage, node:20-alpine)
- [x] docker-compose.yml updated (N8N removed, api + redis added)
- [x] docker-compose.dev.yml for local development
- [x] CORS configured for app.maf.run
- [x] `npm run build` passes for api project

## Success Criteria
- `GET /health` returns 200 with `{ status: "ok" }`
- Docker compose starts all services (maf-app, maf-api, postgres, redis, cloudflared)
- N8N commented out but still present in compose (removed in Phase 6)
- Prisma migration runs successfully

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| PostgreSQL has N8N data | Create separate `maf` database, don't touch `n8n` DB |
| Port conflict with N8N | N8N removed; api uses port 3001 |
| Redis memory | Set maxmemory 2GB with allkeys-lru policy |

## Security Considerations
- No exposed ports (all traffic via Cloudflare tunnel)
- Environment variables for all secrets
- Non-root Docker user
- CORS whitelist only app.maf.run

## Next Steps
- Phase 2: Implement WordPress SSO on top of this foundation
- Phase 3: Add UserProfile model and CRUD endpoints
