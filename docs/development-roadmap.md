# Development Roadmap

## Current Version: 1.5.0 (Strava Integration — Complete Phase 4)

**Status:** Production Ready | **Frontend:** https://app.maf.run | **API:** https://api.maf.run

---

## Phase Overview

### Phase 1: Project Setup ✅ COMPLETED
- Initialize React 19 + TypeScript + Vite 6
- Configure Tailwind CSS 3
- Setup Docker multi-stage build
- Configure Nginx + Cloudflare Tunnel

### Phase 2: Core MAF Logic ✅ COMPLETED
- Implement base MAF formula (180 - age)
- Health factor adjustments (recovery, medication, injury)
- Experience level scoring system
- Training schedule generation (3 commitment levels)

### Phase 3: Component Architecture ✅ COMPLETED
- Split monolithic App.tsx (1,113 → 119 lines)
- Create reusable UI components (cards, tables, forms)
- Build commitment selector with icon cards
- Implement result display cards

### Phase 4: Advanced Calculations ✅ COMPLETED
- BMI-based safety adjustments (walking for obese)
- Pace comparison logic (progress vs. regression detection)
- Smart long-run calculation (history-based)
- Weekly volume cap enforcement
- Probation mode for injury recovery

### Phase 5: Lab Mode ✅ COMPLETED
- Heart-rate verification lab (3-step process)
- Pace & HR data entry
- Verified pace storage & feedback

### Phase 6: Testing & Quality ✅ COMPLETED
- ESLint 9 configuration + rules (commit: e941fc4)
- Vitest 3.0.0 unit tests for utilities
- Split mafLogic.ts into 7 submodules + barrel export
- 162 unit tests, 98% coverage on src/utils/ (commit: 83d57ca)

### Phase 7: Documentation ✅ COMPLETED
- Project overview & PDR (commit: 5d68f06)
- Code standards & conventions
- Codebase summary (44 source files, ~4000 LOC)
- System architecture & data flow
- Design guidelines (Tailwind 3, colors, typography)
- Deployment guide (Docker, Nginx, Cloudflare Tunnel)
- Development roadmap (this file)
- Project changelog (semantic versioning)

### Phase 8: Guide Page & Mobile UX ✅ COMPLETED
- `/guide` route with Vietnamese user guide (commit: 8b3d077)
- 5 guide sections: Getting Started, Plan, Lab, Results, Special Cases
- Rewrite user guide to match actual app GUI (commit: 27ec3a7)
- Mobile UX fixes: modal scroll lock, checkbox touch targets, favicon (commit: dc13385)

### Phase 9: WordPress SSO + Server-Side Storage ✅ COMPLETED
- NestJS 10 API with PostgreSQL + Redis
- WordPress direct login + JWT RS256 token-based auth with HTTP-only cookies
- User profiles server-side (replaces localStorage)
- Dashboard page (authenticated, dark theme)
- Login page with credentials entry
- Profile management page
- Docker services: maf-api, postgres, redis

### Phase 10: WordPress SSO Integration + Admin Panel ✅ COMPLETED
- WordPress MU-plugin: `/wp-json/maf/v1/auth` and `/wp-json/maf/v1/sso/verify` endpoints
- Two login methods: direct (username+password) and SSO (one-time code)
- SSO callback page: exchanges WP code for JWT cookies
- Account management: `isActive` field for soft-disable
- Admin panel: user list, search, status toggle with self-protection
- RBAC: role enum (USER, COACH, ADMIN) with endpoint guards
- Redis revocation set for instant JWT invalidation on account disable
- Profile sync from WordPress (name, email, avatar) on each login

### Phase 11: Garmin Integration MVP ✅ COMPLETED
- Garmin device connection with encrypted credential storage (AES-256-GCM)
- Background sync every 2 hours via cron job
- Activity data: distance, pace, heart rate, VO2max
- Daily health metrics: steps, resting HR, sleep, stress
- MAF Lab auto-fill: fetch latest running activity HR
- Paginated activity + daily summary queries
- Feature gated by `FEATURE_GARMIN` env var

