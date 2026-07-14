# Phase 3 — Health-Condition Screening & Safety Advisor

## Context Links

- Source of truth: `../reports/brainstorm-260714-1229-daily-run-recommendation-maf.md` §5 Phase 3
- Special-population research: `research/researcher-01-maffetone-content-report.md` §5 (all LOW-CONFIDENCE — clearance only, no invented limits)
- Domain rules: `../../docs/MAF_RULES_SUMMARY.md` §2 (Ch6 medical clearance, Ch29 special populations, seniors 60+)
- Extends Phase 1: `daily-readiness-score.ts` (adds clamps), `daily-recommendation-engine.ts` (adds caps/gates)
- Reuse: existing `-5/-10` MAF adjustments (`use-maf-calculator.ts`, `maf-safety-adjustments.ts`), profile module
  (`api/src/profile/{profile.service,profile.dto}.ts`, `UserProfile` model)

## Overview

- **Priority:** P1
- **Status:** pending (depends on Phase 1)
- **Effort:** 2.5 days
- **Description:** Screening questionnaire captures structured `healthConditions` flags (CARDIOVASCULAR, HYPERTENSION,
  JOINT_ISSUES, extensible). Flags drive conservative auto-adjustments, doctor-clearance gates, and a pre-run safety
  card with danger signs. Screening → adjust → gate → warn only. NO diagnosis/treatment content.

## Key Insights

- Research is emphatic: NO published intensity ceilings for cardiac/hypertension. So the app MUST use
  **"medical clearance required" language, never invented HR limits** (legal + safety). Only conservative,
  already-sanctioned adjustments (existing −5/−10, duration caps, walk-first) apply.
- Reuse the existing senior (60+) pattern in MAF_RULES_SUMMARY §2 as the template for gating: force HEALTH commitment
  until clearance, cap duration, extend warm-up/cool-down. DRY — don't invent a parallel gate system.
- **RED TEAM FIX #9:** `healthConditions` is a STRICT server-side WHITELIST — `CARDIOVASCULAR | HYPERTENSION | JOINT_ISSUES`.
  REJECT unknown codes at WRITE (400), do NOT "accept unknown + silent-strip-on-read" (that destroys round-trip and lets junk
  in). Bounded array size (≤ number of known codes). Prisma enum array or a checked `String[]` validated against the whitelist.
- **RED TEAM FIX #3:** health flags set an AMBER **FLOOR** (minimum caution), NOT a ceiling. A flagged user with a bad readiness
  signal (e.g. cardiac + RHR spike) MUST still reach RED (rest). Severity RED>AMBER>GREEN; final = most-cautious(computed, floor).
  "Never exceeds AMBER" was inverted and dangerous — a cardiac user could never be told to REST. Fixed.
- **RED TEAM FIX #10:** safety gates cannot be client-only. The server ENFORCES the commitment gate for flagged/uncleared users
  (rejects elevated commitment at profile-write) and records a clearance AUDIT (`clearedAt` + who/when), not a bare self-attested
  boolean. Since `/plan` is client-computed, the server gate applies at profile-write AND any server recompute (Phase 4).
- **RED TEAM FIX #11:** health data governance — capture explicit CONSENT (flag + timestamp) before screening; `healthConditions`
  + check-in vitals are sensitive PII (retention/erasure policy); erasure cascades via User relations; profile serializer must
  NOT log sensitive fields (cardiac status, conditions) into request logs.
- This is the highest legal-exposure phase → persistent "app không thay thế bác sĩ" disclaimer everywhere flags are active.

## Requirements

