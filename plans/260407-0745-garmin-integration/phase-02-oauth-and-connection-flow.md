# Phase 2: OAuth & Connection Flow

## Context Links
- [Plan Overview](plan.md)
- [Phase 1 — Foundation](phase-01-foundation-and-prisma-models.md) (blocker)
- [Design Doc](../reports/brainstorm-260407-0733-garmin-integration-design.md)
- Existing Google OAuth: `api/src/auth/auth.controller.ts`, `api/src/auth/google.strategy.ts`
- Frontend profile page: `src/pages/profile-page.tsx`
- API client: `src/services/api-client.ts`

## Overview
- **Priority:** P1
- **Status:** Pending (blocked by Phase 1)
- **Effort:** 3 days
- **Description:** Implement Garmin OAuth flow using `garmin-connect` library for MVP. Users connect via button on Profile page, backend exchanges credentials, stores encrypted tokens, provides status + disconnect endpoints.

## Key Insights

### garmin-connect Library Auth (MVP)
The `garmin-connect` npm lib does NOT use standard OAuth redirect. It uses **programmatic login** with Garmin credentials (email/password), then maintains session cookies internally. This means:
- **MVP auth flow**: User provides their Garmin email/password in a form on the frontend. Backend uses `garmin-connect` to authenticate, stores the session/tokens encrypted.
- **NOT a redirect flow** like Google OAuth. The library handles Garmin's SSO behind the scenes.
- When official API access is granted (Phase 5), we switch to proper OAuth 2 PKCE redirect.

### Implications for UX
- Phase 2 MVP: form-based connect (email + password) — simpler than redirect
- Phase 5: full OAuth redirect like Google — better UX, no password handling
- Must clearly communicate to user that credentials are encrypted and not stored in plaintext

### Existing Patterns to Follow
- Auth controller uses `cookieOptions()` helper, `@Throttle` decorator
- Services use `Logger`, `ConfigService` injection
- Frontend uses `api.get/post` from `src/services/api-client.ts`
- Profile page uses `useAuth()` context + `useEffect` for server data fetch

## Requirements

### Functional
- Connect endpoint: accepts Garmin email/password, authenticates via `garmin-connect`, stores session
- Disconnect endpoint: removes GarminConnection record, clears stored credentials
- Status endpoint: returns connection state, last sync time, garmin user info
- Frontend: "Connected Devices" section on Profile page with connect form / status display
- Token refresh: `garmin-connect` handles session renewal internally; store updated tokens on each sync

### Non-Functional
- Garmin credentials encrypted at rest via GarminEncryptionService (Phase 1)
- Rate limit connect endpoint (prevent brute force): 3 attempts per minute
- Credentials never logged, never returned in API responses
- Graceful error handling: wrong password, Garmin service down, account locked

### ⚠️ RED TEAM: Credential Storage Mitigations (Finding #2)
MVP stores user Garmin email/password (encrypted). This is a known security liability. Required mitigations:
- **User consent**: Connect form must explicitly state "Thong tin dang nhap duoc luu tam thoi va ma hoa. Khong chia se voi ben thu 3."
- **Time-box**: Hard deadline to migrate to Phase 5 (official OAuth) within 4 weeks of MVP launch
- **Delete capability**: Add "Xoa thong tin Garmin" button that wipes credentials immediately (separate from disconnect)
- **Recommend unique password**: UI note "Nen su dung mat khau rieng cho Garmin"

## Architecture

### Backend Flow (MVP — garmin-connect lib)

```
Frontend                    Backend                         Garmin
   |                           |                               |
   |-- POST /garmin/connect -->|                               |
   |   {email, password}       |                               |
   |                           |-- GarminConnect.login() ----->|
   |                           |   (lib handles SSO)           |
   |                           |<--- session cookies ----------|
   |                           |                               |
   |                           | encrypt(email, password)      |
   |                           | upsert GarminConnection       |
   |                           | set status = CONNECTED        |
   |                           |                               |
   |<-- 200 {connected: true} |                               |
```

### API Endpoints (This Phase)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/garmin/connect` | JWT | Connect Garmin account (email/password) |
| POST | `/garmin/disconnect` | JWT | Remove Garmin connection |
| GET | `/garmin/status` | JWT | Connection status + last sync |

### DTOs

```typescript
// garmin-connect.dto.ts
export class ConnectGarminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export interface GarminStatusResponse {
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'TOKEN_EXPIRED' | 'ERROR' | null;
  garminUserId: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
}
```

### Frontend Component

New section in `profile-page.tsx` — "Thiet bi ket noi" (Connected Devices):

