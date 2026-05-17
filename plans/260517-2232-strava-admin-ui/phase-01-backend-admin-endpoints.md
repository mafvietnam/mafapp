---
phase: 1
title: "Backend — Admin Settings, Endpoints, DB-backed Config"
status: completed
effort: 0.5d
priority: P1
completed: 2026-05-18
---

# Phase 1 — Backend: Admin Settings, Endpoints, DB-backed Config

## Context Links

- Plan overview: [plan.md](plan.md)
- Reference (Garmin pattern): [api/src/admin/admin-settings.service.ts](../../api/src/admin/admin-settings.service.ts), [api/src/admin/admin.controller.ts](../../api/src/admin/admin.controller.ts), [api/src/admin/admin.service.ts:129-182](../../api/src/admin/admin.service.ts)

## Overview

Extend admin module to manage Strava settings via DB and expose overview/sync endpoints. Modify Strava runtime services to read credentials from DB (with env fallback).

## Key Insights

- `AppSetting` already exists and is used by Garmin — reuse it
- Garmin uses `GarminEncryptionService` for secrets; Strava has its own `StravaEncryptionService` — `AdminSettingsService` must accept BOTH (or use one shared key path)
- ~~**Simplest:** keep `AdminSettingsService` using GarminEncryptionService for ALL secrets — encryption is symmetric, not tied to feature~~

> 🔴 **RED TEAM #5 (Critical):** `GarminEncryptionService` is provided by `GarminModule` (feature-gated by `FEATURE_GARMIN`). Strava-only deploy (`FEATURE_GARMIN=false`) → DI cannot resolve. Importing `GarminModule` into `SharedModule` is a layering violation.
>
> **Resolution (Validation Session 1 — minimal):** Move `garmin-encryption.service.ts` from `api/src/garmin/` to `api/src/shared/garmin-encryption.service.ts`. **Keep the class name `GarminEncryptionService`** and **keep the env var `GARMIN_ENCRYPTION_KEY`** — no rename, no new env var. Register it as a provider in `SharedModule`. Update `GarminModule` to import from the new location. This decouples encryption from feature-flagged modules with minimal blast radius. A cleanup rename to a neutral name can happen in a follow-up plan.
>
> **Note:** `STRAVA_ENCRYPTION_KEY` env var in the original plan was redundant — Strava secrets are encrypted with `GARMIN_ENCRYPTION_KEY` via the shared service. Remove `STRAVA_ENCRYPTION_KEY` reference from plan.md env-vars table.

- Strava `WebhookService` runs at `OnModuleInit()` — cannot await async DB at boot reliably; keep env-only for webhook subscription registration. New config readers must be **lazy** (read on-call), not constructor-cached
- Existing `strava-auth.service.ts` caches `clientId`/`clientSecret` in constructor → must change to lazy getters

## Requirements

**Functional:**
- `GET /admin/settings/strava` returns `{ enabled, clientId, clientSecret(masked), hasClientSecret, hasWebhookVerifyToken, webhookCallbackUrl }`
- `POST /admin/settings/strava` accepts `{ clientId?, clientSecret?, webhookVerifyToken?, enabled? }`, upserts to `app_setting`, encrypts secrets
- `GET /admin/strava` returns `{ featureEnabled, totalConnections, connections: [...] }`
- `POST /admin/strava/:userId/sync` fires async manual sync, returns `{ ok, message }`
- StravaAuthService, StravaTokenService, StravaWebhookService read settings via lazy getter → DB first, env fallback

**Non-functional:**
- Same RBAC as existing admin routes (`JwtAuthGuard` + `RolesGuard('ADMIN')`)
- Secret masking on read response (4+4 chars)
- Settings change does NOT require API restart for new connect flows

## Architecture

