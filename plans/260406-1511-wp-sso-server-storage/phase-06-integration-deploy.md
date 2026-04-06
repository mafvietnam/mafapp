# Phase 6: Integration & Deploy

## Context
- [Phase 1-5](./plan.md) — all previous phases
- [Production Deploy Guide](../../PRODUCTION_DEPLOY.md)
- [docker-compose.yml](../../docker-compose.yml) — current production compose

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 2 days
- **Blocked by:** Phase 5

Connect frontend to real backend. Fix API contract mismatches. Test all auth flows end-to-end. Deploy to production via Docker compose + Cloudflare tunnel.

## Requirements

### Functional
- All auth flows working end-to-end (login, logout, refresh, profile CRUD)
- Dashboard renders with real user data
- Calculator works for anonymous users (no regression)
- API contract matches between frontend services/* and backend endpoints

### Non-Functional
- API p95 latency <200ms
- Docker health checks passing for all services
- Rollback plan documented and tested

## Implementation Steps

### Day 1: Integration Testing

1. **API Contract Verification:**
   - Compare `src/services/*.ts` request shapes with backend controller DTOs
   - Fix any request/response mismatches
   - Verify cookie domain/path works between app.maf.run and api.maf.run

2. **E2E Flow Testing:**
   - Anonymous: Calculator works at `/` (light theme, no regression)
   - Login: Click login → WP OAuth PKCE → callback → JWT cookie → redirect to /dashboard
   - Dashboard: Renders with user data (MAF zone, profile info)
   - Profile: View → Edit → Save → Reload → Data persisted
   - Logout: Cookie cleared → redirect to home → /dashboard redirects to /login
   - Token refresh: Wait 15min (or manually expire) → auto-refresh works

3. **Edge Cases:**
   - Expired JWT → auto-refresh → seamless experience
   - WordPress down → existing sessions work (7-day refresh token)
   - No profile yet → GET /users/me/profile returns 404 → frontend shows empty form
   - Invalid profile data → validation errors shown
   - Network error → error boundary catches

4. **Responsive Testing:**
   - Mobile: glass-card dashboard, bottom tabs, banner bg
   - Tablet: mixed layout
   - Desktop: top nav, 12-col grid, sidebar widgets
   - Dark theme contrast verification

### Day 2: Production Deploy

5. **Pre-deploy Backup:**
   - `pg_dump` existing PostgreSQL data
   - Tag current Docker images: `maf-app:pre-sso`

6. **Build Production Images:**
   ```bash
   docker-compose build maf-app maf-api
   ```

7. **Incremental Deploy:**
   - Step 1: Deploy Redis container (no impact on existing services)
   - Step 2: Deploy maf-api container (health check at /health)
   - Step 3: Run Prisma migration: `npx prisma migrate deploy`
   - Step 4: Update Cloudflare tunnel config (api.maf.run → NestJS port 3001)
   - Step 5: Deploy updated maf-app (frontend with auth)
   - Step 6: Remove N8N container + volume (after verifying api works)

8. **Rollback Plan:**
   - If API fails: revert tunnel config, restart pre-SSO frontend image
   - If DB migration fails: `psql maf < backup.sql`
   - Keep `docker-compose.pre-sso.yml` snapshot for quick rollback

9. **Smoke Test Production:**
   - Visit app.maf.run → calculator works
   - Click login → WordPress OAuth flow completes
   - Dashboard renders with user data
   - Profile saves and persists
   - Logout works
   - Mobile + desktop layouts correct

10. **Post-deploy Monitoring:**
    - Check Docker logs: `docker logs maf-api --tail 100`
    - Verify health: `curl https://api.maf.run/health`
    - Monitor Redis memory usage
    - Check PostgreSQL connection count

## Todo List
- [x] API contract verified (frontend ↔ backend)
- [x] Auth flow E2E working (login → dashboard → profile → logout)
- [x] Calculator unchanged for anonymous users
- [x] Mobile responsive verified (dark theme)
- [x] Desktop responsive verified (top nav, grid)
- [x] PostgreSQL backed up
- [x] Docker images built for production
- [x] Prisma migration deployed
- [x] Cloudflare tunnel updated (api.maf.run → NestJS)
- [x] N8N removed from production stack
- [x] Smoke test on production passing
- [x] Rollback plan documented

## Success Criteria
- `app.maf.run/` → calculator works (anonymous, light theme)
- `app.maf.run/login` → WordPress SSO → `/dashboard` with user data (dark theme)
- `api.maf.run/health` → `{ db: "up", redis: "up" }`
- All Docker containers healthy
- No 5xx errors in API logs
- Profile data persists across sessions

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Cookie not working in production | Verify domain=.maf.run, secure=true, sameSite=lax |
| Cloudflare tunnel routing conflict | Test tunnel config change on staging first |
| Data loss during N8N removal | Backup PostgreSQL before any changes |
| DNS propagation delay | Tunnel updates are instant (no DNS change) |

## Security Considerations
- Production secrets in .env (never in Docker image)
- Verify CORS only allows app.maf.run
- Verify httpOnly cookie flags in production
- Check CSP headers don't block API calls
- Ensure no debug endpoints exposed

## Next Steps
- Separate developer: Strava integration (fills dashboard empty states)
- Future sprints: SP3 nutrition, SP4 challenges, etc.
