# Phase 5 Frontend — Multi-provider AI + BYOK + Admin Budget

**Status:** DONE
**Date:** 2026-07-14
**Scope:** Frontend only (backend endpoints already live). No deploy, no commit/push, no prod touch.

## Summary

Implemented user BYOK key management (mounted on profile page) and admin AI settings/usage page,
mirroring existing Strava/Garmin patterns exactly. Fixed `use-coaching-narrative.ts` to treat both
`'byok'` and `'system'` sources as AI (was checking stale `'ai'` literal). All copy Vietnamese.

## Files Created

- `src/utils/ai-provider-validation.ts` (60 LOC) — pure provider metadata (labels, key-prefix
  hints) + `validateAiKeyInput()` light client-side pre-check mirroring backend
  `PREFIX_HINTS`/`MinLength(10)` (api/src/ai/user-ai-key.service.ts, dto). UX-only; backend
  remains source of truth.
- `src/utils/__tests__/ai-provider-validation.test.ts` (47 LOC, 9 tests) — pure-logic test,
  matches repo's existing precedent (all frontend tests are `src/utils/**/*.test.ts`; vitest
  config runs `environment: 'node'` with no jsdom, so no component tests exist anywhere in the
  repo — mirrored that convention rather than introducing a new pattern).
- `src/services/ai-key-service.ts` (63 LOC) — `getAiKeyStatus`/`setAiKey`/`deleteAiKey`, mirrors
  `garmin-service.ts` try/catch → null/safe style.
- `src/components/settings/ai-key-card.tsx` (196 LOC) — user BYOK card: provider `<select>`
  (OpenRouter/Anthropic/OpenAI/Gemini), `SecretInput` (reused from `components/admin/secret-input`,
  password-type, never pre-filled), Save/Delete, shows `source`/`usageThisMonth`/`quota`. Styled
  `desktop-card` to match `GarminConnectCard`/`StravaConnectCard`.
- `src/services/admin-ai-service.ts` (64 LOC) — `getAdminAiSettings`/`saveAdminAiSettings`/
  `getAdminAiUsage`. Split out of `admin-service.ts` rather than appended, mirroring the backend's
  own `admin-ai.service.ts` split out of `admin.service.ts` for the identical ">200 LOC" reason —
  `admin-service.ts` was already 231 LOC pre-Phase-5.
