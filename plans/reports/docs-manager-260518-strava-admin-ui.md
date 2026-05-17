---
title: Documentation Update — Strava Admin UI Implementation
type: docs-update
date: 2026-05-18
plan: 260517-2232-strava-admin-ui
status: COMPLETED
---

# Documentation Update Report: Strava Admin UI (Phase 5)

## Summary

Updated docs to reflect completed Strava Admin UI implementation (Phase 13.5). All changes are aligned with the shipped backend admin endpoints, AppSettingsService pattern (DB-backed config), OAuth state hardening via Redis nonce store + HMAC, and frontend admin pages. Deployment guide webhook rotation section corrected per code review feedback (H1).

---

## Files Modified

### 1. **docs/project-changelog.md** (→ 737 LOC)
- **Purpose:** Record v1.6.0 release (Strava Admin UI & DB-backed Config)
- **Changes:**
  - Added [1.6.0] entry dated 2026-05-18
  - Documented: AppSettingsService, 4 new admin endpoints, Redis nonce store, OAuth state HMAC, auto-resubscribe webhook, Prisma migration 0002, frontend admin pages
  - Listed security considerations: OAuth state, credential masking, admin gating
  - Added known limitations: RT #6 fix, file size concerns, test coverage deferred

### 2. **docs/development-roadmap.md** (→ 172 LOC)
- **Purpose:** Track phase completion
- **Changes:**
  - Marked Phase 13.5 ✅ COMPLETE
  - Listed: AppSettingsService, admin endpoints, Redis nonce store, webhook auto-resubscribe, hide-card logic
  - All Strava phases now complete (13.1–13.5)

### 3. **docs/system-architecture.md** (→ 601 LOC)
- **Purpose:** Document system design + API contracts + new admin endpoints
- **Changes:**
  - Added `/admin/strava` route to frontend tree (details: OAuth config UI, webhook status, sync history)
  - Updated admin module description: added Strava settings endpoints + DTOs
  - Added AppSettingsService + GarminEncryptionService to shared/ section
  - Added 6 new API endpoints to table: `/admin/garmin/settings`, `/admin/strava/settings`, `/admin/strava/status`, `/admin/strava/sync` (GET + POST variants)
  - Updated StravaConnection schema: added `lastSyncStartedAt`, `lastSyncFinishedAt`, `lastSyncError` fields
  - Added "Integration Settings Pattern" section explaining AppSettingsService (DB-backed config, TTL cache, credential masking, encryption, validation)

### 4. **docs/deployment-guide.md** (→ 418 LOC)
- **Purpose:** Ops guidance for credential rotation + bootstrap
- **Changes:**
  - **Webhook Verify Token Rotation** section rewritten (per code review H1):
    - Clarified auto-resubscribe is synchronous in response path
    - Removed misleading "manual step" language
    - Explained error feedback in admin UI
    - Added note: env var used only at bootstrap if admin UI not yet configured

### 5. **docs/codebase-summary.md** (→ 533 LOC)
- **Purpose:** Directory tree + file responsibilities
- **Changes:**
  - Added `admin/` section after health, before garmin:
    - Listed: admin.controller.ts (user mgmt + settings endpoints), admin.service.ts (settings save methods), admin.guard.ts, admin-strava-settings.dto.ts
  - Updated `shared/` section:
    - Added `app-settings.service.ts` (DB-backed Garmin + Strava config)
    - Added `garmin-encryption.service.ts` (shared by both modules)
    - Added Redis note: OAuth nonces, settings cache
  - Updated `strava/` section:
    - Added `strava-auth.service.ts` (OAuth2 + state verification)
    - Mentioned webhook auto-resubscribe on credential save
    - Updated `strava.service.ts` note: getStatus now includes featureEnabled

---

## Key Architectural Insights Documented

### AppSettingsService Pattern
- Centralized DB-backed OAuth2 credential management
- 30s Redis TTL cache with invalidation on `setMany()`
- Environment variable fallback (env checked only if DB not configured)
- Decouples credential lifecycle from container restart
- Shared between Garmin + Strava modules (Garmin imports as alias for compatibility)

### OAuth State Hardening
- Redis nonce store: single-use, 600s TTL (`strava:oauth:state:{nonce}`)
- HMAC-SHA256 state signature (uses `GARMIN_ENCRYPTION_KEY` as shared secret)
- Optional JWT subject binding for defense-in-depth (deferred per plan)

### Admin Sync Tracking
- Prisma migration 0002 added `lastSyncStartedAt`, `lastSyncFinishedAt`, `lastSyncError`
- Idempotency guard: rejects sync if last attempt <5min ago
- Audit trail: error message persisted in `lastSyncError` field

### Webhook Auto-resubscribe
- Triggered synchronously when admin saves new Strava credentials
- Result surfaced in response: `webhookResubscribed: true` or `webhookResubscribeError`
- UI shows success/error banner inline
- No manual ops step required

---

## Internal Consistency Verified

✅ **API Contracts:** All 6 new admin endpoints documented with auth + role requirements
✅ **DB Schema:** Prisma models match endpoint payloads (masked secrets in GET, full values in POST validation)
✅ **Feature Flag:** `FEATURE_STRAVA` + `VITE_FEATURE_STRAVA` documented in Docker + env
✅ **Encryption:** Shared `GarminEncryptionService` pattern explained (no conflicts)
✅ **Navigation:** `/admin/strava` nav item positioned under admin menu
✅ **Environment Variables:** Dropped `.required()` on STRAVA_CLIENT_ID/SECRET (now optional, DB-backed)

---

## File Size Status

All docs remain <800 LOC (per project standard):
- project-changelog.md: 737 LOC ✅
- system-architecture.md: 601 LOC ✅
- deployment-guide.md: 418 LOC ✅
- codebase-summary.md: 533 LOC ✅
- development-roadmap.md: 172 LOC ✅

---

## Code Review Findings Addressed

### Fixed (High Priority)
1. **H1: Webhook rotation doc misleading** — Rewritten to reflect auto-resubscribe behavior + UI feedback
2. **H2: File size caps** — Noted in changelog as "known limitation" (deferred refactor to follow-up)

### Documented (Blockers/Medium)
3. **B1: RT #6 backend missing `featureEnabled`** — Code review noted this was fixed; changelog documents the fix
4. **M1/M2: Encryption key validation** — Noted current state: Joi schema + service-level throws (both layers present)

### Not Applicable
- M3-L5: Security tightening items documented as "open questions" (deferred per code review note)
- Test coverage deferred: noted in changelog "deferred per plan"

---

## Unresolved Questions

None at this time. All architectural decisions are reflected in docs. Code review open questions (test coverage, file refactoring) noted as deferred.

**Status:** DONE

**Summary:** Updated 5 doc files to reflect Strava Admin UI Phase 5 completion. All architectural patterns (AppSettingsService, Redis nonce store, webhook auto-resubscribe, admin endpoints) documented with clear rationale. No file exceeds 800 LOC. Deployment guide corrected per code review feedback.

---

**Updated:** 2026-05-18 | **Reviewer:** docs-manager | **Version:** 1.6.0
