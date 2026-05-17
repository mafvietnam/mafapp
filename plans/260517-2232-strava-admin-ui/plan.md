---
title: "Strava Admin UI + Integration Fixes"
description: "Add admin management UI for Strava (settings + connection overview) mirroring Garmin pattern; fix scope, card visibility, frontend env wiring"
status: completed
priority: P1
effort: 1.5d
branch: dev
tags: [strava, admin, oauth, ui, fixes]
created: 2026-05-17
completed: 2026-05-18
related: [260407-1549-strava-integration, 260407-0745-garmin-integration, 260407-0004-admin-dashboard]
---

# Strava Admin UI + Integration Fixes

## Summary

Strava integration backend + user-facing card are built but admin has NO UI to manage credentials or monitor connections. Currently `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` live in `.env` only. This plan adds admin parity with Garmin (DB-backed settings, admin overview page, per-user sync) and bundles 3 known fixes.

**Approach:** Mirror Garmin patterns 1:1. Admin enters credentials in `/admin/settings`, monitors users in `/admin/strava`. Runtime config readers fall back to env vars so existing deployments keep working.

## Data Flow

```
Admin UI (/admin/settings)
  └─> POST /admin/settings/strava
        └─> AdminSettingsService.setMany({ "strava.*": ... })
              └─> AppSetting table (clientSecret encrypted AES-256)

StravaAuthService.getAuthorizationUrl()
  └─> AdminSettingsService.getByPrefix("strava")
        └─> fallback to ConfigService(env) if empty
              └─> https://strava.com/oauth/authorize?...

Admin UI (/admin/strava)
  └─> GET /admin/strava
        └─> AdminService.getStravaOverview()
              └─> StravaConnection.findMany() + activity counts

Admin UI [Sync button]
  └─> POST /admin/strava/:userId/sync
        └─> StravaSyncService.syncUser()
```

## Phases

| # | Phase | Key Deliverable | Effort | Status |
|---|-------|-----------------|--------|--------|
| 1 | [Backend — Settings, Endpoints, DB-backed Config](phase-01-backend-admin-endpoints.md) | AdminSettingsService strava keys; new admin endpoints; runtime config fallback | 0.5d | Completed |
| 2 | [Frontend Admin UI](phase-02-frontend-admin-ui.md) | Sidebar link, admin-strava-page, settings card, admin-service methods, route | 0.5d | Completed |
| 3 | [Fixes + E2E Verification](phase-03-fixes-and-test.md) | Hide card when disabled, scope check, VITE_FEATURE_STRAVA in docker, manual test | 0.5d | Completed (E2E deferred to staging) |

## Dependencies

- Phase 2 depends on Phase 1 (frontend calls new endpoints)
- Phase 3 independent — can run in parallel with Phase 2

## Env Vars Affected (no new ones)

| Variable | Status |
|----------|--------|
| `FEATURE_STRAVA` | Kept as env-only (boot-time module init) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Now optional in env — admin UI takes precedence |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Optional in env — admin UI takes precedence |
| ~~`STRAVA_ENCRYPTION_KEY`~~ | Removed (Validation S1) — Strava secrets are encrypted with `GARMIN_ENCRYPTION_KEY` via shared `GarminEncryptionService` in SharedModule |
| `VITE_FEATURE_STRAVA` | New: must be set at frontend build time (Phase 3) |

## Reference Files (read before implementing)

**Garmin admin pattern to mirror:**
- [api/src/admin/admin-settings.service.ts](../../api/src/admin/admin-settings.service.ts) — DEFAULTS, SECRET_KEYS, getGarminSettings
- [api/src/admin/admin.controller.ts](../../api/src/admin/admin.controller.ts) — endpoint shape lines 36-59
- [api/src/admin/admin.service.ts:129-182](../../api/src/admin/admin.service.ts) — getGarminOverview, triggerGarminSync
- [src/pages/admin/admin-garmin-page.tsx](../../src/pages/admin/admin-garmin-page.tsx) — overview UI
- [src/pages/admin/admin-settings-page.tsx](../../src/pages/admin/admin-settings-page.tsx) — settings form UI
- [src/services/admin-service.ts](../../src/services/admin-service.ts) — types + fetch wrappers

**Strava code to modify:**
- [api/src/strava/strava-auth.service.ts](../../api/src/strava/strava-auth.service.ts) — clientId/secret reader
- [api/src/strava/strava-webhook.service.ts:36-40](../../api/src/strava/strava-webhook.service.ts) — verifyToken/clientId/secret reader
- [src/components/strava-connect-card.tsx](../../src/components/strava-connect-card.tsx) — hide-when-disabled fix
- [docker-compose.yml:127](../../docker-compose.yml) — VITE_FEATURE_STRAVA

## Success Criteria