```
AdminController
  ├─ GET /admin/settings/strava ──┐
  ├─ POST /admin/settings/strava ─┤── AdminSettingsService
  ├─ GET /admin/strava ───────────┤      ├─ getByPrefix("strava")
  └─ POST /admin/strava/:id/sync ─┘      └─ setMany({ "strava.*": ... })
                                              └─ PrismaService.appSetting

StravaAuthService (lazy getters)
  ├─ get clientId() ──┐
  ├─ get clientSecret()┤── AdminSettingsService.get("strava.clientId" | "strava.clientSecret")
  └─ get authorizationUrl() ─ uses both ─ fallback ConfigService
```

## Related Code Files

**Modify:**
- `api/src/admin/admin-settings.service.ts` — add Strava DEFAULTS + SECRET_KEYS + getStravaSettings()
- `api/src/admin/admin.controller.ts` — add 4 new routes
- `api/src/admin/admin.service.ts` — add getStravaOverview() + triggerStravaSync()
- `api/src/admin/admin.module.ts` — import StravaModule (for StravaSyncService)
- `api/src/strava/strava.module.ts` — export StravaSyncService
- `api/src/strava/strava-auth.service.ts` — lazy getters reading AdminSettingsService → env
- `api/src/strava/strava-token.service.ts` — pass through to auth service (uses StravaAuthService.refreshAccessToken which already routes through auth)
- `api/src/strava/strava-webhook.service.ts` — lazy getters for verifyToken/clientId/clientSecret (keep onModuleInit env-only — see Implementation Notes)

**Create:** (none)

**Delete:** (none)

## Implementation Steps

### 1. Extend `AdminSettingsService` ([admin-settings.service.ts](../../api/src/admin/admin-settings.service.ts))

Add to top constants:
```typescript
const SECRET_KEYS = new Set([
  'garmin.clientSecret',
  'garmin.encryptionKey',
  'strava.clientSecret',          // NEW
  'strava.webhookVerifyToken',    // NEW (treat as secret)
]);

const DEFAULTS: Record<string, string> = {
  // ...existing garmin keys
  'strava.enabled': 'false',         // NEW
  'strava.clientId': '',             // NEW
  'strava.clientSecret': '',         // NEW
  'strava.webhookVerifyToken': '',   // NEW
};
```

Add method:
```typescript
async getStravaSettings() {
  const s = await this.getByPrefix('strava');
  return {
    enabled: s['strava.enabled'] === 'true',
    clientId: s['strava.clientId'] || '',
    clientSecret: this.mask(s['strava.clientSecret'] || ''),
    hasClientSecret: !!s['strava.clientSecret'],
    hasWebhookVerifyToken: !!s['strava.webhookVerifyToken'],
    webhookCallbackUrl: `${process.env.BACKEND_URL ?? 'https://api.maf.run'}/strava/webhook`,
  };
}

/** Raw decrypted reader for Strava runtime services (internal — not exposed to API) */
async getStravaRuntimeConfig() {
  const s = await this.getByPrefix('strava');
  return {
    enabled: s['strava.enabled'] === 'true',
    clientId: s['strava.clientId'] || process.env.STRAVA_CLIENT_ID || '',
    clientSecret: s['strava.clientSecret'] || process.env.STRAVA_CLIENT_SECRET || '',
    webhookVerifyToken: s['strava.webhookVerifyToken'] || process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || '',
  };
}
```

> 🔴 **RED TEAM #12 (High):** `getByPrefix("strava")` hits Prisma + decrypts on every call. Webhook bursts (50 simultaneous activity events) → 150+ DB lookups + AES-GCM decrypts → Strava's 2s webhook timeout breached → subscription marked unhealthy.
>
> **Resolution:** Add a 30-second TTL in-memory cache to `getStravaRuntimeConfig()`. Invalidate cache on `setMany()` call. Document: "admin save propagates within 30s, not instantly."
>
> ```typescript
> private stravaCfgCache: { data: StravaRuntimeConfig; expiresAt: number } | null = null;
>
> async getStravaRuntimeConfig() {
>   const now = Date.now();
>   if (this.stravaCfgCache && this.stravaCfgCache.expiresAt > now) return this.stravaCfgCache.data;
>   const s = await this.getByPrefix('strava');
>   const data = { /* same as before */ };
>   this.stravaCfgCache = { data, expiresAt: now + 30_000 };
>   return data;
> }
>
> // In setMany, after transaction commit:
> if (Object.keys(values).some(k => k.startsWith('strava.'))) this.stravaCfgCache = null;
> ```

