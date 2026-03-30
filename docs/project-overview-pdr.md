# MAF Running Coach — Project Overview & PDR

## Product Overview

**MAF Running Coach** is a client-side React application that helps runners determine their optimal MAF (Maximum Aerobic Function) heart rate zone and generates personalized training schedules based on Dr. Phil Maffetone's aerobic training methodology.

### What It Does
- Calculate MAF heart rate: `180 - age` with adjustments for health, experience, and recovery status
- Generate weekly training schedules (HEALTH, BASE, PERFORMANCE tiers)
- Provide smart long-run suggestions based on historical data
- Adjust volume caps and recovery phases based on progression
- Support probation mode for injury recovery
- Operate completely offline (client-side calculation)

### Live Deployment
**App:** https://app.maf.run (Frontend React SPA)
**Backend (optional):** https://api.maf.run (N8N automation, not required for core functionality)

---

## Technology Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | React + TypeScript | 19.2.0 |
| Build Tool | Vite | 6.2.0 |
| Styling | Tailwind CSS | 3.4.15 |
| Testing | Vitest | 3.0.0 |
| Linting | ESLint 9 | 9.39.4 |
| Icons | Lucide React | 0.554.0 |

### Build & Dev
```bash
npm install              # Install dependencies
npm run dev             # Start local dev server (http://localhost:5173)
npm run build           # Production build → dist/
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix linting issues
npm run test            # Run Vitest suite
npm run test:watch      # Watch mode for tests
```

### Infrastructure
- **Container:** Docker multi-stage build (Node 20 Alpine → Nginx Alpine)
- **Web Server:** Nginx 1.25 (serves SPA + CSP headers)
- **Reverse Proxy:** Cloudflare Tunnel (token-based, no exposed ports)
- **Database:** PostgreSQL 15 (for N8N workflows, not app core)
- **Size:** ~50-60MB production image

---

## Key Features

### 1. MAF Calculator
Computes personalized MAF heart rate from:
- Age (base: 180 - age)
- Recovery status (-10 bpm if recovering)
- Medication/injury (-5 bpm if medicated or injured)
- Experience level (-5 to +5 bpm adjustment)
- Probation mode (-10 bpm extra safety during recovery)

### 2. Training Plans
Three commitment levels:
- **HEALTH** (3-4 hrs/week): Weight management, consistency
- **BASE** (5-6 hrs/week): MAF foundation building (recommended)
- **PERFORMANCE** (7-12 hrs/week): Race preparation

### 3. Smart Adjustments
- **BMI-based:** Auto-switches to walking for BMI ≥ 30
- **Pace comparison:** Detects progress/regression vs. last month
- **Long-run logic:** Increases 10% if progressing, caps based on age/experience
- **Volume cap:** Enforces max weekly minutes per commitment level
- **Probation mode:** 70% volume reduction during injury recovery
- **Senior support:** Special guidance for runners 60+

### 4. Lab Mode
Integrated heart-rate verification lab to test actual MAF pace before planning.

---

## Non-Functional Requirements

| Requirement | Standard |
|---|---|
| **Performance** | First paint <500ms, TTI <1s |
| **Offline** | 100% functional without API |
| **Browser Support** | Modern browsers (ES2022) |
| **Mobile-first** | Fully responsive design |
| **Accessibility** | Semantic HTML, color contrast OK |
| **Security** | No external API keys in code, CSP headers active |

---

## Success Metrics

- Users complete MAF calculation without errors
- Training plan adopted with <5% bounce rate
- 95+ Lighthouse score maintained
- 99.9% uptime (Cloudflare monitored)

---

## Future Roadmap

- [ ] User authentication & profile persistence
- [ ] Training history tracking (database)
- [ ] Progress visualization charts
- [ ] Mobile app (React Native)
- [ ] Integration with fitness trackers
- [ ] Multi-language support
- [ ] Social sharing features

---

**Last Updated:** March 30, 2026 | **Version:** 1.0.0
