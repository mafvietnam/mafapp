# Phase 1 — Today Recommendation Core ("Hôm nay chạy gì?")

## Context Links

- Source of truth: `../reports/brainstorm-260714-1229-daily-run-recommendation-maf.md` §5 Phase 1
- Domain rules: `../../docs/MAF_RULES_SUMMARY.md` (Ch5 15/15, Ch6 180-formula, Ch7 Work+Rest)
- Reuse patterns: `src/utils/maf-coaching-insights.ts` (BookRef+tier), `src/utils/journal-analytics.ts`
  (inZonePct, mafTrendSeries), `src/utils/maf-activity-analysis.ts` (verdict, MafZone),
  `src/utils/maf-schedule-generator.ts` (getWeeklySchedule), `src/hooks/use-maf-calculator.ts` (calculateRawMaf)
- <!-- RED TEAM FIX #4: MUST also read/reuse the FULL orchestrator that /plan actually renders —
  `src/utils/maf-calculator-orchestrator.ts` (`calculateMAF` → `buildAndAdjustSchedule`: safety caps, probation −30%
  volume caps, smart long run) + `src/utils/maf-calculator-schedule-builder.ts` + `src/utils/maf-safety-adjustments.ts`.
  `calculateRawMaf` (use-maf-calculator.ts:30) OMITS probation −10; the orchestrator's `applyHeartRateAdjustments`
  INCLUDES it. Daily engine must consume the orchestrator's ADJUSTED schedule + ADJUSTED mafHr, not raw values. -->
- <!-- RED TEAM FIX #6: `buildChildResult()` (maf-calculator-orchestrator.ts:106) short-circuits age<16 to play-only.
  Daily engine must mirror this branch — read that function for the exact copy/shape. -->
- <!-- RED TEAM FIX #5: `FEATURE_GARMIN` gate at `api/src/garmin/garmin.module.ts:7` (=== 'true'); FALSE on prod (MFA).
  Garmin signals are ZERO data on prod, treat as bonus-only. -->
- <!-- RED TEAM FIX #14: `maf-coaching-insights.ts:23` BookRef = 'CH3'|'CH4'|'CH5'|'CH8'|'CH9' — lacks CH6/CH7; must extend. -->
- Garmin consumer: `src/services/garmin-service.ts:106` (getGarminDailySummary — VERIFIED present)
- Backend module pattern: `api/src/garmin/{garmin.module,garmin.controller}.ts`, `api/src/profile/profile.service.ts`

## Overview

