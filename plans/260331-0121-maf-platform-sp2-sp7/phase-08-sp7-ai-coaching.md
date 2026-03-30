# Phase 8: SP7 — AI Coaching for Elite & Racing

## Overview
- **Priority:** P3
- **Owner:** Both
- **Status:** Pending
- **Effort:** 6-8 weeks
- **Blocked by:** Phase 7 (SP6 mentoring — reuses trainer/coach infrastructure)

AI-generated training plans reviewed by human coaches. Race preparation for serious runners.

## Parallel Split

### Dev A (Backend)
**File ownership:** `api/src/coaching/`, `api/src/race/`

- **CoachingModule:**
  - AI plan generator: Claude API integration
  - Input: user MAF data, Strava history, race goal (distance, target time, date)
  - Output: periodized plan (base → speed → race-specific → taper)
  - Plan versioning: AI draft → coach review → final version
  - Coach role: extends trainer with coaching certification badge
- **RaceModule:**
  - Race calendar: user sets target races
  - Readiness score: composite of MAF trend + volume consistency + nutrition
  - Race prediction: estimate finish time from current MAF pace
  - Post-race analysis: predicted vs actual performance
- **DB tables:** `training_plans`, `plan_versions`, `races`, `race_results`
- **APIs:**
  - `POST /coaching/generate-plan` — AI generates plan from goals
  - `GET /coaching/plans/:id` — get plan with versions
  - `PATCH /coaching/plans/:id/review` — coach edits plan
  - `POST /coaching/plans/:id/approve` — coach finalizes plan
  - `POST /races` — add target race
  - `GET /races/:id/readiness` — readiness score
  - `GET /races/:id/prediction` — predicted finish time

### Dev B (Frontend)
**File ownership:** `src/pages/coaching-*`, `src/pages/race-*`, `src/components/coaching/`, `src/components/race/`

- **Pages:**
  - `coaching-page.tsx` — manage training plans
  - `plan-detail-page.tsx` — week-by-week plan view with edit (coaches)
  - `race-calendar-page.tsx` — upcoming races
  - `race-detail-page.tsx` — readiness, prediction, post-race analysis
- **Components:**
  - `coaching/plan-generator-form.tsx` — race goal input → generate plan
  - `coaching/plan-week-view.tsx` — weekly schedule with session details
  - `coaching/plan-session-card.tsx` — individual session (HR target, pace, distance)
  - `coaching/coach-review-panel.tsx` — coach's edit interface
  - `race/race-countdown-card.tsx` — days until race
  - `race/readiness-gauge.tsx` — visual readiness score
  - `race/prediction-card.tsx` — estimated finish time
  - `race/post-race-comparison.tsx` — predicted vs actual results
- **Elite metrics on dashboard:**
  - Aerobic efficiency trend
  - Cardiac drift rate
  - Training load graph
  - Fatigue/overtraining warning

## Key Features
1. **AI plan generation:** Claude API creates periodized MAF-based race plans
2. **Coach review:** Human coach reviews/adjusts AI plan before athlete sees it
3. **Race calendar:** Track target races with countdown + readiness score
4. **Race prediction:** Estimate finish from MAF pace extrapolation
5. **Post-race analysis:** Compare predicted vs actual, learn for next cycle
6. **Elite metrics:** Aerobic efficiency, cardiac drift, training load, fatigue index

## Success Criteria
- AI generates sensible periodized plan from race goal + user data
- Coach can edit any session in the plan
- Plan versioning tracks AI draft vs coach-reviewed version
- Race readiness score reflects actual preparedness
- Race prediction within 10% of actual finish time (for well-trained users)
- Elite metrics dashboard shows meaningful trends
