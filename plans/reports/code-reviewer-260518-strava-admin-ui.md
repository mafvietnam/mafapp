---
title: Code Review — Strava Admin UI Implementation
type: code-review
date: 2026-05-18
plan: 260517-2232-strava-admin-ui
reviewer: code-reviewer
recommendation: REQUEST_CHANGES
score: 7/10
---

# Code Review — Strava Admin UI (Plan 260517-2232)

## Scope

- 33 files changed; 1427+/2027- LOC
- Focus: Phase 1 backend (admin endpoints + DB-backed config + crypto refactor), Phase 2 frontend admin UI, Phase 3 hide-card + Dockerfile + docs
- API `npm run build` → clean. Frontend `vite build` → clean.

## Overall Assessment

Implementation is **mostly aligned with the plan** and addresses 13 of 15 red-team findings correctly. Security-critical items (RT #2 HMAC key reuse, RT #3 Redis nonce store, RT #5 SharedModule encryption relocation, RT #9 sync hardening with Prisma migration, RT #10 DTO + ValidationPipe, RT #11 alias shim) are all present and well-implemented.

One **Blocker** breaks the user-facing fix RT #6 (`/strava/status` does not return `featureEnabled` despite frontend depending on it). Two **High** issues need attention before merge. Several **Medium/Low** style nits.

## Findings

### BLOCKER

#### B1. RT #6 hide-card fix is broken — `/strava/status` does not return `featureEnabled` (Confidence 10/10)

**Where:** `api/src/strava/strava.service.ts:52-80` (`getStatus`) and `api/src/strava/strava.controller.ts:123-128` (`@Get('status')`)

**What:** Frontend `StravaConnectCard` (`src/components/strava-connect-card.tsx:54`) checks `if (s === null || !s.featureEnabled) setAvailable(false)`. The frontend type `StravaStatus.featureEnabled: boolean` is declared but **never populated by backend**. At runtime `s.featureEnabled === undefined` → `!undefined === true` → **card is always hidden whenever the user is unconnected, regardless of admin toggle** (when connected, `connected:true` and the conditional rendering hides the connect button anyway). Inversely, the admin toggle has zero effect — the entire RT #6 resolution is dead code.

This breaks the explicit success criterion: "Strava connect card hidden on profile when `FEATURE_STRAVA=false`" works incidentally only because `getStravaStatus()` returns `null` on 404, not because of the new check.

**Fix (api/src/strava/strava.service.ts):**

```typescript
// Constructor: inject AppSettingsService
constructor(
  private readonly prisma: PrismaService,
  private readonly redis: RedisService,
  private readonly encryption: StravaEncryptionService,
  private readonly appSettings: AppSettingsService,   // NEW
) {}

async getStatus(userId: string) {
  const cfg = await this.appSettings.getStravaRuntimeConfig();
  const conn = await this.prisma.stravaConnection.findUnique({ /* …unchanged… */ });
  if (!conn) {
    return {
      connected: false,
      status: null,
      stravaAthleteId: null,
      lastSyncAt: null,
      connectedAt: null,
      featureEnabled: cfg.enabled,          // NEW
    };
  }
  return {
    connected: conn.status === 'CONNECTED',
    status: conn.status,
    stravaAthleteId: conn.stravaAthleteId,
    lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
    connectedAt: conn.createdAt.toISOString(),
    featureEnabled: cfg.enabled,            // NEW
  };
}
```

`getStravaRuntimeConfig()` already has 30s TTL cache (verified) so the extra read is cheap.

---

### HIGH

#### H1. Docs contradict implementation — webhook rotation says "manual step" but code auto-resubscribes (Confidence 9/10)

**Where:** `docs/deployment-guide.md` (Webhook Verify Token Rotation section, added in this diff)

**What:** Doc states: *"Changing the verify token in admin settings requires re-subscribing the Strava webhook (Strava validates the token on subscribe). This is a manual step — current behavior sets the token at boot via `STRAVA_WEBHOOK_VERIFY_TOKEN` env var."*

But `api/src/admin/admin.service.ts:300-308` synchronously calls `this.stravaWebhook.refreshSubscription()` when any of clientId / clientSecret / webhookVerifyToken changes, and surfaces `webhookResubscribed` / `webhookResubscribeError` in the response. Frontend renders the result. This is the RT #8 resolution.

Doc misleads ops; they may run manual `psql` resubscribe scripts that double-subscribe.

**Fix:** Replace that section with:

> Saving a new verify token / Client ID / Secret in admin settings now automatically deletes and recreates the Strava webhook subscription using the new value. The result (`webhookResubscribed: true` or `webhookResubscribeError`) is shown inline in the admin UI banner after save.

#### H2. Two Phase-2 files exceed the 200-LOC cap (Confidence 10/10)

**Where:**
- `src/pages/admin/admin-strava-page.tsx` — 219 LOC
- `src/components/admin/strava-settings-card.tsx` — 240 LOC

**What:** CLAUDE.md and `phase-02-frontend-admin-ui.md` step 3 explicitly state "target < 200 LOC. If approaching, extract `statusConfig` + `timeAgo` into `src/components/admin/connection-status-utils.ts` and reuse from both pages." Phase 2 todo item: *"Create admin-strava-page.tsx (< 200 LOC)"*.

**Fix:** Extract shared helpers:
- `src/components/admin/connection-status-utils.ts` — `statusConfig`, `timeAgo`, `truncate` (reusable across Garmin/Strava pages)
- Optionally `src/components/admin/strava-secret-input.tsx` for the eye-toggle pattern (used 2× in the settings card)

This drops both files under 200 LOC and matches the "evaluate after Strava ships" comment in the plan (it already shipped above the cap).

---

### MEDIUM

#### M1. `GarminEncryptionService.onModuleInit()` warns instead of throwing on invalid key (Confidence 8/10)

**Where:** `api/src/shared/garmin-encryption.service.ts:22-28`

**What:** Plan RT #2 specifies "Validate length ≥ 32 bytes; **THROW** at boot if missing/short." Current impl `console.warn`s instead. Boot proceeds with `key.length === 0` → every `encrypt()`/`decrypt()` throws `Invalid key length` at first use (runtime, not boot).

Mitigation in place: `app.module.ts:32` Joi schema makes `GARMIN_ENCRYPTION_KEY` `.required().hex().length(64)` → boot fails earlier. So the missing throw is a defense-in-depth issue, not an active vuln. Still — keep both layers.

**Fix:** Change `console.warn` to `throw new Error('GARMIN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)')`. `StravaAuthService.onModuleInit()` (line 39-43) already throws — make these consistent.

#### M2. Joi schema does not validate `STRAVA_ENCRYPTION_KEY` even though `StravaEncryptionService` requires it at init (Confidence 8/10)

**Where:** `api/src/app.module.ts:33-39` (Joi schema) and `api/src/strava/strava-encryption.service.ts:17-23`

**What:** When `FEATURE_STRAVA=true`, `StravaEncryptionService.onModuleInit()` throws if `STRAVA_ENCRYPTION_KEY` is not 64 hex chars. But the Joi schema doesn't enforce this format up-front. Misconfiguration surfaces as a late-boot NestJS error instead of a Joi validation message at startup.

**Fix:** Add to Joi schema:
```typescript
STRAVA_ENCRYPTION_KEY: Joi.alternatives().conditional('FEATURE_STRAVA', {
  is: 'true',
  then: Joi.string().hex().length(64).required(),
  otherwise: Joi.string().default(''),
}),
```

#### M3. `StravaController.handleCallback` doesn't pass `currentUserId` to `verifyState` (Confidence 7/10)

**Where:** `api/src/strava/strava.controller.ts:110` and `api/src/strava/strava-auth.service.ts:73`

**What:** `verifyState` accepts an optional `currentUserId` for the CSRF-resistance check (RT #3). Plan acknowledges the callback route is public (no JWT cookie/header forwarded by Strava redirect), so the JWT-subject binding is technically unenforceable in the OAuth callback handler. Code is correct — the comment "Callback route is public; currentUserId is optional; nonce is still single-use + HMAC-verified" matches the plan's accepted trade-off.

However the design implies the JWT cookie could be read from `req.cookies` (it's a same-site Lax cookie that follows the redirect-back for top-level navigation). Worth a security tightening pass:

**Fix (optional, defense-in-depth):** Inject `JwtService`, extract userId from the auth cookie if present, pass to `verifyState`. If absent (incognito flow), proceed without the check (current behavior). Cost: ~10 LOC; benefit: closes confused-deputy hijack even harder.

#### M4. `verifyStateSignature` hex-pad before `timingSafeEqual` is fragile (Confidence 7/10)

**Where:** `api/src/strava/strava-auth.service.ts:138-139`

```typescript
const expectedBuf = Buffer.from(expected, 'hex');
const hmacBuf = Buffer.from(hmac.padEnd(expected.length, '0'), 'hex');
if (expectedBuf.length !== hmacBuf.length) throw new Error('Invalid state signature');
```

`Buffer.from('non-hex-chars', 'hex')` silently truncates at the first invalid char → length mismatch → throws "Invalid state signature" (not a timing-safe failure mode but still rejects). The pad + length-compare dance is unnecessary and somewhat confusing.

**Fix:** Simpler & equivalent:
```typescript
if (hmac.length !== expected.length) throw new Error('Invalid state signature');
const expectedBuf = Buffer.from(expected, 'hex');
const hmacBuf = Buffer.from(hmac, 'hex');
if (expectedBuf.length !== hmacBuf.length || !crypto.timingSafeEqual(expectedBuf, hmacBuf)) {
  throw new Error('Invalid state signature');
}
```

---

### LOW / NIT

#### L1. `triggerStravaSync` doesn't reset `lastSyncStartedAt` after async failure path's swallowed error (Confidence 7/10)

**Where:** `api/src/admin/admin.service.ts:272-278`

If the inner `.update({ data: { lastSyncFinishedAt, lastSyncError } })` itself throws (e.g. DB outage), the `.catch(() => {})` swallows it. Subsequent admin sync attempts will see `lastSyncStartedAt` set with `lastSyncFinishedAt < lastSyncStartedAt` → idempotency guard refuses retries until the 5-min window expires. Acceptable trade-off for admin tool; flag for follow-up.

#### L2. Frontend `saveStravaSettings` returns `{ ok: true, ...body }` — `result.ok` may shadow body's `ok` field (Confidence 7/10)

**Where:** `src/services/admin-service.ts:225-227`

```typescript
const body = await res.json();
return { ok: true, ...body };
```

Backend `AdminService.saveStravaSettings` returns `{ ok: true, webhookResubscribed?, webhookResubscribeError? }`. Spread overwrites the outer `ok: true` with body's `ok: true` — harmless today but fragile if backend ever emits `ok: false` in a partial-success case.

**Fix (low impact):** swap order: `return { ...body, ok: true };` so the caller-set `ok` always wins. Or define the shape explicitly: `return { ok: true, webhookResubscribed: body.webhookResubscribed, webhookResubscribeError: body.webhookResubscribeError };`

#### L3. `AppSettingsService.getStravaRuntimeConfig` returns plaintext secret via SharedModule consumer access (RT #13 partially addressed) (Confidence 7/10)

**Where:** `api/src/shared/app-settings.service.ts:118-141`

Plan RT #13 said "split decrypted-secret reader into a non-public provider scoped only to Strava module." Resolution is comment-only (`@internal` JSDoc tag). Any SharedModule consumer can call `appSettings.getStravaRuntimeConfig()`. Today there are only 2 callers in Strava module — acceptable as KISS. Flag for follow-up: extract `StravaSecretsProvider` (or similar) into `StravaModule.providers` only, with `AppSettingsService` keeping only the masked `getStravaSettings()` public.

#### L4. `STRAVA_ENCRYPTION_KEY` references in plan-mentioned "removals" not actually removed (Confirmation, not a bug) (Confidence 9/10)

`STRAVA_ENCRYPTION_KEY` is still required by `StravaEncryptionService` for user token AES at rest — distinct from `clientSecret`/`webhookVerifyToken` (which use shared `GarminEncryptionService`). The plan's "remove from .env.example" todo conflates the two. Current state is correct: keep `STRAVA_ENCRYPTION_KEY` in .env.example + docker-compose + deployment-guide. The plan todo item should be marked "not applicable — keys serve different scopes" rather than left unchecked.

#### L5. Misleading comment in StravaAuthService HMAC key (Confidence 6/10)

`strava-auth.service.ts:23-24` comment says "reused from GARMIN_ENCRYPTION_KEY (shared crypto secret, dual-purpose AES + HMAC)". `GarminEncryptionService.hmacKey` getter (`shared/garmin-encryption.service.ts:39-41`) was added for exactly this purpose but `StravaAuthService` instead reads `config.get('GARMIN_ENCRYPTION_KEY')` directly and builds its own Buffer (line 33-34). Both paths produce the same bytes; just inconsistent. Prefer `this.encryption.hmacKey` for clarity and to centralize key length validation.

---

## Plan Adherence Matrix

| Plan red-team item | Implementation status |
|---|---|
| RT #2 — HMAC key from GARMIN_ENCRYPTION_KEY, ≥32 bytes, throw at boot | ✅ throws in StravaAuthService.onModuleInit; warn-only in GarminEncryptionService (M1) |
| RT #3 — Redis nonce store, single-use, HMAC integrity | ✅ correct |
| RT #4 — sync→async cascade complete | ✅ all callers awaited; no test refs |
| RT #5 — encryption service in SharedModule, GarminModule no longer self-provides | ✅ correct |
| RT #6 — `/strava/status` returns `featureEnabled` | ❌ **BLOCKER B1** — backend missing the field |
| RT #8 — webhook resubscribe-on-save with result surfaced | ✅ correct (docs note inconsistent — H1) |
| RT #9 — ParseUUIDPipe + admin audit log + idempotency + Prisma migration | ✅ migration 0002 present; idempotency check present |
| RT #10 — DTO + class-validator + global ValidationPipe | ✅ correct |
| RT #11 — alias shim `AdminSettingsService` → `AppSettingsService` | ✅ correct |
| RT #12 — 30s TTL cache + invalidate on setMany | ✅ correct |
| RT #15 — Dockerfile ARG in builder stage; BACKEND_URL fallback localhost:3001 | ✅ correct |

## Behavioral Checklist (per agent rubric)

- [x] Concurrency — idempotency guard in `triggerStravaSync`; in-memory cache invalidation matches single-instance assumption
- [x] Error boundaries — async tasks `.catch()`'d; admin-triggered sync persists errors to `lastSyncError`
- [⚠️] API contracts — `/strava/status` contract violated (B1)
- [x] Backwards compatibility — `AdminSettingsService` shim kept; Garmin imports updated to new shared path
- [x] Input validation — `StravaSettingsDto` with class-validator + global ValidationPipe (`whitelist:true, forbidNonWhitelisted:true, transform:true`)
- [x] Auth/authz — admin endpoints behind `JwtAuthGuard + RolesGuard('ADMIN')`; OAuth state HMAC + nonce single-use
- [x] N+1 / query efficiency — overview uses `groupBy` + Map lookup; cache for runtime config
- [x] Data leaks — secrets masked (4+4), `getStravaSettings` never returns plaintext; `getStravaRuntimeConfig` marked `@internal`

## Positive Observations

- Clean encryption service relocation with thoughtful shim for Garmin compatibility (RT #11)
- HMAC dual-purpose design is well-commented; constructor caches the key buffer (no per-call hex decode)
- Prisma migration applied (`0002_strava_admin_sync_columns`) — RT #9 fully wired through the table layer, service layer, and frontend column ("Last Error")
- `StravaSettingsDto` enforces numeric `clientId`, max-length, optional booleans — robust
- Cache invalidation key check `Object.keys(settings).some(k => k.startsWith('strava.'))` is precise — won't churn cache on Garmin writes
- Docker setup correctly places ARG/ENV in the builder stage with clear comment warning future editors

## Recommended Actions (priority order)

1. **Fix B1** — add `featureEnabled` to `StravaService.getStatus()` response (5 LOC + 1 constructor injection)
2. **Fix H1** — rewrite the "Webhook Verify Token Rotation" doc section to reflect auto-resubscribe behavior
3. **Fix H2** — extract `connection-status-utils.ts`; split secret-input subcomponent; bring both files under 200 LOC
4. **Fix M1/M2** — throw on bad key in `GarminEncryptionService.onModuleInit`; add `STRAVA_ENCRYPTION_KEY` to Joi
5. **(Optional) M3/M4/L5** — defense-in-depth tightening

After fixes 1-3 are applied, this is APPROVE.

## Metrics

- Files over 200 LOC: 2 (admin-strava-page 219, strava-settings-card 240)
- Build status: API `nest build` ✅ clean; frontend `vite build` ✅ clean
- Test coverage: No tests added (deferred per plan — Open Question)
- Linting: not run (no diff in lint config)

## Unresolved Questions

1. **Cookie-based session binding in OAuth callback** — should we read the JWT from `req.cookies` to opportunistically pass `currentUserId` to `verifyState`? Plan deferred PKCE; this is the next-best CSRF tightener.
2. **`lastSyncFinishedAt` semantics** — when an admin sync errors out, the catch handler updates both `lastSyncFinishedAt` AND `lastSyncError`. The idempotency guard at line 247-251 uses `lastSyncFinishedAt >= lastSyncStartedAt` to consider sync "done". On DB-update failure inside the catch, `lastSyncStartedAt` stays > `lastSyncFinishedAt` → admin is locked out for 5 min. Tolerable today; document or flag for follow-up?
3. **`StravaEncryptionService` retirement** — long-term, can the user-token encryption migrate to the shared `GarminEncryptionService`/`AppEncryptionService` too? Would require a one-time re-encryption migration. Out of scope here but worth noting.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Implementation matches the plan on 13/15 red-team items but RT #6 hide-card fix has a backend gap (`/strava/status` missing `featureEnabled`) that makes the frontend check inert. Recommendation: REQUEST_CHANGES — score 7/10.