- Admin can enter Strava Client ID + Secret + Webhook Verify Token in `/admin/settings` and toggle Strava on/off
- **For credential rotation only** (post-bootstrap): stored credentials override env vars on next API call. First-time setup still requires env vars + redeploy because `StravaModule` is loaded conditionally on `FEATURE_STRAVA=true` at boot.
- `/admin/strava` shows feature status + connections table + per-user sync button
- Strava connect card hidden on profile when `FEATURE_STRAVA=false`
- `VITE_FEATURE_STRAVA=true` exposed to frontend container so MAF Lab auto-fill activates
- OAuth scope mismatch resolved (code asks `read,activity:read_all`; user authorizes both)
- E2E manual flow: connect → sync → activities listed in admin → disconnect

## Rollback

> 🔴 **RED TEAM #11 (High):** Phase 1 is NOT purely additive — it renames `AdminSettingsService` → `AppSettingsService`, moves the file across modules, and converts `StravaAuthService` methods sync→async. Rollback ordering matters.

**Mandatory ordering:**
1. **Pre-rollback check:** Verify `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` env vars are populated with current valid credentials. If admins migrated to DB-only, repopulate env from DB first.
2. **Revert code commits** (Phase 1 + Phase 2). Wait for deploy to settle.
3. **Verify OAuth end-to-end** — one Connect attempt + one webhook delivery.
4. **Only then** drop `strava.*` rows from `app_setting`.

**Mitigation:** Keep an alias export `export { AppSettingsService as AdminSettingsService }` for one release cycle so a partial revert doesn't break DI resolution.

- Phase 3: Surgical (3 small file edits). Per-file revert is safe.

## Reports

- Red Team Review (3 hostile reviewers: Security Adversary, Failure Mode Analyst, Assumption Destroyer) — findings recorded inline in phase files and summarized below.

## Red Team Review

### Session — 2026-05-17
**Findings:** 15 accepted (out of 32 raw findings after dedup) — 5 rejected
**Severity breakdown:** 7 Critical, 6 High, 2 Medium
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | StravaModule env-gated; admin UI cannot bootstrap | Critical | Accept | plan.md (Open Questions, Success Criteria) |
| 2 | OAuth state HMAC key = clientSecret → empty-key forgery + rotation breakage | Critical | Accept | phase-01 step 5 |
| 3 | OAuth state not bound to session → confused-deputy hijack | Critical | Accept | phase-01 step 5 |
| 4 | Sync→async cascade incomplete; getConnectUrl returns unawaited Promise | Critical | Accept | phase-01 step 5 |
| 5 | GarminEncryptionService coupling — SharedModule layering violation | Critical | Accept | phase-01 Key Insights + step 5 |
| 6 | FEATURE_STRAVA/strava.enabled split-brain; toggle is dead-weight | Critical | Accept | plan.md (Open Questions), phase-03 step 1 |
| 7 | Phase 3 destructive prod re-auth without backfill plan | Critical | Accept | phase-03 step 2 |
| 8 | Webhook verify-token rotation has no resubscribe | High | Accept | phase-01 step 6 |
| 9 | Admin sync fire-and-forget — no audit/UUID/idempotency | High | Accept | phase-01 step 2 + 3 |
| 10 | No DTO validation + String coercion holes | High | Accept | phase-01 step 2 |
| 11 | Rename + move + sync→async = NOT additive; rollback ordering wrong | High | Accept | plan.md Rollback, phase-01 step 5 |
| 12 | getStravaRuntimeConfig hits DB every call → webhook timeout risk | High | Accept | phase-01 step 1 |
| 13 | Privilege boundary erased — plaintext secrets to any SharedModule consumer | High | Accept (modified) | phase-01 step 1 |
| 14 | Status typed as `string`; backfillStatus JSX not explicitly removed | Medium | Accept | phase-02 step 1 + 3 |
| 15 | Dockerfile ARG stage ambiguous; BACKEND_URL fallback hardcodes prod URL | Medium | Accept | phase-01 step 1, phase-03 step 3 |

**Rejected findings (5):**
- Secret mask 4+4 leak (speculative; matches Garmin pattern)
- Webhook payload forgery / no HMAC on POSTs (pre-existing Strava protocol limitation; out of scope)
- Settings page extraction at 199 LOC unjustified (judgment call; both options valid)
- AppSetting concurrent admin writes race (single-admin reality; YAGNI)
- Zero test tasks (deferred to follow-up plan)

## Validation Log

### Session 1 — 2026-05-17
**Trigger:** Post-red-team validation interview before implementation kickoff
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture]** Red Team #2 introduced a stable HMAC key for OAuth state (decoupled from rotatable clientSecret). Where should this key live?
   - Options: Reuse STRAVA_ENCRYPTION_KEY (Recommended) | New STATE_SIGNING_KEY env var | Generate-and-store in DB on first boot
   - **Answer:** Reuse STRAVA_ENCRYPTION_KEY
   - **Rationale:** Zero new env vars; already mandatory; already 32 bytes; already stable. KISS — one secret, dual-purpose (AES + HMAC). Code comment required.

2. **[Scope]** Red Team #3 recommended adding PKCE (code_challenge/verifier). Include in this plan?
   - Options: Defer to follow-up plan (Recommended) | Include PKCE in this plan | Skip PKCE entirely
   - **Answer:** Defer to follow-up plan
   - **Rationale:** Session-bound nonce store + JWT-subject check already closes the confused-deputy hijack. PKCE is defense-in-depth, can ship separately. Reduces this plan's scope by ~0.5d.

