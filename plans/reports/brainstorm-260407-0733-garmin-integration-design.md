# Garmin Integration Design — MAF Running Coach

**Date:** 2026-04-07 | **Status:** Agreed | **Approach:** Two-Track (Unofficial MVP + Official API)

---

## Problem Statement

MAF app requires manual HR input in MAF Lab. Users want automatic data sync from Garmin devices — activity HR for MAF calculations, daily health summaries for dashboard, and profile sync.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Two-Track | Fast MVP now + stable official API later |
| Auth UX | OAuth redirect | Consistent with existing Google OAuth flow |
| MVP Scope | Full integration | Auto-fill MAF Lab + activity list + dashboard stats |
| Entity | Registered company (VN) | Eligible for official Garmin Developer Program |

---

## Part 1: Garmin Developer Program Registration Guide

### Step 1: Apply (Do This TODAY)

1. Go to: https://www.garmin.com/en-US/forms/GarminConnectDeveloperAccess/
2. Fill form with:
   - **Company name**: Your registered company name
   - **Contact email**: Company email (not personal Gmail)
   - **APIs needed**: Health API, Activity API
   - **Use case description**: Write something like:

> "We operate MAF Vietnam (app.maf.run), a community wellness platform for MAF (Maximum Aerobic Function) training method coaching. We need Health API for daily metrics (HR, steps, sleep) and Activity API for activity heart rate data to auto-calculate personalized MAF training zones. Our platform serves the Vietnamese running community with ~[N] active users. We need to sync Garmin activity data to provide automated heart rate zone analysis and training recommendations based on Dr. Phil Maffetone's MAF method."

3. Submit and wait — Garmin typically responds within **2 business days**

### Step 2: After Approval

1. You'll receive access to **Garmin Developer Portal** (`developerportal.garmin.com`)
2. Get **evaluation consumer key** (rate-limited, for development)
3. May be invited to **integration call** with Garmin team
4. Build + test against evaluation environment

### Step 3: Go to Production

1. After integration is working, request **production consumer key**
2. Garmin verifies integration quality
3. Production key = higher rate limits

### Important Notes
- **Free access** (no fees for API usage)
- Commercial use may require licensing discussion
- OAuth 1.0a deprecated 12/31/2026 — build with OAuth 2.0 only

---

## Part 2: Technical Architecture

### Current Stack (Relevant)
- **Backend**: NestJS 10, Passport.js, Prisma 6.19, PostgreSQL 15, Redis 7
- **Auth**: OAuth 2 PKCE (Google), JWT RS256, refresh tokens in Redis
- **Frontend**: React 19, TypeScript, Tailwind CSS

### Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│                                                     │
│  Profile/Settings ──► [Connect Garmin] button        │
│  Dashboard ──► Daily HR, Steps, Sleep widgets        │
│  MAF Lab ──► Auto-fill HR from latest Garmin run     │
│  Activities ──► List of synced Garmin activities      │
└────────────────────┬────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────┐
│                   BACKEND (NestJS)                    │
│                                                      │
│  GarminModule                                        │
│  ├── garmin.controller.ts   (OAuth + API endpoints)  │
│  ├── garmin.service.ts      (Sync logic, data fetch) │
│  ├── garmin-auth.service.ts (OAuth 2 PKCE flow)      │
│  ├── garmin-sync.service.ts (Activity/health sync)   │
│  └── garmin.cron.ts         (Periodic sync job)      │
│                                                      │
│  Prisma Models                                       │
│  ├── GarminConnection (tokens, userId, status)       │
│  ├── GarminActivity   (activities, HR, zones)        │
│  └── GarminDailySummary (steps, HR, sleep, stress)   │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    PostgreSQL    Redis     Garmin API
    (data)     (tokens)   (Health + Activity)
