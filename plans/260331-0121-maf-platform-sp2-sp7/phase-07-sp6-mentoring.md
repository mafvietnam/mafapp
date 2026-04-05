# Phase 7: SP6 — Trainer-Trainee Mentoring

## Overview
- **Priority:** P3
- **Owner:** Both
- **Status:** Pending
- **Effort:** 4-6 weeks
- **Blocked by:** Phase 3 (SP2 complete)

Community mentoring: experienced MAF runners guide newer runners. Free, no payments.

## Parallel Split

### Dev A (Backend)
**File ownership:** `api/src/mentoring/`, `api/src/messaging/`

- **MentoringModule:**
  - Trainer profiles: bio, specialties, max trainees, auto-verification
  - Eligibility check: 6+ months activity data, proven MAF improvement
  - Matching: trainee requests mentor, trainer accepts/declines
  - Shared data access: trainer reads trainee's activities, dashboard, nutrition
  - Weekly check-in prompts (cron job → push notification)
- **MessagingModule:**
  - Simple in-app messaging via **WebSocket** (NestJS @WebSocketGateway)
  - Activity feedback: trainer annotates trainee's activities
  - Message notifications via push
  - Transport: WebSocket (confirmed) — bidirectional needed for chat UX
<!-- Updated: Validation Session 3 - WebSocket confirmed over SSE/polling -->
- **DB tables:** `trainer_profiles`, `mentoring_relationships`, `messages`, `activity_feedback`
- **APIs:**
  - `GET /trainers` — browse verified trainers
  - `POST /mentoring/request` — trainee requests mentoring
  - `PATCH /mentoring/:id/accept` — trainer accepts
  - `GET /mentoring/trainees` — trainer's trainee list with stats
  - `GET /mentoring/trainer` — trainee's trainer info
  - `POST /messages` — send message
  - `GET /messages/:userId` — conversation history
  - `POST /activities/:id/feedback` — trainer adds feedback

### Dev B (Frontend)
**File ownership:** `src/pages/mentoring-*`, `src/components/mentoring/`, `src/components/messaging/`

- **Pages:**
  - `trainers-page.tsx` — browse available trainers
  - `trainer-dashboard-page.tsx` — trainer's view of all trainees
  - `mentoring-page.tsx` — trainee's mentoring view (trainer info, messages)
- **Components:**
  - `mentoring/trainer-card.tsx` — trainer profile preview
  - `mentoring/trainee-overview-card.tsx` — trainee stats at a glance
  - `mentoring/shared-trend-chart.tsx` — side-by-side MAF trends
  - `mentoring/weekly-checkin-form.tsx` — trainee weekly report
  - `messaging/message-thread.tsx` — conversation view
  - `messaging/activity-feedback-badge.tsx` — feedback indicator on activities

## Authorization Boundary (CRITICAL)
- **Every mentoring/messaging endpoint MUST verify an active `mentoring_relationships` row** linking the requesting user to the target user
- `GET /messages/:userId` → reject with 403 if no active relationship between requester and target
- `GET /mentoring/trainees` → return only trainer's own trainees
- Trainer cannot access data of users they are not mentoring
- **Implement as NestJS Guard**: `MentoringRelationshipGuard` — reusable across all mentoring endpoints
<!-- Updated: Red Team Session 2 - Authorization boundary to prevent data access across unrelated users -->

## Success Criteria
- Trainers auto-verified from activity history
- Trainees can browse + request mentoring
- Trainer sees **only their own trainees'** MAF data in one dashboard
- In-app messaging works with push notifications (WebSocket transport)
- Trainer can annotate trainee's activities with tips
- Weekly check-in prompts sent to trainees
- **Authorization: no user can access another user's data without active mentoring relationship**