> 🔴 **RED TEAM #13 (High):** After moving `AdminSettingsService` to `SharedModule`, `getStravaRuntimeConfig()` returns plaintext `clientSecret` to ANY consumer of SharedModule. Comment-only protection.
>
> **Resolution (simplified):** Do NOT make `getStravaRuntimeConfig()` a public method. Mark it `@Internal` via a separate explicit export from a `strava-config.provider.ts` injected ONLY into `StravaAuthService`, `StravaWebhookService`, `StravaTokenService`. Or: split `AppSettingsService` (masked, public) from `AppSecretsService` (decrypted, registered as provider only in modules that need it). Keep KISS — one extra file is fine, two services is fine. Do NOT add typed branding gymnastics.

> 🔴 **RED TEAM #15 (Medium):** `webhookCallbackUrl` fallback `'https://api.maf.run'` will display the production URL in dev/staging when `BACKEND_URL` is unset. Inconsistent with rest of codebase (`strava-auth.service.ts:25` and `strava-webhook.service.ts:39` use `'http://localhost:3001'`).
>
> **Resolution:** Use `process.env.BACKEND_URL ?? 'http://localhost:3001'` for consistency. If a deploy lacks `BACKEND_URL` in production, that is a config bug to fail loud — not paper over with a hardcoded prod URL in this method.

### 2. Extend `AdminController` ([admin.controller.ts](../../api/src/admin/admin.controller.ts))

After Garmin endpoints, add:
```typescript
@Get('strava')
getStravaOverview() {
  return this.adminService.getStravaOverview();
}

@Post('strava/:userId/sync')
triggerStravaSync(
  @Param('userId', new ParseUUIDPipe()) userId: string,
  @CurrentUser() admin: AuthUser,
) {
  return this.adminService.triggerStravaSync(userId, admin.id);
}

@Get('settings/strava')
getStravaSettings() {
  return this.settingsService.getStravaSettings();
}

@Post('settings/strava')
saveStravaSettings(@Body() body: StravaSettingsDto) {
  const settings: Record<string, string> = {};
  if (body.clientId !== undefined) settings['strava.clientId'] = body.clientId.trim();
  if (body.clientSecret !== undefined) settings['strava.clientSecret'] = body.clientSecret.trim();
  if (body.webhookVerifyToken !== undefined) settings['strava.webhookVerifyToken'] = body.webhookVerifyToken.trim();
  if (body.enabled !== undefined) settings['strava.enabled'] = body.enabled === true ? 'true' : 'false';
  return this.settingsService.setMany(settings);
}
```

> 🔴 **RED TEAM #10 (High):** Inline `@Body() body: { ... }` types are erased at runtime — no validation. `body.enabled = "false"` (string) or `1` (number) → `String()` coerces to `"false"`/`"1"` → silently disables feature. `body.clientSecret = null` → encrypt(null) crashes. Pasted secrets with trailing newlines break OAuth with cryptic errors.
>
> **Resolution:** Create proper DTO with `class-validator`:
>
> ```typescript
> // api/src/admin/dto/strava-settings.dto.ts
> import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
>
> export class StravaSettingsDto {
>   @IsOptional() @IsString() @MaxLength(50) @Matches(/^\d+$/, { message: 'clientId must be numeric' })
>   clientId?: string;
>
>   @IsOptional() @IsString() @MaxLength(200)
>   clientSecret?: string;
>
>   @IsOptional() @IsString() @MaxLength(200)
>   webhookVerifyToken?: string;
>
>   @IsOptional() @IsBoolean()
>   enabled?: boolean;
> }
> ```
>
> Verify global `ValidationPipe` is enabled in `main.ts` with `{ transform: true, whitelist: true, forbidNonWhitelisted: true }`. If not present in current codebase — add it.

