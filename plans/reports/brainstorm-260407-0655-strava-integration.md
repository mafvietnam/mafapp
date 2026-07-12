# Brainstorm: Strava Integration for MAF Running Coach

**Date:** 2026-04-07  
**Status:** Approved  
**Approach:** Simple & Direct (Passport OAuth + Direct API)

---

## Problem Statement

MAF Running Coach needs Strava integration to:
- Auto-import running activities with detailed HR/cadence/speed data
- Analyze MAF zone compliance from real workout data
- Provide another OAuth login option alongside Google/WordPress
- Keep data fresh via webhooks when users upload new activities

## Requirements

**Functional:**
- Strava OAuth login (3rd provider alongside Google + WordPress)
- "Connect Strava" from profile settings for existing users
- Import last 30 days of activities on first connect
- Fetch detailed streams: heart rate, cadence, speed, altitude
- Webhook endpoint for real-time new activity sync
- Disconnect Strava option in profile
- Activity list and detail views

**Non-functional:**
- Stay within Strava rate limits (200 req/15min, 2000/day)
- Encrypt stored Strava tokens
- Respond to webhook within 2 seconds
- Handle token rotation correctly (Strava invalidates old refresh tokens)

---

## Step 0: Register Strava API Application (Manual)

1. Go to https://www.strava.com/settings/api
2. Click "Create an Application"
3. Fill in:
   - **Application Name:** MAF Running Coach
   - **Category:** Training
   - **Website:** https://app.maf.run
   - **Authorization Callback Domain:** `api.maf.run` (prod) / `localhost` (dev)
   - **Description:** MAF heart rate training analysis app
4. Note down **Client ID** and **Client Secret**
5. Add to `.env`:
   ```
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   STRAVA_CALLBACK_URL=http://localhost:3001/auth/strava/callback
   ```
6. Production `.env` uses `https://api.maf.run/auth/strava/callback`

---

## Step 1: Database Schema Changes

### Add to User model
```prisma
stravaId  String?  @unique    // Strava athlete ID
```

### New models
```prisma
model StravaToken {
  id           String   @id @default(uuid())
  userId       String   @unique
  accessToken  String                    // encrypted
  refreshToken String                    // encrypted
  expiresAt    DateTime
  scope        String                    // granted scopes
  athleteId    Int                       // Strava athlete ID
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StravaActivity {
  id                String    @id @default(uuid())
  userId            String
  stravaActivityId  BigInt    @unique
  name              String
  type              String                // Run, Ride, etc.
  sportType         String?
  startDate         DateTime
  movingTime        Int                   // seconds
  elapsedTime       Int                   // seconds
  distance          Float                 // meters
  totalElevation    Float?                // meters
  avgSpeed          Float?                // m/s
  maxSpeed          Float?                // m/s
  avgHeartRate      Float?
  maxHeartRate      Float?
  avgCadence        Float?
  calories          Float?
  hasStreams         Boolean   @default(false)
  rawData           Json?                 // full Strava response
  syncedAt          DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  streams           StravaActivityStream?
}

model StravaActivityStream {
  id           String  @id @default(uuid())
  activityId   String  @unique
  time         Int[]               // seconds from start
  heartRate    Int[]               // bpm per second
  cadence      Float[]             // steps/min
  velocity     Float[]             // m/s
  altitude     Float[]             // meters
  distance     Float[]             // cumulative meters
  activity     StravaActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
}
```

### User model relation additions
```prisma
model User {
  // existing fields...
  stravaId        String?          @unique
  stravaToken     StravaToken?
  stravaActivities StravaActivity[]
}
```

---

## Step 2: Backend — Strava OAuth (NestJS + Passport)

### Files to create
```
api/src/strava/
├── strava.module.ts
├── strava.strategy.ts            // Passport OAuth2 strategy
├── strava.controller.ts          // Auth + API endpoints
├── strava.service.ts             // Strava API client
├── strava-token.service.ts       // Token storage + refresh
├── strava-sync.service.ts        // Activity import logic
├── strava-webhook.service.ts     // Webhook handling
└── strava.guard.ts               // Guard for Strava OAuth
```

### OAuth Flow
1. `GET /auth/strava` → redirect to Strava consent screen
   - Scopes: `read,activity:read_all,profile:read_all`
   - Include `state` param for CSRF protection
2. `GET /auth/strava/callback` → exchange code for tokens
   - Store access + refresh tokens in StravaToken table
   - Create or link User (find by stravaId or email)
   - Set JWT cookies (same as Google flow)
   - Redirect to frontend

### Token Refresh Logic
- Before any Strava API call, check `expiresAt`
- If < 5 min remaining → POST `/oauth/token` with refresh token
- **Critical:** Store NEW refresh token immediately (old one is invalidated)

---

## Step 3: Backend — Activity Sync

### Initial sync (on first connect)
1. Fetch `GET /athlete/activities?after={30_days_ago}&per_page=30`
2. Paginate if needed (max 200 per page)
3. For each activity: fetch `GET /activities/{id}/streams?keys=heartrate,cadence,velocity_smooth,altitude,distance,time`
4. Store in StravaActivity + StravaActivityStream tables
5. Track rate limit headers, pause if approaching limit

