# Phase 5: Official Garmin API Migration

## Context Links
- [Plan Overview](plan.md)
- [Phase 2 — OAuth & Connection](phase-02-oauth-and-connection-flow.md) (auth pattern to replace)
- [Phase 3 — Data Sync Engine](phase-03-data-sync-engine.md) (sync to replace with webhooks)
- [API Research — Official APIs](../reports/researcher-260407-0732-garmin-api-research.md)
- [Garmin OAuth 2 PKCE Spec](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)
- Google OAuth pattern: `api/src/auth/google.strategy.ts`, `api/src/auth/auth.controller.ts`

## Overview
- **Priority:** P2 (can begin independently after Garmin Developer Program approval)
- **Status:** Pending (blocked by external: Garmin Developer Program approval)
- **Effort:** 5-7 days (code changes); timeline depends on Garmin approval (2-4 weeks)
<!-- RED TEAM: Finding #5 — Re-estimated from 2d. This is a near-complete rewrite of Phases 2+3 auth and data fetching. -->
- **Description:** Replace unofficial `garmin-connect` npm library with official Garmin Health API + Activity API. Switch from credential-based auth to OAuth 2 PKCE redirect flow. Replace cron polling with webhook push notifications.

## Key Insights
- Official API uses standard OAuth 2 PKCE — same pattern as existing Google OAuth
- Garmin provides evaluation consumer key first, then production key after integration review
- Webhook model: Garmin POSTs notification to our endpoint when user syncs device → we fetch data asynchronously
- Access tokens expire ~3 hours; refresh tokens are long-lived
- Must respond to webhook within timeout — return 200 immediately, fetch data async
- Backfill: ~30 days of data on first connect, one-time per data type per user
- No breaking changes to frontend — same data shape in database, same REST endpoints
- `garmin-connect` npm package can be removed after migration

## Requirements

### Functional
- OAuth 2 PKCE redirect flow: user clicks "Connect Garmin" → redirected to Garmin consent screen → callback stores tokens
- Token refresh: auto-refresh access token before API calls when expired
- Webhook receiver: accepts Garmin push notifications, triggers async data fetch
- Replace all `garmin-connect` lib calls with direct HTTP calls to official API
- Maintain backward compatibility: same GarminActivity/GarminDailySummary schema, same REST endpoints
- Remove Garmin credential storage (email/password) — only OAuth tokens stored

### Non-Functional
- Webhook endpoint must return 200 within 5 seconds (no blocking work in handler)
- Webhook payload verification (if Garmin provides signing)
- Production consumer key has higher rate limits — remove artificial delays from sync
- Graceful migration: existing connected users must re-authenticate via OAuth (one-time)

## Architecture

### OAuth 2 PKCE Flow (Official API)

```
User clicks "Connect Garmin"
  |
  v
Frontend: window.location = /api/garmin/auth
  |
  v
Backend (garmin.controller.ts):
  Generate state + code_verifier + code_challenge
  Store in Redis (5 min TTL): garmin:state:{state} -> code_verifier
  Redirect 302 to:
    https://apis.garmin.com/oauth-service/oauth/authorize
    ?client_id={GARMIN_CLIENT_ID}
    &redirect_uri=https://api.maf.run/garmin/callback
    &response_type=code
    &scope=health_api activity_api
    &state={random}
    &code_challenge={S256_hash}
    &code_challenge_method=S256
  |
  v
User logs into Garmin, grants consent
  |
  v
Garmin redirects to: /api/garmin/callback?code=XXX&state=YYY
  |
  v
Backend:
  1. Verify state matches Redis entry
  2. Retrieve code_verifier from Redis
  3. POST https://apis.garmin.com/oauth-service/oauth/token
     body: grant_type=authorization_code, code, client_id, client_secret, code_verifier, redirect_uri
  4. Receive: access_token, refresh_token, expires_in, token_type
  5. Encrypt tokens, upsert GarminConnection (store real OAuth tokens, not credentials)
  6. Delete Redis state entry
  7. Trigger initial backfill (async)
  8. Redirect to frontend: https://app.maf.run/profile?garmin=connected
```

### Webhook Architecture

