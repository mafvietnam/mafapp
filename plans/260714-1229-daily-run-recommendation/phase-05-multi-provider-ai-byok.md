# Phase 5 — Multi-provider AI + BYOK + Admin Budget

## Context
Extends Phase 4 (which shipped a single-provider Claude coaching module, AI-OFF). Non-profit → cost-optimized.
User-confirmed decisions (2026-07-14):
- **Provider arch:** OpenRouter as the SYSTEM backbone (one OpenAI-compatible API covers Claude/OpenAI/Gemini/…).
  User BYOK: user supplies their own key (OpenRouter OR native Anthropic/OpenAI/Gemini).
- **Free tier quota:** default **30 generations/user/month** on the system key (admin-configurable at runtime).
- **Admin:** full admin UI page + runtime config (set OpenRouter key, default model, per-user monthly quota, view usage).
- **BYOK key storage:** AES-256-GCM server-side (mirror the existing Strava/Garmin encryption).

## Key resolution (per request)
1. If user has a stored, valid BYOK key → use it (unlimited, their cost). No quota consumed.
2. Else if system AI enabled + admin OpenRouter key set + user's monthly usage < quota → use system OpenRouter key; increment usage.
3. Else → **template fallback** (Phase 4 already guarantees this; never error).
(All Phase 4 guards still apply: kill-switch, cache, SETNX single-flight, global daily budget.)

## Reuse (grounded in codebase — mirror, don't reinvent)
- **Admin config store:** `api/src/shared/app-settings.service.ts` (`AppSetting` table, auto-encrypts SECRET_KEYS,
  prefix queries, masked getters, 30s runtime-config cache). ADD `ai.*` keys — NO new admin-config table:
  `ai.enabled`, `ai.openRouterKey` (SECRET), `ai.defaultModel` (e.g. `anthropic/claude-haiku-4.5` or
  `google/gemini-2.0-flash`), `ai.defaultMonthlyQuota` (`30`). Add `getAiSettings()` (masked) + `getAiRuntimeConfig()`
  (cached, decrypted) mirroring `getStravaSettings`/`getStravaRuntimeConfig`; add secret key to `SECRET_KEYS`.
- **Encryption:** mirror `api/src/shared/garmin-encryption.service.ts` / `strava-encryption.service.ts` (AES-256-GCM)
  for BYOK keys. Reuse the same ENCRYPTION_KEY env or the existing service.
- **Admin backend:** `api/src/admin/{admin.controller,admin-settings.service}.ts` + `dto/strava-settings.dto.ts` — mirror
  for `dto/ai-settings.dto.ts` + admin AI endpoints (GET masked settings, PUT settings incl. usage summary).
- **Admin frontend:** `src/pages/admin/admin-strava-page.tsx` + `src/components/admin/strava-settings-card.tsx` +
  `admin-sidebar.tsx` — mirror → `admin-ai-page.tsx` + `ai-settings-card.tsx` + sidebar entry + route.
- **Phase 4 integration:** `api/src/coaching/claude-client.service.ts` → generalize into a provider call behind
  `AiProviderService`; `coaching.service.ts` calls the provider service (which does key-resolution + quota).
  OpenRouter + OpenAI + BYOK-openai use ONE OpenAI-compatible client (`openai` npm SDK, configurable `baseURL`
  = `https://openrouter.ai/api/v1` for OpenRouter). Anthropic BYOK reuses `@anthropic-ai/sdk` (already a dep).
  Gemini BYOK via REST (`generativelanguage.googleapis.com`) or `@google/genai` — keep thin, fetch-based OK.

## New DB (migration `0008_ai_keys_usage`)
- `UserAiKey { id, userId (FK Cascade), provider (enum OPENROUTER|ANTHROPIC|OPENAI|GEMINI), encryptedKey Text,
  createdAt, updatedAt, @@unique([userId]) }` — one active BYOK key per user (provider + key). Encrypted at rest.
