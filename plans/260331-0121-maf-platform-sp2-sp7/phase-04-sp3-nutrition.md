# Phase 4: SP3 — Nutrition & Supplementation

## Overview
- **Priority:** P2
- **Owner:** Both (Dev A: backend, Dev B: frontend)
- **Status:** Pending
- **Effort:** 4-6 weeks
- **Blocked by:** Phase 3 (SP2 complete)

MAF-aligned nutrition content + daily food/supplement tracking + training correlation.

## Parallel Split

### Dev A (Backend)
**File ownership:** `api/src/nutrition/`

- **NutritionModule** in NestJS:
  - `nutrition-content.controller.ts` — CRUD for guides, meal plans
  - `food-log.controller.ts` — daily food/supplement logging API
  - `two-week-test.controller.ts` — test tracker API
  - `nutrition-insight.service.ts` — correlate nutrition with Strava performance
- **DB tables:** `nutrition_content`, `food_logs`, `supplement_logs`, `two_week_test_entries`
- **Seed data:** MAF-approved food lists, supplement guides, meal plan templates
- **APIs:**
  - `GET /nutrition/guides` — content list with filters
  - `GET /nutrition/meal-plans?commitment=BASE` — meal plans by level
  - `POST /nutrition/food-log` — log meal
  - `POST /nutrition/supplement-log` — log supplement
  - `GET /nutrition/history?from=&to=` — food/supplement history
  - `GET /nutrition/insights` — weekly nutrition score + training correlation
  - `POST /nutrition/two-week-test/start` — start Two-Week Test
  - `GET /nutrition/two-week-test/progress` — current test status

### Dev B (Frontend)
**File ownership:** `src/pages/nutrition-*`, `src/components/nutrition/`

- **Pages:**
  - `nutrition-page.tsx` — tab layout: Guides | Log | Two-Week Test
  - `meal-plan-detail-page.tsx` — single meal plan view
- **Components:**
  - `nutrition/meal-plan-browser.tsx` — searchable meal plan cards
  - `nutrition/food-log-form.tsx` — quick food entry (meal type, items, notes)
  - `nutrition/supplement-log-form.tsx` — supplement entry
  - `nutrition/daily-summary-card.tsx` — today's nutrition summary
  - `nutrition/two-week-test-wizard.tsx` — guided 14-day elimination diet flow
  - `nutrition/nutrition-score-card.tsx` — weekly compliance score
  - `nutrition/nutrition-insight-card.tsx` — training correlation messages
- **Dashboard integration:** Add nutrition summary card to dashboard page
- **Navigation:** Add "Nutrition" tab to sidebar

## Key Features
1. **Content system:** Pre-built MAF meal plans by commitment level, supplement guides
2. **Daily logging:** Food + supplement tracking with favorites/recent items
3. **Two-Week Test:** Guided elimination diet protocol with daily symptom checklist
4. **Insights:** "MAF pace improved 5s/km — you logged consistent low-carb meals this week"
5. **Hydration tracking:** Daily water intake

## Success Criteria
- Users can browse MAF meal plans filtered by commitment level
- Users can log food/supplements quickly (favorites, recent items)
- Two-Week Test wizard guides through 14-day protocol
- Dashboard shows weekly nutrition score
- Nutrition-training correlation insights displayed
