# Phase 1 — Backend: Slot Cap Guard + Status Slot Fields + Callback Error Codes

## Context Links

- Plan: [plan.md](plan.md)
- Red Team invariants: `plans/260517-2232-strava-admin-ui/plan.md`
- Files: `api/src/strava/strava.controller.ts`, `api/src/strava/strava.service.ts`, `api/src/strava/strava-webhook.service.ts`, `api/src/shared/app-settings.service.ts`

## Overview

- **Priority:** P1 · **Status:** pending · **Effort:** 0.5d
- Add a server-side guard so the app never exceeds Strava's 10-athlete grant. Expose slot availability in `/strava/status` (boolean only), return HTTP 409 from `/strava/connect` when full, add `?strava_error=full` on the OAuth callback race, and keep the local slot ledger aligned with Strava's authorization ledger. Cap is a DB `AppSetting` (`strava.maxAthletes`, default 10) — **no schema migration, no env var**.

## Key Insights

- `StravaConnection.status` is enum `StravaConnectionStatus` (default `CONNECTED`).
- > 🔴 **RED TEAM #H6 (High):** "disconnect frees a Strava slot" is **FALSE** as written. `disconnect()` deletes the local row but never calls Strava `/oauth/deauthorize` → the athlete keeps consuming an app-side slot. Also: `TOKEN_EXPIRED`/`ERROR` rows still hold a Strava authorization, and `athlete` deauth webhook events (`updates.authorized=false`) are silently dropped. The slot ledger is **Strava-side authorizations**, not local `CONNECTED` rows. Fix: deauthorize on disconnect; count ALL rows; handle athlete-deauth webhook (see steps 2, 3a, 3b).
- `getStravaRuntimeConfig()` is already 30s-cached and invalidated on `strava.*` writes — piggyback `maxAthletes` there (DRY, no extra DB round-trip on the hot `/status` path).
- `AppSetting` has **no `@@map`** → real table is `"AppSetting"` (needed for the E2E cap simulation in Phase 4).
- Callback route is public (no JWT) — cap re-check there must use the `userId` recovered from signed state, never trust query input.
- **Preserve invariants:** do NOT touch HMAC state signing, single-use nonce, or webhook resubscribe logic. This phase is additive except the deauthorize call inside `disconnect()`.

## Requirements

