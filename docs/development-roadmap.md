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

### Phase 8: User Authentication (Planned Q2 2026)
**Goal:** Persist user profiles across sessions

**Features:**
- Email/password registration
- OAuth (Google, Apple)
- Profile dashboard
- Settings management

**Effort:** 2-3 weeks

### Phase 9: Training History (Planned Q2 2026)
**Goal:** Track completed workouts and progression

**Features:**
- Log completed runs (date, duration, pace, HR)
- Historical pace trends
- Workout completion calendar
- Personal records (PRs)

**Effort:** 2 weeks

### Phase 10: Progress Visualization (Planned Q3 2026)
**Goal:** Charts and analytics for progress tracking

**Features:**
- Line charts: pace improvement over time
- Pie charts: volume distribution by workout type
- Heart rate zones histogram
- Progress badges/milestones

**Library:** Chart.js or Recharts

**Effort:** 2 weeks

### Phase 11: Mobile App (Planned Q3 2026)
**Goal:** Native iOS/Android app with offline tracking

**Tech:** React Native or Flutter

**Features:**
- Live heart rate integration (smartwatch/strap)
- Workout timer with audio cues
- GPS tracking and mapping
- Push notifications for scheduled runs

**Effort:** 6-8 weeks

### Phase 12: Fitness Device Integration (Planned Q4 2026)
**Goal:** Sync with Garmin, Apple Watch, Fitbit

**Features:**
- Import workouts from device
- Auto-calculate metrics from device data
- Sync schedules to device calendar
- Real-time HR zone alerts

**Platforms:** Garmin Connect API, Apple HealthKit, Fitbit API

**Effort:** 3-4 weeks

### Phase 13: Multi-language Support (Planned Q4 2026)
**Goal:** Support 3+ languages (EN, VI, FR)

**Libraries:** i18next or react-intl

**Effort:** 1-2 weeks

### Phase 14: Social Features (Planned 2027)
**Goal:** Community engagement

**Features:**
- Share progress publicly
- Follow other runners
- Leaderboards by age/location
- Challenge friends (group challenges)

**Effort:** 4-6 weeks

### Phase 15: Advanced Analytics (Planned 2027)
**Goal:** AI-powered insights

**Features:**
- Personalized training recommendations
- Injury risk prediction (ML model)
- Optimal recovery detection
- Pace progression forecasting

**Tech:** TensorFlow.js or cloud ML API

**Effort:** 6-8 weeks

---

## Known Limitations

| Limitation | Workaround | Priority |
|---|---|---|
| No user accounts (data reset on browser clear) | Use localStorage wisely | High |
| No offline cache beyond localStorage | SPA works offline after load | Medium |
| Lab mode requires manual HR input | Integration with wearables (Phase 12) | High |
| No cross-device sync | Cloud backup planned (Phase 8) | Medium |
| Vietnamese UI only in some components | Multi-language (Phase 13) | Low |

---

## Dependencies to Monitor

| Dependency | Current | Latest | Risk |
|---|---|---|---|
| React | 19.2.0 | 19.2.x | Low (stable) |
| Vite | 6.2.0 | 6.x | Low (minor updates) |
| TypeScript | 5.8.2 | 5.9.x | Low (compatible) |
| Tailwind | 3.4.15 | 4.x | Medium (major breaking change in 4.x) |
| Vitest | 3.0.0 | 3.x | Low (stable) |

---

## Timeline Estimate

| Phase | Dates | Effort | Status |
|---|---|---|---|
| 1-7 (Current) | Nov 2025 - Mar 2026 | 20 weeks | ✅ Done |
| 8 (Auth) | Apr - May 2026 | 2-3w | 📅 Planned |
| 9 (History) | Jun 2026 | 2w | 📅 Planned |
| 10 (Charts) | Jul - Aug 2026 | 2w | 📅 Planned |
| 11 (Mobile) | Sep - Oct 2026 | 6-8w | 📅 Planned |
| 12 (Devices) | Nov 2026 | 3-4w | 📅 Planned |
| 13 (i18n) | Dec 2026 | 1-2w | 📅 Planned |
| 14+ (Social/AI) | 2027 | TBD | 🔮 Long-term |

---

## Success Metrics

### Current (v1.0)
- ✅ Users complete MAF calculation successfully
- ✅ 95+ Lighthouse score
- ✅ <500ms first paint
- ✅ 99.9% uptime (Cloudflare monitored)

### Phase 8-9 (v1.1-1.2)
- [ ] 10K+ registered users
- [ ] 70%+ user retention (30 days)
- [ ] <2% app error rate
- [ ] Average session duration: 5+ minutes

### Phase 10+ (v2.0)
- [ ] 100K+ registered users
- [ ] Featured in fitness app stores
- [ ] Integration with 3+ wearable platforms
- [ ] Mobile app download: 50K+

---

## Technology Debt

| Issue | Priority | Effort |
|---|---|---|
| Refactor ResultDisplay component (too many props) | Medium | 1w |
| Add E2E tests (Cypress/Playwright) | Medium | 1w |
| Migrate to Vite 7 when released | Low | 2d |
| Upgrade TypeScript to 5.9 when stable | Low | 2d |
| Move styling to CSS Modules (optional) | Low | 2w |

---

## Community & Feedback

**Issue Tracking:** GitHub Issues (to be enabled)

**Feature Requests:**
- GitHub Discussions (planned Q2 2026)
- User survey (Q2 2026)

**Contribution Guidelines:**
- Fork → Feature branch → Pull Request
- Follow `CONTRIBUTING.md` (to be created)

---

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