```
┌──────────────────────────────────────────┐
│  Thiết bị kết nối                        │
│                                          │
│  [Garmin icon]  Garmin Connect           │
│                                          │
│  IF NOT CONNECTED:                       │
│  ┌────────────────────────────────────┐  │
│  │ Email:    [________________]       │  │
│  │ Password: [________________]       │  │
│  │                                    │  │
│  │ [Kết nối Garmin]                   │  │
│  │                                    │  │
│  │ * Thông tin được mã hóa AES-256   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  IF CONNECTED:                           │
│  ┌────────────────────────────────────┐  │
│  │ ✓ Đã kết nối                      │  │
│  │ Đồng bộ lần cuối: 2 giờ trước    │  │
│  │                                    │  │
│  │ [Ngắt kết nối]                    │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `api/src/garmin/garmin.controller.ts` | Add connect, disconnect, status endpoints |
| `api/src/garmin/garmin.service.ts` | Add connect, disconnect, getStatus methods |
| `api/src/garmin/garmin.module.ts` | Add DTO validation imports if needed |
| `src/pages/profile-page.tsx` | Add "Connected Devices" section |

### Files to Create
| File | Purpose |
|------|---------|
| `api/src/garmin/garmin-connect.dto.ts` | Validation DTOs for connect request |
| `src/services/garmin-service.ts` | Frontend API client for Garmin endpoints |
| `src/components/garmin-connect-card.tsx` | Connect/disconnect UI component |

## Implementation Steps

### Step 1: Create garmin-connect.dto.ts

Create `api/src/garmin/garmin-connect.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConnectGarminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
```

Verify `class-validator` and `class-transformer` are already installed (NestJS default). If not: `npm install class-validator class-transformer`.

### Step 2: Implement garmin.service.ts — connect method

In `api/src/garmin/garmin.service.ts`, add:

2.1. Import `GarminConnect` from `garmin-connect` package

2.2. Add `connect(userId: string, email: string, password: string)` method:
- Create `new GarminConnect({ username: email, password })` instance
- Call `await client.login()` — this authenticates with Garmin
- On success: get user profile via `client.getUserProfile()` to extract `garminUserId` (displayName)
- Encrypt email and password using `GarminEncryptionService`
- Upsert `GarminConnection` record:
  - `userId`, `garminUserId`, `accessToken` = encrypted email, `refreshToken` = encrypted password
  - `status` = CONNECTED, `lastSyncAt` = null (first sync happens in Phase 3)
- Return `{ connected: true }`
- On failure: throw `UnauthorizedException('Invalid Garmin credentials')` or `InternalServerErrorException` for network issues

2.3. Add `disconnect(userId: string)` method:
<!-- RED TEAM: Finding #14 — Disconnect must be a first-class cleanup with explicit deletes and sync lock -->
- Acquire per-user Redis lock (`garmin:sync:${userId}`) to prevent concurrent sync
- Set `GarminConnection.status = DISCONNECTED` first (so any in-flight sync bails out)
- Delete `GarminDailySummary` records: `prisma.garminDailySummary.deleteMany({ where: { userId } })`
- Delete `GarminActivity` records: `prisma.garminActivity.deleteMany({ where: { userId } })`
- Delete `GarminConnection` record: `prisma.garminConnection.delete({ where: { userId } })`
- Release Redis lock
- Return `{ disconnected: true }`

2.4. Add `getStatus(userId: string)` method:
- Find `GarminConnection` where `userId` matches
- If not found: return `{ connected: false, status: null, ... }`
- If found: return status, lastSyncAt, garminUserId, createdAt
- Never return tokens

2.5. Add `getAuthenticatedClient(userId: string)` helper (used by Phase 3):
- Load GarminConnection for userId
- Decrypt email/password
- Create + login `GarminConnect` instance
- Return authenticated client
- Throw if connection not found or login fails (mark status = ERROR)

### Step 3: Implement garmin.controller.ts — endpoints

In `api/src/garmin/garmin.controller.ts`:

3.1. Add imports: `UseGuards`, `Post`, `Get`, `Body`, `Req` from `@nestjs/common`, `JwtAuthGuard`, `Throttle`

3.2. Add `@UseGuards(JwtAuthGuard)` at class level (all endpoints require auth)

3.3. Implement endpoints:

```typescript
@Post('connect')
@Throttle({ default: { limit: 3, ttl: 60000 } })
async connect(@Req() req: Request, @Body() dto: ConnectGarminDto) {
  const userId = (req.user as { sub: string }).sub;
  return this.garminService.connect(userId, dto.email, dto.password);
}

@Post('disconnect')
async disconnect(@Req() req: Request) {
  const userId = (req.user as { sub: string }).sub;
  return this.garminService.disconnect(userId);
}

@Get('status')
async getStatus(@Req() req: Request) {
  const userId = (req.user as { sub: string }).sub;
  return this.garminService.getStatus(userId);
}
```

3.4. Add proper type import for the JWT payload. Check `api/src/auth/auth.types.ts` for `TokenPayload` interface and use it.

### Step 4: Create frontend garmin-service.ts

Create `src/services/garmin-service.ts`:

```typescript
import { api } from './api-client';

export interface GarminStatus {
  connected: boolean;
  status: string | null;
  garminUserId: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
}

export async function getGarminStatus(): Promise<GarminStatus | null> {
  const res = await api.get('/garmin/status');
  if (!res.ok) return null;
  return res.json();
}