```

### Database Schema (New Prisma Models)

```prisma
model GarminConnection {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  garminUserId  String?  @unique
  accessToken   String   // encrypted
  refreshToken  String   // encrypted
  tokenExpiry   DateTime?
  status        GarminConnectionStatus @default(CONNECTED)
  lastSyncAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum GarminConnectionStatus {
  CONNECTED
  DISCONNECTED
  TOKEN_EXPIRED
  ERROR
}

model GarminActivity {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  garminActivityId String  @unique
  activityType    String   // RUNNING, WALKING, CYCLING, etc.
  startTime       DateTime
  duration        Int      // seconds
  distance        Float?   // meters
  avgHeartRate    Int?
  maxHeartRate    Int?
  minHeartRate    Int?
  avgPace         Float?   // min/km
  calories        Int?
  vo2Max          Float?
  trainingEffect  Float?
  rawData         Json?    // full Garmin response
  createdAt       DateTime @default(now())

  @@index([userId, startTime])
}

model GarminDailySummary {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date            DateTime @db.Date
  steps           Int?
  restingHeartRate Int?
  avgHeartRate    Int?
  maxHeartRate    Int?
  minHeartRate    Int?
  sleepDuration   Int?     // minutes
  sleepScore      Float?
  stressAvg       Int?
  calories        Int?
  activeMinutes   Int?
  rawData         Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, date])
  @@index([userId, date])
}
```

### Auth Flow — Two Tracks

<!-- RED TEAM: Finding #9 — Clarified that MVP uses credential login, NOT OAuth redirect -->
**MVP (Phase 2):** User enters Garmin email/password in a form. Backend uses `garmin-connect` lib for programmatic login. Credentials stored encrypted. NOT an OAuth redirect.

**Production (Phase 5):** Proper OAuth 2 PKCE redirect (like Google). User clicks button → redirected to Garmin → consent → callback. No passwords stored.

### OAuth 2 PKCE Flow (Phase 5 — Official API Only)

```
User clicks "Connect Garmin"
  │
  ▼
Frontend: GET /api/garmin/auth
  │
  ▼
Backend: Generate state + code_verifier + code_challenge
  Store in Redis (5 min TTL)
  Redirect to: https://apis.garmin.com/oauth-service/oauth/authorize
    ?client_id=XXX
    &redirect_uri=https://app.maf.run/api/garmin/callback
    &response_type=code
    &scope=health_api activity_api
    &state={random}
    &code_challenge={S256_hash}
    &code_challenge_method=S256
  │
  ▼
User logs into Garmin, grants consent
  │
  ▼
Garmin redirects: /api/garmin/callback?code=XXX&state=YYY
  │
  ▼
Backend: Verify state, exchange code for tokens
  POST https://apis.garmin.com/oauth-service/oauth/token
  Store access_token + refresh_token (encrypted) in GarminConnection
  Trigger initial data backfill
  │
  ▼
Redirect user to /profile?garmin=connected
```

### API Endpoints (New)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/garmin/auth` | Yes | Initiate OAuth redirect |
| GET | `/garmin/callback` | No | OAuth callback |
| POST | `/garmin/disconnect` | Yes | Remove Garmin connection |
| GET | `/garmin/status` | Yes | Connection status + last sync |
| GET | `/garmin/activities` | Yes | List synced activities (paginated) |
| GET | `/garmin/activities/:id` | Yes | Single activity detail |
| GET | `/garmin/daily-summary` | Yes | Daily health data (date range) |
| POST | `/garmin/sync` | Yes | Manual trigger sync |

### Frontend Changes

**Profile/Settings page** — new "Connected Devices" section:
- [Connect Garmin] button → OAuth redirect
- Status indicator (connected/disconnected/error)
- Last sync timestamp
- [Disconnect] button

**Dashboard page** — new widgets:
- Today's steps, resting HR, sleep duration
- Weekly HR trend chart
- Recent activities list (last 5)

**MAF Lab** — auto-fill enhancement:
- If Garmin connected + recent running activity exists → auto-populate:
  - `lastLongRunHeartRate` from activity avgHeartRate
  - `lastLongRunDuration` from activity duration
