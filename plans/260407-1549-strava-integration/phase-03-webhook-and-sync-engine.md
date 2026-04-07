# Phase 3: Webhook & Sync Engine

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 3d
- **Depends on:** Phase 2 (needs valid OAuth tokens)

Implement Strava webhook subscription (real-time push), sync engine (fetch + upsert activities), deduplication logic against Garmin, and manual sync endpoint. This is the core data pipeline phase.

## Related Files

- **Mirror pattern from:** `api/src/garmin/garmin-sync.service.ts`, `api/src/garmin/garmin.service.ts`
- **Strava API docs:** https://developers.strava.com/docs/webhooks/
- **Modify:** `api/src/strava/strava-sync.service.ts`, `api/src/strava/strava.controller.ts`

## Strava Webhook Architecture

### How Strava Webhooks Work
1. **One-time subscription** per app (not per user) — done at startup
2. Strava sends `POST` to your endpoint on every event (new activity, update, delete)
3. Strava sends `GET` to your endpoint during subscription setup (challenge validation)
4. Events contain `owner_id` (athlete Strava ID) and `object_id` (activity ID)
5. Must respond within 2 seconds — fetch full activity details asynchronously

### Webhook Event Payload
```typescript
interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;           // activity ID
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;            // Strava athlete ID
  subscription_id: number;
  event_time: number;          // Unix timestamp
  updates?: Record<string, string>;
}
```

## Files to Create/Modify

- Create: `api/src/strava/strava-webhook.service.ts`
- Modify: `api/src/strava/strava-sync.service.ts` (fill out stub)
- Modify: `api/src/strava/strava.controller.ts` (add webhook routes)
- Modify: `api/src/strava/strava.module.ts` (register StravaWebhookService, ScheduleModule)

## StravaWebhookService

### Webhook Subscription Registration (on app startup)
```typescript
// Called once at app start (OnModuleInit) if FEATURE_STRAVA=true
async registerWebhookSubscription(): Promise<void> {
  // 1. Check existing subscription via GET https://www.strava.com/api/v3/push_subscriptions
  // 2. If exists and callback URL matches → store subscriptionId, done
  // 3. If exists with wrong URL → delete old subscription first
  // 4. POST https://www.strava.com/api/v3/push_subscriptions with:
  //    { client_id, client_secret, callback_url, verify_token }
  // 5. Strava immediately sends GET validation challenge to callback_url
  // 6. Store returned subscription_id in app config (or env)
}
```

### Webhook Endpoint (Public — No JWT)
```typescript
// GET /strava/webhook — Strava validation challenge (during subscription setup)
// Query: hub.mode, hub.verify_token, hub.challenge
// Response: { "hub.challenge": hub.challenge } if verify_token matches

// POST /strava/webhook — Real-time event push
// - Respond 200 immediately (within 2s)
// - Process event asynchronously (setImmediate)
// - Only handle: object_type=activity, aspect_type=create
// - Ignore: athlete events, update/delete events (out of scope for MVP)
```

### Event Processing Flow
```typescript
async processActivity(event: StravaWebhookEvent): Promise<void> {
  // 1. Find StravaConnection by stravaAthleteId = event.owner_id
  // 2. If not found → log + ignore (unconnected athlete)
  // 3. Get valid access token (auto-refresh if needed)
  // 4. Fetch full activity: GET /api/v3/activities/{event.object_id}
  // 5. Check activity type: only Run | TrailRun | VirtualRun
  // 6. If wrong type → ignore
  // 7. Upsert to StravaActivity
  // 8. Run dedup check against Garmin
  // 9. Update StravaConnection.lastSyncAt
}
```

## StravaSyncService

### Manual/Cron Sync (Pull-based)
```typescript
async syncUser(userId: string): Promise<void> {
  // Redis lock: strava:sync:{userId} (NX, EX 300)
  // Fetch since lastSyncAt (default: 30 days ago if first sync)
  // GET /api/v3/athlete/activities?after={unixTimestamp}&per_page=50&page=N
  // Filter: only Run | TrailRun | VirtualRun
  // Batch upsert to StravaActivity
  // Run dedup for each new activity
  // Update lastSyncAt
  // Release lock
}
```

### Activity Fetch + Transform
```typescript
// Strava activity fields to extract:
interface StravaActivityRaw {
  id: number;
  name: string;
  type: string;              // 'Run' | 'TrailRun' | 'VirtualRun'
  start_date: string;        // ISO 8601
  distance: number;          // meters
  moving_time: number;       // seconds
  elapsed_time: number;      // seconds
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;    // m/s
  max_speed?: number;        // m/s
  total_elevation_gain?: number;
  kilojoules?: number;       // calories ≈ kilojoules (close enough)
}

// Computed fields:
avgPace = movingTime / 60 / (distance / 1000)  // min/km
```