- `src/components/admin/ai-settings-card.tsx` (153 LOC) — mirrors `strava-settings-card.tsx`:
  enable toggle, OpenRouter key (`SecretInput`, masked display via backend's `mask()`), default
  model text input, per-user monthly quota number input.
- `src/components/admin/ai-usage-table.tsx` (60 LOC) — per-user usage table (name, email,
  used/quota), split out from the page component to keep it small.
- `src/pages/admin/admin-ai-page.tsx` (39 LOC) — mirrors `admin-strava-page.tsx` layout: header +
  `AiSettingsCard` + `AiUsageTable`.

## Files Modified

- `src/pages/profile-page.tsx` — added `<AiKeyCard />` under Connected Devices (Garmin/Strava),
  above Commitment section.
- `src/components/admin/admin-sidebar.tsx` — added "AI Coaching" nav entry (Sparkles icon) under
  "Tích hợp" section, route `/admin/ai`.
- `src/app.tsx` — imported `AdminAiPage`, registered `<Route path="/admin/ai" element={<AdminAiPage />} />`
  inside the existing `AdminProtectedRoute > AdminLayout` block (admin-role-gated, same as Strava/Garmin).
- `src/services/admin-service.ts` — added a 1-line pointer comment to the new `admin-ai-service.ts`
  (no functional change; net +3 LOC after trimming, 234 LOC total — pre-existing 231 LOC baseline).
- `src/services/coaching-service.ts` — widened `CoachingTodayResponse.source` from `'ai' | 'template'`
  to `'byok' | 'system' | 'template'` to match the live backend response shape
  (`coaching-response.dto.ts`).
- `src/hooks/use-coaching-narrative.ts` — widened `source` state type to match; fixed the AI-check
  from `result.source === 'ai'` (stale, never matches the real backend value) to
  `result.source === 'byok' || result.source === 'system'`. This is the fix requested in the task —
  `TodayCard` will now actually show the AI narrative paragraph once the backend returns `source:
  'byok'` or `'system'`.

## Backend Contract Verification

Read the live backend code (not just the spec) to confirm exact shapes before wiring the frontend:
- `api/src/ai/ai.controller.ts` — `GET/PUT/DELETE /ai/key`, `JwtAuthGuard`, PUT throttled 5/60s.
- `api/src/ai/user-ai-key.service.ts` — `UserAiKeyStatus` shape, `PREFIX_HINTS` regex per provider,
  `MinLength(10)` on the DTO.
- `api/src/admin/admin.controller.ts` — `GET/PUT /admin/ai/settings`, `GET /admin/ai/usage`.
- `api/src/admin/admin-ai.service.ts`, `api/src/admin/dto/ai-settings.dto.ts` — settings/usage
  response + request shapes.
- `api/src/shared/app-settings.service.ts` — `getAiSettings()` masked shape (`mask()` = first 4 +
  `••••` + last 4 chars, matches how `strava-settings-card.tsx` displays `clientSecret`).
- `api/src/coaching/coaching-response.dto.ts` — confirmed `source: 'byok' | 'system' | 'template'`
  is the real, already-shipped-to-repo type (also cross-checked `coaching.service.spec.ts` and
  `coaching-cache.service.ts` for the same values).

No deviation from the spec's documented contract — all endpoint paths/methods/response shapes
matched exactly.

## Where mounted

- BYOK card: `src/pages/profile-page.tsx`, rendered after `<StravaConnectCard />`.
- Admin page: `/admin/ai` route, sidebar entry "AI Coaching" under "Tích hợp", admin-role-gated via
  the existing `AdminProtectedRoute` (mirrors Strava/Garmin — no new guard logic needed).

## Tests Status

- **Type check / build:** `npm run build` → vite exit 0, 2426 modules transformed, no TS errors.
- **Unit tests:** `npx vitest run` → 21 files, 482 tests, all pass (9 new in
  `ai-provider-validation.test.ts`: empty key, whitespace-only, too-short, prefix-mismatch, valid
  key per all 4 providers, trim-before-validate).
- **Lint:** `npm run lint` → 4 errors / 25 warnings, all pre-existing in files not touched this
  phase (`maf-lab.tsx`, `strava-connect-card.tsx`, `admin-users-page.tsx`, `sso-callback-page.tsx`
  — all `react-hooks/set-state-in-effect`, pre-existing React-Compiler-rule violations unrelated to
  Phase 5). Zero new findings in any file created/modified this phase — verified with a scoped
  `eslint` run against exactly the touched file list before the full-repo run.

## Deviations / notes

- One self-caught issue during implementation: `ai-key-card.tsx`'s original effect used
  `refresh().finally(() => setLoading(false))` where `refresh` was a local function that itself
  called `setStatus`/`setProvider`. ESLint's `react-hooks/set-state-in-effect` rule flagged this
  (local-function state-setting calls invoked from an effect are traced; calls into imported/opaque
  service functions are not). Fixed by inlining an `async` IIFE with `await` directly in the effect
  (matches the exact working pattern already in `use-coaching-narrative.ts`), and kept a separate
  `loadStatus()` helper for post-mutation refreshes in `handleSave`/`handleDelete` (not inside an
  effect, so the rule doesn't apply there).
- `admin-service.ts` was already 231 LOC before this phase (pre-existing debt, not created here).
  Rather than append the ~55 LOC AI settings/usage block, split into a new `admin-ai-service.ts`
  — this both avoids growing an already-oversized file and mirrors the backend's own precedent
  (`admin-ai.service.ts` split from `admin.service.ts` for the identical reason, per its own doc
  comment).
- `profile-page.tsx` was already 250 LOC before this phase; +3 LOC for the `AiKeyCard` mount only.

## Unresolved

None. Spec's own "Unresolved (non-blocking)" items (OpenRouter default model id, where user
settings live) are both backend/product decisions already resolved by the shipped backend
(`ai.defaultModel` default `google/gemini-2.0-flash-001`, admin-configurable) and this
implementation (profile-page, per spec's own suggestion).
