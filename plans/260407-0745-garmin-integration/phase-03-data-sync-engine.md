# Phase 3: Data Sync Engine

## Context Links
- [Plan Overview](plan.md)
- [Phase 2 — OAuth & Connection](phase-02-oauth-and-connection-flow.md) (blocker)
- [Design Doc](../reports/brainstorm-260407-0733-garmin-integration-design.md)
- [API Research — Data Formats](../reports/researcher-260407-0732-garmin-api-research.md#4-available-data)
- garmin-connect lib methods: `getActivities()`, `getHeartRate()`, `getSteps()`, `getSleep()`

## Overview
- **Priority:** P1
- **Status:** Pending (blocked by Phase 2)
- **Effort:** 3 days
- **Description:** Build the sync engine that fetches Garmin activities and daily health summaries, stores them in PostgreSQL, and runs on a cron schedule. Add REST endpoints for frontend to query synced data.

## Key Insights

### ⚠️ RED TEAM: Finding #1 — VERIFY LIBRARY METHODS BEFORE IMPLEMENTATION
The garmin-connect npm library may NOT expose `getHeartRate(date)` or `getStressData(date)`. These methods are not documented in the library README. **Before writing any sync code:**
1. Read the library's TypeScript declarations: `node_modules/garmin-connect/dist/index.d.ts`
2. Check actual available methods
3. If missing: get HR from activity records (`avgHeartRate`), use `getUserSummary()` if available, or defer daily HR widgets to Phase 5

- `garmin-connect` lib provides: `getActivities(start, limit)`, `getSteps(date)`, `getSleepData(date)` (VERIFIED in README)
- `getHeartRate(date)` and `getStressData(date)` — **UNVERIFIED, may not exist** — must check before coding
- Activities are paginated (page index + limit) — fetch in batches of 20
- Daily summaries must be fetched per-date — batch date range with parallel requests
- Initial backfill: last 30 days of data on first connect
- Ongoing sync: cron every 2 hours, fetch since `lastSyncAt`
- garmin-connect session may expire — re-authenticate per sync (create fresh client each time)
- NestJS `@nestjs/schedule` provides `@Cron()` decorator for cron jobs
- Garmin data latency: device syncs to cloud 1-4 hours after activity

## Requirements

### Functional
- **Initial backfill**: on first connect, queue a sync of last 30 days
- **Cron sync**: every 2 hours, sync all connected users
- **Manual sync**: POST `/garmin/sync` triggers immediate sync for requesting user
- **Activity fetch**: get activities, deduplicate by `garminActivityId`, extract HR/pace/distance
- **Daily summary fetch**: get steps, HR, sleep, stress per date, upsert by `(userId, date)`
- **API endpoints**: paginated activities list, single activity detail, daily summary by date range
- **Error resilience**: if one user's sync fails, continue with others; mark connection status = ERROR

### Non-Functional
- Sync job must not block API requests (async, fire-and-forget from cron)
- Rate limit manual sync: 1 per 5 minutes per user (prevent API abuse)
- Log sync duration and record counts for observability
- Handle garmin-connect lib errors gracefully (network, auth, rate limit)

## Architecture

### Sync Data Flow

```
Cron (every 2h) or Manual trigger
  |
  v
GarminSyncService.syncAllUsers()
  |
  |-- for each CONNECTED GarminConnection:
  |     |
  |     v
  |   GarminService.getAuthenticatedClient(userId)
  |     |-- decrypt credentials
  |     |-- new GarminConnect().login()
  |     |
  |     v
  |   syncActivities(client, userId, since)
  |     |-- client.getActivities(0, 20)
  |     |-- filter: startTime > since
  |     |-- map to GarminActivity fields
  |     |-- prisma.garminActivity.upsert() per activity
  |     |
  |     v
  |   syncDailySummaries(client, userId, since)
  |     |-- for each date from since to today:
  |     |     client.getHeartRate(date)
  |     |     client.getSteps(date)
  |     |     client.getSleepData(date)
  |     |-- merge into single summary
  |     |-- prisma.garminDailySummary.upsert()
  |     |
  |     v
  |   Update GarminConnection.lastSyncAt = now()
  |
  v
Done (log summary)
```

### API Endpoints (This Phase)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/garmin/sync` | JWT | Manual trigger sync |
| GET | `/garmin/activities` | JWT | List activities (paginated) |
| GET | `/garmin/activities/:id` | JWT | Single activity detail |
| GET | `/garmin/daily-summary` | JWT | Daily summaries (date range) |

### Query Parameters

**GET /garmin/activities:**
- `page` (default: 1)
- `limit` (default: 20, max: 50)
- `type` (optional filter: RUNNING, WALKING, CYCLING)

**GET /garmin/daily-summary:**
- `from` (ISO date, required)
- `to` (ISO date, default: today)

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `api/src/garmin/garmin.controller.ts` | Add sync, activities, daily-summary endpoints |
| `api/src/garmin/garmin.service.ts` | Add data query methods (getActivities, getDailySummaries) |
| `api/src/garmin/garmin.module.ts` | Import ScheduleModule, register GarminSyncService |
| `api/src/app.module.ts` | Import ScheduleModule.forRoot() |
| `api/package.json` | Add `@nestjs/schedule` dependency |

### Files to Create
| File | Purpose |
|------|---------|
| `api/src/garmin/garmin-sync.service.ts` | Sync engine: fetch + store activities and summaries |
| `api/src/garmin/garmin-cron.service.ts` | Cron job: triggers sync every 2 hours |
| `api/src/garmin/garmin-activity.dto.ts` | Query DTOs for activity list + daily summary |

## Implementation Steps

### Step 1: Install @nestjs/schedule

```bash
cd api && npm install @nestjs/schedule
```

### Step 2: Register ScheduleModule in AppModule

In `api/src/app.module.ts`:
- Add import: `import { ScheduleModule } from '@nestjs/schedule';`
- Add `ScheduleModule.forRoot()` to imports array

### Step 3: Create garmin-activity.dto.ts

Create `api/src/garmin/garmin-activity.dto.ts`:

```typescript
import { IsOptional, IsInt, Min, Max, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  type?: string;  // RUNNING, WALKING, CYCLING
}

export class DailySummaryQueryDto {
  @IsDateString()
  from: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
```

### Step 4: Create garmin-sync.service.ts

Create `api/src/garmin/garmin-sync.service.ts` (~180 lines):

4.1. Constructor injects: `PrismaService`, `GarminService` (for `getAuthenticatedClient`), `Logger`

4.2. `syncUser(userId: string)` method:
- Get authenticated garmin-connect client via `garminService.getAuthenticatedClient(userId)`
- Get GarminConnection to determine `lastSyncAt` (null = first sync = backfill 30 days)
- Call `syncActivities(client, userId, since)`
- Call `syncDailySummaries(client, userId, since)`
- Update `GarminConnection.lastSyncAt = new Date()`
- Wrap in try/catch: on auth error, set connection `status = TOKEN_EXPIRED`; on other error, set `status = ERROR`; log error, don't rethrow

4.3. `syncActivities(client, userId, since)` method:
- Fetch activities: `client.getActivities(0, 50)` — returns array of activity summaries
- Filter to activities with `startTimeLocal > since`
- For each activity, map fields:
  - `garminActivityId`: activity.activityId (string)
  - `activityType`: activity.activityType.typeKey (e.g., "running")
  - `startTime`: new Date(activity.startTimeLocal)
  - `duration`: activity.duration (seconds)
  - `distance`: activity.distance (meters)
  - `avgHeartRate`: activity.averageHR
  - `maxHeartRate`: activity.maxHR
  - `avgPace`: compute from duration/distance if running
  - `calories`: activity.calories
  - `rawData`: full activity object (JSON)
- Upsert each via `prisma.garminActivity.upsert()` with `where: { garminActivityId }`, `update: { ...fields }`, `create: { ...fields, userId }`
- Log count: `Synced ${count} activities for user ${userId}`

4.4. `syncDailySummaries(client, userId, since)` method:
- Calculate date range: from `since` (or 30 days ago) to today
- For each date in range (iterate day by day, max 30 days to avoid rate limits):
  - Fetch HR: `client.getHeartRate(dateStr)` — returns `{ restingHeartRate, maxHeartRate, minHeartRate }`
  - Fetch steps: `client.getSteps(dateStr)` — returns `{ totalSteps }`
  - Fetch sleep: `client.getSleepData(dateStr)` — returns `{ sleepTimeSeconds, overallSleepScore }`
  - Merge into single object
  - Upsert: `prisma.garminDailySummary.upsert()` with `where: { userId_date: { userId, date } }`
- Add 500ms delay between dates to avoid rate limiting
- Log count: `Synced ${count} daily summaries for user ${userId}`

4.5. `syncAllUsers()` method:
<!-- RED TEAM: Finding #6 — Add mutex lock to prevent overlapping cron runs + per-user timeouts -->
- **Acquire Redis mutex**: `SET garmin:sync:lock NX EX 7200` — if already locked, skip this cycle
- Query all GarminConnections where `status = CONNECTED` AND `lastSyncAt` is older than 1 hour (skip recently synced)
- For each, call `syncUser(connection.userId)` sequentially with 30s timeout per user
- Track sync start time — abort cycle if exceeds 90 minutes
- Release Redis mutex on completion
- Log total: `Sync complete: ${success}/${total} users synced`

### Step 5: Create garmin-cron.service.ts

Create `api/src/garmin/garmin-cron.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GarminSyncService } from './garmin-sync.service.js';

@Injectable()
export class GarminCronService {
  private readonly logger = new Logger(GarminCronService.name);

  constructor(private readonly syncService: GarminSyncService) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleSync() {
    this.logger.log('Starting scheduled Garmin sync...');
    const start = Date.now();
    await this.syncService.syncAllUsers();
    this.logger.log(`Scheduled sync complete in ${Date.now() - start}ms`);
  }
}
```

### Step 6: Add data query methods to garmin.service.ts

In `api/src/garmin/garmin.service.ts`, add:

6.1. `getActivities(userId, page, limit, type?)`:
```typescript
const where = { userId, ...(type ? { activityType: type } : {}) };
const [items, total] = await Promise.all([
  this.prisma.garminActivity.findMany({
    where,
    orderBy: { startTime: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  }),
  this.prisma.garminActivity.count({ where }),
]);
return { items, total, page, limit };
```

6.2. `getActivity(userId, activityId)`:
<!-- RED TEAM: Finding #8 — Never return rawData to frontend. Use Prisma select. -->
```typescript
return this.prisma.garminActivity.findFirst({
  where: { id: activityId, userId },
  select: {
    id: true, garminActivityId: true, activityType: true, startTime: true,
    duration: true, distance: true, avgHeartRate: true, maxHeartRate: true,
    minHeartRate: true, avgPace: true, calories: true, vo2Max: true,
    trainingEffect: true, createdAt: true,
    // rawData explicitly EXCLUDED — may contain GPS coords, device IDs, PII
  },
});
```
Return 404 if not found.

6.3. `getDailySummaries(userId, from, to)`:
```typescript
return this.prisma.garminDailySummary.findMany({
  where: {
    userId,
    date: { gte: new Date(from), lte: new Date(to) },
  },
  orderBy: { date: 'desc' },
});
```

### Step 7: Add endpoints to garmin.controller.ts

In `api/src/garmin/garmin.controller.ts`, add:

7.1. POST `/garmin/sync` (manual trigger):
```typescript
@Post('sync')
@Throttle({ default: { limit: 1, ttl: 300000 } })  // 1 per 5 min
async sync(@Req() req: Request) {
  const userId = (req.user as TokenPayload).sub;
  await this.garminSyncService.syncUser(userId);
  return { ok: true };
}
```
Inject `GarminSyncService` in controller constructor.

7.2. GET `/garmin/activities` (paginated list):
```typescript
@Get('activities')
async getActivities(@Req() req: Request, @Query() query: ListActivitiesDto) {
  const userId = (req.user as TokenPayload).sub;
  return this.garminService.getActivities(
    userId, query.page ?? 1, query.limit ?? 20, query.type,
  );
}
```

7.3. GET `/garmin/activities/:id` (single detail):
```typescript
@Get('activities/:id')
async getActivity(@Req() req: Request, @Param('id') id: string) {
  const userId = (req.user as TokenPayload).sub;
  const activity = await this.garminService.getActivity(userId, id);
  if (!activity) throw new NotFoundException('Activity not found');
  return activity;
}
```

7.4. GET `/garmin/daily-summary` (date range):
```typescript
@Get('daily-summary')
async getDailySummary(@Req() req: Request, @Query() query: DailySummaryQueryDto) {
  const userId = (req.user as TokenPayload).sub;
  const to = query.to ?? new Date().toISOString().split('T')[0];
  return this.garminService.getDailySummaries(userId, query.from, to);
}
```

### Step 8: Update garmin.module.ts

Add `GarminSyncService` and `GarminCronService` to providers:

```typescript
providers: [
  GarminService,
  GarminEncryptionService,
  GarminSyncService,
  GarminCronService,
],
```

### Step 9: Trigger initial backfill on connect

<!-- RED TEAM: Finding #11 — Track backfill status, don't silently fail -->
In `api/src/garmin/garmin.service.ts` — inside the `connect()` method (Phase 2), after successfully creating GarminConnection:
- Set `backfillStatus = 'PENDING'` on the GarminConnection record (add field to Prisma schema: `backfillStatus String @default("NONE")`)
- Fire async backfill: `this.syncService.syncUser(userId)` (don't await — return connected immediately)
- Inside `syncUser()`: set `backfillStatus = 'IN_PROGRESS'` at start, `'COMPLETE'` on success, `'FAILED'` on error
- Expose `backfillStatus` in the `/garmin/status` endpoint
- Frontend shows "Dang dong bo du lieu..." spinner while backfillStatus is PENDING or IN_PROGRESS
- If backfillStatus is FAILED, show "Dong bo that bai" with a manual "Thu lai" (Retry) button
- Import and inject `GarminSyncService` in GarminService constructor
- Handle circular dependency: use `forwardRef(() => GarminSyncService)` if needed, OR move trigger to controller level

### Step 10: Build and test

```bash
cd api && npm run build
```

Test manually:
- Connect a Garmin account (Phase 2)
- Hit POST `/garmin/sync` — verify activities + summaries appear in DB
- Hit GET `/garmin/activities?page=1&limit=5` — verify paginated response
- Hit GET `/garmin/daily-summary?from=2026-03-08&to=2026-04-07` — verify date range

## Todo List

- [ ] Install `@nestjs/schedule` package
- [ ] Register ScheduleModule.forRoot() in AppModule
- [ ] Create `garmin-activity.dto.ts` with query DTOs
- [ ] Create `garmin-sync.service.ts` — `syncUser()` method
- [ ] Implement `syncActivities()` — fetch + upsert activities
- [ ] Implement `syncDailySummaries()` — fetch + upsert daily data
- [ ] Implement `syncAllUsers()` — iterate connected users
- [ ] Create `garmin-cron.service.ts` — 2-hour cron job
- [ ] Add `getActivities()` query method to garmin.service.ts
- [ ] Add `getActivity()` query method to garmin.service.ts
- [ ] Add `getDailySummaries()` query method to garmin.service.ts
- [ ] Add POST `/garmin/sync` endpoint
- [ ] Add GET `/garmin/activities` endpoint (paginated)
- [ ] Add GET `/garmin/activities/:id` endpoint
- [ ] Add GET `/garmin/daily-summary` endpoint (date range)
- [ ] Update garmin.module.ts with new providers
- [ ] Trigger initial backfill on connect
- [ ] Verify cron fires every 2 hours (check logs)
- [ ] Verify build compiles cleanly

## Success Criteria

- Cron job runs every 2 hours without errors (verify in logs)
- Activities synced with correct HR, pace, distance, duration
- Daily summaries have steps, resting HR, sleep duration
- Paginated activities endpoint returns correct total + items
- Manual sync works and respects rate limit (1 per 5 min)
- Failed sync for one user doesn't block others
- Connection status set to ERROR on repeated failures

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| garmin-connect rate limited during bulk backfill | High | Medium | 500ms delay between daily summary requests; limit backfill to 30 days |
| garmin-connect API shape changes between versions | Medium | High | Pin package version; store rawData for debugging; abstract mapping |
| Cron job runs during deployment/restart | Low | Low | @nestjs/schedule handles graceful shutdown; sync is idempotent (upsert) |
| Large user base = long sync cycles | Low (MVP) | Medium | Sequential per-user is fine for <50 users; Phase 5 adds webhooks |
| garmin-connect methods return undefined/null | Medium | Medium | Null-check all fields; use `??` defaults; log missing data |

## Security Considerations

- Manual sync endpoint rate-limited to prevent abuse against Garmin's servers
- `getAuthenticatedClient()` decrypts credentials only in memory, never cached
- Activity data is user-scoped: queries always filter by `userId` from JWT (no IDOR)
- rawData JSON may contain sensitive fields — never expose in list endpoint (only detail view)

## Next Steps

Phase 4 consumes this synced data: auto-fills MAF Lab from latest running activity, renders dashboard widgets from daily summaries, and builds the activity list UI.
