# MAF Running Coach — Sprint Roadmap (SP2–SP7)

**Date:** 2026-03-31 | **Status:** Brainstorm | **Team:** 2 devs, 2-4 week sprints

---

## Context

- **Current:** v1.0 React 19 SPA, offline-first, no user accounts (localStorage only)
- **Live:** app.maf.run | **WP site:** maf.run
- **Infra:** Docker + Nginx + Cloudflare Tunnel, self-hosted
- **DB:** PostgreSQL 15 (exists for N8N)
- **Goal:** Evolve from calculator tool → full MAF training platform with users, Strava, nutrition, challenges, mobile, coaching

---

## Backend Recommendation

### NestJS + PostgreSQL + Redis (Self-hosted Docker)

**Why NestJS over alternatives:**

| Option | Verdict |
|--------|---------|
| Express.js | Too unstructured for a growing platform with many modules |
| N8N extension | Not designed for user-facing APIs at scale |
| Supabase | Great but self-hosted Supabase adds operational complexity |
| **NestJS** | **TypeScript-native, modular, scales well, built-in guards/pipes/interceptors, great for 2-dev team growing a big system** |

**Stack:**
- **NestJS** — modular API framework (auth module, strava module, nutrition module, etc.)
- **PostgreSQL 15** — already have it, proven at scale
- **Redis** — session cache, rate limiting, realtime pub/sub for challenges
- **TypeORM or Prisma** — ORM for type-safe DB access
- **Docker** — add `api` service alongside existing containers

**Architecture:**
```
User → Cloudflare CDN
         ↓
    Cloudflare Tunnel
         ↓
    ├─ app.maf.run  → Nginx + React SPA (Capacitor for mobile)
    ├─ api.maf.run  → NestJS API → PostgreSQL + Redis
    └─ maf.run      → WordPress (SSO provider)
```

### Mobile Recommendation: Capacitor (Ionic)

**Why:** Wrap existing React web app in native shell. Fastest path to app stores with 2 devs. Share 95% codebase between web and mobile. Add native plugins (push notifications, biometrics) as needed.

---

## SP2: User Registration + Strava + MAF Analysis (6-8 weeks)

### Goal
Users register via WordPress SSO, connect Strava, and get automated MAF-based training analysis from their real running data.

### 2.1 Backend Foundation
- Set up NestJS project with modular architecture
- Configure PostgreSQL schema (users, sessions, strava_tokens, activities)
- Set up Redis for session management
- Docker service: `maf-api` alongside existing containers
- API gateway at api.maf.run via Cloudflare Tunnel
- Health checks, logging, error handling middleware

### 2.2 WordPress SSO Integration
- **Protocol:** OAuth2 / OpenID Connect via WP plugin (e.g., WP OAuth Server or miniOrange)
- **Flow:** User clicks "Login" on app.maf.run → redirects to maf.run/oauth/authorize → callback to app with token → NestJS validates token, creates/finds user
- **Data from WP:** user ID, email, display name, avatar
- **Session:** JWT tokens (access + refresh), stored in httpOnly cookies
- **DB tables:** `users` (id, wp_user_id, email, name, avatar, created_at)

### 2.3 Strava Integration
- **OAuth2 flow:** User connects Strava → authorize → callback with token
- **Strava API scopes:** `read,activity:read_all` (activities + HR data)
- **Webhook:** Register Strava webhook to receive new activity notifications
- **Data to pull:**
  - Activities: type, distance, duration, average_hr, max_hr, average_pace, splits
  - Streams: heart rate time-series, pace time-series (for detailed analysis)
- **Storage:** `strava_connections` (user_id, access_token, refresh_token, expires_at), `activities` table
- **Sync:** Initial bulk sync (last 3 months), then webhook-driven incremental sync
- **Rate limits:** Strava allows 100 req/15min, 1000/day — queue bulk syncs

### 2.4 MAF Analysis Engine
- Move MAF calculation logic to backend (keep frontend version for offline)
- **Auto-analysis per activity:**
  - Was the run in MAF zone? (% time in zone)
  - Cardiac drift detection (HR increase over time at same pace)
  - Pace vs HR efficiency ratio
  - MAF test detection (consistent pace runs)
- **Dashboard data:**
  - MAF pace trend over weeks/months (the key MAF metric)
  - Weekly volume vs target
  - Zone compliance percentage
  - Progress/regression alerts (auto-detected from Strava data)
