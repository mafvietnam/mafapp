# Development Roadmap

## Current Version: 1.0.0 (Released)

**Status:** Production Ready | **Live:** https://app.maf.run

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
- ESLint 9 configuration + rules
- Vitest unit tests for utilities
- Split mafLogic.ts into barrel module (7 submodules)
- Achieved 70%+ coverage on utils

### Phase 7: Documentation ✅ COMPLETED
- Project overview & PDR
- Code standards & conventions
- Codebase summary with file descriptions
- System architecture & data flow
- Design guidelines (colors, typography, components)
- Deployment guide (Docker, Nginx, Cloudflare)
- Development roadmap (this file)
- Project changelog

---

## Future Roadmap (Planned)

| Phase | Goal | Effort | ETA |
|-------|------|--------|-----|
| 8 | User authentication (email/OAuth) | 2-3w | Q2 2026 |
| 9 | Training history logging & persistence | 2w | Q2 2026 |
| 10 | Progress charts & visualization | 2w | Q3 2026 |
| 11 | Mobile app (React Native/Flutter) | 6-8w | Q3 2026 |
| 12 | Fitness device integration (Garmin, Apple Watch) | 3-4w | Q4 2026 |
| 13 | Multi-language support (EN, VI, FR) | 1-2w | Q4 2026 |
| 14+ | Social features, AI insights | TBD | 2027+ |

---

## Known Limitations

- No user accounts (localStorage only → data reset on browser clear)
- Manual heart rate input in Lab (future: wearable integration)
- Vietnamese UI (future: multi-language support)

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

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
