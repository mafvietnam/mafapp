---
title: "Daily Run Recommendation — Plan↔Journal Sync"
description: "Deterministic daily 'hôm nay chạy gì?' engine syncing plan template + journal signals + check-in into a book-grounded TodayCard, with a thin AI narrative layer."
status: completed
priority: P1
effort: ~14-15 days
branch: dev
tags: [feature, frontend, backend, fullstack]
blockedBy: []
blocks: []
created: 2026-07-14
---

# Daily Run Recommendation — Plan↔Journal Sync

Sync the ephemeral `/plan` schedule with `/journal` activity + readiness signals into a daily
"hôm nay bạn nên chạy như thế nào" recommendation. Hybrid engine: **deterministic rule engine decides
every workout parameter** (safety-critical), **LLM only phrases the narrative** (Phase 4, optional).
All copy Vietnamese. Every recommendation shows its "why" + book-chapter citation. Source of truth:
`../reports/brainstorm-260714-1229-daily-run-recommendation-maf.md` (user-approved architecture).

## Architecture (one-line)

`readiness signals (journal + Garmin + check-in + profile) → daily-readiness-score (tier) →
daily-recommendation-engine (orchestrator adjusted schedule + adjusted mafHr + tier → structured DailyRecommendation) →
TodayCard (render) → [Phase 4] AI narrative wrapper (SERVER RECOMPUTES rec from server-owned data, LLM sees only structured fields; optional, cached, fallback = template)`

<!-- RED TEAM FIX #1: engine reuses orchestrator adjusted schedule (not raw template); Phase 4 AI layer recomputes server-side, never trusts client JSON. -->
<!-- RED TEAM FIX #7: SERVER (Asia/Ho_Chi_Minh) is the single source of "today"; client never sends the authoritative date. -->

**Trust boundary (locked):** the deterministic rule engine is the source of truth for every number/decision.
The engine runs on BOTH frontend (render) and server (Phase 4 AI recompute) via a shared pure-utils package
(`packages/maf-core` — see Phase 4). The LLM receives ONLY server-recomputed structured fields (numbers + enum
codes + citation ids), never client free text — closes the prompt-injection + un-gated-narration hole.

## Phases

| # | Phase | Status | Effort | Depends on |
|---|-------|--------|--------|-----------|
| 1 | [Today Recommendation Core](phase-01-today-recommendation-core.md) — readiness score, recommendation engine, `daily_checkins`, TodayCard | completed | 5d | — |
| 2 | [Content Library & Guidance](phase-02-content-library-guidance.md) — pre/post-run, bài bổ trợ, R.E.S.T cards, rule-based selection | completed | 2.5d | Phase 1 |
| 3 | [Health Screening & Safety Advisor](phase-03-health-screening-safety.md) — `healthConditions`, questionnaire, gates, safety card | completed | 3d | Phase 1 |
| 4 | [AI Narrative Layer](phase-04-ai-narrative-layer.md) — NestJS `coaching` module, server-local recompute port, Claude (server key), cache, fallback | completed | 4d | Phases 1-3 |
| 5 | [Multi-provider AI + BYOK + Admin Budget](phase-05-multi-provider-ai-byok.md) — OpenRouter backbone, user BYOK (AES), 30/mo quota, admin AI page | completed | ~4d | Phase 4 |

**Phase 5 shipped (prod SHA 1636a03, migration 0008_ai_keys_usage), AI still OFF (`ai.enabled=false` default).** E2E-verified: coaching no-regression (template), BYOK lifecycle (set/mask/resolve/delete + fake-key→template), validation 400, admin settings+usage, UI (BYOK card on /profile + /admin/ai). **To activate AI:** admin sets OpenRouter key + toggles Bật AI on /admin/ai (or a user adds their own BYOK key). Refinements shipped SHA 358c43f (PDF content + Garmin-labeled RHR).

**Post-1-4 additions (user-requested 2026-07-14):** (a) refinements — fill Phase 2 PDF content gaps via FREE local extraction (pypdf, non-profit cost) + RHR readiness labeled "Garmin device only" & hidden when absent; (b) Phase 5 above. Garmin API stays OFF (not yet approved).

