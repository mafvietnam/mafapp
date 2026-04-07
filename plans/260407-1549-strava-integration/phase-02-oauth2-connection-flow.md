# Phase 2: OAuth2 Connection Flow

## Overview
- **Priority:** P0 (blocks Phase 3)
- **Status:** Pending
- **Effort:** 2d
- **Depends on:** Phase 1

Implement full OAuth2 connect/disconnect flow: redirect to Strava → callback → token exchange → encrypted storage. Add frontend connect card. This replaces the credential-based approach used in Garmin.

## Related Files

- **Mirror pattern from:** `api/src/garmin/garmin.controller.ts`, `api/src/garmin/garmin.service.ts`
- **Mirror frontend from:** `src/components/garmin-connect-card.tsx`, `src/services/garmin-service.ts`
- **Modify:** `src/components/profile-page.tsx` (add Strava connect card)

## Strava OAuth2 Endpoints

Strava authorization URL:
```
https://www.strava.com/oauth/authorize
  ?client_id={STRAVA_CLIENT_ID}
  &redirect_uri={BACKEND_URL}/strava/callback
  &response_type=code
  &scope=read,activity:read_all
  &approval_prompt=auto
```

Token exchange endpoint: `POST https://www.strava.com/oauth/token`

Token refresh endpoint: `POST https://www.strava.com/oauth/token` (grant_type=refresh_token)

## Backend: StravaAuthService

### Files to Create/Modify
- Create: `api/src/strava/strava-auth.service.ts`
- Create: `api/src/strava/strava-token.service.ts`
- Modify: `api/src/strava/strava.service.ts` (add connect/disconnect/status logic)
- Modify: `api/src/strava/strava.controller.ts` (add routes)
- Modify: `api/src/strava/strava.module.ts` (register new services)

### strava-auth.service.ts
```typescript
@Injectable()
export class StravaAuthService {
  getAuthorizationUrl(userId: string): string
  // Returns Strava OAuth URL with state param (userId encoded)

  exchangeCodeForTokens(code: string): Promise<StravaTokenResponse>
  // POST https://www.strava.com/oauth/token with grant_type=authorization_code

  refreshAccessToken(encryptedRefreshToken: string): Promise<StravaTokenResponse>
  // POST https://www.strava.com/oauth/token with grant_type=refresh_token
}
```

### strava-token.service.ts
```typescript
@Injectable()
export class StravaTokenService {
  // Auto-refresh access token if expiry within 5 minutes
  async getValidAccessToken(userId: string): Promise<string>

  // Update tokens in DB after refresh
  async updateTokens(userId: string, tokenResponse: StravaTokenResponse): Promise<void>
}
```

### Controller Routes

All authenticated routes use `@UseGuards(JwtAuthGuard)`:

```typescript
// Redirect user to Strava OAuth page
GET /strava/connect
// → redirect to strava.com/oauth/authorize (no auth guard, carries userId in state)

// Strava redirects here after user grants access
GET /strava/callback?code=xxx&state=userId&scope=...
// → exchange code → encrypt tokens → store StravaConnection → redirect to frontend

// Disconnect Strava account
POST /strava/disconnect
// @Throttle(3, 60) — delete connection + all activities

// Connection status
GET /strava/status
// → returns { connected, stravaAthleteId, lastSyncAt, status }

// Manual sync trigger
POST /strava/sync
// @Throttle(1, 300) — async sync, returns 202 immediately
```

### State Parameter (Security)
- On `/connect`: encode `userId` in `state` param (sign with HMAC-SHA256 using `JWT_SECRET`)
- On `/callback`: verify state signature before processing
- Prevents CSRF attacks on OAuth callback

### Disconnect Logic
```typescript
async disconnect(userId: string): Promise<void> {
  const lock = await this.redis.set(`strava:sync:${userId}`, '1', 'NX', 'EX', 30);
  // Delete StravaConnection
  // Delete all StravaActivity for user
  // Unflag isDuplicate on any GarminActivity marked duplicate by Strava
  // Release lock
}
```

## Backend: Token Storage

Strava token response fields to store:
```typescript
interface StravaTokenResponse {
  access_token: string;    // expires_at ~6h → encrypt → StravaConnection.accessToken
  refresh_token: string;   // long-lived → encrypt → StravaConnection.refreshToken
  expires_at: number;      // unix timestamp → StravaConnection.tokenExpiresAt
  athlete: {
    id: number;            // → StravaConnection.stravaAthleteId
  }
}
```

## Frontend: StravaConnectCard

### Files to Create
- `src/components/strava-connect-card.tsx` — mirror of `garmin-connect-card.tsx`
- `src/services/strava-service.ts` — mirror of `garmin-service.ts`

### strava-service.ts methods
```typescript
getStravaStatus(): Promise<StravaStatus>
connectStrava(): void  // window.location.href = /api/strava/connect
disconnectStrava(): Promise<void>
triggerSync(): Promise<void>
getActivities(params): Promise<PaginatedActivities>
```

### strava-connect-card.tsx states
- **Not connected:** "Connect Strava" button → triggers OAuth redirect
- **Connected:** athlete name, last sync time, "Sync Now" + "Disconnect" buttons
- **Error:** show error message, retry button

### Profile Page Integration
Add `<StravaConnectCard />` to `src/components/profile-page.tsx` below existing GarminConnectCard (or in same "Integrations" section).

## Implementation Steps

1. Create `strava-auth.service.ts` with `getAuthorizationUrl()` and `exchangeCodeForTokens()`
2. Create `strava-token.service.ts` with `getValidAccessToken()` (check expiry, auto-refresh)
3. Update `strava.service.ts`: add `getStatus()`, `connect()` (save tokens), `disconnect()`
4. Update `strava.controller.ts`: add all 5 routes with correct guards/throttles
5. Register new services in `strava.module.ts`
6. Add HttpModule to `strava.module.ts` imports (for token exchange HTTP calls)
7. Create `src/services/strava-service.ts`
8. Create `src/components/strava-connect-card.tsx`
9. Add StravaConnectCard to profile-page.tsx (FEATURE_STRAVA gated)
10. Compile check: `cd api && npx tsc --noEmit`
11. Manual test: connect flow end-to-end, verify tokens stored encrypted

## Todo

- [ ] strava-auth.service.ts — OAuth URL builder + code exchange
- [ ] strava-token.service.ts — getValidAccessToken with auto-refresh
- [ ] strava.service.ts — getStatus, disconnect, save tokens from callback
- [ ] strava.controller.ts — 5 routes (connect, callback, disconnect, status, sync)
- [ ] strava.module.ts — register HttpModule + new services
- [ ] src/services/strava-service.ts
- [ ] src/components/strava-connect-card.tsx
- [ ] profile-page.tsx — add StravaConnectCard (FEATURE_STRAVA gated)
- [ ] Compile check passes
- [ ] Manual OAuth flow test

## Success Criteria

- GET /strava/connect redirects to strava.com with correct scopes
- Callback stores encrypted tokens in StravaConnection
- GET /strava/status returns correct connection state
- POST /strava/disconnect deletes all data + unflag Garmin duplicates
- Frontend card shows connected state with athlete name
- Token auto-refresh works when token within 5 min of expiry

## Security Considerations

- State param signed with HMAC — prevents OAuth CSRF
- Tokens never returned from API (status endpoint returns stravaAthleteId only)
- Disconnect requires JWT auth — user can only disconnect their own account
- Rate limit: connect 1/60s (via redirect, not stored), disconnect 3/60s, sync 1/300s