### 3. Extend `AdminService` ([admin.service.ts](../../api/src/admin/admin.service.ts))

Constructor: add optional `StravaSyncService`:
```typescript
constructor(
  // ...existing,
  @Optional() @Inject(StravaSyncService) private readonly stravaSync?: StravaSyncService,
) {}
```

Add methods (mirror getGarminOverview / triggerGarminSync):
```typescript
async getStravaOverview() {
  const isEnabled = process.env.FEATURE_STRAVA === 'true';

  const connections = await this.prisma.stravaConnection.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  const activityCounts = await this.prisma.stravaActivity.groupBy({
    by: ['userId'],
    _count: { id: true },
  });
  const countMap = new Map(activityCounts.map((c) => [c.userId, c._count.id]));

  return {
    featureEnabled: isEnabled,
    totalConnections: connections.length,
    connections: connections.map((c) => ({
      userId: c.userId,
      userName: c.user.name,
      userEmail: c.user.email,
      userAvatar: c.user.avatar,
      stravaAthleteId: c.stravaAthleteId,
      status: c.status,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      connectedAt: c.createdAt.toISOString(),
      activityCount: countMap.get(c.userId) ?? 0,
    })),
  };
}

async triggerStravaSync(userId: string, adminUserId: string) {
  if (!this.stravaSync) {
    return { ok: false, message: 'Strava feature is disabled' };
  }

  const conn = await this.prisma.stravaConnection.findUnique({ where: { userId } });
  if (!conn) throw new NotFoundException('Strava connection not found');

  // Idempotency guard: refuse if a sync is in-flight (< 5 min old)
  if (conn.lastSyncStartedAt && Date.now() - conn.lastSyncStartedAt.getTime() < 5 * 60_000 &&
      (!conn.lastSyncFinishedAt || conn.lastSyncFinishedAt < conn.lastSyncStartedAt)) {
    return { ok: false, message: 'Sync already in progress' };
  }

  await this.prisma.stravaConnection.update({
    where: { userId },
    data: { lastSyncStartedAt: new Date(), lastSyncError: null },
  });

  // Audit log
  this.logger.log(`Admin ${adminUserId} triggered Strava sync for user ${userId}`);
  // TODO if AdminAuditLog table exists: await this.prisma.adminAuditLog.create({...})

  this.stravaSync.syncUser(userId)
    .then(() => this.prisma.stravaConnection.update({
      where: { userId }, data: { lastSyncFinishedAt: new Date() },
    }))
    .catch(async (err) => {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.error(`Admin-triggered Strava sync failed for user ${userId}: ${msg}`);
      await this.prisma.stravaConnection.update({
        where: { userId },
        data: { lastSyncFinishedAt: new Date(), lastSyncError: msg.slice(0, 500) },
      });
    });

  return { ok: true, message: 'Sync triggered' };
}
```

> 🔴 **RED TEAM #9 (High):** Original fire-and-forget pattern: no UUID validation on `:userId` (malformed input → noisy 500s), no audit trail (who triggered which sync), no idempotency (double-click spawns parallel syncs racing on upserts), errors swallowed to logs only (admin UI never sees failure).
>
> **Resolution applied (see code above):**
> 1. `@Param('userId', ParseUUIDPipe)` validates input.
> 2. `@CurrentUser()` decorator captures admin identity; logged with sync trigger.
> 3. `lastSyncStartedAt` / `lastSyncFinishedAt` / `lastSyncError` columns on `StravaConnection` (new Prisma migration) → idempotency check + surface error to admin overview.
> 4. Errors persist to `lastSyncError` so admin sees the failure in the overview row (Phase 2 must add a column to render this).
>
> **Prisma migration required:** Add `lastSyncStartedAt: DateTime?`, `lastSyncFinishedAt: DateTime?`, `lastSyncError: String?` to `StravaConnection` model.

### 4. Module wiring

