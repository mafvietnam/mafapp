# Phase 4 — AI Narrative Layer (Hybrid Completion)

## Context Links

- Source of truth: `../reports/brainstorm-260714-1229-daily-run-recommendation-maf.md` §5 Phase 4
- Overlap: `../260331-0121-maf-platform-sp2-sp7/phase-08-sp7-ai-coaching.md` (BYOK sketch — this phase supersedes with server-key)
- Consumes Phases 1-3: `DailyRecommendation` + `ReadinessResult` + `HealthAdjustment` + selected `GuidanceCard[]` (structured JSON)
- Infra present: `api/src/shared/redis.service.ts` (ioredis), `@nestjs/config`, module pattern (`garmin.module.ts`)

## Overview

- **Priority:** P1 (last — value-add polish, not correctness-critical)
- **Status:** pending (depends on Phases 1-3)
- **Effort:** 4 days (RED TEAM FIX #1 — `packages/maf-core` extraction + server recompute dominate the added scope)
- **Description:** NestJS `coaching` module **RECOMPUTES the recommendation server-side from server-owned data**
  (UserProfile + schedule template + signals) via a shared `packages/maf-core`, then wraps that structured output in a warm
  Vietnamese narrative via Claude (server-side key). AI phrases ONLY — it cannot alter any parameter, cites only provided
  sources, and receives ONLY server-recomputed structured fields (numbers + enum codes + citation ids), never client free text.
  Cached 1 generation/user/day (server-derived hash); template rendering (Phases 1-3) is the permanent fallback.

## Key Insights

- Hybrid boundary is the whole point: **rule engine = source of truth for every number/decision; LLM = tone only.**
- **RED TEAM FIX #1 (CRITICAL — trust boundary):** the server MUST NOT trust a client-sent `DailyRecommendation`. Free-text
  client fields (`title`, `reasons`, `adjustmentNote`) reaching Claude under the server key = prompt injection, and un-gated
  client recs would get AI-narrated. Therefore the server **RECOMPUTES** the recommendation from server-owned data
  (UserProfile + schedule template + readiness signals) and sends the LLM ONLY structured fields (numbers + enum codes +
  citation ids) — never client free text. This requires the pure MAF engine to run server-side.
- **RED TEAM FIX #1 (shared engine):** extract the pure domain utils into a shared package `packages/maf-core` (or have `api`
  import the pure `src/utils/*` domain fns) usable by BOTH the frontend (render) and NestJS (recompute). Pure = no React/DOM/IO.
  Candidates: `maf-calculator-orchestrator`, `maf-calculator-schedule-builder`, `maf-safety-adjustments`, `maf-schedule-generator`,
  `daily-readiness-score`, `daily-recommendation-engine`, `local-today`, `maf-coaching-insights` (BookRef). This is the YAGNI-reversal
  the original plan deferred — it is now mandatory for a sound trust boundary.
- Server-side key (not BYOK) — brainstorm rejected BYOK as ~0% VN adoption. Cost bounded by MANDATORY budget cap + 1/user/day cache + haiku-class model.
- Fallback is not optional: any AI error/timeout/kill-switch/budget → render the Phase 1-2 template output. AI is strictly additive.
- No Anthropic SDK in repo yet — add `@anthropic-ai/sdk` (or plain fetch to Messages API). Key + model + flags via env (validated in app.module Joi schema).

## Requirements