- **API endpoints:**
  - `GET /api/activities` — paginated activity list with MAF analysis
  - `GET /api/dashboard` — aggregated stats, trends, alerts
  - `GET /api/maf-tests` — detected MAF test results over time
  - `POST /api/calculate` — server-side MAF calculation

### 2.5 Frontend Updates
- Login/logout UI with WP SSO button
- Strava connect/disconnect flow
- Activity list page with MAF zone indicators
- Dashboard with MAF pace trend chart (use Recharts or Chart.js)
- Migrate from localStorage-only → API-backed with offline fallback

### Deliverables
- [ ] NestJS API running in Docker
- [ ] WP SSO login/logout working
- [ ] Strava OAuth + webhook sync
- [ ] Activity list with MAF analysis
- [ ] Dashboard with MAF pace trend chart
- [ ] User profile page

---

## SP3: Nutrition & Supplementation (4-6 weeks)

### Goal
Provide MAF-aligned nutrition guidance (content) AND daily food/supplement tracking to support aerobic training.

### 3.1 Content System (MAF Nutrition Knowledge Base)
- **Source:** Dr. Maffetone's nutrition principles (Two-Week Test, low-carb aerobic diet, fat adaptation)
- **Content types:**
  - Meal plan templates (breakfast, lunch, dinner, snacks) by commitment level
  - Supplement guides (magnesium, fish oil, vitamin D — MAF-recommended)
  - Two-Week Test protocol (elimination diet guide)
  - Food categories: "MAF-approved" vs "avoid" lists
- **DB:** `nutrition_content` (id, type, title, body, tags, commitment_level)
- **API:** `GET /api/nutrition/guides`, `GET /api/nutrition/meal-plans`
- **Admin:** Simple CMS or markdown files served via API (keep it lean)

### 3.2 Daily Tracking
- **Food log:** Meal type (breakfast/lunch/dinner/snack), food items, notes
- **Supplement log:** What supplement, dosage, time taken
- **Hydration:** Daily water intake tracking
- **DB:** `food_logs` (user_id, date, meal_type, items JSON, notes), `supplement_logs`
- **Two-Week Test tracker:** Day-by-day progress, symptom checklist, reintroduction log
- **API:** `POST /api/nutrition/log`, `GET /api/nutrition/history`

### 3.3 MAF-Training Correlation
- **Insight engine:** Correlate nutrition patterns with Strava performance
  - "Your MAF pace improved 5s/km this week — you logged consistent low-carb meals"
  - "Missed supplements 3 days this week — consider consistency"
- **Weekly nutrition score** based on MAF compliance
- Show nutrition data alongside training dashboard

### 3.4 Frontend
- Nutrition tab in app navigation
- Meal plan browser with search/filter
- Quick food log entry (favorites, recent items)
- Supplement reminder notifications (optional)
- Two-Week Test guided wizard
- Weekly nutrition summary card on dashboard

### Deliverables
- [ ] Nutrition content API + seed data
- [ ] Daily food/supplement logging
- [ ] Two-Week Test tracker
- [ ] Nutrition-training correlation insights
- [ ] Nutrition tab UI

---

## SP4: Community Challenges (4-6 weeks)

### Goal
Distance/time challenges AND MAF improvement challenges for the MAF community. Province-based groups with leaderboards.

### 4.1 Challenge System
- **Challenge types:**
  - **Distance challenge:** "Run 100km this month at MAF HR" — tracked via Strava
  - **Time challenge:** "30 consecutive days of MAF running"
  - **MAF improvement:** "Improve MAF pace by 10s/km in 8 weeks"
- **Properties:** title, description, type, start_date, end_date, target_value, rules
- **DB:** `challenges` (id, type, title, target, start/end dates, created_by), `challenge_participants` (user_id, challenge_id, progress, joined_at)
- **Auto-tracking:** Sync Strava activities → update challenge progress automatically
- **Validation:** Only count activities within MAF HR zone (prevent gaming)

### 4.2 Leaderboards
- **Global leaderboard** per challenge
- **Province/city groups:** Users select their province during registration
- **Group leaderboard:** Rank within your province group
- **Metrics:** Total distance, total time in zone, MAF pace improvement %
- **Real-time updates:** Redis pub/sub for live leaderboard changes

### 4.3 Community Groups
- **Province-based groups:** Auto-created for Vietnam's 63 provinces
- **Group features:** Member list, group stats, group challenges
- **Group feed:** Recent activities from group members (light social feed)
- **DB:** `groups` (id, name, province_code, type), `group_members` (user_id, group_id, role)