**`api/src/admin/admin.module.ts`:**
```typescript
imports: [GarminModule, StravaModule],   // add StravaModule
```

**`api/src/strava/strava.module.ts`:**
```typescript
exports: [StravaService, StravaTokenService, StravaSyncService],  // add StravaSyncService
```

### 5. Make `StravaAuthService` config DB-backed ([strava-auth.service.ts](../../api/src/strava/strava-auth.service.ts))

> 🔴 **RED TEAM #2 (Critical):** Original plan re-uses `clientSecret` as HMAC key for OAuth `state` signing. Two compound failures:
> 1. **Empty-key forgery** — when DB row + env are both empty (fresh deploy before admin saves), `getStravaRuntimeConfig().clientSecret` returns `''`. `crypto.createHmac('sha256', '')` is valid Node API and produces deterministic signatures → attacker who guesses any userId can mint a valid state and account-link any user to their attacker-controlled Strava.
> 2. **Mid-flow rotation** — admin saves new clientSecret while users have in-flight OAuth → all pending callbacks fail HMAC verify → users see "Invalid state signature".
>
> **Resolution (Validation Session 1):** Reuse the existing mandatory `GARMIN_ENCRYPTION_KEY` env var (now shared via the moved `GarminEncryptionService` in SharedModule) as the HMAC signing key — it's already 32 bytes, already stable, already validated at boot. **No new env var.**
> - `signState(userId)` / `verifyState(state)` stay **synchronous** (private methods, constructor-cached HMAC key from `process.env.GARMIN_ENCRYPTION_KEY`). Revert the sync→async cascade for these two methods.
> - Validate length ≥ 32 bytes; THROW at boot if missing/short.
> - Add code comment: `// HMAC key for OAuth state — reused from GARMIN_ENCRYPTION_KEY (shared crypto secret, dual-purpose AES + HMAC). KISS.`

> 🔴 **RED TEAM #3 (Critical):** OAuth `state` carries `userId` but is not bound to the authenticated session. Combined with `approval_prompt: 'auto'`, an attacker can mint state for their own account, send the redirect URL to a victim, and Strava silently delivers the victim's tokens to the attacker's MAF userId.
>
> **Resolution (Validation Session 1):** Bind state to a server-side store keyed by random nonce:
> 1. On `getAuthorizationUrl(userId)` → generate `nonce = crypto.randomBytes(16).toString('hex')`. Store in Redis: `SET stravaOAuth:${nonce} ${userId} EX 600` (10 min TTL).
> 2. `state = HMAC(nonce, GARMIN_ENCRYPTION_KEY) + ':' + nonce` (HMAC integrity + nonce as lookup key).
> 3. On callback `verifyState(state, currentUserId)` → split, verify HMAC, look up `userId` from Redis, **assert it equals `currentUserId` from JWT**, delete the key (single-use). Reject if mismatch.
>
> This makes state single-use, session-bound, and CSRF-resistant. Requires `RedisService` injection (already in `SharedModule`).
>
> **PKCE deferred (Validation Session 1):** Adding `code_challenge`/`code_verifier` is defense-in-depth but the session-bound nonce store + JWT-subject check above already closes the confused-deputy hijack. Track as follow-up plan: `plans/<future>-strava-oauth-pkce/`.

> 🔴 **RED TEAM #4 (Critical):** Plan's claim "Update `strava.controller.ts:80,109` callers to await" is incomplete. `getAuthorizationUrl` currently returns `string`. After plan changes, it returns `Promise<string>`. The caller `getConnectUrl()` (line 78-82) is currently NOT async and returns `{authUrl}` directly — that returns `{authUrl: {}}` (Promise serialized to `{}`) to the frontend → `window.location.href = authUrl` becomes `[object Promise]` → **100% of new connection attempts fail post-deploy.**
>
> **Resolution:** Explicit task: make `StravaController.getConnectUrl` async and `await` the URL. Run `grep -r "authService\.\(getAuthorizationUrl\|verifyState\|signState\)"` (including `*.spec.ts`) before claiming the cascade is complete.
>
> **Note:** Resolution #2 reverts `signState`/`verifyState` to sync. Only `getAuthorizationUrl` truly becomes async (Redis write for nonce store).