### Functional
1. NestJS `coaching` module: `POST /coaching/today` → `{ narrative: string, source: 'ai'|'template', cachedAt }`.
   Body carries NO recommendation params — only the auth context (userId from JWT). Server recomputes everything (FIX #1).
2. **Input = server-RECOMPUTED structured recommendation** (numbers + enum codes + citation ids) built via `packages/maf-core`
   from server-owned data; NEVER trust client-sent params or free text (FIX #1).
3. Claude call with constrained system prompt; VN output; no medical claims beyond provided flags.
4. Cache 1 generation/user/**server-ICT-day** (FIX #7); regenerate only when the **server-derived** inputHash changes (FIX #2).
5. Template fallback whenever AI unavailable (error, timeout, kill switch, budget). Budget cap is MANDATORY (FIX #2).
6. **RED TEAM FIX #2 (concurrency):** wrap generation in a Redis single-flight lock (`SETNX coaching:lock:{userId}:{date}`)
   so concurrent requests cannot double-spend or race the `@@unique` upsert (P2002). Log + alert on budget breach; kill-switch
   env flag `AI_COACHING_ENABLED` (a hard on/off distinct from the feature flag).
7. **RED TEAM FIX #10:** server-enforced health gate applies during recompute — an un-cleared flagged user's recompute yields
   the gated (HEALTH-capped) recommendation, so the AI narrates the SAFE rec, never an un-gated one.

### Non-Functional
- Cost guardrails: per-user daily cap enforced by cache; global kill switch env flag; haiku-class model.
- p95 added latency budget; on breach → fallback (never block TodayCard render — frontend shows template immediately, AI hydrates async).
- Module files <200 LOC; feature-flagged (`FEATURE_AI_COACHING`) like Garmin/Strava modules.

## Architecture

### Data flow

```
Frontend TodayCard renders template narrative IMMEDIATELY (Phases 1-2 output)
        │ (async, non-blocking; body has NO rec params)
        ▼
POST /coaching/today  ──►  coaching.controller (JwtAuthGuard, throttled per real IP [FIX #15])
        │
        ▼
coaching.service:
  1. RECOMPUTE DailyRecommendation server-side from server-owned data via packages/maf-core  [FIX #1]
     (UserProfile + template + signals; health gate applied [FIX #10]); NEVER trust client params
  2. localDate = SERVER ICT today  [FIX #7];  inputHash = hash(SERVER rec structured fields)  [FIX #2]
  3. cache lookup by (userId, localDate, inputHash) ───────────────►┌── Redis: coaching:{userId}:{ictDate}
        │ hit → return cached                                        │    value { narrative, inputHash, cachedAt }
        │ miss ▼                                                     └── + DB row (persist across Redis flush)
  4. kill switch (AI_COACHING_ENABLED=false)? OR budget exceeded? → template fallback (log+alert on breach [FIX #2])
  5. SETNX coaching:lock:{userId}:{ictDate}  [FIX #2 single-flight] → if held, return template (no double-spend)
  6. Claude Messages API (haiku), system prompt = constraints, user msg = STRUCTURED fields only (no free text)
        │ ok → validate output → cache (Redis + DB, release lock) → return { source:'ai' }
        │ error/timeout → release lock → return { source:'template' } (never throw to client)
        ▼
Frontend swaps template → AI narrative when response arrives
```

### System prompt constraints (hard guardrails)

- **Input is SERVER-recomputed structured fields ONLY** (numbers + enum codes + citation ids) — no client free text ever
  reaches the model (RED TEAM FIX #1 — closes prompt-injection). The serializer builds the user message from typed fields,
  not from any client-supplied string.
- MUST NOT change any number, duration, HR zone, tier, or day type — phrase only.
- MUST cite only the sources provided in input (book chapters / card citations); invent none.
- MUST output Vietnamese, warm/encouraging, ≤ ~120 words.
- MUST NOT give medical advice/diagnosis; may only restate provided health flags + clearance/danger-sign guidance verbatim-in-spirit.
- MUST NOT contradict the rest/adjustment decision.
- Output schema-validated (plain text; reject-to-fallback if it contains disallowed patterns, e.g. numeric HR not in input).

### Caching

- **Key:** `coaching:{userId}:{ictDate}` where `ictDate` = SERVER Asia/Ho_Chi_Minh date (RED TEAM FIX #7 — never client-sent),
  Redis + `CoachingNarrative` row for durability.
- **inputHash (RED TEAM FIX #2):** derived SERVER-SIDE from the server-recomputed structured fields ONLY — the client cannot
  mutate a byte to force regen. Client sends no hash.
- **Invalidation:** store `inputHash`; on request, if hash differs (new check-in/activity/health flag reflected in the SERVER
  recompute) → regenerate, else serve cached. Natural daily rollover via the ICT-date key.
- **Cost controls (RED TEAM FIX #2 — all MANDATORY):** (a) ≤1 successful generation/user/day unless server inputHash changes;
  (b) MANDATORY global daily budget cap — on breach → template fallback + log + alert; (c) Redis SETNX single-flight lock
  `coaching:lock:{userId}:{ictDate}` around generation to prevent concurrent double-spend and the `@@unique` upsert P2002 race;
  (d) kill-switch `AI_COACHING_ENABLED=false` → immediate template, zero API calls.

### Backend module

- `api/src/coaching/coaching.module.ts` (feature-flagged `FEATURE_AI_COACHING`), `coaching.controller.ts`,
  `coaching.service.ts` (recompute + lock + budget + cache + fallback), `claude-client.service.ts` (thin Anthropic wrapper),
  `coaching-prompt.ts` (system prompt + structured input serializer).
- **Recompute path (RED TEAM FIX #1 — DECISION REVERSED to (a)):** the Phase 1-3 pure utils must run server-side. Extract them
  into a shared **`packages/maf-core`** (pure TS, no React/DOM/IO) imported by BOTH the frontend and `api`. `coaching.service.ts`
  loads server-owned data (UserProfile, template, signals) and calls the SAME engine the frontend renders (orchestrator →
  readiness → recommendation), producing an authoritative structured rec. Option (b) "accept client rec + re-validate" is
  REJECTED: free-text client fields reaching Claude = prompt injection, and re-validation cannot sanitize narrative-bound free
  text. The shared-package refactor is no longer YAGNI — it is the trust boundary.
  - Extraction is mechanical (utils are already pure); the risk is import-path churn, mitigated by keeping public signatures stable.
  - Frontend continues to import the same functions from `packages/maf-core` (single source, DRY) — TodayCard and server agree by construction.

### Frontend

- `src/services/coaching-service.ts` — `getTodayNarrative()` (async, returns template-or-ai).
- `use-today-recommendation.ts` — render template narrative first; fetch AI narrative; swap on success (graceful, no spinner-block).

### Env / config (app.module Joi)

- `FEATURE_AI_COACHING` (default 'false'), `ANTHROPIC_API_KEY` (required when flag true),
  `AI_COACHING_MODEL` (default haiku-class id), `AI_COACHING_ENABLED` (kill-switch, default 'true' when flag on — FIX #2),
  `AI_COACHING_DAILY_BUDGET` (**MANDATORY** global cap — required, not optional; breach → fallback + alert — FIX #2).

## Related Code Files

### Create
- `packages/maf-core/` (RED TEAM FIX #1 — shared pure engine: orchestrator, schedule-builder, safety-adjustments,
  schedule-generator, daily-readiness-score, daily-recommendation-engine, local-today, BookRef; `package.json` + `tsconfig`)
- `api/src/coaching/coaching.module.ts`
- `api/src/coaching/coaching.controller.ts`
- `api/src/coaching/coaching.service.ts` (recompute via maf-core + SETNX lock + budget + cache + fallback)
- `api/src/coaching/claude-client.service.ts`
- `api/src/coaching/coaching-prompt.ts` (structured serializer — no client free text)
- `api/src/coaching/coaching.dto.ts`
- `api/prisma/migrations/000N_coaching_narrative_cache/migration.sql`
- `api/prisma/migrations/000N_coaching_narrative_cache/down.sql` (rollback DDL — RED TEAM FIX #8)
- `src/services/coaching-service.ts`

### Modify
- `packages/maf-core` migration of pure utils from `src/utils/*` (frontend re-imports from the package — DRY, single source)
- `api/prisma/schema.prisma` (`CoachingNarrative` cache model **with `user User @relation(onDelete: Cascade)`** — RED TEAM FIX #11)
- `api/src/app.module.ts` (import `CoachingModule` when flag; add Joi env vars incl. mandatory budget + kill-switch;
  throttler real-IP getTracker — RED TEAM FIX #15)
- `api/package.json` (add `@anthropic-ai/sdk` if used; add `packages/maf-core` dep)
- `package.json` / workspace config (register `packages/maf-core` workspace)
- `src/hooks/use-today-recommendation.ts` (async AI narrative swap; body sends no rec params)
- `src/components/today/today-card.tsx` (narrative slot: template default, AI hydrate)

### Delete
- None

## Implementation Steps

1. **`packages/maf-core` extraction (RED TEAM FIX #1 — do FIRST, gates everything)** — move the pure utils
   (orchestrator, schedule-builder, safety-adjustments, schedule-generator, daily-readiness-score, daily-recommendation-engine,
   local-today, BookRef) into a shared workspace package; repoint frontend imports; keep signatures stable.
   Verify frontend still builds + all Phase 1-3 tests pass (no behavior change) before touching the API.
2. **Prisma + migration (RED TEAM FIX #8, #11)** — `CoachingNarrative { id, userId, date @db.Date, inputHash, narrative,
   model, createdAt, updatedAt, @@unique([userId,date]) }` **with `user User @relation(fields:[userId], references:[id],
   onDelete: Cascade)`** + User back-relation. `migrate dev --name coaching_narrative_cache`; author `down.sql`.
   **Prod (DB-first):** apply SQL → verify `\d "CoachingNarrative"` → `migrate resolve` → THEN deploy code; table-absent guard.
3. **Env/config** — add Joi vars (mandatory budget + `AI_COACHING_ENABLED` kill-switch); `@anthropic-ai/sdk` dep (or fetch);
   throttler real-IP getTracker (`CF-Connecting-IP`) — RED TEAM FIX #15.
4. `coaching-prompt.ts` — system prompt (constraints) + **structured serializer** (server rec → typed fields, NO client free text — FIX #1).
5. `claude-client.service.ts` — thin wrapper: model, timeout, error → null (caller falls back).
6. `coaching.service.ts` — **RECOMPUTE via maf-core** (server-owned data, health gate applied — FIX #1, #10);
   server-ICT date + server inputHash (FIX #2, #7); **SETNX single-flight lock** + **mandatory budget check** (log+alert on breach)
   + kill-switch; Redis+DB cache; fallback (never throw). Handle P2002 upsert race behind the lock.
7. `coaching.controller.ts` + dto (`POST /coaching/today`, JwtAuthGuard, throttled per real IP; body carries NO rec params).
8. Register module (flagged) in app.module. `cd api && npm run build`.
9. `coaching-service.ts` (frontend) + wire async swap in `use-today-recommendation.ts` + TodayCard narrative slot.
10. **Guardrail tests:** structured-serializer shape (no free-text passthrough), recompute==frontend-engine parity,
    fallback-on-error, cache hit/miss, SETNX lock (concurrent → one gen), budget-breach → template, kill-switch → template.
    (Model call mocked — no live API in CI.)
11. Verify: `npm run lint`, `npm test`, `cd api && npm run build`.

## VN Copy Samples (template fallback — always available)

- Fallback narrative (GREEN run): `Hôm nay là ngày tốt để chạy nhẹ 45 phút trong vùng MAF {lower}–{upper} bpm. Khởi động 15 phút, giữ nhịp thở thoải mái, và thả lỏng 15 phút. Cứ chậm mà chắc!`
- AI system-prompt intent (EN, internal): "You rephrase a fixed training recommendation into warm Vietnamese. Never change numbers. Cite only provided chapters."

## Todo List

- [ ] **`packages/maf-core` extraction** — shared pure engine, frontend re-imports, no behavior change (FIX #1)
- [ ] `CoachingNarrative` cache migration + **User `onDelete: Cascade` relation** + `down.sql` (FIX #8, #11)
- [ ] Prod migration DB-first: apply SQL → verify → `migrate resolve` → THEN code (FIX #8)
- [ ] Env vars + Joi (mandatory budget + `AI_COACHING_ENABLED` kill-switch) + throttler real-IP + `@anthropic-ai/sdk` (FIX #2, #15)
- [ ] `coaching-prompt.ts` (constraints + **structured serializer, no client free text**, FIX #1)
- [ ] `claude-client.service.ts`
- [ ] `coaching.service.ts` (**server recompute via maf-core**, server hash/date, SETNX lock, mandatory budget, fallback — FIX #1, #2, #7, #10)
- [ ] `coaching.controller.ts` + dto (flagged, throttled per real IP; no rec params in body)
- [ ] Frontend `coaching-service.ts` + async narrative swap
- [ ] Guardrail + parity + lock + budget + cache + fallback tests (model mocked)
- [ ] Lint + tests + api build green

## Success Criteria

- **Server recompute == frontend engine** for the same user (parity test) — AI narrates the SAME numbers TodayCard shows (FIX #1).
- **Client-sent recommendation params are ignored** — a request with tampered/free-text rec fields cannot influence the prompt
  or the cache (server recomputes from server-owned data) (FIX #1).
- With `FEATURE_AI_COACHING=false` OR `AI_COACHING_ENABLED=false`, TodayCard shows the template — feature works, zero AI calls.
- With flag on, first request generates + caches; second same-day request with same server inputs is a cache hit (no API call).
- New check-in (changed SERVER inputHash) triggers exactly one regeneration; client cannot force regen by mutating a byte (FIX #2).
- Concurrent requests for the same user/day produce at most ONE generation (SETNX lock; no double-spend, no P2002) (FIX #2).
- Budget breach → template fallback + logged alert; never silent overspend (FIX #2).
- Cache key uses SERVER ICT date; client-sent dates are ignored (FIX #7).
- Deleting a User cascades and removes their `CoachingNarrative` rows (FIX #11).
- AI never emits a number absent from the input (validated → else fallback).
- Any Claude error/timeout returns template, never a 5xx to the client.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Prompt injection / un-gated narration via client JSON (FIX #1)** | Med | High | Server RECOMPUTES via maf-core; LLM gets structured fields only; no client free text ever in prompt |
| **Cost bypass via client hash / concurrent double-spend (FIX #2)** | Med | High | Server-derived hash; MANDATORY budget cap + alert; SETNX single-flight lock; kill-switch; haiku-class |
| AI alters/contradicts safety params | Med | High | Input = server structured fields; output validation rejects out-of-input numbers → fallback |
| Model latency blocks card | Med | Med | Template renders first; AI hydrates async; timeout → fallback |
| Medical claim hallucination | Low | High | System-prompt guardrail + only provided flags + owner spot-check of samples |
| **Shared-package extraction breaks frontend build (FIX #1)** | Med | Med | Mechanical move of already-pure utils; stable signatures; run full FE build+tests before touching API |
| **Cache-key TZ drift / User-relation orphan (FIX #7, #11, #8)** | Med | Med | Server ICT date key; `onDelete: Cascade`; DB-first migration + `down.sql` + table-absent guard |
| Overlap/conflict w/ SP7 phase-08 | Low | Low | Reconcile at kickoff; reuse their skeleton if merged first, else self-contained |

## Security Considerations

- `ANTHROPIC_API_KEY` server-side only (env, never shipped to client). Routes behind `JwtAuthGuard`, throttled per real IP
  (`CF-Connecting-IP` — RED TEAM FIX #15, else one shared bucket behind the tunnel).
- **RED TEAM FIX #1 (trust boundary):** the LLM prompt is built ONLY from server-recomputed structured fields; no client free
  text (title/reasons/adjustmentNote) is ever forwarded — closes prompt-injection and un-gated-narration.
- **RED TEAM FIX #2:** server-derived inputHash + SETNX single-flight + MANDATORY budget + kill-switch prevent client-driven
  cost bypass and concurrent double-spend; breaches logged/alerted.
- Never send other users' data; input scoped to authenticated `userId`; cache key uses server ICT date (FIX #7).
- **RED TEAM FIX #11:** `CoachingNarrative` has an `onDelete: Cascade` User relation (erasure); narrative stores no raw health
  notes — health flags are coded constraints only.

## Next Steps

- Post-ship: monitor cache hit rate, per-day cost, budget-breach + fallback rate, lock contention; tune model/prompt/budget.
- `packages/maf-core` becomes the single engine for any future server-side MAF need (webhooks, notifications, exports).

## Unresolved Questions

- Exact haiku-class model id + per-token budget number → confirm at implementation (env-config, not a redesign).
- Whether to reuse SP7 phase-08 module skeleton → decide at Phase 4 kickoff based on its merge status.
- `packages/maf-core` layout (npm workspace vs path alias) → confirm against the repo's existing build tooling at kickoff
  (extraction is mechanical either way).

<!-- RED TEAM FIX #1: prior "share pure utils = YAGNI" decision REVERSED — shared package is now mandatory (trust boundary). -->
<!-- RED TEAM FIX #2: prior "budget cap optional" REVERSED — budget cap is mandatory + SETNX single-flight added. -->
