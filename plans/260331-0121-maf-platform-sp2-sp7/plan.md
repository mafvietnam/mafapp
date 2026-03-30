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

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|-------------|------|--------|
| Blocked by | [Full Modernization Refactor](../260330-1924-full-modernization-refactor/plan.md) | pending |

> Refactor plan restructures codebase into `src/` with proper modules. SP2 builds on that clean structure.

## Tech Stack (New)

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend API | NestJS + TypeScript | Modular, TS-native, scales well |
| Database | PostgreSQL 15 | Already exists for N8N |
| Cache | Redis | Sessions, rate limiting, realtime |
| ORM | Prisma | Type-safe, great DX, migrations |
| Auth | WordPress OAuth2 → JWT | maf.run existing WP site |
| External | Strava API, Claude API | Activity data, AI coaching |
| Mobile | Capacitor | Wrap React app for app stores |
| Infra | Docker Compose + Cloudflare | Self-hosted, existing setup |

## Architecture

```
User → Cloudflare CDN → Cloudflare Tunnel
    ├─ app.maf.run  → Nginx + React SPA (+ Capacitor mobile)
    ├─ api.maf.run  → NestJS API → PostgreSQL + Redis
    └─ maf.run      → WordPress (SSO provider)
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
| 1 | [SP2: Backend Foundation + Auth + Strava](./phase-01-sp2-backend.md) | Dev A | Pending | 4w | Refactor plan |
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
| WP OAuth plugin complexity | Medium | Test with miniOrange first, fallback to email/password |
| Strava rate limits (100/15min) | High | Queue system (BullMQ), cache, webhook-driven |
| API contract drift between devs | Medium | Define OpenAPI spec before each sprint, generate types |
| Refactor plan not done | Blocks all | Complete refactor first, it's 12h total |
| Self-hosted Redis/PG scaling | Low | Fine for 10K users, add replicas later |
