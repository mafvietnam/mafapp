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

### Day 3-4: E2E Testing
5. Test flows manually:
   - Anonymous: Calculator works without login
   - Login: WP SSO → redirect → authenticated state
   - Profile: View/edit MAF profile → saved to DB
   - Strava: Connect → bulk sync → activities list populated
   - Dashboard: Trends chart shows real data
   - Activity detail: MAF analysis displayed correctly
   - Logout: State cleared, redirect to home
6. Edge cases:
   - Expired JWT → auto-refresh works
   - Strava token expired → re-auth prompt
   - No activities yet → empty state UI
   - Network error → error boundary catches
7. Mobile responsive check on real devices

### Day 5: Deploy + Monitor
8. Build production Docker images (api + frontend)
9. Update docker-compose.yml with all services
10. Deploy: `docker-compose up -d`
11. Verify api.maf.run + app.maf.run via Cloudflare Tunnel
12. Smoke test production: full login → Strava → dashboard flow
13. Monitor: Check logs, health checks, error rates

## Todo List
- [ ] API contract verified between frontend and backend
- [ ] Auth flow E2E working in dev
- [ ] Strava flow E2E working in dev
- [ ] Dashboard rendering real data
- [ ] Mobile responsive verified
- [ ] Production Docker build passing
- [ ] Production deploy successful
- [ ] Smoke test on production passing

## Success Criteria
- All user flows work end-to-end without errors
- Production deploy at app.maf.run + api.maf.run
- Existing calculator still works for anonymous users
- No console errors in production