### Ongoing sync (via webhook)
1. Webhook receives `{ object_type: "activity", aspect_type: "create", object_id: 123 }`
2. Fetch activity detail + streams
3. Store in DB

### Manual re-sync
- `POST /strava/sync` triggers fresh fetch of last 30 days
- Upsert activities (update if exists, create if new)

---

## Step 4: Backend — Webhook Endpoint

### Setup
1. `GET /strava/webhook` — verification endpoint
   - Strava sends `hub.mode`, `hub.challenge`, `hub.verify_token`
   - Return `{ "hub.challenge": value }` immediately
2. `POST /strava/webhook` — event receiver
   - Respond 200 immediately (within 2s)
   - Process event async (fetch activity, update DB)

### Events handled
| Event | Action |
|-------|--------|
| activity:create | Fetch + store activity & streams |
| activity:update | Re-fetch + update activity |
| activity:delete | Delete from DB |
| athlete:update | Re-fetch athlete profile |
| athlete:delete | Disconnect user's Strava |

### Webhook registration (one-time via CLI or admin endpoint)
```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -d client_id=YOUR_ID \
  -d client_secret=YOUR_SECRET \
  -d callback_url=https://api.maf.run/strava/webhook \
  -d verify_token=YOUR_VERIFY_TOKEN
```

---

## Step 5: Frontend Changes

### Login page
- Add "Connect with Strava" button (orange, Strava brand color #FC4C02)
- Strava provides official brand assets: https://developers.strava.com/guidelines/
- Button redirects to `GET /auth/strava`

### Profile settings
- "Connected Accounts" section
- Show Strava connection status (connected/disconnected)
- "Connect Strava" button if not connected
- "Disconnect" button if connected
- Show last sync date

### Activity views (future phase or included)
- Activity list with summary (date, distance, duration, avg HR)
- Activity detail with HR/cadence/speed charts
- MAF zone analysis (% time in MAF zone per activity)

---

## Step 6: Environment & Config

### New env vars
```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_CALLBACK_URL=http://localhost:3001/auth/strava/callback
STRAVA_WEBHOOK_VERIFY_TOKEN=random_string_for_webhook_verification
```

### Production callback domain
- Must match `api.maf.run` in Strava app settings
- Strava validates domain on callback redirect

---

## Rate Limit Strategy

| Scenario | API Calls | Risk |
|----------|-----------|------|
| New user connects (30 day sync) | ~60-90 calls | Medium |
| Webhook: new activity | 2 calls | Low |
| Manual re-sync | ~60-90 calls | Medium |
| 10 users connect same hour | 600-900 calls | **HIGH** — will hit 15-min limit |

**Mitigations:**
- Track `X-RateLimit-Usage` header in Redis
- If > 150/200 used in window, delay remaining requests
- Queue initial syncs sequentially (not all at once)
- Cache athlete profile (1 hour TTL)

---

## Implementation Phases

### Phase 1: OAuth + Login (Core)
- [ ] Register Strava API app
- [ ] Prisma schema migration (stravaId on User, StravaToken model)
- [ ] Strava Passport strategy
- [ ] Auth controller endpoints (login + callback)
- [ ] Token storage + refresh service
- [ ] Frontend: Strava login button
- [ ] Test OAuth flow end-to-end

### Phase 2: Activity Sync
- [ ] StravaActivity + StravaActivityStream models (migration)
- [ ] Strava API service (activities, streams)
- [ ] Initial sync service (last 30 days)
- [ ] Activity list + detail API endpoints
- [ ] Rate limit tracking in Redis
- [ ] Frontend: "Connect Strava" in profile settings

### Phase 3: Webhooks + Real-time
- [ ] Webhook verification endpoint
- [ ] Webhook event handler
- [ ] Register webhook subscription
- [ ] Handle activity create/update/delete events
- [ ] Handle athlete deauthorization
- [ ] Frontend: activity list/detail views

### Phase 4: MAF Analysis (Future)
- [ ] HR zone calculation from streams
- [ ] MAF zone compliance % per activity
- [ ] Progress tracking over time
- [ ] Charts and visualizations

---

## Security Considerations

- Store Strava tokens encrypted in DB (not plain text)
- Validate `state` parameter in OAuth callback (CSRF)
- Verify webhook `verify_token` matches expected value
- Never expose Client Secret to frontend
- Rate limit the sync endpoint (prevent abuse)
- Handle deauthorization properly (cleanup tokens)

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rate limit exceeded | High | Redis tracking + request queuing |
| Token rotation failure | High | Always persist new refresh token before using it |
| Webhook timeout | Medium | Respond immediately, process async |
| Strava API downtime | Low | Retry with backoff, cache existing data |
| User revokes access externally | Medium | Handle deauth webhook, show reconnect UI |

---

## Dependencies

- `passport-strava-oauth2` npm package
- Strava API app registration (manual step)
- Production: webhook requires public HTTPS URL (already have via Cloudflare Tunnel)

## Success Metrics

- Users can login via Strava
- Activities imported with HR/cadence/speed streams
- Webhook receives new activities within minutes of upload
- No rate limit errors in production
- Token refresh works silently (no re-auth needed)