3. **[Architecture]** Red Team #5: extract generic AppEncryptionService scope?
   - Options: Minimal — export GarminEncryptionService from SharedModule, keep name (Recommended) | Full rename + new APP_ENCRYPTION_KEY env | Two services (one per feature)
   - **Answer:** Minimal — move file to shared/, keep class name `GarminEncryptionService`
   - **Rationale:** Lowest risk to existing Garmin admin. Decouples from feature-flagged GarminModule. Cleanup-rename can happen in a follow-up plan. STRAVA_ENCRYPTION_KEY can be removed from plan (no longer relevant since shared service uses GARMIN_ENCRYPTION_KEY env).

4. **[Risk]** Red Team #8: webhook resubscribe-on-save behavior?
   - Options: Sync inside saveStravaSettings, surface result in API response (Recommended) | Async fire-and-forget | Manual button
   - **Answer:** Sync inside saveStravaSettings, surface result in API response
   - **Rationale:** Admin sees resubscribe success/failure immediately. 1-3s blocking on Strava API is acceptable for an admin-only endpoint. Prevents the silent-failure recurrence RT #8 was trying to fix.

#### Confirmed Decisions
- **OAuth state HMAC key:** reuse `STRAVA_ENCRYPTION_KEY` env (already mandatory, stable, 32 bytes). Document dual-purpose use in code comment.
- **PKCE:** defer to follow-up plan; ship session-bound nonce store now.
- **Encryption service:** move existing `GarminEncryptionService` to `SharedModule` (file path `api/src/shared/garmin-encryption.service.ts` or rename to a neutral path but **keep class name and key env**). Drop `STRAVA_ENCRYPTION_KEY` from env-vars table.
- **Webhook resubscribe:** synchronous in `saveStravaSettings`, result fields `webhookResubscribed` / `webhookResubscribeError` in response body.

#### Action Items
- [ ] Phase 1 step 5: update to reuse `STRAVA_ENCRYPTION_KEY` as HMAC signing key; remove references to `STATE_SIGNING_KEY`
- [ ] Phase 1: confirm `STRAVA_ENCRYPTION_KEY` remains a required env var (decryption key cannot self-store)
- [ ] Phase 1: drop PKCE tasks from todo list; add a follow-up note in "Next Steps" referencing a future plan
- [ ] Phase 1 Key Insights: simplify Red Team #5 resolution — file move only, no rename
- [ ] Plan.md env-vars table: remove `STRAVA_ENCRYPTION_KEY` row (now subsumed by Garmin's shared encryption key) — or keep with note "alias of GARMIN_ENCRYPTION_KEY"; clarify

#### Impact on Phases
- Phase 1: simplified — no new env var; smaller crypto refactor; PKCE removed
- Phase 2: unchanged
- Phase 3: unchanged

## Open Questions

> 🔴 **RED TEAM #1 (Critical):** `StravaModule` is conditionally registered in `app.module.ts:56` only when `process.env.FEATURE_STRAVA === 'true'`, AND Joi validation (lines 37-46) makes `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET`/`STRAVA_WEBHOOK_VERIFY_TOKEN`/`STRAVA_ENCRYPTION_KEY` REQUIRED when the flag is on. The plan's success criterion "Stored credentials override env vars on next API call (no restart needed)" is **unachievable with current architecture** — env must already contain valid values before server boot.
>
> **Resolution chosen:** Reframe the plan as **post-bootstrap config rotation**, not first-time setup. First-time setup still requires env vars + restart. Admin UI lets ops rotate credentials without redeploy (DB takes precedence on next call). Remove the misleading "no restart needed" claim from Success Criteria. Drop Joi `.required()` on the three Strava env vars so empty env is tolerated when DB has values; keep `STRAVA_ENCRYPTION_KEY` required (it's the decryption key, cannot be self-stored).

- Should `FEATURE_STRAVA` move from env to AppSetting too (like `garmin.enabled`)? **Decision:** No — `StravaWebhookService.onModuleInit()` runs at boot before DB is queryable; keep env. Admin toggle (`strava.enabled`) is a separate UI-only flag, used by frontend to hide card.

> 🔴 **RED TEAM #6 (Critical):** `strava.enabled` (DB) is described as "UI-only flag used by frontend to hide card" but **no frontend code in this plan reads it**. Phase 3 step 1 hides the card based on `getStravaStatus() === null` (HTTP 404 detection), which checks whether the StravaModule is loaded, NOT the admin toggle. Result: admin can toggle "Enabled" off, but users still see the card.
>
> **Resolution chosen:** Extend `/strava/status` to include `featureEnabled: cfg.enabled` (read from `getStravaRuntimeConfig`). Update `StravaConnectCard` in Phase 3 step 1 to hide when `status === null` OR `!status.featureEnabled`. Document the precedence: `FEATURE_STRAVA` env (backend wiring, boot-time) > `strava.enabled` DB (UI gate, runtime).