### Functional
1. Extend `UserProfile` with `healthConditions` (WHITELIST enum codes — FIX #9) + `healthScreenedAt` +
   `healthConsentAt` (consent timestamp — FIX #11) + `clearedAt` (clearance audit timestamp — FIX #10) +
   `clearedBy`/method note (who/when).
2. Screening questionnaire UI (Ch6 clearance model + Ch29 special-pop model) → captures explicit CONSENT first,
   then sets whitelisted flags. No consent → no screening stored (FIX #11).
3. Rule effects: **server-enforced** doctor-clearance gate before schedule beyond HEALTH commitment when any flag set
   (reject elevated commitment at profile-write — FIX #10); conservative MAF adjustment (existing −5/−10); duration caps;
   walk-first for JOINT_ISSUES; extended 15/15. Health flag = AMBER FLOOR, RED still reachable (FIX #3).
4. Pre-run safety card for flagged users: danger-sign checklist (chest pain / dizziness / unusual breathlessness →
   STOP + seek help) + persistent disclaimer.

### Non-Functional
- No diagnosis/treatment text anywhere. Screening → adjustment → gate → warn ONLY.
- Reuse existing safety adjustment utils; new logic <200 LOC.
- All copy Vietnamese; danger-sign card visually distinct (danger styling).

## Architecture

### Data model

- `UserProfile.healthConditions String[]` (`@default([])`) — values constrained to the whitelist at write (FIX #9);
  `UserProfile.healthScreenedAt DateTime?`; `UserProfile.healthConsentAt DateTime?` (FIX #11);
  `UserProfile.clearedAt DateTime?` + `UserProfile.clearedBy String?` (clearance audit who/when — FIX #10).
- TS: `export enum HealthCondition { CARDIOVASCULAR = 'CARDIOVASCULAR', HYPERTENSION = 'HYPERTENSION', JOINT_ISSUES = 'JOINT_ISSUES' }`.
  The whitelist IS the enum — no "extensible unknown codes".
- **RED TEAM FIX #9:** `profile.dto.ts` validates `healthConditions` with `@IsEnum(HealthCondition, { each: true })` +
  `@ArrayMaxSize(3)` (bounded). `profile.service.ts` upsert persists ONLY whitelisted codes; **unknown code → 400 at WRITE**
  (never silent-strip-on-read). Round-trip is lossless.
- **RED TEAM FIX #11:** without `healthConsentAt`, screening data is not stored. Deleting a User cascades to profile
  (existing relation) — conditions + consent purged. Retention/erasure policy line added in Security Considerations.

### Screening flow (data flow)

```
Consent capture (UI) ──► Screening questionnaire ──► profile.upsert(consent, healthConditions[], screenedAt, clearedAt)
   (FIX #11: no consent, no store)                          │  (FIX #9: whitelist-validate, reject unknown 400)
                                                            │  (FIX #10: SERVER rejects elevated commitment if !clearance)
                    ┌───────────────────────────────────────┴───────────────────────┐
                    ▼                                                                ▼
   daily-readiness-score.ts (Phase 1)                          daily-recommendation-engine.ts (Phase 1)
   + health FLOOR: any flag → AMBER floor (min caution),       + commitment gate: any flag & !clearance → HEALTH-only
     RED still reachable on bad signal  [FIX #3]                + JOINT_ISSUES → RUN→WALK, extended warm-up/cool-down
   + CARDIOVASCULAR/HYPERTENSION → extra-caution reason code    + duration cap (mirror senior 90min / beginner 60min)
                    │                                                                │
                    └──────────────────────► TodayCard ◄─────────────────────────────┘
                                        │
                                        ▼
                          Pre-run safety card (danger signs + disclaimer)  [flagged users only]
```

### Rule effects (`src/utils/health-condition-rules.ts`, pure)

- **Input:** `{ healthConditions: HealthCondition[]; hasClearance: boolean /* derived from clearedAt */; age; commitment }`.
- **Output:** `HealthAdjustment = { forceHealthCommitment: boolean; requiresClearanceGate: boolean;
  tierFloor: 'AMBER' | null /* FIX #3: floor, not ceiling */; mafDelta: number /* reuse -5/-10, no new numbers */;
  durationCapMin: number | null; walkFirst: boolean; extendWarmCool: boolean; reasons: ReasonCode[]; needsSafetyCard: boolean }`.
- **Rules:**
  - Any flag AND `!hasClearance` → `forceHealthCommitment=true`, `requiresClearanceGate=true`. **FIX #10:** this gate is
    ENFORCED SERVER-SIDE at profile-write (reject commitment above HEALTH) — the client util is advisory only.
  - Any flag → `tierFloor='AMBER'` (FIX #3 — minimum caution; RED still applies if a bad readiness signal fires).
  - CARDIOVASCULAR or HYPERTENSION → `mafDelta` uses existing medicated/recovering −5/−10 (NO invented ceiling),
    `needsSafetyCard=true`, clearance gate.
  - JOINT_ISSUES → `walkFirst=true`, `extendWarmCool=true`, `durationCapMin` mirrors beginner cap.
  - Feed `HealthAdjustment` into Phase 1 readiness as a **floor** (`most-cautious(computedTier, tierFloor)`) + engine (cap/swap/gate).
- Reuse existing `maf-safety-adjustments.ts` for the −5/−10 math (DRY); this module only DECIDES which apply.

### UI

- `src/components/health/health-screening-form.tsx` — questionnaire (checkbox conditions + Ch6 clearance confirm),
  reachable from profile page. Writes via profile service.
- `src/components/today/safety-card.tsx` — danger-sign checklist + disclaimer; rendered in TodayCard when
  `needsSafetyCard`.
- Clearance gate surfaced in `/plan` + TodayCard: if `requiresClearanceGate`, show gate message instead of higher-commitment schedule.

## Related Code Files

### Create
- `src/utils/health-condition-rules.ts`
- `src/utils/__tests__/health-condition-rules.test.ts`
- `src/components/health/health-screening-form.tsx`
- `src/components/today/safety-card.tsx`
- `api/prisma/migrations/000N_profile_health_conditions/migration.sql`
- `api/prisma/migrations/000N_profile_health_conditions/down.sql` (rollback DDL — RED TEAM FIX #8)

### Modify
- `api/prisma/schema.prisma` (`UserProfile.healthConditions String[]`, `healthScreenedAt`, `healthConsentAt`, `clearedAt`, `clearedBy`)
- `api/src/profile/profile.dto.ts` (`@IsEnum(HealthCondition,{each:true})` + `@ArrayMaxSize(3)`; consent/clearance fields — FIX #9)
- `api/src/profile/profile.service.ts` (persist new fields; **server-enforce commitment gate** for flagged/uncleared — FIX #10;
  record `clearedAt`/`clearedBy` audit; **exclude sensitive health fields from any log/serializer** — FIX #11)
- `src/types.ts` (`HealthCondition` whitelist enum; extend `UserProfile` interface with consent/clearance fields)
- `src/pages/profile-page.tsx` (link/mount screening form)
- `src/utils/daily-readiness-score.ts` (apply health clamp)
- `src/utils/daily-recommendation-engine.ts` (apply cap/swap/gate)
- `src/components/today/today-card.tsx` (render safety-card when flagged)
- `src/content/safety.ts` (add danger-sign card content — created Phase 2)

### Delete
- None

## Implementation Steps

1. **Prisma + migration (RED TEAM FIX #8)** — add `healthConditions String[] @default([])`, `healthScreenedAt DateTime?`,
   `healthConsentAt DateTime?`, `clearedAt DateTime?`, `clearedBy String?`; `npx prisma migrate dev --name profile_health_conditions`;
   rename `000N_...`; author `down.sql`. **Prod (DB-first):** apply SQL via `psql` → verify columns (`\d "UserProfile"`) →
   `npx prisma migrate resolve --applied 000N_profile_health_conditions` → THEN deploy code. Postgres `text[]` default `'{}'` —
   verify manual SQL matches Prisma-generated DDL. Code guards column-absent during rollout.
2. **profile dto + service (FIX #9, #10, #11)** — validate `healthConditions` against whitelist enum (`@IsEnum each`,
   `@ArrayMaxSize`), **reject unknown code at write (400)** — no strip-on-read; server-enforce commitment gate for
   flagged/uncleared; record `clearedAt`/`clearedBy`; exclude sensitive fields from logs. `cd api && npm run build`.
3. `src/types.ts` — `HealthCondition` whitelist enum + `UserProfile` consent/clearance fields.
4. `health-condition-rules.ts` + tests — decision table per flag × clearance; emits `tierFloor='AMBER'` (FIX #3); reuse −5/−10 util.
5. Wire into `daily-readiness-score.ts` as a **floor** (`most-cautious(computed, tierFloor)`, RED reachable — FIX #3) + engine (cap/swap/gate).
6. `health-screening-form.tsx` — explicit CONSENT step first (FIX #11), then questionnaire; save via profile service (sets `healthConsentAt`).
7. `safety-card.tsx` + `safety.ts` danger-sign content; render in TodayCard when `needsSafetyCard`.
8. Clearance-gate message in `/plan` + TodayCard when `requiresClearanceGate`.
9. Verify: `npm run lint`, `npm test`, `cd api && npm run build`.

## VN Copy Samples

- Screening intro: `Vài câu hỏi sức khỏe giúp chúng tôi gợi ý an toàn hơn. Thông tin này KHÔNG thay thế chẩn đoán y tế.`
- Clearance gate: `Bạn có tình trạng sức khỏe cần lưu ý. Hãy tham khảo bác sĩ trước khi tăng khối lượng tập vượt mức Sức khỏe (HEALTH). (Chương 6)`
- Danger signs (safety card): `NGỪNG TẬP NGAY và tìm hỗ trợ y tế nếu bạn thấy: đau/tức ngực, chóng mặt, khó thở bất thường.`
- JOINT_ISSUES: `Ưu tiên đi bộ trước, khởi động & thả lỏng dài hơn để bảo vệ khớp. (Chương 29)`
- Persistent disclaimer: `Ứng dụng không thay thế bác sĩ. Luôn tham khảo chuyên gia y tế cho tình trạng của bạn.`

## Todo List

- [ ] Migration: `healthConditions` + `healthScreenedAt` + `healthConsentAt` + `clearedAt`/`clearedBy` + `down.sql` (FIX #8, #10, #11)
- [ ] Prod migration DB-first: apply SQL → verify → `migrate resolve` → THEN code (FIX #8)
- [ ] profile dto + service: whitelist validate + reject unknown at write; server-enforce gate; audit; no sensitive logging (FIX #9, #10, #11)
- [ ] `HealthCondition` whitelist enum + type extension
- [ ] `health-condition-rules.ts` + tests (emits AMBER `tierFloor`, FIX #3)
- [ ] Readiness FLOOR (RED reachable) + engine cap/swap/gate wiring (FIX #3)
- [ ] `health-screening-form.tsx` (consent step first — FIX #11) on profile page
- [ ] `safety-card.tsx` + danger-sign content
- [ ] Clearance gate in /plan + TodayCard (server-enforced source of truth, FIX #10)
- [ ] Owner review of safety/clearance copy (no diagnosis)
- [ ] Lint + tests + api build green

## Success Criteria

- Setting CARDIOVASCULAR flag without clearance forces HEALTH commitment (server-rejects higher commitment — FIX #10) +
  shows clearance gate + safety card; `clearedAt`/`clearedBy` recorded when clearance confirmed.
- JOINT_ISSUES yields walk-first + extended warm-up/cool-down + duration cap on the recommendation.
- **Flagged user's readiness has an AMBER FLOOR, and a bad signal (e.g. RHR +7) still escalates to RED (rest reachable)** (FIX #3).
- Posting an unknown `healthConditions` code returns 400 (not silently stripped); round-trip of valid codes is lossless (FIX #9).
- Screening without prior consent is not stored; `healthConsentAt` set on consent (FIX #11).
- Sensitive health fields never appear in request/response logs (FIX #11).
- No diagnosis/treatment strings present (copy review asserts clearance/warn language only).
- `health-condition-rules.ts` unit-tested per flag × clearance combination (incl. floor + RED-reachable case).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Inverted clamp blocks RED for cardiac user (FIX #3)** | Med | High | AMBER is a FLOOR not ceiling; `most-cautious(computed,floor)`; test proves RHR+7 → RED for flagged user |
| **Client-only gate bypassed (FIX #10)** | Med | High | Server enforces commitment gate at profile-write + recompute; `clearedAt`/`clearedBy` audit, not self-attest bool |
| **Unknown-code junk / lossy round-trip (FIX #9)** | Med | Med | Whitelist enum, reject unknown at write (400), bounded array; no strip-on-read |
| **Health PII leak / no erasure (FIX #11)** | Med | High | Consent flag+ts; cascade erasure via User; serializer excludes sensitive fields from logs |
| Invented medical intensity limits (legal) | Low | High | Clearance language only; no HR ceilings; owner copy review |
| `String[]` migration DDL mismatch on prod (FIX #8) | Med | High | DB-first apply→verify→resolve→code; hand-verify `text[] default '{}'` vs Prisma DDL; `down.sql` |
| Over-gating frustrates healthy users | Low | Med | Gate only when flag set AND clearance unconfirmed; clearance unlocks |
| Screening feels invasive | Med | Low | Optional, consent-gated, framed as safety-only, VN empathetic copy |

## Security Considerations

- Health data is sensitive PII — same `JwtAuthGuard` + `userId`-scoping; never expose another user's conditions.
- **RED TEAM FIX #9:** validate `healthConditions` against the server whitelist enum; reject unknown codes at WRITE (400);
  store codes only (no free-text medical notes); bounded array size.
- **RED TEAM FIX #10:** commitment gate + clearance are server-authoritative (not client-trusted); clearance recorded as an
  audited `clearedAt`/`clearedBy`, not a self-attested boolean.
- **RED TEAM FIX #11 (governance):** capture `healthConsentAt` before storing screening; classify `healthConditions` +
  check-in vitals as sensitive PII with a retention/erasure policy; erasure cascades via User→UserProfile relation;
  profile serializer/logger MUST exclude cardiac status + conditions from request logs.
- Persistent disclaimer prevents medical-advice misinterpretation (liability).

## Next Steps

- Phase 4 AI narrative MUST receive health flags as constraints and MUST NOT generate medical claims beyond the
  provided flags (system-prompt guardrail).