**Shipped (all E2E-verified on prod app.maf.run):** P1 c96ba0e (migration 0005) · P2 7e2a3d8 · P3 9799f05 (migration 0006) · P4 338a5e4 (migration 0007, ships AI-OFF; enable with `ANTHROPIC_API_KEY` + `AI_COACHING_ENABLED=true`).
**Arch change from plan:** P4 used a server-LOCAL recompute port under `api/src/coaching/recompute/` (NOT `packages/maf-core` workspace extraction — that would break the separate frontend/api Docker build contexts). DRY debt noted in ported files.
**Follow-ups:** P4 recompute skips pace-test smart-long-run/volume-cap tuning (AI-narrated duration may differ slightly on those days; safety gating faithful); RHR baseline only from Garmin (dead on prod) — build from historical check-ins; garmin 404 console noise when Garmin off; 2 post-run nutrition content items are PDF-gap TODOs (need GEMINI_API_KEY); anti-stretching content pending owner sign-off.

<!-- RED TEAM FIX #1,#6,#7: Phase 1 +1d (server-date authority, child gate, orchestrator reuse, stale-strava ack). -->
<!-- RED TEAM FIX #3,#9,#10,#11: Phase 3 +0.5d (tier-floor, whitelist enum, clearance audit, consent/governance). -->
<!-- RED TEAM FIX #1,#2: Phase 4 +1.5d (packages/maf-core extraction + server recompute, SETNX single-flight, budget cap). -->

**Effort delta from red-team review:** Phase 1 4d→5d, Phase 3 2.5d→3d, Phase 4 2.5d→4d (shared-package extraction dominates).

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| Related (overlap) | [MAF Platform SP2-SP7](../260331-0121-maf-platform-sp2-sp7/plan.md) | pending |

Note: Phase 4 (AI narrative) supersedes part of SP2-SP7 `phase-08-sp7-ai-coaching` scope (server-key coaching
vs their BYOK sketch). No blocking either direction — if SP7 phase-08 ships first, Phase 4 reuses its module skeleton;
otherwise Phase 4 is self-contained. Reconcile at Phase 4 kickoff.

## Key Dependencies

- **Verified present** (no build needed): `GET /garmin/daily-summary` (api/src/garmin/garmin.controller.ts:89)
  + consumer `getGarminDailySummary` (src/services/garmin-service.ts:106). Redis (`api/src/shared/redis.service.ts`),
  ioredis, `@nestjs/config` already in stack.
- **Reuse (DRY):** `maf-activity-analysis.ts` (verdict, cardiacDrift, aerobicEfficiency), `journal-analytics.ts`
  (inZonePct, mafTrendSeries), `maf-coaching-insights.ts` (BookRef citation + tier pattern),
  `maf-schedule-generator.ts` (weekly template), `calculateRawMaf` (use-maf-calculator).
- **Prod risk (all migration phases):** Prisma history drifted from repo on prod — every new migration is
  applied to prod as **manual SQL + `prisma migrate resolve --applied <name>`**, never blind `migrate deploy`.
  Dev uses normal `prisma migrate dev`. Migration folders follow `000N_name` convention.
  <!-- RED TEAM FIX #8: THREE migrations, not two — Phase 1 `daily_checkins`, Phase 3 `profile_health_conditions`,
       Phase 4 `coaching_narrative_cache`. MANDATORY per-migration protocol (all phases):
       (a) apply SQL to prod BEFORE shipping code that reads/writes the table/column (else 500s during rollout gap);
       (b) verify object exists (`\d table` / column check) BEFORE `prisma migrate resolve --applied`;
       (c) provide down/rollback SQL in the migration folder (`down.sql`) for revert;
       (d) code guards table-absent during rollout (try/catch → template/empty, never 5xx). -->
- **Deploy ordering (locked):** DB-first, then code. Each migration phase ships in 2 steps: schema SQL to prod →
  verify → resolve → deploy code that uses it. Rollback = revert code first, then optional `down.sql`.