```
Garmin Cloud
  |
  | User syncs device
  v
POST https://api.maf.run/garmin/webhook
  body: { userId, summaryType, startTimeInSeconds, ... }
  |
  v
GarminController.handleWebhook():
  1. Validate request (verify source if signing available)
  2. Return 200 OK immediately
  3. Queue async job: garminSyncService.syncUser(garminUserId)
  |
  v
GarminSyncService.syncUser():
  1. Find GarminConnection by garminUserId
  2. Refresh access_token if expired
  3. Fetch data from official API endpoints
  4. Upsert to database
```

### Official API Endpoints to Call

| Purpose | Method | URL |
|---------|--------|-----|
| Token exchange | POST | `https://apis.garmin.com/oauth-service/oauth/token` |
| Token refresh | POST | `https://apis.garmin.com/oauth-service/oauth/token` (grant_type=refresh_token) |
| Daily summaries | GET | `https://apis.garmin.com/wellness-api/rest/dailySummary/{date}` |
| Daily summaries range | GET | `https://apis.garmin.com/wellness-api/rest/dailySummaryBetween?startDate=...&endDate=...` |
| Activities | GET | `https://apis.garmin.com/activity-api/activities?start=0&limit=20` |
| Activity detail | GET | `https://apis.garmin.com/activity-api/activities/{id}` |
| User profile | GET | `https://apis.garmin.com/wellness-api/rest/user/id` |

### Env Vars (New/Changed)

| Variable | Purpose | Replaces |
|----------|---------|----------|
| `GARMIN_CLIENT_ID` | Official API client ID | N/A (new) |
| `GARMIN_CLIENT_SECRET` | Official API client secret | N/A (new) |
| `GARMIN_WEBHOOK_SECRET` | Webhook signature key (if available) | N/A (new) |
| ~~`GARMIN_EMAIL`~~ | Removed | Was MVP credential |
| ~~`GARMIN_PASSWORD`~~ | Removed | Was MVP credential |

`GARMIN_ENCRYPTION_KEY` remains — still needed for encrypting OAuth tokens.

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `api/src/garmin/garmin.controller.ts` | Replace connect endpoint with auth/callback redirect flow, add webhook endpoint |
| `api/src/garmin/garmin.service.ts` | Replace garmin-connect lib calls with direct HTTP to official API, add token refresh |
| `api/src/garmin/garmin-sync.service.ts` | Replace garmin-connect data fetch with official API calls, remove artificial delays |
| `api/src/garmin/garmin-cron.service.ts` | Reduce cron to fallback only (webhook is primary), or remove entirely |
| `api/src/garmin/garmin.module.ts` | Remove garmin-connect import references |
| `api/src/garmin/garmin-connect.dto.ts` | Remove email/password DTO, add callback query DTO |
| `api/src/app.module.ts` | Add GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET to Joi schema |
| `api/package.json` | Remove `garmin-connect` dependency |
| `src/components/garmin-connect-card.tsx` | Replace email/password form with redirect button (like Google login) |
| `src/services/garmin-service.ts` | Change `connectGarmin()` from POST credentials to `window.location` redirect |

### Files to Create
| File | Purpose |
|------|---------|
| `api/src/garmin/garmin-api-client.service.ts` | HTTP client wrapper for official Garmin API calls + token refresh |

## Implementation Steps

### Step 1: Create garmin-api-client.service.ts

Create `api/src/garmin/garmin-api-client.service.ts`:

1.1. Injectable service, constructor injects `ConfigService`, `PrismaService`, `GarminEncryptionService`

1.2. Private fields: `clientId`, `clientSecret` from env vars, `baseUrl = 'https://apis.garmin.com'`

1.3. `generateAuthUrl(state: string, codeChallenge: string): string`:
- Build authorization URL with query params: client_id, redirect_uri, response_type=code, scope, state, code_challenge, code_challenge_method=S256
- Return full URL string

