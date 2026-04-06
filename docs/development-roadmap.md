# Development Roadmap

## Current Version: 1.1.0 (WordPress SSO + Backend API)

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
- NestJS 10 API with PostgreSQL + Redis (commit: TBD)
- WordPress OAuth2 PKCE authentication (secure for SPAs)
- JWT RS256 token-based auth with HTTP-only cookies
- User profiles server-side (replaces localStorage)
- Dashboard page (authenticated, dark theme)
- Login page with WP SSO button
- Profile management page
- Docker services: maf-api, postgres, redis

### Phase 10: Sprint Planning ✅ DRAFTED
- SP2-SP7 sprint roadmap created (commit: 86be72c)
- Research reports generated (commit: 5d069b0)
- Parallel execution strategy defined
- Review reports: plan failure analysis, scope complexity critique

---

## Future Roadmap (Planned)

| Phase | Goal | Effort | ETA |
|-------|------|--------|-----|
| 10 | Training history logging & persistence | 2w | Q2 2026 |
| 11 | Progress charts & visualization | 2w | Q3 2026 |
| 12 | Mobile app (React Native/Flutter) | 6-8w | Q3 2026 |
| 13 | Fitness device integration (Garmin, Apple Watch) | 3-4w | Q4 2026 |
| 14 | Multi-language support (EN, VI, FR) | 1-2w | Q4 2026 |
| 15+ | Social features, AI insights | TBD | 2027+ |

---

## Known Limitations

- Manual heart rate input in Lab (future: wearable integration)
- Vietnamese UI (future: multi-language support)
- N8N automation server commented out (Phase 10 task)

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

**Last Updated:** April 6, 2026 | **Version:** 1.1.0
