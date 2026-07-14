---
title: "MAF Platform — SP2 to SP7"
description: "Evolve MAF calculator into full training platform: auth, Strava, nutrition, challenges, mobile, coaching"
status: pending
priority: P1
effort: 40w
branch: dev
tags: [feature, backend, frontend, fullstack, platform]
blockedBy: [260330-1924-full-modernization-refactor]
blocks: []
created: 2026-03-31
---

# MAF Platform — SP2 to SP7

## Overview

Transform MAF Running Coach from offline-first calculator (v1.0) into full-featured training platform with user accounts, Strava integration, nutrition tracking, community challenges, mobile apps, and AI coaching.

**Team:** 2 developers (vibe coding, parallel execution)
**Strategy:** Dev A = Backend, Dev B = Frontend — clear file ownership, no conflicts

## Research Reports
- [Scaling Architecture 40K+](../reports/researcher-260405-1101-scaling-architecture-40k.md) — PgBouncer, Redis Cluster, horizontal scaling, job architecture
- [WordPress OAuth + Job Systems](../reports/researcher-260405-1101-wp-oauth-job-systems.md) — WP OAuth Server, PKCE, job pipeline, Strava rate limits

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|-------------|------|--------|
| Blocked by | [Full Modernization Refactor](../260330-1924-full-modernization-refactor/plan.md) | pending |
| Related (overlap) | [Daily Run Recommendation](../260714-1229-daily-run-recommendation/plan.md) | pending |

> **2026-07-14 note:** Daily Run Recommendation plan implements the *daily AI narrative* slice (server-key + 1/day cache) that partially overlaps Phase 8 (SP7 AI Coaching, BYOK). Re-scope Phase 8 when reached: full plan-generation remains SP7; daily narrative + rule engine will already exist. No blocking either direction.

> Refactor plan restructures codebase into `src/` with proper modules. SP2 builds on that clean structure.

## Tech Stack Timeline

### VPS Baseline

**Server:** 16 GB RAM | 4 vCPU | 100 GB NVMe | 1 Gbps — Ubuntu 24.04 LTS
**Hosts:** maf.run (WordPress) + app.maf.run (React SPA) + api.maf.run (NestJS, post-SP2)

**Current usage (pre-SP2):**

| Service | RAM | CPU | Note |
|---------|-----|-----|------|
| OS + system | ~500 MB | — | Ubuntu baseline |
| WordPress + MySQL | ~800 MB | ~0.5 | maf.run (future SSO provider) |
| Nginx (maf-app) | ~50 MB | ~0.1 | React SPA static files |
| PostgreSQL 15 | ~500 MB | ~0.5 | N8N data (repurposed in SP2) |
| N8N | ~2,000 MB | ~1.5 | **REMOVED in SP2 Phase 0** |
| Cloudflared | ~50 MB | ~0.1 | Tunnel to Cloudflare |
| Docker overhead | ~200 MB | — | Engine + networking |
| **Total** | **~4.1 GB** | **~2.7** | **26% of 16 GB** |

---

### ADR: Backend Language — Why NestJS (TypeScript), Not Python/Go/Rust

**Decision:** NestJS + TypeScript for all backend (SP2–SP7).
**Status:** Confirmed (2026-04-05)

**Context:** 2-person team (AI-assisted), React+TS frontend, 16GB VPS, 5K-10K users year 1, I/O-bound workload (REST, webhooks, Redis, PostgreSQL). Peak load ~400 req/s at 30K users.

| Criteria | NestJS (TS) | FastAPI (Python) | Go (Gin) | Rust (Axum) |
|----------|-------------|------------------|----------|-------------|
| Shared types w/ React | **YES** | No | No | No |
| Time to ship SP2 | **4 weeks** | 5-6w | 6-8w | 10-12w |
| ORM quality | Prisma (excellent) | SQLAlchemy (good) | GORM (OK) | SeaORM (immature) |
| AI coding quality | **Best** | Good | Medium | Poor |
| Memory per process | 600 MB | 300 MB | 100 MB | 50 MB |
| Req/s (realistic w/ DB) | 300-800 | 200-600 | 2K-5K | 5K-15K |
| Hiring pool (Vietnam) | Large | Large | Small | Very small |

**Why not Python:** No shared types (Pydantic ≠ TS interfaces), GIL limits concurrency, async less mature than Node.js. Only better if ML-heavy — MAF analysis is basic math.
**Why not Go:** No shared types, 2-3x more boilerplate (no decorators/DI), weaker ORM. Only better at >100K users or microservices with separate teams.
**Why not Rust:** 2-3x slower dev speed, immature web ecosystem, AI tools struggle with borrow checker. Overkill — peak 400 req/s vs Rust's 15K capacity.