1.4. `exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens>`:
- POST to `${baseUrl}/oauth-service/oauth/token`
- Body: `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `code_verifier`, `redirect_uri`
- Return `{ accessToken, refreshToken, expiresIn }`

1.5. `refreshAccessToken(encryptedRefreshToken: string): Promise<OAuthTokens>`:
- Decrypt refresh token
- POST to token endpoint with `grant_type=refresh_token`
- Return new tokens

1.6. `fetchWithAuth(userId: string, path: string): Promise<any>`:
- Load GarminConnection for userId
- Decrypt access token
- Check tokenExpiry — if expired, call refreshAccessToken, update DB
- GET `${baseUrl}${path}` with `Authorization: Bearer ${token}`
- Handle 401 → refresh and retry once
- Return parsed JSON

1.7. Convenience methods:
- `getDailySummary(userId, date)` → `fetchWithAuth(userId, '/wellness-api/rest/dailySummary/{date}')`
- `getDailySummaryRange(userId, from, to)` → `fetchWithAuth(userId, '/wellness-api/rest/dailySummaryBetween?...')`
- `getActivities(userId, start, limit)` → `fetchWithAuth(userId, '/activity-api/activities?...')`
- `getUserId(userId)` → `fetchWithAuth(userId, '/wellness-api/rest/user/id')`

### Step 2: Update garmin.controller.ts — OAuth redirect flow

2.1. Replace POST `/garmin/connect` with:

```typescript
@Get('auth')
@UseGuards(JwtAuthGuard)
async initiateAuth(@Req() req: Request, @Res() res: Response) {
  const userId = (req.user as TokenPayload).sub;
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256')
    .update(codeVerifier).digest('base64url');

  // Store in Redis: state -> { userId, codeVerifier }, 5 min TTL
  await this.redis.set(
    `garmin:state:${state}`,
    JSON.stringify({ userId, codeVerifier }),
    'EX', 300,
  );

  const authUrl = this.garminApiClient.generateAuthUrl(state, codeChallenge);
  res.redirect(authUrl);
}
```

2.2. Replace the connect logic with GET `/garmin/callback`:

<!-- RED TEAM: Finding #7 — Bind callback to user session. Verify JWT cookie matches userId in state. -->
```typescript
@Get('callback')
async handleCallback(
  @Query('code') code: string,
  @Query('state') state: string,
  @Req() req: Request,
  @Res() res: Response,
) {
  // Verify state
  const stateData = await this.redis.get(`garmin:state:${state}`);
  if (!stateData) throw new UnauthorizedException('Invalid state');

  // RED TEAM: Verify JWT cookie matches the userId who initiated the flow
  const jwtPayload = this.extractJwtFromCookie(req); // decode JWT from cookie
  const { userId, codeVerifier } = JSON.parse(stateData);
  if (!jwtPayload || jwtPayload.sub !== userId) {
    throw new UnauthorizedException('Session mismatch — OAuth flow must be completed by the same user');
  }

  const { userId, codeVerifier } = JSON.parse(stateData);
  await this.redis.del(`garmin:state:${state}`);

  // Exchange code for tokens
  const tokens = await this.garminApiClient.exchangeCode(code, codeVerifier);

  // Get Garmin user ID
  const garminUser = await this.garminApiClient.getUserId(/* temp auth with new token */);

  // Encrypt and store
  const encryptedAccess = this.encryption.encrypt(tokens.accessToken);
  const encryptedRefresh = this.encryption.encrypt(tokens.refreshToken);

  await this.garminService.upsertConnection(userId, {
    garminUserId: garminUser.userId,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
    status: 'CONNECTED',
  });

  // Trigger backfill async
  this.garminSyncService.syncUser(userId);

  // Redirect to frontend
  const frontendUrl = IS_PROD ? 'https://app.maf.run' : 'http://localhost:5173';
  res.redirect(`${frontendUrl}/profile?garmin=connected`);
}
```

2.3. Add POST `/garmin/webhook`:

<!-- RED TEAM: Finding #4 — Webhook MUST be authenticated. Not optional. -->
<!-- RED TEAM: Finding #6 (setImmediate) — Use proper job queue or at minimum track failures. -->
```typescript
@Post('webhook')
async handleWebhook(
  @Body() body: any,
  @Headers('x-garmin-webhook-secret') webhookSecret: string,
  @Res() res: Response,
) {
  // Step 1: Validate webhook authentication (MANDATORY)
  const expectedSecret = this.configService.get('GARMIN_WEBHOOK_SECRET');
  if (!expectedSecret || webhookSecret !== expectedSecret) {
    // If Garmin doesn't provide signing, use IP allowlist instead
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Step 2: Validate payload shape
  const garminUserId = body?.userId || body?.garminUserId;
  if (!garminUserId) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  // Step 3: Return 200 immediately
  res.status(200).json({ ok: true });

  // Step 4: Process async — track failures in GarminConnection
  setImmediate(async () => {
    try {
      const connection = await this.prisma.garminConnection.findUnique({
        where: { garminUserId: String(garminUserId) },
      });
      if (connection) {
        await this.garminSyncService.syncUser(connection.userId);
      }
    } catch (err) {
      this.logger.error('Webhook processing error', err);
      // Track failure: increment error counter on connection for observability
      await this.prisma.garminConnection.updateMany({
        where: { garminUserId: String(garminUserId) },
        data: { status: 'ERROR' },
      }).catch(() => {});
    }
  });
}
```

### Step 3: Update garmin-sync.service.ts — use official API

3.1. Replace `getAuthenticatedClient()` usage with `garminApiClient.fetchWithAuth()` calls

3.2. Update `syncActivities()`:
- Call `garminApiClient.getActivities(userId, 0, 50)` instead of garmin-connect
- Map official API response fields to GarminActivity model
- Official API field names may differ from garmin-connect — check response and adjust mapping

3.3. Update `syncDailySummaries()`:
- Call `garminApiClient.getDailySummaryRange(userId, from, to)` — single call replaces per-day loop
- Remove 500ms delay between requests (official API has better rate limits)
- Map response fields to GarminDailySummary model

3.4. Remove `getAuthenticatedClient()` from garmin.service.ts (no longer needed)

### Step 4: Update garmin-cron.service.ts

4.1. Keep cron as fallback (webhook may miss events), but reduce frequency:
- Change from `EVERY_2_HOURS` to `EVERY_6_HOURS` or `EVERY_12_HOURS`
- Cron only syncs users whose `lastSyncAt` is older than 6 hours (skip recently webhook-synced users)

### Step 5: Update frontend — redirect-based connect

5.1. In `src/components/garmin-connect-card.tsx`:
- Remove email/password form
- Replace with single button: "Ket noi Garmin"
- On click: `window.location.href = '${API_BASE}/garmin/auth'`
- Same pattern as Google login button
- Check for `?garmin=connected` URL param on profile page mount → show success toast

5.2. In `src/services/garmin-service.ts`:
- Remove `connectGarmin(email, password)` function
- Add `getGarminAuthUrl(): string` that returns `${API_BASE}/garmin/auth`

### Step 6: Update env vars and validation

6.1. In `api/src/app.module.ts` Joi schema, add:
```typescript
GARMIN_CLIENT_ID: Joi.string().default(''),
GARMIN_CLIENT_SECRET: Joi.string().default(''),
GARMIN_WEBHOOK_SECRET: Joi.string().default(''),
```

6.2. Remove `GARMIN_EMAIL` and `GARMIN_PASSWORD` from `.env` files

### Step 7: Remove garmin-connect dependency

```bash
cd api && npm uninstall garmin-connect
```

Remove all imports of `garmin-connect` from source files.

### Step 8: Handle existing users migration

8.1. Existing users with credential-based connections must re-authenticate:
- On next status check, if connection has no `tokenExpiry` (old format), set `status = DISCONNECTED`
- Frontend shows "Ket noi lai" (Reconnect) button instead of connected status
- User clicks → goes through new OAuth flow → connection updated with real tokens

8.2. One-time migration:
<!-- RED TEAM: Finding #15 — Use MIGRATION_REQUIRED status, not silent DISCONNECTED. Add in-app notification. -->
- Add `MIGRATION_REQUIRED` value to `GarminConnectionStatus` enum
- Run migration: `UPDATE "GarminConnection" SET status = 'MIGRATION_REQUIRED' WHERE "tokenExpiry" IS NULL;`
- Frontend: when status is `MIGRATION_REQUIRED`, show banner: "Chung toi da nang cap ket noi Garmin. Vui long ket noi lai bang phuong thuc moi an toan hon."
- Keep old credential-based sync running for a 2-week grace period while users migrate
- After grace period, set remaining `MIGRATION_REQUIRED` to `DISCONNECTED` and delete stored credentials

### Step 9: Build and test

```bash
cd api && npm run build
cd .. && npm run build
```

Test with Garmin evaluation consumer key:
- Click "Connect Garmin" → redirected to Garmin consent
- Grant consent → redirected back to profile with `?garmin=connected`
- Verify tokens stored (encrypted) in GarminConnection
- Trigger manual sync → activities + summaries fetched from official API
- Send test webhook payload → verify async sync triggered

### Step 10: Request production consumer key

After integration verified with evaluation key:
- Contact Garmin via developer portal to request production key
- Update `GARMIN_CLIENT_ID` and `GARMIN_CLIENT_SECRET` in production env
- Test with production key — verify higher rate limits

## Todo List

- [ ] Create `garmin-api-client.service.ts` with official API HTTP calls
- [ ] Implement OAuth 2 PKCE: `generateAuthUrl`, `exchangeCode`, `refreshAccessToken`
- [ ] Implement `fetchWithAuth` with auto-refresh on 401
- [ ] Replace POST `/garmin/connect` with GET `/garmin/auth` redirect
- [ ] Implement GET `/garmin/callback` token exchange
- [ ] Implement POST `/garmin/webhook` endpoint
- [ ] Update `garmin-sync.service.ts` to use official API
- [ ] Reduce cron frequency (webhook is primary)
- [ ] Update frontend `garmin-connect-card.tsx` to redirect-based connect
- [ ] Update `garmin-service.ts` frontend service
- [ ] Add GARMIN_CLIENT_ID/SECRET to env validation
- [ ] Remove `garmin-connect` npm dependency
- [ ] Handle existing user migration (set DISCONNECTED)
- [ ] Test full OAuth flow with evaluation key
- [ ] Test webhook processing
- [ ] Test token refresh flow
- [ ] Request production consumer key from Garmin
- [ ] Build check (frontend + backend)

## Success Criteria

- OAuth redirect flow works end-to-end (connect → consent → callback → connected)
- Token refresh works transparently (no user action needed)
- Webhook triggers data sync within seconds of device sync
- All existing Phase 3/4 functionality works with new data source
- `garmin-connect` package fully removed from codebase
- Existing MVP users see "Reconnect" prompt and can re-auth via OAuth
- Production consumer key obtained and deployed

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Garmin Developer Program approval denied | Low | Critical | Strong use case + registered company; fallback: continue with unofficial lib |
| Official API response format differs from garmin-connect | High | Medium | Abstract data mapping; store rawData; adjust mapping when testing |
| Webhook endpoint receives unexpected payloads | Medium | Low | Validate payload structure; log and ignore unknown formats |
| Token refresh race condition (concurrent requests) | Low | Medium | Mutex/lock on refresh per user; only first request refreshes, others wait |
| Evaluation key rate limits too low for testing | Medium | Low | Test with single user; request production key early |
| Existing users frustrated by re-auth requirement | Medium | Low | Clear messaging: "Garmin upgraded to official connection — please reconnect" |

## Security Considerations

- **OAuth tokens**: AES-256-GCM encrypted at rest (same as Phase 1)
- **No password storage**: OAuth 2 eliminates credential storage entirely
- **Webhook validation**: Verify source IP or HMAC signature if Garmin provides it
- **PKCE**: Prevents authorization code interception (public client protection)
- **State parameter**: CSRF protection on OAuth flow (Redis-backed, 5min TTL)
- **Callback endpoint**: No auth guard (must accept Garmin redirect), but validates state
- **Client secret**: Server-side only, never exposed to frontend

## Next Steps

After production key obtained:
- Monitor webhook reliability and data freshness
- Consider adding more Garmin data types (respiration, body composition) if user demand
- Evaluate multi-wearable support (Strava, Apple Health) using same architectural pattern