export async function connectGarmin(email: string, password: string): Promise<boolean> {
  const res = await api.post('/garmin/connect', { email, password });
  return res.ok;
}

export async function disconnectGarmin(): Promise<boolean> {
  const res = await api.post('/garmin/disconnect');
  return res.ok;
}
```

### Step 5: Create garmin-connect-card.tsx component

Create `src/components/garmin-connect-card.tsx`:

5.1. Props: none (self-contained, fetches own data)

5.2. State:
- `status: GarminStatus | null` — fetched on mount
- `loading: boolean` — initial fetch loading
- `connecting: boolean` — connect request in flight
- `email: string`, `password: string` — form inputs
- `error: string` — error message

5.3. On mount: call `getGarminStatus()`, populate state

5.4. If not connected — render connect form:
- Email input, password input
- "Ket noi Garmin" button (gradient style matching existing buttons)
- Security note: "Thong tin duoc ma hoa AES-256"
- Error display if connect fails

5.5. If connected — render status card:
- Green checkmark + "Da ket noi" label
- Last sync time (relative: "2 gio truoc") — use simple `getTimeAgo()` helper
- "Ngat ket noi" button (red/danger style)

5.6. Keep component under 150 lines. Extract time formatting to a utility if needed.

### Step 6: Add garmin-connect-card to profile-page.tsx

In `src/pages/profile-page.tsx`:

6.1. Import `GarminConnectCard` from `../components/garmin-connect-card`

6.2. Add a new section after the "Suc khoe" (Health) card and before the "Muc do cam ket" (Commitment) card:
```tsx
{/* Connected Devices */}
<GarminConnectCard />
```

The card itself handles its own desktop-card styling to match siblings.

### Step 7: Verify end-to-end flow

7.1. Start backend: `cd api && npm run start:dev`
7.2. Start frontend: `npm run dev`
7.3. Navigate to Profile page
7.4. Enter Garmin credentials, click Connect
7.5. Verify GarminConnection record created in database
7.6. Verify status endpoint returns correct state
7.7. Click Disconnect, verify record removed

### Step 8: Build check

```bash
cd api && npm run build
cd .. && npm run build
```

## Todo List

- [ ] Create `garmin-connect.dto.ts` with validation decorators
- [ ] Implement `garmin.service.ts` — `connect()` method with garmin-connect lib
- [ ] Implement `garmin.service.ts` — `disconnect()` method
- [ ] Implement `garmin.service.ts` — `getStatus()` method
- [ ] Implement `garmin.service.ts` — `getAuthenticatedClient()` helper
- [ ] Implement `garmin.controller.ts` — POST `/garmin/connect` endpoint
- [ ] Implement `garmin.controller.ts` — POST `/garmin/disconnect` endpoint
- [ ] Implement `garmin.controller.ts` — GET `/garmin/status` endpoint
- [ ] Create `src/services/garmin-service.ts` frontend API client
- [ ] Create `src/components/garmin-connect-card.tsx` component
- [ ] Add GarminConnectCard to `profile-page.tsx`
- [ ] Test connect flow end-to-end
- [ ] Test disconnect flow
- [ ] Test error handling (wrong password, network failure)
- [ ] Verify both frontend and backend build cleanly

## Success Criteria

- User can connect Garmin account from Profile page with email/password
- GarminConnection record created with encrypted tokens (verify in DB — tokens are gibberish)
- Status endpoint returns `{ connected: true, status: 'CONNECTED', ... }`
- Disconnect removes record and shows connect form again
- Wrong credentials return clear error message, not 500
- Rate limit on connect endpoint works (4th attempt in 1 min = 429)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `garmin-connect` login blocked by Garmin CAPTCHA | Medium | High | Implement retry with delay; document workaround (user logs in on browser first); Phase 5 replaces this entirely |
| User password stored (even encrypted) raises trust concern | Medium | Medium | Clear UI messaging about encryption; Phase 5 eliminates password storage entirely |
| garmin-connect lib session expires between syncs | High | Medium | Re-authenticate on each sync (Phase 3); `getAuthenticatedClient()` always creates fresh session |
| Two-factor auth on Garmin account | Low | High | Document that 2FA must be disabled for MVP; Phase 5 handles 2FA natively via OAuth |

## Security Considerations

- **Credentials at rest**: AES-256-GCM encrypted via `GarminEncryptionService`
- **Credentials in transit**: HTTPS only (enforced by Cloudflare Tunnel)
- **Credentials in memory**: Only decrypted during active `garmin-connect` session, garbage collected after
- **Rate limiting**: 3 connect attempts per minute per IP (Throttle decorator)
- **No credential leakage**: Status endpoint never returns tokens; logs never include credentials
- **CORS**: Already restricted to `app.maf.run` in main.ts
- **User consent**: Connect form includes explicit note that credentials are encrypted

## Next Steps

Phase 3 uses `getAuthenticatedClient()` to fetch activities and daily health summaries, implementing the sync engine and cron job.
