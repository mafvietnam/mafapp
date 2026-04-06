# MAF Running Coach — Project Overview & PDR

## Product Overview

**MAF Running Coach** is an offline-first React SPA implementing Dr. Phil Maffetone's aerobic training method. All calculations happen client-side—no backend required for core features. Users calculate personalized heart rate zones, generate adaptive training schedules, and verify their MAF pace via an interactive lab.

### Core Features
- **MAF Calculator:** Heart rate formula `180 - age` with adjustments (recovery, injury, experience, probation)
- **Smart Scheduling:** 3 commitment levels (HEALTH/BASE/PERFORMANCE) with 7-day weekly plans
- **Safety First:** BMI-based activity swaps, age-based caps, medical clearance gating, children mode (<16)
- **Pace Comparison:** Progress/regression detection vs. previous month (±10s threshold)
- **Smart Long-Run:** History-based adjustments (HR feedback, feeling, age caps)
- **Recovery Gating:** 14-day probation mode with 70% volume cap, auto-unlock
- **MAF Lab:** 3-step verification test for pace/HR validation
- **Responsive:** Mobile-first CSS, full desktop support, Vietnamese UI
- **Guide Page:** In-app user documentation at `/guide` route

### Live Application
- **Frontend:** https://app.maf.run (React SPA, offline-capable)
- **Backend (optional):** https://api.maf.run (N8N workflows, not required for core features)
- **Routes:** `/` (main app) | `/guide` (Vietnamese user guide)

---

## Technology Stack

| Component | Tech | Version |
|-----------|------|---------|
| **Framework** | React | 19.2.0 |
| **Language** | TypeScript | 5.8.2 |
| **Build Tool** | Vite | 6.2.0 |
| **Styling** | Tailwind CSS | 3.4.15 |
| **Icons** | Lucide React | 0.554.0 |
| **Routing** | React Router | 7.13.2 |
| **Testing** | Vitest + v8 coverage | 3.0.0 |
| **Linting** | ESLint 9 + typescript-eslint | 9.39.4, 8.57.2 |
| **Container** | Docker multi-stage | Node 20 Alpine → Nginx |
| **Server** | Nginx 1.25 Alpine | SPA + CSP headers |
| **Tunnel** | Cloudflare Tunnel | Token auth, no exposed ports |
| **Backend (opt)** | N8N + PostgreSQL 15 | Workflow automation |

---

## Quick Start

### Local Development
```bash
git clone https://github.com/mafvietnam/mafapp.git
cd mafapp
npm install
npm run dev                 # http://localhost:5173
```

### Production Docker
```bash
cp .env.example .env       # Edit with secrets
docker-compose up -d
# https://app.maf.run (via Cloudflare Tunnel)
```

---

## Core Features

**1. MAF Formula**
- Base: `180 - age`
- Adjustments: recovery (-10), medication/injury (-5), probation (-10), experience (±5)
- Result: Optimal training heart rate zone (MAF ± 10 bpm)

**2. Three Commitment Levels**
- **HEALTH**: 3-4 hrs/week, weight management focus
- **BASE**: 5-6 hrs/week, aerobic foundation (recommended)
- **PERFORMANCE**: 7-12 hrs/week, race preparation

**3. Safety-First Design**
- Children <16: "play naturally" guide, no structured training
- BMI ≥ 30: Auto-switch from running to walking
- Seniors 60+: Reduced long-run caps, recovery emphasis
- Recovery checkboxes: Medical clearance gating

**4. Smart Volume Management**
- Weekly caps: HEALTH 240min, BASE 360min, PERFORMANCE 720min
- Pace comparison: ±10s threshold triggers 10% increase or 30% safety reduction
- Long-run history: Auto-adjust based on HR, feeling, and age
- Probation auto-unlock: 14-day countdown after injury

---

## Infrastructure

```
User → Cloudflare CDN
         ↓
    Cloudflare Tunnel
         ↓
    ├─ app.maf.run → Nginx + React (SPA)
    └─ api.maf.run → N8N → PostgreSQL (optional)
```

- **Frontend**: React 19, Vite build, Nginx serving
- **Network**: No exposed ports (Cloudflare Tunnel only)
- **Size**: 50-60MB production Docker image
- **Health checks**: Every 30s (Nginx + N8N)
- **Logging**: JSON-file driver, 10MB max per file

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| **Offline** | 100% functional after initial load |
| **Performance** | <500ms first paint, <1s TTI |
| **Browser** | Modern ES2022+ (no IE11 support) |
| **Mobile** | Fully responsive (mobile-first CSS) |
| **Accessibility** | Semantic HTML, WCAG AA contrast |
| **Security** | No secrets in code, CSP headers, Cloudflare TLS |

---

## Implementation Status

| Phase | Status | Commits |
|-------|--------|---------|
| Core MAF formula | ✅ Complete | f72af00, 98fa075 |
| Modular refactor | ✅ Complete | e941fc4 |
| Test suite (162 tests, 98% coverage) | ✅ Complete | 83d57ca |
| Guide page + Vietnamese docs | ✅ Complete | 8b3d077, 27ec3a7 |
| Mobile UX fixes | ✅ Complete | dc13385 |
| SP2-SP7 sprint planning | ✅ Drafted | 86be72c, 5d069b0 |

---

**GitHub:** https://github.com/mafvietnam/mafapp | **License:** MIT

**Version:** 1.0.0 | **Last Updated:** April 6, 2026
