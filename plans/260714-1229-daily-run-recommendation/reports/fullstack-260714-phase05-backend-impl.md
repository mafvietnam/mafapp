status: DONE

# Phase 5 Backend — Multi-provider AI + BYOK + Admin Budget

Backend-only implementation. No deploy, no commit/push, no prod touched, no real API keys used.

## Exact verification results

- `cd api && npm install` — added `openai@^6.46.0`. Exit 0. Pre-existing 18 audit vulns (unrelated to this change, not introduced by `openai`).
- `cd api && npm run build` (`nest build`) — **exit 0**, zero TS errors.
- `cd api && npx jest` — **318/318 tests pass**, 37 suites, 0 failures (baseline was 273 — net +45 after removing 6 old `claude-client.service.spec.ts` tests and adding new coverage).
- `cd api && npx eslint "src/ai/**/*.ts" "src/coaching/**/*.ts"` — **zero findings** (errors and warnings).
- `npx prisma generate` — regenerated client with `UserAiKey`/`AiUsage`/`AiProvider` types.

## Confirmations

- `ai.enabled=false` (ships-with default) → `AiProviderService.hasAiPath()` returns `false` when no BYOK key exists → `coaching.service.ts` skips the Redis lock/budget entirely and returns the template narrative — **zero behavior change from Phase 4**, verified by `coaching.service.spec.ts` "no AI path available" suite.
- BYOK path **bypasses quota entirely** — `generateWithByok()` never touches `AiUsage`; verified by `ai-provider.service.spec.ts` (`aiUsageUpsert` assertion `not.toHaveBeenCalled()`). A failed BYOK call returns `null` and does **not** fall through to the system tier (avoids silently spending the shared budget on a broken user key).
- System path **increments usage only on success** and **respects the monthly quota** (checked before the provider call via an upsert read, incremented via a second upsert only after a non-null narrative) — verified by 4 dedicated tests (under quota / at-quota / disabled / no-key).
- BYOK keys and the admin OpenRouter key are **AES-256-GCM encrypted at rest** (reusing `GarminEncryptionService`, no new cipher) and **never returned raw** — `GET /ai/key` never includes the key at all (only provider/hasKey/usage/quota/source); `GET /admin/ai/settings` masks `openRouterKey` via `AppSettingsService.mask()` (first4••••last4), mirroring Strava's `clientSecret` masking.
- Template fallback on **any** failure is preserved end-to-end: `AiProviderService.generateNarrative()` has an outer try/catch that never throws; `coaching.service.ts`'s `tryGenerateAiNarrative()` still wraps the whole generate+cache path in try/catch/finally exactly as Phase 4 did.
- Did **not** touch prod, did **not** commit/push, did **not** use any real provider key (all adapter tests mock the HTTP/SDK clients).

## Key design decision (flagged, non-blocking per spec's own "Unresolved" section)