- **Decisions locked:** NO `training_plans` table (compute today from orchestrator output + weekday — YAGNI);
  morning check-in = ONE small `daily_checkins` table; AI last, server-side key, server-recomputed input, 1 gen/user/day
  cached (server-derived hash), MANDATORY budget cap + kill-switch, template fallback always on.
  <!-- RED TEAM FIX #4: "template + weekday" corrected → orchestrator adjusted output + weekday (engine must not
       desync from what /plan actually renders: safety caps, probation −30%, volume caps, adjusted mafHr). -->
  <!-- RED TEAM FIX #2: budget cap is MANDATORY (was "optional"); server-derived inputHash + SETNX single-flight lock. -->

## Success Criteria (feature-level)

- Dashboard + Journal render a TodayCard with today's workout (what / duration / HR zone / why + citation)
  in user-local TZ (Asia/Ho_Chi_Minh), degrading gracefully when Garmin/check-in data absent.
- Readiness tier + recommendation adjustments are pure, unit-tested (target ≥90% per existing utils convention).
- Zero uncontrolled advice: every parameter comes from the rule engine; AI never alters numbers and receives only
  server-recomputed structured fields (no client free text).
- TodayCard never contradicts `/plan` for probation/recovering/senior/beginner/high-BMI users (shared orchestrator output).
- Health-flagged users: AMBER is a conservative FLOOR; RED (rest) is always reachable (cardiac RHR spike → rest permitted).

## Red Team Review

### Session 2026-07-14 — 15 findings, ALL accepted

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|-----------|
| 1 | Phase 4 trust boundary: server MUST recompute rec from server-owned data, never trust client `DailyRecommendation` JSON (prompt-injection + un-gated narration). Extract pure MAF utils to shared `packages/maf-core`; LLM sees only structured fields | CRITICAL | Accept | Phase 4, Phase 1 |
| 2 | inputHash cost bypass: client-supplied hash → unbounded regen; budget "optional". Server-derived hash, MANDATORY budget cap, Redis SETNX single-flight, log/alert on breach, kill-switch `AI_COACHING_ENABLED` | CRITICAL | Accept | Phase 4 |
| 3 | Tier-clamp inverted: "never exceed AMBER" forbade RED → cardiac RHR spike could never REST. AMBER = conservative FLOOR, RED always permitted; severity RED>AMBER>GREEN; final = most-cautious(computed, floor) | CRITICAL | Accept | Phase 3, Phase 1 |
| 4 | Engine desyncs from /plan: plan indexed raw template + `calculateRawMaf` (omits probation −10); /plan renders via full orchestrator (safety caps, probation −30%, volume caps, adjusted mafHr). Reuse orchestrator output, then readiness deltas | CRITICAL | Accept | Phase 1 |
| 5 | Garmin dead on prod (`FEATURE_GARMIN=false`, MFA) → RHR/sleep/stress are ZERO data not sparse. Engine CHECK-IN-FIRST; Garmin bonus-only gated behind flag/presence; RHR baseline min-sample n≥7; day-1 works with zero data | CRITICAL | Accept | Phase 1 |
| 6 | Under-16 child gate missing: /plan short-circuits via `buildChildResult()`; daily engine would prescribe 45-min runs to minors. Add `isChild` (age<16) branch mirroring buildChildResult (play-only, no workout, no HR zone) | HIGH | Accept | Phase 1 |
| 7 | Timezone split-brain: frontend fixed +07, browser-TZ mondayOf, UTC Strava, unspecified cache-key TZ, client-sent check-in date. SERVER is single source of "today" (Asia/Ho_Chi_Minh); all date keys server-derived; client never sends authoritative date | HIGH | Accept | Phase 1, Phase 4 |
| 8 | Migration protocol incomplete (3 migrations not 2, no ordering/rollback/table-absent guard). Each migration: apply-SQL-before-code, verify-before-resolve, down/rollback SQL, code guards for table-absent | HIGH | Accept | Phase 1, Phase 3, Phase 4 |
| 9 | healthConditions validation self-contradiction ("accept unknown, strip on read" vs "validate"). Strict server-side WHITELIST enum, bounded array, reject unknown at WRITE (no silent-strip-on-read that destroys round-trip) | HIGH | Accept | Phase 3 |
| 10 | Safety gates client-only: readiness clamps/commitment gate/duration caps live only in frontend; clearance self-attested no audit. Server enforces commitment gate for flagged/uncleared; add `clearedAt` audit (who/when); gate at profile-write + server recompute | HIGH | Accept | Phase 3, Phase 4 |
| 11 | Health data governance: no consent/retention/erasure; CoachingNarrative no User relation; profile GET logs cardiac status. Consent flag+ts; cascade User relations; serializer must not log sensitive fields; classify vitals+conditions PII | HIGH | Accept | Phase 3, Phase 4, Phase 1 |
| 12 | Stale Strava → false GREEN: no prod webhook, sync lag; "missing signal = nothing" hides a hard morning run → 2nd hard session recommended, adherence "missed". Surface last-sync + "Chưa đồng bộ?" prompt; missing activity ≠ rest/GREEN; manual "tôi đã chạy hôm nay" ack | HIGH | Accept | Phase 1 |
| 13 | AMBER arithmetic degenerates (45min −35% −15−15 = 0 main min); <30min all-easy misses 30–35 band; RED "force REST or WALK" + risk table "chạy nhẹ" contradiction. Math never ≤0 main min; fix all-easy band; RED = REST or gentle recovery WALK only (never a run) | HIGH | Accept | Phase 1 |
| 14 | BookRef union lacks CH6/CH7 (is CH3\|CH4\|CH5\|CH8\|CH9); plan cites CH6/CH7 = compile error. Extend union; add `maf-coaching-insights.ts` to Phase 1 Modify list | MEDIUM | Accept | Phase 1 |
| 15 | ThrottlerGuard behind Cloudflare Tunnel keys on req.ip w/ no proxy trust → all users share one bucket (whole-app DoS). Configure trust proxy + `CF-Connecting-IP` for throttler keying | MEDIUM | Accept | Phase 1, Phase 4 |