- `AiUsage { id, userId (FK Cascade), yearMonth (e.g. '2026-07'), count Int, @@unique([userId, yearMonth]) }` —
  system-tier monthly usage counter (BYOK requests don't increment). Admin reads aggregate for the usage view.
- Follow the DB-first prod protocol (apply SQL → verify → `migrate resolve` → deploy code); author `down.sql`;
  table-absent try/catch guards.

## Endpoints
- **User BYOK** (`JwtAuthGuard`): `GET /ai/key` (masked status: provider + hasKey + this month's usage + quota +
  source 'byok'|'system'), `PUT /ai/key` (set provider + key — validated, encrypted), `DELETE /ai/key`.
- **Admin** (admin-guarded, mirror Strava admin): `GET /admin/ai/settings` (masked), `PUT /admin/ai/settings`
  (enabled, openRouterKey, defaultModel, defaultMonthlyQuota), `GET /admin/ai/usage` (per-user + totals this month).
- Coaching `GET /coaching/today` (Phase 4) now resolves key via `AiProviderService`; response `source` gains
  `'byok'` vs `'system'` vs `'template'` (or keep `ai|template` + a `provider` field — impl choice).

## Frontend
- **User BYOK UI:** a settings section (find where user settings live — likely profile-page or a settings page;
  if none, add a small `src/components/settings/ai-key-card.tsx` surfaced on the profile page). Provider dropdown
  (OpenRouter/Anthropic/OpenAI/Gemini) + key input (masked, never echoed back) + save/delete + shows remaining
  free quota this month. VN copy. `src/services/ai-key-service.ts` (try/catch → null style).
- **Admin AI page:** mirror `admin-strava-page.tsx` — `ai-settings-card.tsx` (enable toggle, OpenRouter key masked
  input, default model, per-user monthly quota) + a small usage table (user, used/quota). Sidebar + route.

## Constraints
- All UI copy Vietnamese. YAGNI/KISS/DRY (mirror existing patterns hard). Files <200 LOC.
- Secrets: never return raw keys to client (mask like `AppSettingsService.mask`); never log keys.
- Encrypted at rest (AES-256-GCM). BYOK key validated (non-empty, provider-appropriate prefix check is enough).
- Template fallback ALWAYS (inherit Phase 4). Ships with `ai.enabled=false` default → no behavior change until admin configures.
- Do NOT weaken existing tests (464 frontend + 273 api).

## Todo
- [ ] Migration `0008_ai_keys_usage` (UserAiKey + AiUsage + User back-relations, cascade) + down.sql
- [ ] AES BYOK key encrypt/decrypt (reuse existing encryption service)
- [ ] `AppSettingsService` ai.* keys + getAiSettings/getAiRuntimeConfig + SECRET_KEYS
- [ ] `AiProviderService` — OpenAI-compatible client (OpenRouter/OpenAI) + Anthropic + Gemini adapters; key-resolution + monthly-quota
- [ ] Integrate into `coaching.service` (replace direct claude-client)
- [ ] User `ai` module (GET/PUT/DELETE /ai/key) + usage read
- [ ] Admin AI endpoints (settings + usage) mirroring Strava admin
- [ ] Frontend: user BYOK card + service; admin AI page + card + sidebar + route
- [ ] Tests (provider resolution, quota, encryption round-trip, template fallback); build + lint green
- [ ] Deploy DB-first + E2E

## Success criteria
- `ai.enabled=false` (default) → coaching unchanged (template), zero regression.
- Admin sets OpenRouter key + enables → system tier works; a user under quota gets AI narrative (`source: system`),
  usage increments; over quota → template.
- User adds a BYOK key → unlimited (`source: byok`), no quota consumed; key stored encrypted, never echoed.
- Admin usage view shows per-user monthly counts.

## Unresolved (flag, non-blocking)
- Exact OpenRouter default model id (cheap): `anthropic/claude-haiku-4.5` vs `google/gemini-2.0-flash-001` — admin-configurable, pick a cheap default.
- Where user settings live in the frontend (profile-page vs dedicated settings page) — confirm at impl.