**Bottom line:** At this scale, bottleneck is developer velocity, not runtime performance. NestJS on 16GB VPS uses 4% RAM at peak. Go/Rust savings don't matter when you have 12+ GB free.

**Reconsider when:** >50K users with latency issues (Go microservice for hot path), or team hires Go/Rust developers.

---

### Short-Term: SP2 (Apr–May 2026) — Beta <1K users

**Goal:** Auth + Strava + Dashboard MVP. Invite-only beta.

#### Tech Stack

| Layer | Technology | Version | Why | Alternatives rejected |
|-------|-----------|---------|-----|----------------------|
| API framework | NestJS | 10.x | Modular, TS-native, decorator DI | Express (too bare), Fastify (smaller ecosystem) |
| Language | TypeScript | 5.8+ | Shared with frontend | — |
| ORM | Prisma | 6.x | Type-safe queries, auto-client, migrations | TypeORM (verbose), Drizzle (less mature) |
| Database | PostgreSQL 15 | 15-alpine | Already on VPS, JSONB for raw data | — |
| Cache + Queue | Redis 7 | 7-alpine | Sessions + BullMQ + rate limit + cache (1 service) | — |
| Job queue | BullMQ | 5.x | Redis-backed, priority queues, retries | pg-boss (PG-based, slower), Agenda (MongoDB) |
| Auth (SSO) | WP OAuth Server + PKCE | — | maf.run WP = existing user base | Firebase Auth (vendor lock), custom auth (overkill) |
| Auth (tokens) | JWT RS256 + opaque refresh | — | Stateless access, revocable refresh | Session cookies (not scalable for API) |
| Token encryption | AES-256-GCM | — | Strava tokens at rest | — |
| API spec | OpenAPI 3.1 | — | Contract-first, type generation | — |
| External API | Strava API v3 | — | Activity data + webhooks | — |
| Frontend | React 19 + Vite 6 | existing | Keep what works | — |
| Routing | React Router 7 | existing | Already in deps | — |
| Styling | Tailwind CSS 3 | existing | Utility-first, dark theme | — |
| HTTP client | Native fetch + wrapper | — | Zero deps, built-in | Axios (heavier) |
| Infrastructure | Docker Compose | — | Single-node orchestration | — |
| Reverse proxy | Cloudflare Tunnel | — | Zero-trust, no ports exposed | Nginx reverse proxy (port exposure) |
| Monitoring | Structured JSON logging | — | Grep-friendly, simple | Prometheus+Grafana (overkill for beta) |

#### Infrastructure Detail
1. Direct Prisma → PostgreSQL — pool size 5, sufficient <1K users
2. Redis standalone 1-2 GB — sessions + cache + BullMQ (single instance)
3. BullMQ single queue — priority-based (1=webhooks, 10=sync, 50=bulk), in-process with API
4. Strava rate limiter — Redis-based, 100 req/15min, 1,000 req/day
5. DB indexes — composite on `(userId, startDate)`, `(stravaId)`, `(userId, isInMafZone)`
6. Caching — Redis dashboard stats (TTL 5min)
7. CDN — Cloudflare for static assets

