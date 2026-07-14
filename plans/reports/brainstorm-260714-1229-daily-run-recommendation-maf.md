# Brainstorm Report: Daily Run Recommendation — Plan↔Journal Sync (MAF Coaching)

**Date:** 2026-07-14 | **Branch:** dev | **Status:** Consensus reached

## 1. Problem Statement

User request (VN): lịch trong `/plan` sync với `/journal` để gợi ý "hôm nay bạn nên chạy như thế nào"; hướng dẫn chuẩn bị trước/sau khi chạy; bài bổ trợ + phương pháp R.E.S.T theo MAF; cố vấn cho runner có bệnh nền (tim mạch, huyết áp, xương khớp). Mọi phân tích chuẩn khoa học thể thao, bám sách "The Big Book of Endurance Training and Racing" (`docs/the-big-book-of-endurance-training-and-racing.pdf`), ưu tiên sức khỏe & không chấn thương.

## 2. Current State (scout findings)

- Plan = ephemeral client computation from `UserProfile` (3 fixed 7-day templates per commitment). NOT persisted. `src/utils/maf-schedule-generator.ts`, `ScheduleItem` has weekday label only — no real dates, no per-item HR zone.
- Journal = view over `StravaActivity` rows (`src/pages/journal-page.tsx`, `use-journal-activities.ts`). No plan↔journal link exists.
- Reusable analysis layer: `maf-activity-analysis.ts` (timeInZone, cardiacDrift, aerobicEfficiency), `journal-analytics.ts` (inZonePct, mafTrendSeries), `maf-coaching-insights.ts` (retrospective per-activity coaching card, VN text, book-chapter citations — proven pattern).
- Untapped signals: `GarminDailySummary` (restingHeartRate, sleep, stress), profile flags (`isProbation`, `isRecovering`, `lastLongRunFeeling`).
- No AI in product code. SP7 phase-08 (pending) pre-scoped Claude BYOK coaching.
- Stack: React 19 SPA + NestJS 10 + Prisma/Postgres. MAF logic = pure client utils, ~98% test coverage. UI 100% Vietnamese. Prod has Prisma migration drift — migrations need manual SQL + `migrate resolve`.

## 3. Decisions (user-confirmed)

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Brainstorm full architecture, ship in 4 phases | Phase 1 = highest value, reduce risk |
| Engine | Hybrid: deterministic rule engine decides workout params; LLM only phrases narrative | Safety-critical advice must be book-grounded, not hallucinated |
| Health conditions | Screening questionnaire + conservative auto-adjustments + doctor-clearance gates (book Ch6/Ch29) | Low legal risk; app is not a doctor |
| R.E.S.T | Synthesize book recovery principles into R.E.S.T framework (Recovery–Eat–Sleep–Time) | User confirmed general recovery per book |
| Plan persistence | NO `training_plans` table yet — compute today's workout from template + weekday | YAGNI; prod migration drift risk; revisit when plans become editable |
| Morning check-in | YES, Phase 1. New small `daily_checkins` table | Highest-value readiness signal, covers non-Garmin users; book teaches morning HR tracking |
| AI timing/cost | Last phase. Server-side key, 1 generation/user/day, cached | BYOK = adoption killer; cache bounds cost |
| UI placement | Shared `TodayCard`: prominent on Dashboard + compact on Journal | Daily retention + historical context |

## 4. Evaluated Alternatives (rejected)

- **Pure LLM engine**: flexible but can hallucinate health advice, per-day cost, uncontrollable. Rejected.
- **Pure rule-based (no AI ever)**: safe/cheap but repetitive copy. Kept as permanent fallback; AI added as thin narrative layer later.
- **Persist `training_plans` now** (per SP7 sketch): correct long-term, but blocks MVP on risky prod migration; adherence computable dynamically. Deferred.
- **BYOK Claude keys**: zero system cost but ~0% VN runner adoption. Rejected in favor of server key + cache.

## 5. Recommended Architecture

### Phase 1 — "Hôm nay chạy gì?" (Today Recommendation Core)

**New pure-function modules** (follow existing utils pattern, <200 LOC each, unit-tested):
- `src/utils/daily-readiness-score.ts` — inputs: 7/14-day load + inZonePct + drift trend (journal-analytics), Garmin daily summary (resting HR delta vs personal baseline, sleep, stress), morning check-in, profile flags (isProbation, isRecovering, age, BMI), days since last run/long run. Output: readiness tier `GREEN | AMBER | RED` + reason codes.
- `src/utils/daily-recommendation-engine.ts` — resolve today's planned workout from existing schedule template + weekday → apply readiness adjustments: reduce duration %, swap RUN→WALK, force REST, always include 15/15 warm-up/cool-down (Ch5), HR zone from MafResult (Ch6). Output structured `DailyRecommendation` with book citations (reuse citation pattern from `maf-coaching-insights.ts`).
- Adherence strip: this week template vs actual `StravaActivity` matched by date/type.

