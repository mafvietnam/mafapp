# MAF Running Coach — Project Overview & PDR

## Product Overview

**MAF Running Coach** is an offline-first React SPA that calculates personalized MAF (Maximum Aerobic Function) heart rate zones and generates adaptive training plans based on Dr. Phil Maffetone's aerobic training method. All calculations happen client-side—no backend required for core functionality.

### What It Does
- Calculate MAF heart rate: `180 - age` with adjustments for recovery, injury, experience, and probation status
- Generate personalized weekly schedules for three commitment levels (HEALTH, BASE, PERFORMANCE)
- Auto-adjust activities based on BMI (switch to walking if BMI ≥ 30)
- Compare current vs. previous month pace to detect progress/regression
- Smart long-run calculations based on heart rate history and recovery feedback
- Probation mode: 70% volume reduction for injury recovery (auto-unlocks after 14 days)
- MAF Lab: Interactive verification test to determine actual MAF pace

### Live App
**Frontend:** https://app.maf.run (React SPA, full offline capability)
**Backend (optional):** https://api.maf.run (N8N automation, not required)

---

## Technology Stack

| Component | Tech | Version |
|-----------|------|---------|
| Framework | React + TypeScript | 19.2.0 |
| Build | Vite | 6.2.0 |
| Styling | Tailwind CSS | 3.4.15 |
| Icons | Lucide React | 0.554.0 |
| Testing | Vitest | 3.0.0 |
| Linting | ESLint 9 + typescript-eslint | 9.39.4 |
| **Container** | Docker (multi-stage) | Node 20 Alpine → Nginx |
| **Server** | Nginx 1.25 Alpine | SPA + health checks |
| **Tunnel** | Cloudflare Tunnel | Token-based, no exposed ports |
| **Optional Backend** | N8N + PostgreSQL 15 | Workflow automation |

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

## Repository

**GitHub:** https://github.com/mafvietnam/mafapp
**License:** MIT

---

**Version:** 1.0.0 | **Last Updated:** March 30, 2026