#### Strava API Budget
- **Limit:** 100 req/15min, 1,000 req/day (per APP, default tier)
- **Webhooks are FREE** — handle real-time sync (don't count against limit)
- **API calls:** Reserved for initial bulk sync + token refresh
- **At <1K users:** ~1 sync/user/day = ~1,000 req/day (within budget)

#### SP2 RAM Budget (after N8N removal)

| Service | RAM | CPU | Change |
|---------|-----|-----|--------|
| OS + system | 500 MB | — | — |
| WordPress + MySQL | 800 MB | 0.5 | — |
| Nginx (maf-app) | 50 MB | 0.1 | — |
| PostgreSQL 15 | 500 MB | 0.5 | `maf` DB (dedicated) |
| Redis 7 | 200 MB | 0.1 | **NEW** |
| NestJS API | 600 MB | 1.0 | **NEW** (in-process BullMQ + analysis; `mem_limit: 1GB`) |
| Cloudflared | 50 MB | 0.1 | — |
| Docker overhead | 200 MB | — | — |
| **Total** | **~2.9 GB** | **~2.4** | **-1.2 GB** (N8N removed) |
| **Free** | **~13.1 GB** | **~1.6** | **82% headroom** |

#### Skills Required
NestJS, Prisma ORM, Redis/BullMQ, OAuth2 PKCE flow, Strava API, JWT auth, OpenAPI spec design

#### Migration Effort: Low
- Backend is green-field (new `api/` directory)
- Frontend adds pages incrementally (no rewrite)
- Remove N8N Docker services + archive its DB
- Install WP OAuth Server plugin on maf.run

#### Cost: $0 new
All self-hosted OSS. No paid services.

---

### Mid-Term: SP3–SP5 (Jun–Oct 2026) — Growth 1K–10K users

**Goal:** Nutrition tracking, community challenges, mobile app release.

#### New Technology Additions

| Addition | Sprint | Technology | Server RAM | Note |
|----------|--------|-----------|------------|------|
| Nutrition module | SP3 | NestJS module + DB tables | +50 MB | Same API process, new endpoints |
| Challenge leaderboards | SP4 | Redis sorted sets (ZADD/ZRANGE) | +100 MB | Real-time ranking, recalc on activity sync |
| Province groups (63) | SP4 | PostgreSQL + Redis cache | +50 MB | Pre-seeded Vietnam provinces |
| Push notifications | SP5 | Firebase Cloud Messaging | +0 MB | External service, free: 10M msg/month |
| Mobile wrapper | SP5 | Capacitor 6 | +0 MB | Build-time only (iOS/Android), no server cost |
| Health data | SP5 | @capacitor-community/health | +0 MB | Apple Health / Google Fit (client-side) |
| CI/CD mobile | SP5 | GitHub Actions | +0 MB | Build iOS/Android, free: 2,000 min/month |

#### SP5 RAM Budget (cumulative)

| Service | RAM | Change from SP2 |
|---------|-----|-----------------|
| NestJS API | 500 MB | +100 MB (more modules) |
| PostgreSQL | 600 MB | +100 MB (more tables + indexes) |
| Redis | 400 MB | +200 MB (leaderboards + more cache) |
| Everything else | 1,600 MB | unchanged |
| **Total** | **~3.1 GB** | **+400 MB** |
| **Free** | **~12.9 GB** | **81% headroom** |

#### Skills Required (new from SP2)
Firebase Cloud Messaging, Capacitor 6, iOS/Android build tooling, App Store + Play Store publishing, GitHub Actions CI/CD

#### Migration Effort: Medium
- SP3–SP4: Low — add NestJS modules + DB migrations + frontend pages (same patterns)
- SP5: Medium — Capacitor wraps existing React app (no rewrite), but native plugin setup, signing certs, store submission are new workflows

#### New Costs
| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer | $99 | Annual |
| Google Play | $25 | One-time |
| Firebase Cloud Messaging | $0 | Free under 10M msg/month |

---

### Long-Term: SP6–SP7 (Nov 2026 – Mar 2027) — Scale 10K–30K+ users

**Goal:** Mentoring system, AI coaching, race preparation.

#### New Technology Additions

| Addition | Sprint | Technology | Server RAM | Note |
|----------|--------|-----------|------------|------|
| In-app messaging | SP6 | WebSocket (NestJS @WebSocketGateway) | +300-600 MB | Real-world ~150-250 KB/conn (includes buffers, auth state, GC). Hard-cap 2,000 conns. Client exponential backoff on reconnect. |
| Mentor matching | SP6 | PostgreSQL + BullMQ cron | +50 MB | Weekly check-in scheduler |
| Push: mentoring | SP6 | FCM (already deployed in SP5) | +0 MB | Reuse |
| AI plan generation | SP7 | Claude API (Anthropic) | +0 MB | External, pay-per-token |
| Race prediction | SP7 | In-process calculation | +50 MB | Statistical model, no ML infra |
| Plan versioning | SP7 | PostgreSQL JSONB | +50 MB | AI draft → coach review → final |

#### SP7 RAM Budget (cumulative)

| Service | RAM | Change from SP5 |
|---------|-----|-----------------|
| NestJS API | 800 MB | +300 MB (WebSocket connections + modules) |
| PostgreSQL | 800 MB | +200 MB (messages, plan versions, race data) |
| Redis | 500 MB | +100 MB (WS pub/sub, session pinning) |
| Everything else | 1,600 MB | unchanged |
| **Total** | **~3.7 GB** | **+600 MB** |
| **Free** | **~12.3 GB** | **77% headroom** |

#### Skills Required (new from SP5)
WebSocket/SSE real-time patterns, Claude API prompt engineering, basic statistical modeling

#### Migration Effort: Low–Medium
- SP6: Medium — WebSocket gateway is new pattern; messaging adds significant DB schema
- SP7: Low — Claude API is HTTP calls; race prediction is math, no infra change

#### New Costs
| Item | Cost | Frequency |
|------|------|-----------|
| Claude API (Anthropic) | ~$10–50 | Monthly (depends on AI plan generation volume) |
| **Total monthly at SP7** | **~$10–60** | Claude API only; everything else is self-hosted |

---

## VPS Capacity & CCU Analysis

### RAM Headroom Summary

| Phase | RAM Used | RAM Free | % Used | Verdict |
|-------|----------|----------|--------|---------|
| Current (pre-SP2) | 4.1 GB | 11.9 GB | 26% | N8N is heavy |
| **SP2** (N8N removed) | **2.9 GB** | **13.1 GB** | **18%** | Best ratio |
| SP5 (mid-term peak) | 3.3 GB | 12.7 GB | 21% | Comfortable |
| SP7 (long-term peak) | 4.1 GB | 11.9 GB | 26% | Fine (mem_limits enforced) |

### CCU Capacity Estimates

**Assumptions:**
- Avg user: 1 API request per 15–30s during active session → ~0.05 req/s per CCU
- NestJS on 4 vCPU: **~300–800 req/s** (with Prisma + PostgreSQL + Redis in the loop; raw NestJS is higher but DB is the bottleneck)
- PostgreSQL with indexes: ~500–1,000 TPS
- Redis cache (TTL 5min) reduces DB load ~60%
- Peak CCU = 5–10% of registered users (validated: daily training app, sporadic dashboard checks)
<!-- Updated: Red Team Session 2 - Throughput revised from 1500-3000 to 300-800 with DB in loop -->

| Phase | Registered Users | Peak CCU | Req/s at Peak | Bottleneck | Verdict |
|-------|-----------------|----------|---------------|------------|---------|
| SP2 | <1,000 | 50–100 | 5–10 | None | **Effortless** |
| SP3–SP4 | 1K–5K | 100–500 | 10–50 | None | **Comfortable** |
| SP5 (mobile) | 5K–10K | 500–1,000 | 50–100 | None | **Fine** |
| SP6 (WebSocket) | 10K–15K | 1,000–1,500 | 100–150 + WS | WS memory | **Monitor** |
| SP7 (AI + WS) | 15K–30K | 1,500–3,000 | 150–300 + WS | PG connections | **Tune PgBouncer** |
| **Hard ceiling** | **~40K** | **~4,000** | **~400** | **WS + PG** | **Second VPS** |

> **Bottom line:** This VPS handles up to ~30K registered users (~3K peak CCU) without hardware changes. Second VPS only needed beyond 30K users or 5K+ simultaneous WebSocket connections.

### Scaling Decision Points

| Trigger | Action | Expected Timeline |
|---------|--------|-------------------|
| >5K registered | Add PgBouncer (connection pooling) | SP5–SP6 |
| >10K registered | Separate BullMQ workers to own container | SP6 |
| >3K WebSocket conns | Redis pub/sub for WS horizontal scaling | SP6 |
| >15K registered | Prometheus + Grafana monitoring | SP6–SP7 |
| >30K registered | 2nd VPS: offload workers + Redis | SP7+ |
| >50K registered | Load balancer + 3 API nodes | Post-SP7 |

Full scaling research: [reports/researcher-260405-1101-scaling-architecture-40k.md](../reports/researcher-260405-1101-scaling-architecture-40k.md)

### Launch Strategy

**Beta (<1K users):** Invite-only, single VPS, all Docker Compose. Validates: WP OAuth → Strava sync → MAF analysis → dashboard. CDN off.
**Closed Beta (1K–5K):** Wider invite, community testing. **Enable Cloudflare CDN caching at ≥1,000 users.** Monitor perf. Single VPS.
**Growth (5K–10K):** Target for year 1. Add PgBouncer + separate workers as needed. Still single VPS.
**Scale (30K+):** Second VPS for workers + Redis. Load balancer if >50K.
<!-- Updated: Validation Session 3 - CDN trigger at 1K users, growth target 5K-10K year 1 -->

### Total Cost Projection

> **Note:** VPS (16GB, 4vCPU) pre-paid 2 years. Domain owned. These are sunk costs.

| Phase | Monthly Cost | What |
|-------|-------------|------|
| SP2 | $0 | All self-hosted OSS |
| SP3–SP4 | $0 | Same infra, more modules |
| SP5 | ~$8/mo | Apple Developer ($99/yr prorated) |
| SP6 | ~$10/mo | + DB backup storage (~$2/mo) |
| SP7 | ~$10–35/mo | AI: BYOK model, $100–300/yr cap (~$8–25/mo) |
| Scale (2nd VPS) | +$20–50/mo | When >30K users, VPS provider dependent |
<!-- Updated: Validation Session 3 - Sunk costs noted, BYOK AI budget, backup storage added -->

### Dashboard Design References
- **Mobile design:** `home_mobile.html` — glass-card dark theme, bottom tabs, gradient brand
- **Desktop design:** `home_pc.html` — desktop-card dark theme, top nav, 12-col grid (8:4)
- **Brand colors:** `#F42A68` (pink-red) → `#9130F8` (purple) gradient
- **Theme:** Dark (#0B1121 base), glass/frosted effects on mobile, solid gray-900 on desktop

## Architecture

```
User → Cloudflare CDN → Cloudflare Tunnel
    │
    ├─ app.maf.run  → Nginx + React SPA (+ Capacitor mobile)
    │                  Dark theme dashboard (glass-card mobile / desktop-card PC)
    │
    ├─ api.maf.run  → NestJS API → PostgreSQL 15 (dedicated `maf` DB)
    │                  ├─ Redis standalone (sessions, cache, rate limits, BullMQ)
    │                  ├─ BullMQ (single queue, priority-based jobs, in-process)
    │                  └─ Auth: WordPress OAuth2 (PKCE + state) → JWT + opaque refresh
    │
    ├─ staging.maf.run → Staging environment (pre-production validation)
    │
    └─ maf.run      → WordPress (SSO provider, OAuth2 server)

    N8N: REMOVED from stack (non-standard, third-party dependency).
    api.maf.run freed for NestJS. N8N Docker services + DB to be cleaned up.
```

## Parallel Execution Strategy

### Dev A (Backend Developer)
Owns: `api/` directory (NestJS), Docker configs, DB migrations, external API integrations

### Dev B (Frontend Developer)
Owns: `src/` directory (React), UI components, pages, hooks, API client layer

### Shared (Coordination Points)
- API contract (OpenAPI spec) — agreed before each phase pair starts
- TypeScript types — shared via `@maf/shared` package or copied
- Integration testing — joint effort at end of each sprint

## Phases

| # | Phase | Owner | Status | Effort | Blocks |
|---|-------|-------|--------|--------|--------|
| 0 | SP2 Pre-sprint: WP OAuth spike + remove N8N | Dev A | Pending | 1d | Refactor plan |
| 1 | [SP2: Backend Foundation + Auth + Strava](./phase-01-sp2-backend.md) | Dev A | Pending | 4w | Phase 0 |
| 2 | [SP2: Frontend Auth + Dashboard + Activity UI](./phase-02-sp2-frontend.md) | Dev B | Pending | 4w | Refactor plan |
| 3 | [SP2: Integration + E2E Testing](./phase-03-sp2-integration.md) | Both | Pending | 1w | Phase 1, 2 |
| 4 | [SP3: Nutrition & Supplementation](./phase-04-sp3-nutrition.md) | Both | Pending | 4-6w | Phase 3 |
| 5 | [SP4: Community Challenges & Leaderboards](./phase-05-sp4-challenges.md) | Both | Pending | 4-6w | Phase 3 |
| 6 | [SP5: Mobile Release (Capacitor)](./phase-06-sp5-mobile.md) | Both | Pending | 6-8w | Phase 4, 5 |
| 7 | [SP6: Trainer-Trainee Mentoring](./phase-07-sp6-mentoring.md) | Both | Pending | 4-6w | Phase 3 |
| 8 | [SP7: AI Coaching for Elite & Racing](./phase-08-sp7-ai-coaching.md) | Both | Pending | 6-8w | Phase 7 |

## Dependency Graph

```
Refactor Plan (pending)
    ↓
┌─────────────────────────────────────────┐
│  SP2 (Phase 1 + Phase 2 in PARALLEL)    │
│  Dev A: Backend ──┐                     │
│  Dev B: Frontend ─┤→ Phase 3: Integrate │
└─────────────────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  SP3 (Phase 4) ──parallel──→ │  SP4 (Phase 5)
│  Dev A: Backend              │  Dev A: Backend
│  Dev B: Frontend             │  Dev B: Frontend
└──────────────────────────────┘
    ↓
SP5 (Phase 6) — Mobile wrapping (both)
    ↓
SP6 (Phase 7) — Mentoring (both)
    ↓
SP7 (Phase 8) — AI Coaching (both)
```

## File Ownership Matrix (SP2)

| Directory/File Pattern | Owner | Notes |
|------------------------|-------|-------|
| `api/**/*` | Dev A | Entire NestJS backend |
| `api/prisma/**` | Dev A | DB schema + migrations |
| `docker-compose*.yml` | Dev A | Backend services |
| `src/services/**` | Dev B | API client layer |
| `src/pages/**` | Dev B | New page components |
| `src/components/**` | Dev B | UI components |
| `src/hooks/**` | Dev B | React hooks |
| `src/contexts/**` | Dev B | Auth context, etc. |
| `src/types.ts` | Dev B | Frontend types (mirrors API) |
| `shared/types/**` | Both | API contract types (agree first) |

## Sprint Timeline

```
2026 Apr-May:  SP2 ████████████████████  (Phase 1+2 parallel, Phase 3 sequential)
2026 Jun-Jul:  SP3 ████████████████      SP4 can overlap ████████████████
2026 Aug-Oct:  SP5 ████████████████████████████████
2026 Nov-Dec:  SP6 ████████████████████
2027 Jan-Mar:  SP7 ████████████████████████████████
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| WP OAuth plugin complexity | Medium | Test WP OAuth Server plugin first; fallback to WP REST API + application passwords |
| Strava rate limits (100/15min, 1000/day) | **Critical** | Webhook-first architecture (webhooks are free). API calls only for bulk sync + enrichment. Per-user quota by tier. |
| API contract drift between devs | Medium | Define OpenAPI spec before each sprint, generate types |
| Refactor plan not done | Blocks all | Complete refactor first, it's 12h total |
| PostgreSQL connection exhaustion | Low (beta) | Direct Prisma pool (5 connections). <1K users, no concern. |
| Worker OOM on bulk sync | Medium | BullMQ concurrency=1 for bulk, job timeout 30s, Docker mem_limit, resumable sync |
| Redis memory (beta) | Low | Single Redis 1-2GB. <1K users = ~50MB actual usage. |
| 40K concurrent WebSocket/SSE | Low (SP7) | Defer realtime features; polling with cache for SP2-SP4 |
| WordPress OAuth perf at scale | Medium | Cache WP user data locally, refresh async, minimize OAuth round-trips |
| Dark theme migration effort | Low | New dashboard is green-field; existing calculator page unchanged until later |

## Red Team Review

### Session — 2026-04-05
**Findings:** 15 unique (37 raw, deduplicated) — 15 accepted, 0 rejected
**Severity breakdown:** 7 Critical, 6 High, 2 Medium
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | api.maf.run collision with N8N | Critical | Accept — FIXED | Phase 1 (N8N migration) |
| 2 | Strava rate limits inconsistent | Critical | Accept — FIXED | All phases (locked 100/1000) |
| 3 | Redis Cluster 21GB on 16GB server | Critical | Accept — FIXED | Plan + Phase 1 (Tier 1) |
| 4 | No PostgreSQL isolation from N8N | Critical | Accept — FIXED | Phase 1 (dedicated DB) |
| 5 | No rollback plan | Critical | Accept — FIXED | Phase 3 (staging + rollback) |
| 6 | Strava tokens plaintext | Critical | Accept — FIXED | Phase 1 (AES-256-GCM) |
| 7 | WP OAuth PKCE unvalidated | High | Accept — FIXED | Phase 0 (1-day spike) |
| 8 | Missing OAuth state param | Critical | Accept — FIXED | Phase 1 (state + CSRF) |
| 9 | PKCE model contradiction | High | Accept — FIXED | Phase 1 (backend-initiated) |
| 10 | JWT zero key management | High | Accept — FIXED | Phase 1 (RSA key gen) |
| 11 | Refresh token race condition | High | Accept — FIXED | Phase 1 (grace period) |
| 12 | OpenAPI spec last | High | Accept — FIXED | Phase 1+2 (API-first) |
| 13 | 38 files in 4 weeks | Critical | Accept — FIXED | Phase 2 (MVP scope) |
| 14 | Webhook endpoint abuse | Medium | Accept | Phase 1 (signature validation) |
| 15 | rawData stores GPS tracks | Medium | Accept — FIXED | Phase 1 (strip coordinates) |

**Reports (Session 1):**
- [Security Adversary](../reports/code-reviewer-260405-1120-security-adversary-plan-review.md)
- [Failure Mode Analyst](../reports/code-reviewer-260405-1120-sp2-plan-hostile-review.md)
- [Assumption Destroyer](../reports/code-reviewer-260405-1120-assumption-destroyer-review.md)
- [Scope & Complexity Critic](../reports/code-reviewer-260405-1120-scope-complexity-critique.md)

### Session 2 — 2026-04-05
**Findings:** 15 unique (39 raw, deduplicated) — 15 accepted, 0 rejected
**Severity breakdown:** 5 Critical, 8 High, 2 Medium
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic
**Focus:** Updated Tech Stack Timeline, VPS capacity, CCU estimates, phase artifact consistency

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Phase 1 architecture/todo/criteria still reference PgBouncer, Redis Cluster, Prometheus, separate worker | Critical | Accept — FIXED | Phase 1 (full rewrite to Tier 1) |
| 2 | No Docker `mem_limit` on any container — OOM unpredictable | Critical | Accept — FIXED | Phase 1 Week 1 (api:1GB, pg:2GB, redis:2GB) |
| 3 | No automated backup or disaster recovery plan | Critical | Accept — FIXED | Phase 1 Week 1 (daily pg_dump, off-VPS) |
| 4 | Phase 1 Week 3 packs 10-15 dev-days into 5 calendar days | Critical | Accept — FIXED | Phase 1 (redistributed + sync reduced) |
| 5 | WordPress SSO = single-server auth SPOF | Critical | Accept (modified) | Phase 1 (7d refresh token + WP user cache as degradation) |
| 6 | WebSocket memory 3-5x underestimate + reconnect storms | High | Accept — FIXED | Plan (revised to 150-250KB/conn, 2K cap) |
| 7 | Strava bulk sync blows daily API budget on launch day | High | Accept — FIXED | Phase 1 (1mo sync, staggered, sync-pending UI) |
| 8 | NestJS throughput claim inflated 3-5x | High | Accept — FIXED | Plan (revised to 300-800 req/s) |
| 9 | NestJS 400MB RAM unrealistic with in-process BullMQ | High | Accept — FIXED | Plan (revised to 600MB, mem_limit 1GB) |
| 10 | Rollback plan references removed N8N stack | High | Accept — FIXED | Phase 3 (pre-SP2 snapshot, Prisma rollback) |
| 11 | Phase 2 MVP dashboard still lists 10 widgets | High | Accept | Phase 2 (noted, clean up in impl) |
| 12 | No Docker network isolation between WP and API | High | Accept — FIXED | Phase 1 Week 1 (wp_network + maf_network) |
| 13 | Strava OAuth callback missing `state` CSRF param | High | Accept — FIXED | Phase 1 Week 3 (state + Redis) |
| 14 | AES-256-GCM key has no rotation strategy | Medium | Accept — FIXED | Phase 1 Week 4 (rotation plan documented) |
| 15 | Mentor data access has no authorization boundary | Medium | Accept — FIXED | Phase 7 (MentoringRelationshipGuard) |

**Reports (Session 2):**
- [Security Adversary](../reports/code-reviewer-260405-1217-security-adversary-plan-review-s2.md)
- [Failure Mode Analyst](../reports/code-reviewer-260405-1217-failure-mode-analyst-review.md)
- [Assumption Destroyer](../reports/code-reviewer-260405-1217-assumption-destroyer-review.md)
- [Scope & Complexity Critic](../reports/code-reviewer-260405-1217-scope-complexity-critique.md)

## Validation Log

### Session 1 — 2026-04-05
**Trigger:** Post-red-team validation before implementation
**Questions asked:** 8

#### Confirmed Decisions

1. **[Infra Tier] SP2 deploys Tier 1 infrastructure**
   - Single Redis (2-4GB), direct Prisma→PostgreSQL (no PgBouncer), single BullMQ queue, no Prometheus/Grafana
   - **Rationale:** 0 users with accounts. Add complexity at 5K users. Matches YAGNI.

2. **[N8N Fate] Move N8N to n8n.maf.run, give api.maf.run to NestJS**
   - Add migration step in Phase 1 Week 1: update tunnel config, verify N8N on new subdomain
   - **Rationale:** Clean separation. N8N automations preserved.

3. **[Auth Risk] Add 1-day spike before SP2: install WP OAuth Server, test PKCE end-to-end**
   - Pre-sprint validation: install plugin, configure client, test full flow on maf.run
   - **Rationale:** De-risk the sole auth dependency before committing 4 weeks.

4. **[Rate Limit] Use conservative: 100 req/15min, 1000 req/day**
   - Fix inconsistency in plan. Design for default Strava limits.
   - **Rationale:** Worst-case design. Can upgrade if Strava approves elevated quota.

5. **[FE Scope] MVP dashboard: 3-4 essential widgets only**
   - Build: MAF zone card, activity list, trend chart, profile page. ~20 files.
   - Defer: ecosystem icons, AI assistant, formula widget, glass-card effects → SP3
   - **Rationale:** Realistic 4-week scope. Ship core, iterate later.

6. **[API Contract] API-first: Create OpenAPI spec in Week 1**
   - Both devs agree on spec before coding. Backend implements to spec, frontend generates types.
   - **Rationale:** Eliminates contract drift. Phase 3 integration week stays 1 week.

7. **[Deploy] Add staging env + incremental deploy + documented rollback**
   - staging.maf.run for pre-production. Deploy services incrementally. Backup DB before migration.
   - **Rationale:** Red-team Critical finding. No rollback = unacceptable risk.

8. **[Token Security] AES-256-GCM via Prisma middleware + env var key**
   - Encrypt Strava tokens before write, decrypt after read. Key from ENCRYPTION_KEY env var.
   - **Rationale:** Red-team Critical finding. Plaintext tokens = data breach on DB exposure.

#### Action Items
- [ ] Downgrade plan infrastructure to Tier 1 (single Redis, no PgBouncer, no Prometheus)
- [ ] Add N8N migration step (n8n.maf.run) to Phase 1
- [ ] Add 1-day WP OAuth spike as Phase 0 / pre-sprint task
- [ ] Fix Strava rate limits to 100/15min, 1000/day throughout all files
- [ ] Reduce Phase 2 frontend scope to ~20 files, 3-4 dashboard widgets
- [ ] Move OpenAPI spec creation to Week 1 in both Phase 1 and Phase 2
- [ ] Add staging environment + rollback plan to Phase 3
- [ ] Add AES-256-GCM encryption step for Strava tokens in Phase 1 Week 3
- [ ] Add OAuth `state` parameter for CSRF protection in both WP and Strava flows
- [ ] Add separate PostgreSQL database for MAF (not shared with N8N)

#### Impact on Phases
- Phase 1: Major — strip Redis Cluster/PgBouncer/Prometheus, add N8N migration, add encryption, move OpenAPI to Week 1, add DB isolation
- Phase 2: Major — reduce dashboard scope to MVP, move OpenAPI integration to Week 1
- Phase 3: Major — add staging env, incremental deploy, rollback plan

### Session 2 — 2026-04-05
**Trigger:** User scope correction — beta <1K users, remove N8N entirely
**Changes:** 3

#### Confirmed Decisions

1. **[Target] Beta app: <1,000 users. Closed beta: >1,000 users.**
   - Replaced 40K scaling strategy with beta launch strategy
   - Redis downsized to 1-2GB, all infra beta-appropriate

2. **[N8N] Remove entirely — not migrate, REMOVE.**
   - N8N non-standard, depends on third-party system
   - Remove Docker services + DB. Archive DB before drop.
   - api.maf.run freed for NestJS.

3. **[Strava at <1K] Rate limits comfortable — 1 sync/user/day within 1000/day budget.**
   - No complex budget allocation needed for beta.

#### Impact on Phases
- Plan: 40K scaling → beta launch strategy, N8N removed from architecture
- Phase 0: "N8N migration" → "Remove N8N"
- Phase 1: N8N removal steps, simplified Docker services
- Phase 3: N8N cleanup verification

### Session 3 — 2026-04-05
**Trigger:** Post tech-stack-timeline update — validate CCU, costs, and architecture decisions
**Questions asked:** 6

#### Confirmed Decisions

1. **[Dual DB] Keep WordPress MySQL + NestJS PostgreSQL separately**
   - WP plugins expect MySQL; migration risk outweighs savings
   - Two DB engines on one VPS is acceptable given low resource usage
   - **Rationale:** Don't fix what isn't broken. WP MySQL uses ~200MB. Not worth migration risk.

2. **[CCU Ratio] 5-10% peak CCU is valid for this app type**
   - Daily training app with sporadic dashboard checks, not real-time competition
   - No need to design for 15-20% event spikes at this stage
   - **Rationale:** Users sync Strava in background (webhooks). Dashboard checks are brief.

3. **[Costs] VPS and domain are sunk costs — projection is accurate**
   - VPS: pre-paid 2 years (not a monthly expense)
   - Domain: already owned
   - CDN: enable Cloudflare caching after ≥1,000 users (not before)
   - Backup storage: add when DB has real user data (~$1-5/mo)
   - **Rationale:** No hidden costs for SP2-SP4. Only real new cost is Apple Developer ($99/yr) at SP5.

4. **[Realtime] WebSocket confirmed for SP6 messaging**
   - NestJS @WebSocketGateway for in-app mentoring chat
   - Not SSE, not polling — bidirectional needed for chat UX
   - **Rationale:** Polling creates poor UX for chat. SSE is one-way only. WebSocket is the right tool.

5. **[AI Budget] BYOK model, $100-300/year cap**
   - Bring Your Own Key: users or team provide API keys
   - Low-cost approach; token limits per user/plan generation
   - Consider self-hosted LLM if costs exceed budget
   - **Rationale:** Keep AI features affordable. BYOK shifts cost to power users.

6. **[Growth Target] 5K-10K registered users in first 12 months (ambitious)**
   - Well within VPS capacity (single VPS handles up to 30K)
   - At 10K users: consider PgBouncer + separate BullMQ workers
   - No 2nd VPS needed for this target
   - **Rationale:** Validates current infrastructure plan. No scaling changes needed for year 1.

#### Action Items
- [ ] Add CDN activation trigger (≥1,000 users) to Launch Strategy
- [ ] Update Phase 7 (SP6): confirm WebSocket transport, remove SSE mentions
- [ ] Update Phase 8 (SP7): add BYOK model + $100-300/yr budget cap
- [ ] Add backup storage line item ($1-5/mo) to cost projection when DB has real data

#### Impact on Phases
- Plan: CDN trigger added, cost projection clarified (sunk costs noted)
- Phase 7 (SP6): WebSocket confirmed (remove SSE/polling alternatives)
- Phase 8 (SP7): BYOK model + annual budget cap added