**Backend:**
- `daily_checkins` table: `{id, userId, date, sleepQuality 1-5, fatigue 1-5, soreness enum/note, restingHr?, createdAt}` + NestJS `checkin` module (POST/GET). Migration per drift protocol (manual SQL + `migrate resolve` on prod).
- Expose `GarminDailySummary` to frontend if endpoint missing (verify — unresolved Q from scout).

**Frontend:** `TodayCard` (Dashboard prominent + Journal compact), 20-second check-in mini-form (optional), recommendation display: what/how long/HR zone/why + warning-sign notes. VN copy via template literals (XSS-safe pattern).

**Book grounding:** Ch5 (15/15), Ch6 (180 formula), Ch7 (Training = Work + Rest, overtraining signs incl. elevated morning HR), Ch9 (commitment), Ch29 (safety).

### Phase 2 — Pre/Post-run Guidance + Bài bổ trợ + R.E.S.T Library

- Curated static VN content library (`src/content/` TS constants, each item cites book chapter or Maffetone article URL). No runtime generation.
- Pre-run checklist per workout type: warm-up protocol, hydration, meal timing (Maffetone: fat-adaptation, avoid refined carbs pre-run), gear/weather.
- Post-run: cool-down, walking, refuel, monitoring signs.
- Bài bổ trợ per Maffetone philosophy: easy/slow strength, walking, barefoot/balance & technique drills, mobility. **NOTE:** book is skeptical of static stretching — content must reflect this (contrarian vs mainstream VN running advice; flag in content review).
- R.E.S.T framework cards: Recovery (rest days, easy days), Eat (fat-burning nutrition, refined-carb reduction), Sleep (hygiene, book's sleep guidance), Time/sTress (stress-cortisol chapters, adaptation takes time).
- Rule-based selection: day type + readiness tier + flags → which cards render.
- Research task at plan time: harvest Dr. Maffetone's published supplementary-exercise articles (philmaffetone.com) to augment book; cross-check against book before inclusion.

### Phase 3 — Health-Condition Screening + Safety Advisor

- Extend `UserProfile`: structured `healthConditions` flags (CARDIOVASCULAR, HYPERTENSION, JOINT_ISSUES + extensible) via screening questionnaire (Ch6 medical-clearance model, Ch29 special-populations model).
- Rule effects: force doctor-clearance confirmation before schedule beyond HEALTH; conservative MAF adjustment (existing −5/−10 rules); duration caps; walk-first progression for joint issues; extended warm-up/cool-down (mirror existing 60+ logic).
- Pre-run safety card for flagged users: danger-sign checklist (chest pain, dizziness, unusual breathlessness → STOP + seek help), "app không thay thế bác sĩ" disclaimer.
- Strictly no diagnosis/treatment content. Screening → adjustment → gate → warn only.

### Phase 4 — AI Narrative Layer (Hybrid completion)

- NestJS `coaching` module, Claude API (server key). Input = rule engine's structured JSON only. System prompt: MUST NOT alter parameters, MUST only cite provided sources, VN output, no medical claims beyond provided flags.
- Cache: 1 generation/user/day (Redis+DB), regenerate only when inputs change (new check-in/activity). Haiku-class model sufficient.
- Fallback: template rendering (Phases 1–3 output) whenever AI unavailable → feature never breaks.

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Prod Prisma migration drift | Follow established protocol: manual SQL + `migrate resolve`; keep Phase 1 to ONE small table |
| Garmin coverage sparse | Check-in fills gap; engine degrades gracefully per available signals |
| "Today" timezone bugs | Compute in user-local TZ (Asia/Ho_Chi_Minh default), test around midnight |
| Content scientific accuracy | Every content item cites book chapter/source; anti-static-stretching stance flagged for owner review |
| User trust in recommendations | Always show "why" (signals used + citations), never a bare verdict |
| AI cost/quality (Phase 4) | 1/day cache, schema-validated output, template fallback |
| Legal exposure (health conditions) | Screening+gates only, persistent disclaimers, no diagnosis |

## 7. Success Metrics

- % active users viewing TodayCard daily; % days with check-in submitted.
- Adherence: planned vs actual sessions/week trend.
- MAF quality: inZonePct trend up, cardiac-drift trend down among TodayCard users.
- Safety: probation activations (injury) trend down; zero uncontrolled advice incidents.

## 8. Next Steps

1. Create implementation plan (`/ck:plan`) — phases 1–4 as above; Phase 1 detailed first.
2. Plan-time research: (a) Maffetone supplementary-exercise articles; (b) book chapters for pre/post-run + recovery content extraction (PDF in docs/); (c) verify Garmin daily-summary API exposure.
3. Content review session with owner for Phase 2 library (esp. stretching stance).

## Unresolved Questions

- Backend endpoint exposing `GarminDailySummary` to frontend — exists or needs building? (verify at plan time)
- Soreness field shape in check-in: enum body-areas vs free note — decide at design time.
- Should REST-day TodayCard push R.E.S.T content (Phase 2 dependency) or minimal copy in Phase 1?