Replace constructor field caching with lazy method:
```typescript
constructor(
  private readonly config: ConfigService,
  private readonly adminSettings: AdminSettingsService,   // NEW
) {
  this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');
}

private async getCreds(): Promise<{ clientId: string; clientSecret: string }> {
  const cfg = await this.adminSettings.getStravaRuntimeConfig();
  return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
}

async getAuthorizationUrl(userId: string): Promise<string> {
  const { clientId, clientSecret } = await this.getCreds();
  const state = this.signState(userId, clientSecret);   // HMAC key passed
  // ...rest
}

async exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = await this.getCreds();
  return this.postStravaToken({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' });
}

async refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = await this.getCreds();
  return this.postStravaToken({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' });
}

async verifyState(state: string): Promise<string> {
  const { clientSecret } = await this.getCreds();
  // ...rest of existing verifyState using passed clientSecret as HMAC key
}
```

**IMPORTANT (revised per Red Team #2 + #4):**
- `signState`/`verifyState` stay **synchronous** (use stable `STATE_SIGNING_KEY` from env, constructor-cached).
- Only `getAuthorizationUrl` becomes async (now writes nonce→userId to Redis).
- `exchangeCodeForTokens` and `refreshAccessToken` become async (DB-read creds — already async-shaped).
- Callers needing change: `strava.controller.ts:80` (`getConnectUrl`) must become `async` and `await` the URL. `strava.controller.ts:109` (`handleCallback`) is already async; update to pass `req.user.id` to `verifyState(state, currentUserId)` for session-binding check.
- Run `grep -rn "authService\.\(getAuthorizationUrl\|verifyState\|signState\)" api/src/ api/test/` to confirm caller enumeration before declaring done.

**Module dependency:** `StravaModule` must import a way to access `AdminSettingsService`. Two options:
- **Option A (chosen):** Move `AdminSettingsService` into a shared module or export it from AdminModule; have StravaModule import AdminModule (forwardRef if circular).
- **Option B:** Promote `AdminSettingsService` into `SharedModule` next to PrismaService/RedisService. Cleaner; recommended.

**Implementation chooses Option B:**
- Move `admin-settings.service.ts` to `api/src/shared/app-settings.service.ts` (rename class to `AppSettingsService`).
- Register in `SharedModule` (or wherever PrismaService is).
- Update import in `AdminModule` and add import in `StravaModule`.

> 🔴 **RED TEAM #11 (High):** Plan calls this "additive" — it is NOT. Rename + file move + module relocation + sync→async signature changes = high-blast-radius destructive refactor. If DI providers/exports mismatch on first boot, **Garmin admin breaks too** (it depends on the same service). Rollback section in plan.md was incorrect.
>
> **Resolution applied:**
> 1. Add a backwards-compat alias export for one release cycle:
>    ```typescript
>    // api/src/admin/admin-settings.service.ts (keep file as re-export shim)
>    export { AppSettingsService as AdminSettingsService } from '../shared/app-settings.service.js';
>    ```
> 2. Keep `AdminSettingsService` as the named token in `AdminModule.providers` initially; introduce `AppSettingsService` provider in SharedModule; **both resolve to the same instance** during the transitional release.
> 3. Update plan.md Rollback ordering: env must remain populated → revert code first → verify OAuth → only then drop DB rows. (Already applied above.)
> 4. Smoke-test the Garmin admin flow (`GET /admin/garmin`, `POST /admin/settings/garmin`) after the move — manual checklist item.

### 6. Update `StravaWebhookService` ([strava-webhook.service.ts](../../api/src/strava/strava-webhook.service.ts))

- Keep `isEnabled` from env (boot-time gate is fine; admin can't toggle this without restart — acceptable).
- Inject `AppSettingsService` (renamed from AdminSettingsService).
- In `isValidVerifyToken()`, `subscribeToWebhook()`, etc., read tokens lazily:
  ```typescript
  async isValidVerifyToken(token: string): Promise<boolean> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    return token === cfg.webhookVerifyToken;
  }
  ```
- `onModuleInit()` reading verifyToken from env is OK as initial bootstrap. If env empty, log warn and skip subscription.

> 🔴 **RED TEAM #8 (High):** Original plan deferred webhook resubscribe to follow-up. Failure mode: admin rotates verify token → Strava's existing subscription still uses OLD token → next Strava health check (`GET /strava/webhook?hub.verify_token=OLD`) fails → Strava deactivates subscription → activity webhooks silently stop. No error, no alert. Production debugging nightmare.
>
> **Resolution (in-scope for this plan):** When `saveStravaSettings` writes a new `webhookVerifyToken` (or `clientId`/`clientSecret`), automatically call `StravaWebhookService.refreshSubscription()` synchronously and return the result in the API response.
>
> **Add to `AdminService`:**
> ```typescript
> async saveStravaSettings(body: StravaSettingsDto) {
>   const tokenChanged = body.webhookVerifyToken !== undefined;
>   const credsChanged = body.clientId !== undefined || body.clientSecret !== undefined;
>   const result = await this.settingsService.setMany(/* ... */);
>   if ((tokenChanged || credsChanged) && this.stravaWebhook) {
>     try {
>       await this.stravaWebhook.refreshSubscription(); // delete + recreate
>       result.webhookResubscribed = true;
>     } catch (err) {
>       result.webhookResubscribeError = err instanceof Error ? err.message : 'Unknown';
>     }
>   }
>   return result;
> }
> ```
>
> **Add to `StravaWebhookService`:** new public `refreshSubscription()` method that calls existing `getExistingSubscription()` → `deleteSubscription()` → `createSubscription()` with current DB-backed creds.
>
> Frontend (Phase 2) must surface `webhookResubscribed: true` (toast "Webhook re-subscribed successfully") or `webhookResubscribeError` (red banner with message).

### 7. Compile & test

```bash
cd api && npm run build
```

Fix any TypeScript errors from sync→async signature changes.

## Todo List

**Red-Team-added (Critical/High):**
- [ ] Extract `AppEncryptionService` (rename or new) with `APP_ENCRYPTION_KEY` env; legacy alias `GARMIN_ENCRYPTION_KEY` for one release (RT #5)
- [ ] Reuse `GARMIN_ENCRYPTION_KEY` as HMAC key for OAuth state (validated ≥32 bytes; constructor-cache); add dual-purpose code comment (RT #2 + Validation S1) <!-- Updated: Validation Session 1 — reuse existing key instead of new STATE_SIGNING_KEY -->
- [ ] Implement Redis-backed nonce store for OAuth state; bind to session via `verifyState(state, currentUserId)` (RT #3)
- [ ] ~~Add PKCE~~ — deferred to follow-up plan (Validation S1) <!-- Updated: Validation Session 1 — PKCE moved to follow-up -->
- [ ] Move `garmin-encryption.service.ts` → `api/src/shared/garmin-encryption.service.ts`; register in `SharedModule`; update Garmin imports (RT #5 + Validation S1) <!-- Updated: Validation Session 1 — file move only, no rename -->
- [ ] ~~Extract AppEncryptionService with APP_ENCRYPTION_KEY~~ — deferred to follow-up cleanup plan (Validation S1) <!-- Updated: Validation Session 1 -->
- [ ] Drop `STRAVA_ENCRYPTION_KEY` from env-vars table and `.env.example` references (Validation S1) <!-- Updated: Validation Session 1 — redundant; shared service uses GARMIN_ENCRYPTION_KEY -->
- [ ] Confirm webhook resubscribe is SYNC inside `saveStravaSettings` (already specified — verify no async fire-and-forget regression) (RT #8 + Validation S1)
- [ ] Make `StravaController.getConnectUrl` async; `await` URL (RT #4)
- [ ] Run `grep -rn "authService\.\(getAuthorizationUrl\|verifyState\|signState\)" api/` to enumerate all callers (RT #4)
- [ ] Create `StravaSettingsDto` with `class-validator` decorators; verify global `ValidationPipe` enabled (RT #10)
- [ ] Add `@Param('userId', ParseUUIDPipe)` and `@CurrentUser()` audit logging on sync endpoint (RT #9)
- [ ] Prisma migration: add `lastSyncStartedAt`, `lastSyncFinishedAt`, `lastSyncError` to `StravaConnection` (RT #9)
- [ ] Idempotency guard on `triggerStravaSync` (in-flight check + error persistence) (RT #9)
- [ ] Add `refreshSubscription()` to `StravaWebhookService`; wire into `saveStravaSettings` (RT #8)
- [ ] Add 30s TTL cache to `getStravaRuntimeConfig`; invalidate on `setMany` strava-key write (RT #12)
- [ ] Split decrypted-secret reader into a non-public provider scoped only to Strava module (RT #13)
- [ ] Keep `AdminSettingsService` re-export shim during transition (RT #11)
- [ ] Update `BACKEND_URL` fallback to `'http://localhost:3001'` for consistency (RT #15)
- [ ] Drop Joi `.required()` from `STRAVA_CLIENT_ID/SECRET/WEBHOOK_VERIFY_TOKEN` (allow DB-only post-bootstrap) (RT #1)

**Original tasks:**
- [ ] Move `AdminSettingsService` → `api/src/shared/app-settings.service.ts` as `AppSettingsService`
- [ ] Add `strava.*` keys to DEFAULTS + SECRET_KEYS
- [ ] Add `getStravaSettings()` (masked) + `getStravaRuntimeConfig()` (raw, env-fallback)
- [ ] Add 4 admin endpoints in `admin.controller.ts`
- [ ] Add `getStravaOverview()` + `triggerStravaSync()` in `admin.service.ts` (with `@Optional() StravaSyncService`)
- [ ] `StravaModule.exports`: add `StravaSyncService`
- [ ] `AdminModule.imports`: add `StravaModule`
- [ ] Convert `StravaAuthService` `getAuthorizationUrl` / `exchangeCodeForTokens` / `refreshAccessToken` to async with lazy creds (NOT `signState`/`verifyState` — they stay sync, see RT #2)
- [ ] Update `strava.controller.ts` callers to `await` async auth methods
- [ ] Inject `AppSettingsService` into `StravaWebhookService`; make verify-token reader lazy
- [ ] `npm run build` clean

## Success Criteria

- `curl -X POST http://localhost:3001/admin/settings/strava -d '{"clientId":"221736","clientSecret":"d710...","enabled":true}'` → 200, `app_setting` table contains 3 rows
- `curl http://localhost:3001/admin/settings/strava` → 200 with masked secret
- `curl http://localhost:3001/admin/strava` → 200 with empty `connections` array
- New OAuth connect attempt picks up DB credentials (verify via log: `Strava connection saved for user X`)
- No regression: existing connected Strava users keep working
- `npm run build` exits 0 in `api/`

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Async signState/verifyState changes break OAuth callback | Single caller site in controller; test manually |
| `AppSettingsService` move breaks Garmin admin paths | Update Garmin imports + run Garmin admin manually |
| Circular dep StravaModule ↔ AdminModule | Use SharedModule (Option B) — no circular |
| Existing env-based deployments break | env fallback in `getStravaRuntimeConfig()` |

## Security Considerations

- Client Secret encrypted at rest via existing `GarminEncryptionService.encrypt()` (AES-256-GCM)
- Webhook verify token treated as secret — encrypted at rest
- Admin endpoints all gated by `JwtAuthGuard + RolesGuard('ADMIN')` (inherited from controller-level guard)
- Masked secret in GET response: never reveal full secret to admin UI

## Next Steps

→ Phase 2 (frontend admin UI) consumes the new endpoints
