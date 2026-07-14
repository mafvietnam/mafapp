# Phase 4 — AI Narrative Layer — Implementation Report

**Status:** DONE

## Architecture decision followed

Per the assignment's CRITICAL ARCHITECTURE DECISION, did **not** do the `packages/maf-core`
workspace refactor the phase spec sketched (frontend/api have separate Docker build
contexts — a shared workspace package would break that). Instead: a **server-local port**
of the pure recompute logic under `api/src/coaching/recompute/`, each ported file headed
with `SOURCE OF TRUTH: src/utils/<name>.ts — server-local port (DRY debt, reconcile if
logic changes)`. Frontend `src/utils/*` files were **not** touched.

### Disclosed simplification (today-schedule-basis.ts)

Full parity with the frontend's `maf-calculator-orchestrator.ts` +
`maf-calculator-schedule-builder.ts` (pace-test-driven smart-long-run scaling, weekly
volume-cap enforcement, pace-based warnings/Thursday cross-train swap) would have required
porting a much larger surface (`maf-logic.ts` barrel, `journal-analytics.ts` trend series,
etc.) — outside the "readiness + daily recommendation from profile/activities/checkin"
scope the assignment authorized. `today-schedule-basis.ts` instead ports the STATIC weekly
`SCHEDULES` template + the SAFETY-CRITICAL rules only (BMI joint-safety, newbie/senior
duration caps, recovering walk-conversion, probation volume cut) + the MAF-HR formula
(180-age + experience/recovery/probation deltas — this part IS exact parity, it's pure
arithmetic on UserProfile fields). Net effect: on a minority of days the AI-narrated total
minutes may differ slightly from what TodayCard renders (frontend applies extra
pace-test-driven volume tweaks this port skips). The safety-critical tier gating
(RED/AMBER, health-condition duration caps, "RED = REST-or-walk-only", health clearance
gate) is fully faithfully ported and always applied — this was the actual trust-boundary
requirement (RED TEAM FIX #1/#10), not byte-for-byte duration parity. Also omitted:
`trendSignal` (aerobic-efficiency drift, needs `journal-analytics.mafTrendSeries`) and
Garmin daily-summary signals (bonus-only; every signal degrades gracefully to `[]`
without them) — readiness composition is otherwise a verbatim port.

## Files created

**Migration**
- `api/prisma/migrations/0007_coaching_narrative_cache/migration.sql` + `down.sql`
  (hand-authored via `prisma migrate diff --from-schema-datamodel/--to-schema-datamodel`,
  no live dev DB reachable — same protocol as migration 0006)

**`api/src/coaching/` module**
- `coaching.module.ts` — registered **unconditionally** (unlike Garmin/Strava's
  feature-flagged registration) so `/coaching/today` always answers with the template
- `coaching.controller.ts` — `GET /coaching/today`, `JwtAuthGuard`, `@Throttle`
- `coaching.service.ts` — orchestration (recompute → cache lookup → gated AI generation → fallback)
- `coaching-repository.ts` — loads UserProfile/StravaActivity/DailyCheckin (server-owned data only)
- `coaching-cache.service.ts` — Redis + DB narrative cache (AI-sourced only)
- `coaching-lock-budget.service.ts` — SETNX single-flight lock + mandatory daily budget
- `claude-client.service.ts` — thin `@anthropic-ai/sdk` wrapper, errors → null
- `coaching-prompt.ts` — structured-only serializer + system prompt
- `coaching-narrative-validator.ts` — rejects any AI output with an invented number
- `template-narrative.ts` — deterministic VN fallback narrative
- `coaching-response.dto.ts` — response interface

**`api/src/coaching/recompute/`** (server-local pure port)
- `recompute-types.ts`, `daily-readiness-signals.ts`, `daily-readiness-score.ts`,
  `daily-recommendation-math.ts`, `daily-recommendation-health-adjust.ts`,
  `daily-recommendation-copy.ts`, `health-condition-rules.ts`,
  `daily-recommendation-helpers.ts`, `daily-recommendation-tier-builders.ts`,
  `daily-recommendation-engine.ts`, `today-schedule-basis.ts` (disclosed simplification,
  see above), `recompute.ts` (top-level composition)

**Tests** (all `*.spec.ts`, jest, Anthropic SDK mocked): one per file above, plus
`coaching.controller.spec.ts`, `coaching-repository.spec.ts` — 134 new tests, all pure
recompute logic + full service-flow branch coverage (kill-switch, no-key, cache-hit,
lock-contention, budget-breach, Claude-error, unsafe-output, success).

**Frontend**
- `src/services/coaching-service.ts` — `getTodayNarrative()`, try/catch → null (mirrors garmin-service.ts)
- `src/hooks/use-coaching-narrative.ts` — optional async hydration hook, split out to keep
  `use-today-recommendation.ts` under the LOC guideline

## Files modified
- `api/prisma/schema.prisma` — `CoachingNarrative` model (`onDelete: Cascade` on User relation) + back-relation
- `api/src/app.module.ts` — Joi env vars (`AI_COACHING_ENABLED` default `'false'`,
  `ANTHROPIC_API_KEY` default `''`, `AI_COACHING_MODEL`, `AI_COACHING_DAILY_BUDGET` default
  2000) + `CoachingModule` import. Throttler real-IP guard (`CfConnectingIpThrottlerGuard`)
  was already global from a prior phase — reused as-is, no change needed.
- `api/package.json` — added `@anthropic-ai/sdk@^0.111.0`
- `src/components/today/today-card.tsx` — narrative paragraph slot (renders only when
  `source==='ai'`, per the task's stated default — avoids duplicating reasons already
  shown by the template card)

## Verification results (exact)

- `cd api && npm install` — added 7 packages (incl. `@anthropic-ai/sdk`), 0 errors
- `cd api && npx prisma generate` — OK (CoachingNarrative types generated)
- `cd api && npm run build` — **exit 0**, no errors
- `cd api && npx jest` — **Test Suites: 32 passed, 32 total. Tests: 273 passed, 273 total**
  (139 pre-existing + 134 new; zero pre-existing tests modified/weakened)
- `cd api && npx eslint "src/coaching/**/*.ts"` — **zero findings**
- `npm run build` (vite) — **exit 0**
- `npx vitest run` — **Test Files: 20 passed. Tests: 464 passed** (unchanged from before this phase)
- `npm run lint` (frontend) — 29 pre-existing problems, **zero in files I created/modified**
  (`grep` confirmed no `coaching-service`/`use-coaching-narrative`/`today-card.tsx` hits)
- Coverage (`api/src/coaching/**`): **94.85% statements / 85.32% branch / 98.71% functions**
  — exceeds the ≥90% bar for ported pure logic; `coaching.module.ts`/`coaching.controller.ts`
  are trivial wiring (controller has 1 direct unit test; module untested, pure DI config)

## Correctness/safety confirmations

- **LLM input is structured-only**: `coaching-prompt.ts` `buildStructuredInput()` reads
  only `tier`, `dayType`, 4 numeric duration fields, `hrZone{lower,upper}`,
  `reasons[].code` (never `.text`), and `citations`. Verified by
  `coaching-prompt.spec.ts` — asserts the serialized JSON never contains a raw
  soreness free-tag or any VN prose (title/restCopy/adjustmentNote).
- **Server recomputes, never trusts a client rec**: `coaching.controller.ts`'s
  `GET /coaching/today` has no body/query surface at all —
  `CoachingService.getToday(userId: string)` has arity 1 (asserted in a test). The
  recommendation always comes from `recomputeDailyRecommendation()` fed by
  `CoachingRepository` reads of `UserProfile`/`StravaActivity`/`DailyCheckin`.
- **Budget cap + SETNX single-flight + kill-switch**: all present in
  `coaching-lock-budget.service.ts`, wired in `coaching.service.ts`'s
  `tryGenerateAiNarrative()` in order: kill-switch/key check → SETNX lock → budget
  reserve → Claude call → validate → cache. All three gates fail-CLOSED to template on
  any Redis error (never risks an uncoordinated spend).
- **Template fallback on AI-off AND on error**: `coaching.service.spec.ts` covers all 8
  branches (no profile, cache hit, kill-switch off, no key, lock lost, budget breached,
  Claude error, unsafe output) — every one resolves to `{source:'template', narrative:
  <non-empty VN string>}`, never throws.
- **Frontend does not regress when AI off**: `useCoachingNarrative` only sets `narrative`
  when `source==='ai'`; `today-card.tsx` only renders the extra paragraph when `narrative`
  is truthy. With the endpoint returning `template` (or erroring/absent), the card is
  byte-identical to pre-Phase-4 output. All 464 pre-existing frontend tests (which exercise
  the template-only path) pass unchanged.

## Env vars to ENABLE real AI

```
ANTHROPIC_API_KEY=sk-ant-...
AI_COACHING_ENABLED=true
AI_COACHING_DAILY_BUDGET=2000        # optional, defaults to 2000
AI_COACHING_MODEL=claude-haiku-4-5-20251001   # optional, this is already the default
```

With none of these set (fresh deploy), `GET /coaching/today` returns
`{source:'template', narrative:<deterministic VN sentence>, recommendation:{...}}` and
never errors — confirmed by the "kill-switch / missing key" describe block in
`coaching.service.spec.ts` (3 tests, all passing, zero Claude calls, zero Redis lock/budget
calls).

## Did NOT

- Touch prod (no `migrate deploy`, no SSH, no `.env` on any server)
- `git commit` or `git push`
- Require a real `ANTHROPIC_API_KEY` for any test (Anthropic SDK is `jest.mock()`'d)
- Modify any `src/utils/*` domain-logic file (frontend untouched, zero build risk there)
- Modify any file outside my ownership scope — an earlier `npm run lint --fix` pass
  incidentally reformatted 28 unrelated pre-existing api files (whitespace-only, verified
  via diff); all were reverted via `git checkout --` before finishing

## Prod migration protocol (DB-first, do NOT run yet)

1. `psql` — apply `api/prisma/migrations/0007_coaching_narrative_cache/migration.sql`
2. Verify: `\d "CoachingNarrative"` shows the table + FK + both indexes
3. `npx prisma migrate resolve --applied 0007_coaching_narrative_cache`
4. Deploy code (module already table-absent-guarded — safe even if step 1-3 are delayed;
   `coaching-cache.service.ts` soft-fails DB reads/writes to a no-op template-serving state)
5. Leave `AI_COACHING_ENABLED` unset/`false` and `ANTHROPIC_API_KEY` unset until ready —
   the feature is a strict zero-risk no-op until both are set

## Unresolved questions

- Exact `AI_COACHING_DAILY_BUDGET` production number — defaulted to 2000/day per the
  phase spec's "e.g." example; owner should confirm before enabling.
- `today-schedule-basis.ts`'s disclosed duration-parity gap (see above) — acceptable for
  this P1 polish phase per my judgment call, but flagging for owner awareness; a future
  phase could close it by porting the smart-long-run/volume-cap logic too if exact
  duration-number parity between TodayCard and the AI narrative becomes a requirement.