### Phase 12: Sprint Planning ✅ DRAFTED
- SP2-SP7 sprint roadmap created
- Research reports generated
- Parallel execution strategy defined
- Review reports: plan failure analysis, scope complexity critique

### Phase 13: Strava Integration ✅ COMPLETE
- **Phase 13.1:** Foundation & Prisma Models ✅ COMPLETE
  - StravaConnection + StravaActivity models, AES-256 token encryption, feature flag
- **Phase 13.2:** OAuth2 Connection Flow ⏳ PENDING
  - Connect/disconnect endpoints, token exchange, frontend card
- **Phase 13.3:** Webhook & Sync Engine ✅ COMPLETE
  - Webhook subscription (register on startup), event handler (POST /webhook)
  - Sync service: paginated fetch, Redis locks, dedup check against Garmin
  - Rate-limit handling (X-RateLimit headers, 429 backoff)
  - isDuplicate flag on GarminActivity (Strava wins on conflict)
- **Phase 13.4:** Cron Fallback & MAF Lab ✅ COMPLETE
  - Daily 3am cron fallback (Redis global lock, syncs users not synced in 25h)
  - GET /strava/activities — paginated (page, limit, type, excludeDuplicates)
  - GET /strava/activities/:id — single activity endpoint
  - useStravaAutoFill hook (mirrors Garmin, gated by VITE_FEATURE_STRAVA)
  - MAF Lab Strava auto-fill button (orange banner, wins over Garmin)
- **Phase 13.5:** Admin UI & DB-backed Config ✅ COMPLETE
  - AppSettingsService: unified DB-backed Garmin + Strava OAuth config (30s TTL cache)
  - Admin endpoints: GET/POST /admin/strava/settings, GET /admin/strava/status, POST /admin/strava/sync
  - Redis nonce store + HMAC-SHA256 OAuth state (single-use CSRF prevention)
  - Automatic webhook resubscription on credential save (feedback in UI)
  - Frontend admin page + settings card, gated by ADMIN role
  - Hide Strava connect card when `featureEnabled=false` (reads from `AppSettingsService`)

---

## Future Roadmap (Planned)

| Phase | Goal | Effort | ETA | Status |
|-------|------|--------|-----|--------|
| 14 | Training history logging & persistence | 2w | Q2 2026 | Planned |
| 15 | Progress charts & visualization (Recharts) | 2w | Q3 2026 | Planned |
| 16 | Garmin OAuth2 migration (official API) | 2w | Q3 2026 | Backlog |
| 17 | Mobile app (React Native/Flutter) | 6-8w | Q3 2026 | Backlog |
| 18 | Apple Watch integration | 2-3w | Q4 2026 | Backlog |
| 19 | Multi-language support (EN, VI, FR) | 1-2w | Q4 2026 | Backlog |
| 20+ | Social features, AI insights, coaching | TBD | 2027+ | Visionary |

---

## Known Limitations

- Garmin MVP stores encrypted credentials (Phase 16: migrate to official OAuth2 API)
- Vietnamese UI only (Phase 19: multi-language support planned)
- Strava OAuth2 connection pending (Phase 13.2: defer to Phase 14)
- N8N automation server commented out (deferred)

---

## Current Dependencies

| Package | Version | Stability |
|---------|---------|-----------|
| React | 19.2.0 | ✅ Stable |
| TypeScript | 5.8.2 | ✅ Stable |
| Vite | 6.2.0 | ✅ Stable |
| Tailwind | 3.4.15 | ⚠️ Monitor for v4 |
| Vitest | 3.0.0 | ✅ Stable |

---

## Success Metrics (v1.0)

- ✅ Users complete MAF calculation without errors
- ✅ 95+ Lighthouse score maintained
- ✅ <500ms first paint
- ✅ 99.9% uptime (Cloudflare monitored)

**v1.1+ targets:**
- 10K+ registered users
- 70%+ 30-day retention
- <2% error rate

---

**Last Updated:** April 7, 2026 | **Version:** 1.5.0