### 4.4 Frontend
- Challenges tab: Browse active/upcoming/past challenges
- Join challenge flow
- Challenge detail: Progress bar, leaderboard, your stats
- Group page: Members, group leaderboard, group challenges
- Profile: Badges/achievements from completed challenges

### Deliverables
- [ ] Challenge CRUD + auto-tracking from Strava
- [ ] Leaderboard system (global + province)
- [ ] Province-based community groups
- [ ] Challenge UI + leaderboards
- [ ] Achievement badges

---

## SP5: Mobile Release (6-8 weeks)

### Goal
Ship MAF app to iOS App Store and Google Play Store while maintaining single React codebase.

### 5.1 Capacitor Setup
- **Why Capacitor:** Wrap existing React app, share 95% code, native APIs where needed
- Install `@capacitor/core`, `@capacitor/cli`
- Configure `capacitor.config.ts` for iOS + Android
- Platform-specific: `npx cap add ios && npx cap add android`

### 5.2 Native Plugins
- **Push notifications:** `@capacitor/push-notifications` — training reminders, challenge updates
- **Health/fitness:** `@capacitor-community/health` — read HR from Apple Health / Google Fit
- **Biometric auth:** `@capacitor/biometrics` — fingerprint/face login
- **Camera:** `@capacitor/camera` — food photo for nutrition log
- **Local notifications:** Training schedule reminders
- **Deep links:** `@capacitor/app` — handle maf.run links

### 5.3 Mobile UX Adaptations
- Bottom tab navigation (mobile pattern)
- Touch-optimized inputs (larger targets, swipe gestures)
- Offline sync queue: Log activities/nutrition offline → sync when online
- Splash screen + app icon design
- Status bar + safe area handling

### 5.4 App Store Preparation
- **Apple:** Developer account ($99/year), App Store Connect, review guidelines compliance
- **Google:** Developer account ($25 one-time), Play Console
- **Assets:** App icons (1024x1024), screenshots (6.5" + 5.5" iPhone, Pixel), description, privacy policy
- **TestFlight / Internal testing** before public release

### 5.5 CI/CD for Mobile
- GitHub Actions: Build iOS (macOS runner) + Android (Linux runner)
- Auto-build on tag push
- Distribute via TestFlight + Play Internal Track

### Deliverables
- [ ] Capacitor project configured
- [ ] Native plugins integrated (push, health, biometrics)
- [ ] Mobile-optimized UI
- [ ] iOS TestFlight release
- [ ] Android Play Store release
- [ ] CI/CD pipeline for mobile builds

---

## SP6: Trainer-Trainee Mentoring (4-6 weeks)

### Goal
Community mentoring system where experienced MAF runners guide newer runners. Free, no payments.

### 6.1 Trainer Profiles
- **Eligibility:** Users with 6+ months MAF data, proven MAF pace improvement
- **Profile:** Bio, experience level, MAF journey summary, availability
- **Verification:** System auto-verifies from Strava/activity history
- **DB:** `trainer_profiles` (user_id, bio, specialties, max_trainees, is_verified)

### 6.2 Matching System
- **Trainee request:** Browse trainers, send mentoring request
- **Matching criteria:** Same province (optional), commitment level, experience gap
- **Capacity:** Each trainer sets max trainees (default: 5)
- **DB:** `mentoring_relationships` (trainer_id, trainee_id, status, started_at)

### 6.3 Shared Dashboard
- **Trainer view:** See all trainees' MAF data, activity feed, nutrition compliance
- **Trainee view:** See trainer's feedback, recommended adjustments
- **Communication:** In-app messaging (simple chat, not full messaging platform)
- **Feedback:** Trainer can annotate trainee's activities with MAF tips
- **DB:** `messages` (from_user, to_user, content, created_at), `activity_feedback` (activity_id, trainer_id, comment)

### 6.4 Performance Tracking Together
- Side-by-side MAF pace trends (trainer vs trainee for motivation)
- Weekly check-in prompts (trainee reports: feeling, challenges, wins)
- Trainer dashboard: All trainees at a glance with alert flags

### Deliverables
- [ ] Trainer profile + verification system
- [ ] Browse trainers + request mentoring
- [ ] Shared dashboard (trainer sees trainee data)
- [ ] In-app messaging
- [ ] Activity feedback/annotations
- [ ] Weekly check-in system

---

## SP7: AI Coaching for Elite & Racing (6-8 weeks)

