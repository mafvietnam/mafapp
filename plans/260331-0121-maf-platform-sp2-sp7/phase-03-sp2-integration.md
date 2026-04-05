# Phase 3: SP2 Integration + E2E Testing

## Context
- [Phase 1: Backend](./phase-01-sp2-backend.md)
- [Phase 2: Frontend](./phase-02-sp2-frontend.md)

## Overview
- **Priority:** P1
- **Owner:** Both Dev A + Dev B
- **Status:** Pending
- **Effort:** 1 week
- **Blocked by:** Phase 1, Phase 2

Joint integration phase. Connect frontend to real backend, fix API contract mismatches, E2E test all flows, deploy to production.

## Implementation Steps

### Day 1-2: API Contract Alignment
1. Dev A shares OpenAPI spec → Dev B verifies `src/services/*` match
2. Fix any request/response shape mismatches
3. Test auth flow end-to-end: Login → WP SSO → callback → JWT → /users/me
4. Test Strava flow: Connect → callback → activities appear

### Day 3-4: E2E Testing + Performance Validation
5. Test flows manually:
   - Anonymous: Calculator works without login (light theme, no regression)
   - Login: WP OAuth PKCE → redirect → dark dashboard with user menu
   - Profile: View/edit MAF profile → saved to DB
   - Strava: Connect → bulk sync via job pipeline → activities appear in dashboard
   - Dashboard mobile: glass-card layout, bottom tabs, banner background
   - Dashboard desktop: top nav, 12-col grid, data table, sidebar widgets
   - Activity detail: MAF analysis displayed correctly
   - Logout: State cleared, redirect to home
6. Edge cases:
   - Expired JWT → auto-refresh works
   - Strava token expired → re-auth prompt
   - No activities yet → empty state UI (dark themed)
   - Network error → error boundary catches
   - BullMQ job failure → retry 3x → dead letter queue
   - Prisma pool (5 connections) under simulated load → handles correctly
7. **Performance validation (beta-readiness):**
   - Dashboard API: < 200ms (p95) with cached stats
   - Activity list: < 300ms for 20 items with indexes
   - Strava webhook → job complete pipeline: < 30s
   - BullMQ throughput: simulate 100 concurrent jobs
   - Redis cache hit rate > 80% for dashboard stats
8. Mobile responsive check on real devices (dark theme contrast)

### Day 5-7: Staging + Production Deploy (validated: add staging, incremental deploy, rollback)
9. **Backup PostgreSQL** before any migration: `pg_dump maf > backup-pre-sp2.sql`
10. Build production Docker images (api, frontend)
11. **Deploy to staging first** (staging.maf.run):
    - Deploy all services to staging docker-compose profile
    - Run full E2E test on staging: login → Strava → dashboard
    - Verify N8N fully removed (no orphan containers/volumes)
12. **Incremental production deploy:**
    - Step 1: Deploy Redis + API (no tunnel change yet)
    - Step 2: Verify health checks pass
    - Step 3: Update tunnel config (api.maf.run → NestJS)
    - Step 4: Deploy frontend
13. **Documented rollback plan:**
    - Create `docker-compose.pre-sp2.yml` snapshot (WordPress + MySQL + Nginx + Cloudflared only, NO N8N)
    - Tag Docker images: `maf-api:sp2-v1`, `maf-app:sp2-v1`
    - If API fails: revert tunnel config, `docker-compose -f docker-compose.pre-sp2.yml up -d`
    - If DB migration fails: `prisma migrate resolve` or manual down-migration, then `psql maf < backup-pre-sp2.sql`
    - **Test rollback on staging before production deploy**
<!-- Updated: Red Team Session 2 - Rollback no longer references N8N, added Prisma migration rollback -->
14. Smoke test production: full login → Strava → dashboard flow (mobile + desktop)
15. Monitor: Check structured logs, health checks, error rates
<!-- Updated: Validation Session 1 - staging env, incremental deploy, rollback plan -->

## Todo List
- [ ] API contract verified between frontend and backend
- [ ] Auth flow E2E working in dev (WP OAuth PKCE → JWT → dashboard)
- [ ] Strava flow E2E working in dev (connect → job pipeline → activities)
- [ ] Dashboard rendering real data (mobile glass-card + desktop grid)
- [ ] Mobile responsive verified (dark theme, bottom tabs)
- [ ] Desktop responsive verified (top nav, 12-col grid)
- [ ] Performance benchmarks met (API < 200ms, pipeline < 30s)
- [ ] Prisma direct pool (5 connections) stable under simulated load
- [ ] Structured JSON logs queryable via `docker logs`
- [ ] Production Docker build passing (api + infra, in-process workers)
- [ ] Rollback tested on staging
- [ ] Production deploy successful
- [ ] Smoke test on production passing (mobile + desktop)

## Success Criteria
- All user flows work end-to-end without errors
- Production deploy: app.maf.run + api.maf.run (in-process workers)
- Existing calculator still works for anonymous users (light theme)
- Dashboard matches HTML mockup designs (mobile + desktop)
- Job pipeline processes webhooks in < 30s
- API p95 latency < 200ms with caching
- Docker `mem_limit` enforced, no OOM events
- Structured logs show no errors
<!-- Updated: Red Team Session 2 - Removed PgBouncer/Sentinel/Grafana, Tier 1 criteria -->