### Adjudicated open-question decisions (baked in, autonomous)

- Check-in soreness shape → LOCK `soreness String?` (short tag) + `note String?` (KISS). [Phase 1]
- Cardiac-drift signal → use `inZonePct`/`mafTrendSeries` efficiency proxy (bulk activities only carry avgHeartRate);
  true per-activity drift needs `StravaActivityDetail` hydration (out of scope P1). [Phase 1]
- `MafAssistantCard` → RETAIN (TodayCard is prominent variant; MafAssistantCard stays until owner confirms removal). [Phase 1]
- Tunable constants (RHR window 14d but min n≥7, +5/+7 bpm, stress≥60, AMBER −35%) → documented placeholders,
  flagged for domain sign-off at implementation. [Phase 1]

## Validation Log

### Session 2026-07-14 — self-validation (autonomous run)

Plan is red-teamed (15/15 accepted) + internally consistent. No interactive interview (autonomous execution
per user directive). Two residual concerns from red-team application locked:

1. **`packages/maf-core` layout (Phase 4)** → DECISION: defer the workspace-vs-path-alias choice to a Phase 4
   kickoff spike. Default target = npm workspace package `@maf/core` importing the already-pure `src/utils/*` domain
   fns; fallback = server-side copy of the pure fns if workspace tooling fights the Docker build. NOT blocking Phase 1
   (Phase 1 utils stay in `src/utils/`; extraction happens only when Phase 4 needs server recompute).
2. **AMBER-floor `tierFloor` param (Phase 1↔3 contract)** → DECISION: `daily-readiness-score.ts` ships in Phase 1 with
   an optional `tierFloor?: 'AMBER'` param already in its signature (default undefined). Phase 1 sets it from
   `isProbation || isRecovering`; Phase 3 later also feeds health-condition flags into the same param — no signature
   change needed. Locked now to avoid a Phase 3 breaking change.

**Execution order (autonomous):** implement + test + ship Phase 1 first (the core "hôm nay chạy gì?"), E2E-verify on
prod, then Phases 2→3→4 in turn. Incremental ship matches the DB-first deploy topology and reduces risk per phase.