**Functional**
- `strava.maxAthletes` setting (default `10`) caps the number of live Strava authorizations. `0` is a legitimate value meaning "pause all new connections" (🔴 RED TEAM #H9).
- `GET /strava/connect` returns **409** with a friendly VN message when full **and** the caller has no existing connection.
- `GET /strava/status` returns **only** `connectionLimitReached: boolean` (no numeric slot count — 🔴 RED TEAM #M14).
- OAuth callback redirects `?strava_error=full` when a new (non-reconnecting) user would exceed the cap OR when Strava rejects the token exchange for app-capacity reasons.
- `disconnect()` best-effort revokes the Strava authorization; athlete-deauth webhook events remove/mark the local row.

**Non-functional**
- No new env var, no Prisma migration. All files stay < 200 LOC. Cap read served from the existing 30s cache.

## Related Code Files

**Modify**
- `api/src/shared/app-settings.service.ts` — add default + parse `maxAthletes` into `StravaRuntimeConfig`.
- `api/src/strava/strava.service.ts` — `countActiveConnections()` (ALL rows) + `getSlotInfo()`; extend `getStatus()`; deauthorize in `disconnect()`.
- `api/src/strava/strava.controller.ts` — cap guard in `getConnectUrl`; race + capacity re-check in `handleCallback`.
- `api/src/strava/strava-webhook.service.ts` — handle `object_type='athlete'` deauth events in `processEvent`.

**Create** — none. **Delete** — none.

## Implementation Steps

1. **AppSettings default + config field** (`app-settings.service.ts`):
   - In `DEFAULTS`, add `'strava.maxAthletes': '10',` (NOT in `SECRET_KEYS`).
   - Add `maxAthletes: number;` to the `StravaRuntimeConfig` interface.
   - In `getStravaRuntimeConfig()`, parse defensively — 🔴 **RED TEAM #H9:** allow `>= 0` (0 = pause new connections), fall back to 10 only on NaN/negative:
     ```ts
     const parsedMax = parseInt(s['strava.maxAthletes'] ?? '', 10);
     const data: StravaRuntimeConfig = {
       // ...existing fields...
       maxAthletes: Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : 10,
     };
     ```
2. **Service slot helpers** (`strava.service.ts`) — 🔴 **RED TEAM #H6b:** count ALL connection rows (every row is a live Strava authorization, regardless of local status):
   ```ts
   /** Every StravaConnection row holds a Strava-side authorization → counts against the app slot grant */
   async countActiveConnections(): Promise<number> {
     return this.prisma.stravaConnection.count();
   }

   /** Slot availability derived from AppSettings cap + live authorization count. Internal — never sent whole to clients. */
   async getSlotInfo(): Promise<{ maxAthletes: number; active: number; slotsAvailable: number; limitReached: boolean }> {
     const cfg = await this.appSettings.getStravaRuntimeConfig();
     const active = await this.countActiveConnections();
     return {
       maxAthletes: cfg.maxAthletes,
       active,
       slotsAvailable: Math.max(0, cfg.maxAthletes - active),
       limitReached: active >= cfg.maxAthletes,
     };
   }
   ```
3. **Deauthorize on disconnect + athlete-deauth webhook** (🔴 **RED TEAM #H6a/#H6c**):
   - **3a.** In `strava.service.ts` `disconnect()`, BEFORE deleting the row: decrypt the stored access token and best-effort `POST https://www.strava.com/oauth/deauthorize` (form `access_token=<token>`). Wrap in try/catch → log on failure, **never block** the local delete (token may already be expired — acceptable). Then proceed with the existing delete.
   - **3b.** In `strava-webhook.service.ts` `processEvent()`, add an early branch:
     ```ts
     if (event.object_type === 'athlete' && event.updates?.authorized === 'false') {
       const conn = await this.prisma.stravaConnection.findFirst({ where: { stravaAthleteId: String(event.owner_id) } });
       if (conn) {
         await this.prisma.stravaActivity.deleteMany({ where: { userId: conn.userId } });
         await this.prisma.stravaConnection.delete({ where: { userId: conn.userId } });
         this.logger.log(`Athlete ${event.owner_id} deauthorized on Strava — freed local slot`);
       }
       return;
     }
     ```
     (Placed before the existing `activity`/`create` guard.)
4. **Extend `getStatus()`** (`strava.service.ts`) — 🔴 **RED TEAM #M14:** expose ONLY the boolean; do not leak numeric slot counts to end users. Reuse `getSlotInfo()` and add `connectionLimitReached` to **both** return branches (keep existing `featureEnabled`):
   ```ts
   const slot = await this.getSlotInfo();
   return { connected: false, status: null, stravaAthleteId: null, lastSyncAt: null,
     connectedAt: null, featureEnabled: cfg.enabled,
     connectionLimitReached: slot.limitReached };
   ```
5. **Cap guard in `getConnectUrl`** (`strava.controller.ts`): import `ConflictException` from `@nestjs/common`. Allow idempotent reconnect; block only genuinely new connections:
   ```ts
   const existing = await this.stravaService.findConnection(userId);
   if (!existing) {
     const slot = await this.stravaService.getSlotInfo();
     if (slot.limitReached) {
       throw new ConflictException(
         'Đã đạt giới hạn số người dùng Strava (hết slot). Vui lòng thử lại sau.',
       );
     }
   }
   const authUrl = await this.authService.getAuthorizationUrl(userId);
   return { authUrl };
   ```
6. **Callback race + capacity re-check in `handleCallback`** (`strava.controller.ts`): after `verifyState` recovers `userId`, before token exchange:
   ```ts
   const userId = await this.authService.verifyState(state);
   const existing = await this.stravaService.findConnection(userId);
   if (!existing) {
     const slot = await this.stravaService.getSlotInfo();
     if (slot.limitReached) {
       this.logger.warn(`Strava slot cap reached during callback for user ${userId}`);
       return res.redirect(`${profileUrl}?strava_error=full`);
     }
   }
   const tokens = await this.authService.exchangeCodeForTokens(code);
   // ...existing save + redirect...
   ```
   🔴 **RED TEAM #H6d:** in the existing `catch`, inspect the error message — if Strava rejected the exchange for app-capacity (message contains e.g. `rate limit`/`over` athlete limit indicators), redirect `?strava_error=full` instead of the generic `?strava_error=1`. Keep generic `1` as the fallback.
7. **Compile + unit test:** `cd api && npm run build`. Add/extend `strava.service.spec.ts` covering `getSlotInfo` (under/at/over cap; cap=0 blocks all), `getStravaRuntimeConfig` maxAthletes parse (valid / 0 / missing / negative / non-numeric → 10 vs 0), and the athlete-deauth webhook branch. Run `npm test`.

## Todo List

- [ ] `strava.maxAthletes` default + `maxAthletes` in `StravaRuntimeConfig` (parse `>= 0`, 🔴 H9)
- [ ] `countActiveConnections()` counts ALL rows + `getSlotInfo()` (🔴 H6b)
- [ ] `disconnect()` best-effort Strava deauthorize (🔴 H6a)
- [ ] Athlete-deauth webhook branch in `processEvent` (🔴 H6c)
- [ ] `getStatus()` returns ONLY `connectionLimitReached` boolean (🔴 M14)
- [ ] 409 `ConflictException` in `getConnectUrl` (reconnect exempt)
- [ ] `?strava_error=full` on callback race + Strava capacity error (🔴 H6d)
- [ ] Unit tests (slot math, cap=0, parse, deauth webhook); `npm run build` + `npm test` green

## Success Criteria

- With `strava.maxAthletes` = current row count, `GET /strava/connect` → 409 + VN body; a reconnect by an existing athlete is NOT blocked; `maxAthletes=0` blocks all new connects.
- `GET /strava/status` payload includes boolean `connectionLimitReached` and **no** numeric slot count.
- Callback redirects `?strava_error=full` on cap race and on Strava capacity rejection.
- `disconnect()` issues a Strava deauthorize (verified in logs); athlete-deauth webhook removes the local row.
- `npm run build` (nest) + `npm test` (jest) pass.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Slot ledger divergence (local vs Strava) — 🔴 H6 | High×High | Count ALL rows; deauthorize on disconnect; athlete-deauth webhook; admin force-disconnect backlog (plan.md) |
| Race: two new users grab the last slot simultaneously | Med×Med | Callback re-check (step 6) — worst case one extra, self-heals on next disconnect |
| 30s cache delays a maxAthletes change during E2E | High×Low | Documented; wait ≥30s after DB edit in Phase 4 |
| Deauthorize fails on expired token | Med×Low | Best-effort + logged; local delete proceeds regardless |
| Reconnect wrongly blocked | Low×High | `findConnection` exemption + explicit test |

## Security Considerations

- Callback cap check keyed only on state-recovered `userId` — no trust in query params. Preserves HMAC + single-use nonce (untouched).
- 🔴 **RED TEAM #M14:** `/strava/status` returns only a boolean to non-admin callers — numeric slot counts (a capacity-planning signal) stay internal to `getSlotInfo()` for admin/webhook use.
- `maxAthletes` is non-secret → excluded from `SECRET_KEYS`; never logged with credentials.
- 409 message is generic (no counts/IDs) — no enumeration leak. Deauthorize uses the token over HTTPS to Strava only.

## Next Steps

- Unblocks Phase 2 (frontend consumes `connectionLimitReached` boolean, 409, `?strava_error=full`).
- Contract handshake for parallel P2 dev: status adds `connectionLimitReached` (boolean, no numeric); connect adds 409; callback adds `full` code.
- Backlog (plan.md): admin "force disconnect + deauthorize" slot-reclaim action.
</content>