### Goal
AI-generated training plans reviewed by human coaches for elite athletes preparing for races.

### 7.1 AI Training Plan Generator
- **Input:** User's MAF data, Strava history, race goal (distance, target time, date)
- **AI engine:** Use Claude/GPT API to generate periodized training plans
- **Plan structure:**
  - Base building phase (MAF-only)
  - Speed introduction phase (anaerobic intervals, MAF method)
  - Race-specific phase (tempo, long runs, race pace)
  - Taper phase
- **Output:** Week-by-week schedule with session details, HR targets, pace targets
- **DB:** `training_plans` (user_id, race_goal, plan_data JSON, status, coach_id)

### 7.2 Human Coach Review
- **Coach role:** Verified trainers with coaching certification badge
- **Workflow:** AI generates plan → coach reviews/adjusts → trainee receives final plan
- **Coach tools:** Edit any session, add notes, adjust progression
- **Plan versioning:** Track changes between AI draft and coach-reviewed version

### 7.3 Race Preparation Features
- **Race calendar:** Set target races with countdown
- **Readiness score:** Based on MAF trend, volume consistency, nutrition compliance
- **Race prediction:** Estimate finish time based on current MAF pace + distance
- **Post-race analysis:** Compare predicted vs actual, update MAF profile
- **Tapering automation:** Auto-adjust plan in final 2-3 weeks before race

### 7.4 Elite Performance Metrics
- **Aerobic efficiency:** Pace at MAF HR over time (the gold standard)
- **Cardiac drift rate:** How much HR rises during steady-pace runs
- **Recovery quality:** HRV trends (if available from Strava/health apps)
- **Training load:** Weekly TSS-equivalent based on HR zones
- **Fatigue index:** Warning system for overtraining risk

### Deliverables
- [ ] AI plan generator (Claude/GPT integration)
- [ ] Coach review workflow
- [ ] Race calendar + countdown
- [ ] Readiness score + race prediction
- [ ] Post-race analysis
- [ ] Elite performance metrics dashboard

---

## Sprint Timeline (Recommended)

```
2026 Q2:  SP2 (Apr-May)     ████████████████░░░░░░░░░░░░░░░░
          SP3 (Jun-Jul)     ░░░░░░░░░░░░░░░░████████████████

2026 Q3:  SP4 (Aug-Sep)     ████████████████░░░░░░░░░░░░░░░░
          SP5 (Sep-Nov)     ░░░░░░░░░░░░████████████████████

2026 Q4:  SP6 (Nov-Dec)     ████████████████░░░░░░░░░░░░░░░░

2027 Q1:  SP7 (Jan-Mar)     ████████████████████████████████
```

**Note:** Timeline assumes 2 devs, 2-4 week sprints, flexible schedule. SP2 is the foundation — all others depend on it.

---

## Dependency Graph

```
SP1 (Done) ──→ SP2 (Backend + Auth + Strava) ──→ SP3 (Nutrition)
                     │                                │
                     ├──→ SP4 (Challenges) ───────────┤
                     │                                │
                     ├──→ SP5 (Mobile) ←──────────────┘
                     │         │
                     └──→ SP6 (Mentoring) ──→ SP7 (AI Coaching)
```

**SP2 is critical path.** Everything depends on user accounts + Strava data.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Strava API rate limits | High | Queue system, cache aggressively, webhook-driven sync |
| WP SSO complexity | Medium | Use proven OAuth plugin, fallback to email/password if WP integration delayed |
| 2-dev capacity for SP5 mobile | High | Capacitor reduces effort; consider SP5 after SP4 not before |
| AI coaching cost (API calls) | Medium | Cache plans, limit regeneration, use cheaper models for drafts |
| Self-hosted scaling | Medium | PostgreSQL handles 10K+ users fine; add read replicas if needed later |
| App Store review rejection | Medium | Follow guidelines strictly, prepare privacy policy early |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind |
| Mobile | Capacitor (wrap React app) |
| Backend API | NestJS + TypeScript |
| Database | PostgreSQL 15 |
| Cache/Realtime | Redis |
| ORM | Prisma (type-safe, great DX) |
| Auth | WordPress OAuth2 SSO → JWT |
| External APIs | Strava API, Claude/GPT API (SP7) |
| Infra | Docker Compose, Nginx, Cloudflare Tunnel |
| CI/CD | GitHub Actions |

---

**Next:** Create detailed implementation plan per sprint? Start with SP2?