- User can override manually
- Show "From Garmin: Run on Apr 7, avg HR 142" label

**New Activities page** (or tab in Dashboard):
- Paginated list of Garmin activities
- Each shows: type, date, duration, avg HR, distance
- Click → detail view with HR zones breakdown
- "Use in MAF Lab" button per activity

### Sync Strategy (MVP)

**Initial sync**: On first connect, backfill last 30 days of activities + daily summaries

**Ongoing sync**: Cron job every 2 hours
- Check all connected users
- Fetch new activities since last sync
- Fetch daily summaries for today
- Update database

**Later (Official API)**: Replace cron with webhook push notifications

### Security Considerations

- Encrypt Garmin tokens at rest (AES-256, key in env var)
- Store tokens in PostgreSQL (GarminConnection), not Redis (need persistence)
- Rate limit sync endpoints (prevent abuse)
- CORS restricted to app.maf.run
- User can disconnect anytime → tokens deleted immediately

---

## Part 3: Implementation Phases

### Phase 1: Foundation (Days 1-3)
- [ ] Apply for Garmin Developer Program (TODAY)
- [ ] Add Prisma models (GarminConnection, GarminActivity, GarminDailySummary)
- [ ] Run migration
- [ ] Create GarminModule skeleton in NestJS
- [ ] Install `garmin-connect` npm package for MVP

### Phase 2: OAuth + Connection (Days 4-6)
- [ ] Implement OAuth PKCE flow (garmin-auth.service.ts)
- [ ] /garmin/auth + /garmin/callback endpoints
- [ ] Store encrypted tokens in GarminConnection
- [ ] /garmin/disconnect endpoint
- [ ] /garmin/status endpoint
- [ ] Frontend: "Connect Garmin" button on Profile page

### Phase 3: Data Sync (Days 7-10)
- [ ] garmin-sync.service.ts: fetch activities, daily summaries
- [ ] Initial backfill (last 30 days) on first connect
- [ ] Cron job for periodic sync (every 2 hours)
- [ ] /garmin/activities + /garmin/daily-summary endpoints
- [ ] Frontend: Activities list page/tab

### Phase 4: MAF Lab Integration (Days 11-13)
- [ ] Auto-fill MAF Lab fields from latest Garmin run
- [ ] "From Garmin" label showing source activity
- [ ] User override capability (manual input still works)
- [ ] Dashboard daily health widgets (HR, steps, sleep)

### Phase 5: Official API Migration (After Approval)
- [ ] Replace garmin-connect lib with official Health API + Activity API
- [ ] Implement webhook receiver for push notifications
- [ ] Remove cron polling (replace with webhook-triggered sync)
- [ ] Request production consumer key

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Garmin Developer approval denied | High | Strong use case (community health), registered company |
| Unofficial lib breaks | Medium | Abstract behind service interface → swap to official API |
| Rate limiting on eval key | Low | 2hr sync interval, cache aggressively |
| Token expiry during sync | Medium | Auto-refresh before API calls, retry on 401 |
| User Garmin device not synced | Low | Show "last sync" time, explain data delay (1-4h) |

---

## Unresolved Questions

1. Exact Garmin OAuth 2 scopes — need to verify `health_api` and `activity_api` scope names from developer portal after approval
2. Garmin webhook payload format — need to test with evaluation key
3. Token encryption key management — should use env var or dedicated secrets manager?
4. Whether `garmin-connect` npm lib supports OAuth redirect flow for web apps or only programmatic auth

---

## References

- Research report: `plans/reports/researcher-260407-0732-garmin-api-research.md`
- Strava research (earlier): `plans/reports/researcher-260407-0655-strava-api-research.md`
- Garmin Developer Form: https://www.garmin.com/en-US/forms/GarminConnectDeveloperAccess/
- Garmin OAuth 2 PKCE Spec: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf
- garmin-connect npm: https://www.npmjs.com/package/garmin-connect