### Deduplication Logic
```typescript
async checkAndMarkDuplicate(userId: string, stravaActivity: StravaActivity): Promise<void> {
  const startWindow = new Date(stravaActivity.startDate.getTime() - 5 * 60 * 1000);
  const endWindow   = new Date(stravaActivity.startDate.getTime() + 5 * 60 * 1000);

  // Find overlapping Garmin activity (same user, time window ±5min)
  const garminMatch = await this.prisma.garminActivity.findFirst({
    where: {
      userId,
      startTime: { gte: startWindow, lte: endWindow },
    },
  });

  if (garminMatch) {
    // Strava wins: flag Garmin as duplicate
    await this.prisma.garminActivity.update({
      where: { id: garminMatch.id },
      data: { isDuplicate: true },
    });
  }
}
```

> **Note:** Requires adding `isDuplicate Boolean @default(false)` to `GarminActivity` model in schema. Add this in Phase 1 migration to keep DB changes in one place — update Phase 1 accordingly.

### Rate Limit Handling
Strava limits: 200 req/15min, 2000 req/day.
- Parse `X-RateLimit-Limit` and `X-RateLimit-Usage` response headers
- On 429 response: log warning, update StravaConnection.status = ERROR, abort sync
- Add 200ms delay between paginated requests
- Each sync call = 1 req (webhook) or N/50 req (paginated, max ~6 pages for 30d)

## Controller Additions

```typescript
// PUBLIC routes (no JWT — Strava must reach these)
@Get('webhook')   handleWebhookChallenge(@Query() query)
@Post('webhook')  handleWebhookEvent(@Body() event)

// All existing authenticated routes remain unchanged
```

**Important:** Webhook routes must be excluded from JWT guard. Use route-level `@Public()` decorator or skip guard for `/strava/webhook*` path.

## Implementation Steps

1. Add `isDuplicate` field to `GarminActivity` in schema.prisma → new migration
2. Create `strava-webhook.service.ts`:
   - `validateChallenge()` — verify token check
   - `processActivity()` — async event handler
   - `registerSubscription()` — OnModuleInit
3. Fill out `strava-sync.service.ts`:
   - `syncUser()` with Redis lock
   - `fetchActivitiesSince()` with pagination
   - `upsertActivity()` with transform
   - `checkAndMarkDuplicate()`
4. Add webhook routes to `strava.controller.ts` (public, no auth guard)
5. Register `StravaWebhookService` + `HttpModule` in `strava.module.ts`
6. Add `ScheduleModule` to `strava.module.ts` imports
7. Compile check: `cd api && npx tsc --noEmit`
8. Test webhook challenge validation locally (use ngrok or Cloudflare Tunnel)
9. Test activity upsert with a real Strava activity

## Todo

- [x] Add isDuplicate to GarminActivity model + new migration
- [x] strava-webhook.service.ts — validateChallenge, processActivity, registerSubscription
- [x] strava-sync.service.ts — syncUser, fetchActivitiesSince, upsertActivity, checkAndMarkDuplicate
- [x] strava.controller.ts — GET /webhook (challenge) + POST /webhook (events)
- [x] strava.module.ts — register StravaWebhookService, ensure HttpModule present
- [x] Rate limit header parsing + 429 handling
- [x] Compile check passes
- [x] Webhook challenge validation test (manual: GET with verify_token)
- [x] Activity sync end-to-end test (tested with real activity)

## Success Criteria

- GET /strava/webhook returns `{ "hub.challenge": value }` for valid verify_token
- POST /strava/webhook responds 200 within 2s, processes event async
- New Strava run appears in DB within 60s of upload
- Manual sync (POST /strava/sync) imports last 30 days
- When Garmin + Strava have same run: Garmin.isDuplicate = true
- No tokens logged anywhere (log activity ID/type only)
- 429 rate limit handled gracefully (no crash, status updated)

## Security Considerations

- Webhook endpoint is public — verify `hub.verify_token` on GET challenge
- No signature verification on POST (Strava doesn't send HMAC on events — check subscription_id instead)
- Never log access/refresh tokens in sync service
- Redis lock prevents concurrent syncs for same user (race condition on token refresh)
- Webhook `owner_id` must match a known StravaConnection — reject unknown athletes silently