- **Priority:** P1 (highest value — daily retention driver)
- **Status:** completed (implemented 2026-07-14; migration authored but NOT applied to any DB —
  see reports/fullstack-260714-phase01-impl.md deviation #1; not deployed per instructions)
- **Effort:** 4 days
- **Description:** Compute today's workout from the ephemeral weekly template + weekday, adjust by a readiness
  tier derived from journal/Garmin/check-in/profile signals, render in a shared TodayCard (prominent on
  Dashboard, compact on Journal). Add one small `daily_checkins` table + NestJS `checkin` module.

## Key Insights

- Plan is NOT persisted (no `training_plans` table — locked YAGNI). **RED TEAM FIX #4:** today's workout is NOT the raw
  `getWeeklySchedule(commitment)` template — it is the **orchestrator's ADJUSTED output** that `/plan` actually renders:
  `calculateMAF(...)` → `buildAndAdjustSchedule` applies safety caps, probation −30% volume, volume caps, smart long run,
  and returns an **adjusted mafHr** (probation −10, recovering −10, medicated −5, experience score). Index THAT schedule by
  weekday, then layer readiness deltas on top. Using `calculateRawMaf` (omits probation −10) or the raw template would make
  TodayCard CONTRADICT `/plan` for probation/recovering/senior/beginner/high-BMI users. Non-negotiable: single engine.
- **RED TEAM FIX #6:** age<16 is a hard branch. `/plan` short-circuits children via `buildChildResult()`
  (no structured training, "vui chơi tự nhiên", HR=0). Daily engine MUST have an `isChild` branch that mirrors it —
  play-based message, NO structured workout, NO HR zone. Never prescribe a 45-min run to a minor.
- MAF zone convention is locked: `{ lower: mafHr - 10, upper: mafHr }` (see maf-activity-analysis.ts header). Do NOT re-derive.
- `maf-coaching-insights.ts` is the proven citation pattern: `BookRef` union + VN template literals + importance/priority
  sort + cap. Mirror it (pure fn, no React/IO, unit-tested in `src/utils/__tests__/`).
  **RED TEAM FIX #14:** existing union is `CH3|CH4|CH5|CH8|CH9` — MUST extend with `CH6`, `CH7` before citing them
  (else compile error); this file is in the Modify list now.
- **RED TEAM FIX #5:** Garmin is DEAD on prod (`FEATURE_GARMIN=false`, MFA failure) — restingHR/sleep/stress are ZERO data,
  not "sparse". Engine is **CHECK-IN-FIRST**; Garmin signals are **bonus-only**, gated behind the feature-flag / data-presence
  check. Engine MUST produce a sensible recommendation on day 1 with ZERO check-in history AND zero Garmin (default GREEN,
  as-scheduled, no fabricated penalties).
- **RED TEAM FIX #7:** Timezone is the #1 bug risk. The **SERVER** is the single source of "today" (fixed Asia/Ho_Chi_Minh).
  All authoritative date keys (check-in unique key, Phase 4 cache key) are derived server-side in ICT; the client NEVER sends
  the authoritative date. Frontend `local-today.ts` is display-only (fixed +07, DST-free) and MUST agree with server ICT.
  One consistent TZ regime across engine, adherence (`mondayOf`), check-in, and cache.

## Requirements

### Functional
1. Resolve today's `ScheduleItem` from the **orchestrator's adjusted schedule** (`calculateMAF` output) + user-local weekday
   (RED TEAM FIX #4 — not the raw `getWeeklySchedule` template). Use the adjusted `mafHeartRate`, not `calculateRawMaf`.
2. Compute readiness tier `GREEN | AMBER | RED` + reason codes from available signals (CHECK-IN-FIRST; Garmin bonus-only).
3. Adjust workout: reduce duration %, swap RUN→WALK, or force REST per tier; attach proportional warm-up/cool-down
   (nominal 15/15, scaled so mainMinutes never ≤0 — RED TEAM FIX #13) and MAF HR zone.
   RED = REST or gentle recovery WALK ONLY (never a run) — RED TEAM FIX #13.
4. Persist optional morning check-in (upsert one row per user per **server-derived ICT date** — RED TEAM FIX #7).
5. Render TodayCard: what / duration / HR zone / why (signals + citations) + adherence strip (week template vs actual)
   + **last-sync timestamp + "đã chạy hôm nay" ack path** (RED TEAM FIX #12).
6. REST-day card = minimal static VN copy in Phase 1 (full R.E.S.T content arrives Phase 2).
7. **RED TEAM FIX #6:** `isChild` (age<16) branch — TodayCard shows play-based message, NO structured workout, NO HR zone
   (mirror `buildChildResult()`). Short-circuits before readiness/tier logic.
8. **RED TEAM FIX #12:** never let a MISSING recent activity silently imply rest/GREEN. If today's Strava sync is stale,
   surface "Chưa đồng bộ hoạt động hôm nay?" + a manual "tôi đã chạy hôm nay" acknowledgement that suppresses a 2nd-hard-session
   recommendation and prevents a false "missed" on the adherence strip.

### Non-Functional
- Pure utils <200 LOC each, ≥90% unit coverage (matches repo ~98% convention).
- All UI copy Vietnamese via template literals (XSS-safe, no `dangerouslySetInnerHTML`).
- Check-in form ≤20s to complete, fully optional (card works with zero check-ins).
- No new heavyweight deps.

## Architecture

### Data flow

<!-- RED TEAM FIX #4: engine consumes orchestrator ADJUSTED schedule + adjusted mafHr, not raw template. -->
<!-- RED TEAM FIX #5: check-in-first; Garmin gated bonus-only. #6: isChild short-circuit. #12: stale-sync ack. -->
<!-- RED TEAM FIX #7: server ICT date is authoritative; local-today.ts is display-only. -->

```
 age<16 ? ──yes──► isChild branch (play-only card, no workout, no HR zone)  [RED TEAM FIX #6]
   │ no
   ▼
                         ┌─ daily check-in (use-daily-checkin) [PRIMARY] ┐
                         │    → sleepQuality, fatigue, soreness, restHr   │
                         ├─ journal activities (useStravaActivities) ─────┤
                         │    → journal-analytics: inZonePct, load,       │
                         │      mafTrendSeries (efficiency ≈ cardiac-drift │
                         │      PROXY; true per-activity drift = P2)      │
                         │    → days-since-last-run; STALE-SYNC check ────┤
 "today" (SERVER ICT,    │      (+ manual "đã chạy hôm nay" ack)          │──► daily-readiness-score.ts
  Asia/Ho_Chi_Minh;      ├─ Garmin daily summary [BONUS-ONLY, flag-gated] │      → { tier, reasons[] }
  local-today display)   │    → restingHR delta vs baseline (n≥7 guard),  │              │
                         │      sleep, stress                             │              │
                         └─ profile flags (isProbation,isRecovering,      │              ▼
                            age, BMI, isMedicatedOrInjured, healthFlags)  │   daily-recommendation-engine.ts
                                                                          │   (orchestrator adjustedSchedule[weekday]
 calculateMAF(profile) ── ADJUSTED schedule + ADJUSTED mafHr ─────────────┘    + tier + adjusted mafHr)
   (buildAndAdjustSchedule: safety caps, probation −30%, volume caps)                    │
                                                                                         ▼
                                        adherence-analysis (adjusted week vs actual activities by weekday+type)
                                                                                         │
                                                                                         ▼
                                              TodayCard (prominent | compact)  +  AdherenceStrip
                                              (+ last-sync line + "đã chạy" ack)  [RED TEAM FIX #12]
```

### daily-readiness-score.ts (pure)

- **Input** `ReadinessInput`: `{ recentActivities: StravaActivity[]; dailySummaries: GarminDailySummary[];
  checkin: DailyCheckin | null; profile: { age; bmi; isProbation; isRecovering; isMedicatedOrInjured };
  today: Date /* local midnight */ }`.
- **Output** `ReadinessResult`: `{ tier: 'GREEN'|'AMBER'|'RED'; score: number; reasons: ReasonCode[] }`
  where `ReasonCode = { code: string; severity: 'good'|'warn'|'bad'; text: string /* VN */; bookRef?: BookRef }`.
- **Signals → scoring (deterministic, additive penalty model). All thresholds below are TUNABLE PLACEHOLDERS —
  flagged for domain sign-off at implementation (RED TEAM open-Q decision):**
  - restingHR delta: baseline = trailing mean of `restingHeartRate` over last 14 avail days (exclude today).
    **RED TEAM FIX #5:** REQUIRE a min-sample guard `n ≥ 7` — if fewer than 7 baseline days available, the RHR signal is
    IGNORED entirely (contributes nothing). Never fabricate RED/GREEN from n=1. `+5 bpm` ≥ warn, `+7 bpm` ≥ bad
    (Ch7 elevated morning HR overtraining sign). Check-in `restingHr` is the PRIMARY source; Garmin only if flag-on + present.
  - sleep: `sleepDuration < 6h` OR `sleepQuality ≤ 2` → warn (Ch7 recovery). Check-in `sleepQuality` primary; Garmin bonus.
  - stress: Garmin `stressAvg` ≥ 60 (placeholder) → warn — **BONUS-ONLY, flag-gated** (zero on prod, contributes nothing then).
  - fatigue/soreness (check-in): `fatigue ≥ 4` → warn, `≥ 5` → bad; `soreness` present → warn (feeds RUN→WALK swap).
  - load: 7-day session count / km vs 14-day baseline; sharp spike → warn (spike = overtraining risk).
  - aerobic-quality trend (cardiac-drift PROXY): falling `inZonePct` or falling efficiency (`mafTrendSeries`) over recent
    weeks → info/warn. **Decision (open-Q):** bulk activities carry only `avgHeartRate`, so use this efficiency proxy;
    true per-activity cardiac drift needs `StravaActivityDetail` hydration → OUT OF SCOPE P1.
  - days-since-last-run: 0 (ran today already) → suggest lighter; ≥ N with scheduled REST → fine.
    **RED TEAM FIX #12:** a MISSING recent activity must NOT be read as "rested" → do NOT lower to REST/GREEN on absence alone.
    Absence + stale sync → surface the "đã chạy hôm nay?" prompt; only a user ack or a synced activity confirms the run state.
  - profile: **RED TEAM FIX #3** — `isProbation` OR `isRecovering` sets an AMBER **FLOOR** (minimum caution), NOT a ceiling.
    RED is always still reachable if a bad signal fires. `isMedicatedOrInjured` → warn.
- **Tier mapping (severity RED > AMBER > GREEN):** count weighted penalties → computed tier GREEN (0 warn/bad),
  AMBER (≥1 warn), RED (≥1 bad or multiple warns). **Final tier = most-cautious(computedTier, floor)** where floor comes from
  profile/health flags (RED TEAM FIX #3 — floor raises the minimum, never caps the maximum). Reason codes always returned.
- **Graceful degradation:** each signal is optional; a missing signal contributes nothing (not a penalty) —
  EXCEPT missing activity, which triggers the stale-sync ack prompt rather than a silent GREEN (RED TEAM FIX #12).
  Zero check-in + zero Garmin (prod day-1) → GREEN, as-scheduled, no reasons (RED TEAM FIX #5).

### daily-recommendation-engine.ts (pure)

- **Input** `RecommendationInput`: `{ adjustedScheduleItem: ScheduleItem; mafHr: number; readiness: ReadinessResult;
  profile: { age; bmi } }` where `adjustedScheduleItem` + `mafHr` come from the **orchestrator's `calculateMAF` output**
  (already safety-capped, probation −30%, volume-capped, adjusted mafHr) indexed by weekday — NOT the raw template
  (RED TEAM FIX #4). Engine applies readiness deltas ON TOP of the already-adjusted item.
- **RED TEAM FIX #6 — child short-circuit:** if `age < 16`, return a play-only `DailyRecommendation`
  (`dayType='REST'`, `hrZone=null`, `totalMinutes=0`, VN play copy from `buildChildResult()`); skip all tier/adjustment logic.
- **Output** `DailyRecommendation`:
  ```ts
  interface DailyRecommendation {
    dayType: 'RUN' | 'LONG_RUN' | 'WALK' | 'RECOVERY' | 'REST';
    title: string;            // VN, e.g. "Chạy nhẹ nhàng 45 phút"
    totalMinutes: number;     // after tier adjustment (orchestrator-adjusted then readiness delta)
    warmupMin: number;        // proportional clamp(round(total*0.20),5,15); 0 when allEasy (total<35) — RED TEAM FIX #13
    cooldownMin: number;      // same as warmupMin
    mainMinutes: number;      // total - warmup - cooldown, floored ≥5 (or =total when allEasy)
    allEasy?: boolean;        // true when total<35 → whole session easy, warm/cool folded
    hrZone: MafZone | null;   // { lower: mafHr-10, upper: mafHr }; null if mafHr<=0 or isChild
    tier: 'GREEN'|'AMBER'|'RED';
    reasons: ReasonCode[];    // from readiness, filtered to what changed the plan
    citations: BookRef[];     // e.g. ['CH5','CH6','CH7']
    restCopy?: string;        // set only when dayType==='REST' (minimal VN in P1)
    adjustmentNote?: string;  // VN, e.g. "Đã giảm 40% thời lượng do tín hiệu hồi phục thấp"
  }
  ```
- **Adjustment rules (deterministic). RED TEAM FIX #13 — math must never produce ≤0 main minutes, and RED is unambiguous:**
  - `RED` → **exactly one behavior: REST or a gentle recovery WALK only — NEVER a run.** If the adjusted item was already a
    run/long-run → `dayType='REST'` with `restCopy`. If the user explicitly wants movement, offer a gentle recovery WALK
    ≤30min at ≤ MAF−10 (no running under any RED path). `restCopy` minimal; citations `['CH7']`.
    (Removes the old "force REST or WALK" ambiguity AND the risk-table "chạy nhẹ" contradiction — no light RUN on RED.)
  - `AMBER` → reduce `totalMinutes` by ~35% (placeholder, rounded to 5), pin HR to lower half (MAF−10..MAF), swap RUN→WALK
    when `soreness` reason present; `adjustmentNote` set; citations `['CH5','CH6','CH7']`.
  - `GREEN` → as scheduled (already orchestrator-adjusted); citations `['CH5','CH6']`.
  - **Warm/cool + main-minutes math (RED TEAM FIX #13 — no degenerate 0-minute sessions):**
    - Warm-up/cool-down are **proportional, not fixed 15/15**, so reductions never zero-out the main set:
      `warmupMin = cooldownMin = clamp(round(totalMinutes * 0.20), 5, 15)`; `mainMinutes = totalMinutes − warmup − cooldown`,
      floored so `mainMinutes ≥ 5` (if the floor would be violated, shrink warm/cool first, never the main set below 5).
    - **All-easy band fix:** `totalMinutes < 35` → entirely easy (below MAF−20), warm/cool folded (`allEasy=true`,
      `warmup=cooldown=0`, `mainMinutes=totalMinutes`). Threshold raised 30→35 so the 30–35 band is covered (was a gap that
      left 30–35min sessions with fixed 15/15 = 0 main). Worked example: 45min AMBER −35% = 30 → all-easy 30min main (not 0).
  - BMI ≥30 → RUN becomes WALK (mirror existing Ch29 rule); do NOT duplicate the formula — import from `maf-safety-adjustments.ts`
    if exposed, else replicate minimally with citation comment. (Usually already applied by the orchestrator; guard against double-swap.)
- Reuse `BookRef` type + citation-render pattern from `maf-coaching-insights.ts`. **RED TEAM FIX #14:** extend the `BookRef`
  union with `'CH6'` and `'CH7'` (+ any others cited) in `maf-coaching-insights.ts` BEFORE citing them, and export/share the union (DRY).

### adherence-analysis.ts (pure)

- **Input:** week template `ScheduleItem[]` + `StravaActivity[]` + local week start (Monday, reuse `mondayOf`).
- **Output:** `AdherenceDay[] = { weekday; planned: ScheduleItem; status: 'done'|'missed'|'rest'|'upcoming'|'extra' }`.
- Match actual activity to a template day by local weekday; type family (RUN/LONG_RUN/RECOVERY = "run", WALK = "walk").
  Past run-day with matching activity → done; past run-day without → missed; REST day → rest; future → upcoming;
  activity on a REST day → extra. Reuse `mondayOf`/date utils from `journal-date-utils.ts` (DRY).

### local-today.ts (pure)

- `localToday(tz = 'Asia/Ho_Chi_Minh'): Date` → Date at local midnight; `localWeekdayLabel(date): string` →
  maps to template labels `'Thứ 2'..'Chủ Nhật'`. Implement via `Intl.DateTimeFormat(..., { timeZone })` parts
  (no external tz lib — KISS). Drives client-side RENDER (which weekday to show, adherence `mondayOf`).
- **RED TEAM FIX #7:** this is DISPLAY-only. The **authoritative** "today" for any PERSISTED key (check-in unique
  `(userId, date)`, Phase 4 coaching cache key) is derived SERVER-SIDE in ICT. The client never sends the authoritative
  date to `POST /checkins` or `/coaching/today` — the server computes it. Fixed +07 (DST-free) means client display and
  server key agree, but the server value is canonical. Add a boundary test proving client `localToday` == server ICT date.

### Backend: daily_checkins + checkin module

- **Prisma model** (`api/prisma/schema.prisma`):
  ```prisma
  model DailyCheckin {
    id            String   @id @default(uuid())
    userId        String
    user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    date          DateTime @db.Date
    sleepQuality  Int      // 1-5
    fatigue       Int      // 1-5
    soreness      String?  // optional short tag e.g. "calf","knee","none"
    note          String?  // optional free note
    restingHr     Int?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    @@unique([userId, date])
    @@index([userId, date])
  }
  ```
  Add `dailyCheckins DailyCheckin[]` back-relation on `User`. The `onDelete: Cascade` relation satisfies the
  erasure-cascade requirement (RED TEAM FIX #11 — check-in vitals are PII; deleting a User purges their check-ins).
- **Module** `api/src/checkin/`: `checkin.module.ts`, `checkin.controller.ts` (`@Controller('checkins')`,
  `@UseGuards(JwtAuthGuard)`), `checkin.service.ts`, `checkin.dto.ts` (class-validator: `sleepQuality`/`fatigue`
  `@Min(1) @Max(5)`, `restingHr?` `@Min(20) @Max(200)`, `soreness?`/`note?` `@IsString @MaxLength(...)`).
  - `POST /checkins` → upsert on `(userId, serverIctDate)`. **RED TEAM FIX #7:** server DERIVES the date in ICT — the client
    does NOT send an authoritative `date`. (If a client date is sent it is ignored/validated-only, never trusted for the key.)
    Upsert mirrors `profile.service.ts` upsert pattern.
  - `GET /checkins?from&to` → range list (default `to = server ICT today`), matches `DailySummaryQueryDto` style.
  - Register in `app.module.ts` imports (unconditional — no feature flag; check-in is core).
  - **RED TEAM FIX #8 (migration protocol):** ship `daily_checkins` SQL to prod BEFORE deploying this module (else `POST`/`GET`
    500 on missing table). Service wraps table access in try/catch → empty/soft-fail during the rollout gap. Provide `down.sql`.

### Frontend wiring

- `src/services/checkin-service.ts` — `getCheckins(from,to)`, `upsertCheckin(payload)` (mirror garmin-service style,
  try/catch → safe fallback).
- `src/hooks/use-daily-checkin.ts` — today's check-in + submit handler.
- `src/components/today/today-card.tsx` — `variant: 'prominent' | 'compact'`; renders DailyRecommendation
  (title, duration breakdown, HR zone, reasons+citations, adjustmentNote/restCopy) + slot for AdherenceStrip
  + **last-sync line + "tôi đã chạy hôm nay" ack button when today's Strava sync is stale** (RED TEAM FIX #12).
  Child (age<16) → play-only render (no HR zone, no workout breakdown) (RED TEAM FIX #6).
- `src/components/today/checkin-mini-form.tsx` — optional 3-field form (sleep 1-5, fatigue 1-5, soreness chips).
- `src/components/today/adherence-strip.tsx` — 7-dot week strip (done/missed/rest/upcoming). A day acknowledged via
  "đã chạy" or with a synced activity is `done`; absence alone is NOT auto-`missed` until the local day closes (RED TEAM FIX #12).
- `src/hooks/use-today-recommendation.ts` — orchestrates: runs `calculateMAF` (orchestrator) for the adjusted schedule + mafHr
  (RED TEAM FIX #4), gathers signals (activities + last-sync timestamp, dailySummaries [flag-gated], checkin, profile),
  memoizes readiness + recommendation + adherence (mirror journal-page `useMemo` pattern). Exposes stale-sync state + ack handler.
- **Dashboard:** replace hardcoded `MafAssistantCard` usage with `<TodayCard variant="prominent" />`
  (mobile `<main>` top + desktop right column). Keep `MafAssistantCard` file for now or delete if fully superseded (confirm w/ owner).
- **Journal:** insert `<TodayCard variant="compact" />` above `JournalStatsHeader`.

## Related Code Files

### Create
- `src/utils/local-today.ts`
- `src/utils/daily-readiness-score.ts`
- `src/utils/daily-recommendation-engine.ts`
- `src/utils/adherence-analysis.ts`
- `src/utils/__tests__/local-today.test.ts`
- `src/utils/__tests__/daily-readiness-score.test.ts`
- `src/utils/__tests__/daily-recommendation-engine.test.ts`
- `src/utils/__tests__/adherence-analysis.test.ts`
- `src/services/checkin-service.ts`
- `src/hooks/use-daily-checkin.ts`
- `src/hooks/use-today-recommendation.ts`
- `src/components/today/today-card.tsx`
- `src/components/today/checkin-mini-form.tsx`
- `src/components/today/adherence-strip.tsx`
- `api/src/checkin/checkin.module.ts`
- `api/src/checkin/checkin.controller.ts`
- `api/src/checkin/checkin.service.ts`
- `api/src/checkin/checkin.dto.ts`
- `api/prisma/migrations/000N_daily_checkins/migration.sql`
- `api/prisma/migrations/000N_daily_checkins/down.sql` (rollback DDL — RED TEAM FIX #8)

### Modify
- `api/prisma/schema.prisma` (add `DailyCheckin` + User back-relation, `onDelete: Cascade`)
- `api/src/app.module.ts` (import `CheckinModule`; **RED TEAM FIX #15:** derive throttler key from real client IP —
  custom `ThrottlerGuard.getTracker` reading `CF-Connecting-IP`, since default keys on shared tunnel IP)
- `api/src/main.ts` (**RED TEAM FIX #15:** `app.set('trust proxy', ...)` / Express trust-proxy so real client IP is resolved behind Cloudflare Tunnel)
- `src/utils/maf-coaching-insights.ts` (**RED TEAM FIX #14:** extend `BookRef` union with `'CH6'`, `'CH7'`; export union for reuse)
- `src/types.ts` (add `DailyCheckin`, `ReadinessResult`, `DailyRecommendation` [+`allEasy`], `ReasonCode` interfaces)
- `src/pages/dashboard-page.tsx` (mount prominent TodayCard)
- `src/pages/journal-page.tsx` (mount compact TodayCard)

### Delete
- None (MafAssistantCard retained unless owner confirms removal)

## Implementation Steps

1. **BookRef extension (RED TEAM FIX #14)** — add `'CH6'`, `'CH7'` to the union in `maf-coaching-insights.ts`, export it.
   (Do first — everything downstream cites these.)
2. **local-today.ts + tests** — `localToday`, `localWeekdayLabel`. Tests: 23:30 and 00:30 Asia/Ho_Chi_Minh land on
   correct dates/weekdays; DST-free zone so fixed +07. **RED TEAM FIX #7:** assert client `localToday` == server ICT date
   (display vs authoritative parity).
3. **Prisma + migration (RED TEAM FIX #8)** — add `DailyCheckin` model (`onDelete: Cascade`);
   `cd api && npx prisma migrate dev --name daily_checkins`; rename folder to `000N_daily_checkins`; author `down.sql`.
   **Prod (DB-first ordering):** apply `migration.sql` via `psql` → verify `\d daily_checkins` → `npx prisma migrate resolve
   --applied 000N_daily_checkins` → ONLY THEN deploy the checkin module. Never `migrate deploy` (drift protocol).
4. **checkin module** — service (upsert/list, **server-derived ICT date**, table-absent try/catch), controller (POST/GET),
   dto (validation incl. `soreness`/`note` maxlength), register in app.module. Compile: `cd api && npm run build`.
5. **Throttler proxy (RED TEAM FIX #15)** — `main.ts` trust-proxy + custom `getTracker` reading `CF-Connecting-IP`;
   verify per-user (not whole-app) rate limiting behind the tunnel.
6. **checkin-service.ts + use-daily-checkin.ts** — frontend API + hook (client sends NO authoritative date).
7. **daily-readiness-score.ts + tests** — penalty model; test each signal in isolation + graceful degradation
   (all-null → GREEN, no reasons); **RHR n≥7 min-sample guard** (n<7 → RHR ignored); **AMBER floor not ceiling**
   (RED still reachable with a bad signal); **missing activity → stale-sync state, not GREEN** (RED TEAM FIX #5,#12,#3).
8. **daily-recommendation-engine.ts + tests** — consume **orchestrator adjusted schedule + adjusted mafHr** (RED TEAM FIX #4);
   `isChild` (age<16) play-only branch (RED TEAM FIX #6); tier adjustments; **proportional warm/cool, mainMinutes≥5, all-easy<35**
   (RED TEAM FIX #13); **RED = REST or gentle WALK only, never a run**; BMI≥30 walk swap (guard double-swap). Test each tier + REST + child.
9. **adherence-analysis.ts + tests** — weekday matching (against ADJUSTED schedule) + status classification;
   ack/synced → done; absence not auto-missed until day closes (RED TEAM FIX #12).
10. **TodayCard + checkin-mini-form + adherence-strip** — VN UI; prominent/compact; last-sync line + "đã chạy" ack; child render.
11. **use-today-recommendation.ts** — run orchestrator, wire signals + stale-sync + ack; memoize.
12. **Mount** on dashboard-page + journal-page.
13. **Verify:** `npm run lint`, `npm test`, `cd api && npm run build`.

## VN Copy Samples

- Card title (GREEN, RUN): `Hôm nay: Chạy nhẹ nhàng 45 phút`
- HR zone line: `Giữ nhịp tim trong vùng MAF: {lower}–{upper} bpm (Chương 6)`
- Warm-up/cool-down: `Khởi động 15 phút + thả lỏng 15 phút (Chương 5)`
- AMBER adjustment: `Đã giảm còn 30 phút và chuyển sang đi bộ vì bạn báo đau bắp chân & ngủ chưa đủ.`
- RED rest: `Hôm nay nên NGHỈ. Nhịp tim nghỉ tăng +7 bpm — dấu hiệu cơ thể cần hồi phục (Chương 7).`
- Why block header: `Vì sao có gợi ý này?`
- Check-in prompt: `Sáng nay bạn thấy thế nào? (20 giây)` — fields `Chất lượng giấc ngủ`, `Mức độ mệt`, `Đau nhức?`
- REST minimal (P1): `Ngày nghỉ giúp cơ thể tái tạo mạnh hơn — "Tập luyện = Vận động + Nghỉ ngơi" (Chương 7).`
- Stale-sync prompt (RED TEAM FIX #12): `Chưa đồng bộ hoạt động hôm nay? Lần đồng bộ gần nhất: {lastSync}.`
- Manual ack button (RED TEAM FIX #12): `Tôi đã chạy hôm nay`
- RED gentle-walk option (RED TEAM FIX #13): `Nếu muốn vận động nhẹ: đi bộ thư giãn tối đa 30 phút, giữ nhịp tim dưới {mafLower} bpm — KHÔNG chạy.`
- Child (age<16) card (RED TEAM FIX #6): `Trẻ dưới 16 tuổi: hãy VUI CHƠI tự nhiên (chạy nhảy, bơi, đạp xe) — không theo lịch tập có cấu trúc.`

## Todo List

- [x] Extend `BookRef` union with CH6/CH7 in `maf-coaching-insights.ts` (FIX #14)
- [x] `local-today.ts` + tests (midnight boundary + client==server ICT parity, FIX #7)
- [x] `DailyCheckin` model (`onDelete: Cascade`) + migration (`0005_daily_checkins`) + `down.sql` (FIX #8, #11)
      — SQL generated via `prisma migrate diff` (no live DB in sandbox); NOT yet applied/verified against a DB
- [ ] Prod migration DB-first: apply SQL → verify → `migrate resolve` → THEN deploy code (FIX #8) — deployment step, out of scope for this implementation pass
- [x] `checkin` module (service/controller/dto, server-ICT date, table-absent guard) + app.module registration (FIX #7, #8)
- [x] Throttler trust-proxy + `CF-Connecting-IP` getTracker in `main.ts`/`app.module.ts` (FIX #15)
- [x] `checkin-service.ts` + `use-daily-checkin.ts` (no client authoritative date)
- [x] `daily-readiness-score.ts` + tests (RHR n≥7 guard, AMBER floor, missing-activity≠GREEN — FIX #3, #5, #12)
- [x] `daily-recommendation-engine.ts` + tests (orchestrator reuse, isChild branch, proportional warm/cool, RED=rest/walk — FIX #4, #6, #13)
- [x] `adherence-analysis.ts` + tests (ack/synced=done, absence not auto-missed — FIX #12)
- [x] `TodayCard` (+ last-sync/ack + child render) + `checkin-mini-form` + `adherence-strip`
- [x] `use-today-recommendation.ts` (run orchestrator, wire stale-sync/ack)
- [x] Mount on dashboard + journal
- [x] Lint + tests + api build green (see reports/fullstack-260714-phase01-impl.md for exact results)

## Success Criteria

- TodayCard shows correct workout for the local weekday on both pages; changing local time across midnight flips the day.
- **TodayCard workout == `/plan` workout for the same user** (probation/recovering/senior/beginner/high-BMI): identical
  adjusted mafHr + adjusted duration, because both consume the orchestrator (RED TEAM FIX #4).
- With zero Garmin + zero check-in (prod day-1), card still renders a GREEN default recommendation (no crash, no penalties, RED TEAM FIX #5).
- RHR signal with fewer than 7 baseline days is IGNORED (no RED/GREEN fabricated from n=1) (RED TEAM FIX #5).
- A synthetic `restingHr +7` (check-in primary, Garmin bonus) with n≥7 baseline yields RED + rest copy with Ch7 citation.
- **A probation/recovering user with a bad signal (RHR +7) reaches RED** — the AMBER floor does NOT block REST (RED TEAM FIX #3).
- RED never yields a run: only REST or a ≤30min gentle recovery WALK (RED TEAM FIX #13).
- A 45-min AMBER day (−35% → 30min) renders 30 all-easy main minutes, never 0 (RED TEAM FIX #13).
- `age < 16` renders the play-only child card (no HR zone, no workout) (RED TEAM FIX #6).
- Missing today's activity + stale sync surfaces the "đã chạy hôm nay?" prompt (NOT a silent GREEN/REST); ack marks the
  adherence day `done` (RED TEAM FIX #12).
- Soreness check-in yields RUN→WALK swap on a run day.
- Adherence strip marks a past run-day with matching StravaActivity as done; absence is not auto-`missed` until the day closes.
- Throttler rate-limits per real client IP (`CF-Connecting-IP`), not one shared bucket (RED TEAM FIX #15).
- Pure utils ≥90% coverage; `npm test`, `npm run lint`, `cd api && npm run build` all green.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **TodayCard contradicts /plan (FIX #4)** | High | High | Single engine: consume orchestrator adjusted schedule + adjusted mafHr; parity test TodayCard==/plan |
| Timezone/midnight bug (wrong day, FIX #7) | High | High | SERVER ICT is authoritative for keys; `local-today.ts` display-only; boundary + parity tests; fixed +07 |
| Prod migration drift breaks deploy (FIX #8) | Med | High | DB-first: apply SQL → verify → `migrate resolve` → then code; `down.sql`; table-absent try/catch guard |
| **Garmin ZERO on prod (FIX #5)** | High | Med | Check-in-first; Garmin bonus-only flag-gated; RHR n≥7 guard; day-1 works with zero data |
| **Minor gets a 45-min run (FIX #6)** | Low | High | `isChild` (age<16) branch mirrors `buildChildResult`; play-only card; no HR zone |
| Degenerate 0-min / RED-runs-anyway (FIX #13) | Med | Med | Proportional warm/cool, mainMinutes≥5, all-easy<35; RED = REST or gentle WALK only |
| Stale Strava → false GREEN / 2nd hard run (FIX #12) | Med | High | Last-sync line + "đã chạy" ack; absence ≠ rest/GREEN; ack marks done |
| Shared throttler bucket = whole-app DoS (FIX #15) | Med | Med | trust-proxy + `CF-Connecting-IP` getTracker; per-IP keying verified |
| Over-aggressive RED (annoys user) | Med | Med | RED only on `bad`-severity signal or multi-warn; always show "why" + gentle-walk option (never a run) |
| Readiness/engine coupling grows >200 LOC | Med | Low | Split score (signals) vs engine (workout); reason codes as the contract |

## Security Considerations

- All `checkin` routes behind `JwtAuthGuard`; queries `userId`-scoped (never trust client userId).
- DTO validation (class-validator) on sleep/fatigue/restingHr ranges + `soreness`/`note` maxlength; reject out-of-range.
- **RED TEAM FIX #11:** check-in vitals (restingHr, fatigue, sleep, soreness) are PII — `onDelete: Cascade` User relation
  ensures erasure; do NOT log full check-in rows (serializers exclude vitals from logs); retention follows the same
  policy as profile health data (see Phase 3 governance line).
- **RED TEAM FIX #7:** server derives the check-in date in ICT; client-sent dates are never trusted for the unique key.
- **RED TEAM FIX #15:** throttler keys on real client IP (`CF-Connecting-IP` via trust-proxy), else all users behind the
  Cloudflare Tunnel share one bucket (whole-app DoS + ineffective per-user limit). Rate-limit `POST /checkins`.

## Next Steps

- Phase 2 replaces REST minimal copy + injects pre/post-run + bài bổ trợ cards into TodayCard by day type + tier.
- Phase 3 adds health-condition flags that feed additional readiness clamps + safety card.
- Phase 4 wraps `DailyRecommendation` JSON in an AI narrative (structured input already designed for this).