The spec's literal "Key resolution" list scopes `ai.enabled` to step 2 ("system AI enabled") only — so I implemented `ai.enabled` as gating **only the system tier**, not BYOK. A user's own BYOK key works regardless of the admin switch. The Redis SETNX lock / daily-budget-counter guards (Phase 4's blanket safety net against request storms) still apply to **both** tiers, since the spec's parenthetical explicitly says those "still apply." Documented in `ai-provider.service.ts`'s file header.

Picked `google/gemini-2.0-flash-001` as the OpenRouter default model (cheapest of the two options flagged unresolved in the spec) — admin-configurable via `PUT /admin/ai/settings`.

## Files created

**Migration** (name: `0008_ai_keys_usage`):
- `api/prisma/migrations/0008_ai_keys_usage/migration.sql` — hand-authored from `prisma migrate diff --from-schema-datamodel ... --script` (no live dev DB reachable, same protocol as migrations 0006/0007). Creates `AiProvider` enum + `UserAiKey` + `AiUsage` tables, FKs `ON DELETE CASCADE`.
- `api/prisma/migrations/0008_ai_keys_usage/down.sql` — drops both tables + the enum.
- **Not yet applied to any DB.** Follow the DB-first protocol from Phase 4/prior migrations: apply SQL via `psql` → verify `\d "UserAiKey"` / `\d "AiUsage"` → `npx prisma migrate resolve --applied 0008_ai_keys_usage` → deploy code. All new services table-absent-guard (broad try/catch → treat as "no key"/"no usage", never 500) so the rollout gap is safe.

**New `api/src/ai/` module:**
- `ai-usage-date.util.ts` — `deriveIctYearMonth()`, server-ICT "YYYY-MM" (mirrors `checkin.service.ts` `deriveIctDate`).
- `ai-provider-types.ts` — shared types (`AiAdapterParams`, `AiGenerationResult`, `BYOK_DEFAULT_MODEL` map, `OPENROUTER_BASE_URL`).
- `adapters/openai-compatible-adapter.service.ts` + `.spec.ts` — `openai` SDK client, `baseURL` param covers OpenRouter (system + BYOK) and BYOK-OpenAI.
- `adapters/anthropic-adapter.service.ts` + `.spec.ts` — generalized from the deleted `coaching/claude-client.service.ts` (apiKey/model now per-call params, not env-sourced); BYOK-Anthropic only.
- `adapters/gemini-adapter.service.ts` + `.spec.ts` — thin `fetch`-based REST call to `generativelanguage.googleapis.com` (no new dependency); BYOK-Gemini only.
- `ai-provider.service.ts` + `.spec.ts` — the orchestrator (key resolution, quota, dispatch).
- `user-ai-key.service.ts` + `.spec.ts` — BYOK CRUD (encrypt/decrypt/mask/prefix-sanity-validate).
- `dto/user-ai-key.dto.ts` — `PUT /ai/key` validation.
- `ai.controller.ts` — `GET/PUT/DELETE /ai/key`.
- `ai.module.ts` — registers everything, exports `AiProviderService` for `CoachingModule`.

**New admin files:**
- `api/src/admin/admin-ai.service.ts` + `.spec.ts` — settings get/save + usage summary (split out of `admin.service.ts`, which was already >200 LOC).
- `api/src/admin/dto/ai-settings.dto.ts` — `PUT /admin/ai/settings` validation.

## Files modified

- `api/prisma/schema.prisma` — `AiProvider` enum, `UserAiKey`, `AiUsage` models, `User.aiKey`/`User.aiUsages` back-relations; widened `CoachingNarrative.source` doc comment (no column change — reused `String`).
- `api/package.json` / `package-lock.json` — added `openai@^6.46.0`.
- `api/src/shared/app-settings.service.ts` + `.spec.ts` — `ai.*` DEFAULTS, `ai.openRouterKey` added to `SECRET_KEYS`, `getAiSettings()` (masked), `getAiRuntimeConfig()` (30s-cached, decrypted, mirrors `getStravaRuntimeConfig`), cache invalidation on `ai.*` writes.
- `api/src/admin/admin.controller.ts` — `GET /admin/ai/settings`, `PUT /admin/ai/settings`, `GET /admin/ai/usage` (same `JwtAuthGuard, RolesGuard, @Roles('ADMIN')` as Strava).
- `api/src/admin/admin.module.ts` — registers `AdminAiService`.
- `api/src/coaching/coaching.service.ts` — replaced `ClaudeClientService` with `AiProviderService`; `tryGenerateAiNarrative` now does a cheap `hasAiPath()` pre-check (preserves the "zero Redis calls when AI is off" behavior) before lock/budget/generate; response `source` carries through the resolved tier.
- `api/src/coaching/coaching-cache.service.ts` + `.spec.ts` — `saveNarrative`/`getCached` now carry a `source: 'byok'|'system'` tag through both Redis and the DB row (reused the existing `String` column, no migration) so a cache HIT still reports the correct tier; legacy Phase-4 rows/entries (`source:'ai'` or missing) default to `'system'`.
- `api/src/coaching/coaching-response.dto.ts` — `source` widened `'ai'|'template'` → `'byok'|'system'|'template'`.
- `api/src/coaching/coaching.module.ts` — imports `AiModule` instead of providing `ClaudeClientService`.
- `api/src/coaching/coaching.service.spec.ts` — updated for the new `AiProviderService` dependency + tier-aware assertions.
- `api/src/app.module.ts` — registers `AiModule`; removed the now-dead `AI_COACHING_ENABLED`/`ANTHROPIC_API_KEY`/`AI_COACHING_MODEL` Joi env vars (superseded by DB-backed `ai.*` admin config); kept `AI_COACHING_DAILY_BUDGET` (infra-level safety net, unchanged).

## Files deleted

- `api/src/coaching/claude-client.service.ts` + `.spec.ts` — generalized into `api/src/ai/adapters/anthropic-adapter.service.ts` (apiKey/model became per-call params).

## API contract for the frontend agent

All responses are JSON. All endpoints below (except admin) require the existing JWT cookie auth (`JwtAuthGuard`); admin endpoints additionally require `RolesGuard` + `ADMIN` role (same as the Strava admin endpoints).

### `GET /ai/key` — masked BYOK status
```json
{
  "provider": "ANTHROPIC" | "OPENAI" | "OPENROUTER" | "GEMINI" | null,
  "hasKey": true,
  "source": "byok" | "system" | "none",
  "usageThisMonth": 4,
  "quota": 30
}
```
`source` is what a coaching request would actually resolve to right now (`byok` if the user has a key, else `system` if admin has it enabled+configured, else `none`). `usageThisMonth`/`quota` reflect the **system-tier** counter regardless of `source` (useful even for BYOK users to see the free allowance they're not using).

### `PUT /ai/key` — set/replace the caller's BYOK key
Request:
```json
{ "provider": "ANTHROPIC", "key": "sk-ant-..." }
```
Response: `{ "ok": true }` (200) or `400` with a validation message (empty key, key too short, or fails the provider prefix sanity check — e.g. an OpenAI-shaped key submitted as `provider: "ANTHROPIC"`). Prefix hints: `OPENROUTER` → `sk-or-`, `OPENAI` → `sk-`, `ANTHROPIC` → `sk-ant-`, `GEMINI` → `AIza`. The raw key is never echoed back anywhere.

### `DELETE /ai/key` — idempotent
Response: `{ "ok": true }` always (200), even if no key existed.

### `GET /admin/ai/settings` — masked (admin only)
```json
{
  "enabled": false,
  "openRouterKey": "sk-o••••mnop",
  "hasOpenRouterKey": true,
  "defaultModel": "google/gemini-2.0-flash-001",
  "defaultMonthlyQuota": 30
}
```

### `PUT /admin/ai/settings` — partial update (admin only)
Request (all fields optional):
```json
{
  "enabled": true,
  "openRouterKey": "sk-or-v1-...",
  "defaultModel": "google/gemini-2.0-flash-001",
  "defaultMonthlyQuota": 30
}
```
Response: `{ "ok": true }`. Setting `openRouterKey` to `""` clears it (mirrors Strava's `clientSecret` pattern).

### `GET /admin/ai/usage` — current server-ICT-month usage (admin only)
```json
{
  "yearMonth": "2026-07",
  "total": 87,
  "users": [
    { "userId": "uuid", "userName": "Alice", "userEmail": "a@x.com", "count": 12 }
  ]
}
```
Sorted by `count` descending. Only includes users who have consumed at least 1 system-tier generation this month.

### `GET /coaching/today` (Phase 4, unchanged shape — `source` enum widened)
```json
{
  "source": "byok" | "system" | "template",
  "narrative": "...",
  "recommendation": { ... } | null
}
```

## Env vars

**No new env vars required.** `GARMIN_ENCRYPTION_KEY` (already required — `api/.env`) is reused to encrypt both BYOK keys and the admin OpenRouter key; no separate `AI_ENCRYPTION_KEY`.

**Removed** (dead, no longer read by any code — replaced by DB-backed `ai.*` admin settings): `AI_COACHING_ENABLED`, `ANTHROPIC_API_KEY`, `AI_COACHING_MODEL`. These were only ever referenced from the deleted `coaching/claude-client.service.ts` and the old `coaching.service.ts` kill-switch check; the Joi validation schema in `app.module.ts` no longer declares them (they were never in `api/.env.example` to begin with, so no env file cleanup needed).

**Kept unchanged:** `AI_COACHING_DAILY_BUDGET` (default `2000`) — the global cross-tier Redis daily-generation-count safety net, still infra-level (not per-tenant), still applies to BYOK **and** system requests.

## Unresolved / flagged (non-blocking)

1. `ai.enabled` scoping decision (BYOK bypasses it) — see "Key design decision" above; flagged in case product intent was actually "global off switch blocks everything including BYOK." Easy one-line change in `ai-provider.service.ts` `generateWithByok`/`hasAiPath` if that's preferred.
2. Default OpenRouter model picked as `google/gemini-2.0-flash-001` (the spec flagged this as an open choice between that and `anthropic/claude-haiku-4.5`) — admin can change it any time via `PUT /admin/ai/settings`, zero code impact either way.
3. BYOK default models per native provider (used only when the user hasn't specified — currently no per-user model override exists, matching Phase 4's single-model design): Anthropic `claude-haiku-4-5-20251001`, OpenAI `gpt-4o-mini`, Gemini `gemini-2.0-flash`, OpenRouter-BYOK `google/gemini-2.0-flash-001`. If the frontend wants a user-facing model picker later, that's a small additive DTO change (`UserAiKey.model` column) — not built here (YAGNI, not in spec).
4. Frontend BYOK UI location ("profile-page vs dedicated settings page") — spec flagged as unresolved; out of scope for this backend-only task, left for the frontend agent.
