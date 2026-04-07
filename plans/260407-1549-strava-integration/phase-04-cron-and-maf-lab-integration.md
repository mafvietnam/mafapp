# Phase 4: Cron Fallback & MAF Lab Integration

## Overview
- **Priority:** P2
- **Status:** Complete
- **Effort:** 2d
- **Depends on:** Phase 3 (needs synced activities in DB)

Add daily cron fallback (catches missed webhooks), activity list endpoint for UI, and MAF Lab auto-fill hook. Mirrors Garmin Phase 4 (simplified: MAF Lab auto-fill + connect card only).

## Related Files

- **Mirror pattern from:** `api/src/garmin/garmin-cron.service.ts`, `src/hooks/use-garmin-auto-fill.ts`
- **Modify:** `api/src/strava/strava-cron.service.ts`, `src/components/maf-lab.tsx` (or equivalent)
- **Create:** `src/hooks/use-strava-auto-fill.ts`

## StravaCronService

### Daily Fallback Cron
```typescript
@Injectable()
export class StravaCronService implements OnModuleInit {
  // Runs once daily at 03:00 (off-peak)
  // Purpose: catch activities missed by webhook failures
  @Cron('0 3 * * *')
  async dailySyncAll(): Promise<void> {
    // Global lock: strava:cron:lock (NX, EX 3600)
    // If locked → skip (already running)
    // Query all StravaConnection where status = CONNECTED
    //   AND (lastSyncAt < 25h ago OR lastSyncAt IS NULL)
    // For each: call stravaSyncService.syncUser(userId) with 2s delay between users
    // Release lock
  }
}
```

**Note:** Cron is fallback only — webhook handles real-time. Daily at 3am covers edge cases: webhook delivery failures, server downtime, missed events.

## Activity List Endpoint

Add to `strava.controller.ts`:

```typescript
// GET /strava/activities?page=1&limit=20&type=Run
@Get('activities')
@UseGuards(JwtAuthGuard)
async getActivities(@Req() req, @Query() query: StravaActivityQueryDto)
// Returns: { data: StravaActivity[], total, page, limit }
// Filters: type (Run|TrailRun|VirtualRun), excludeDuplicates (default: false)

// GET /strava/activities/:id
@Get('activities/:id')
@UseGuards(JwtAuthGuard)
async getActivity(@Req() req, @Param('id') id: string)
```

### StravaActivityQueryDto
```typescript
export class StravaActivityQueryDto {
  @IsOptional() @IsNumber() @Min(1) page?: number = 1;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === 'true') excludeDuplicates?: boolean;
}
```

## MAF Lab Auto-Fill Hook

### use-strava-auto-fill.ts
Mirror of `src/hooks/use-garmin-auto-fill.ts`:

```typescript
export function useStravaAutoFill() {
  // Fetch latest Run activity within last 7 days
  // Extract: duration (movingTime), distance, avgHeartRate
  // Return: { duration, distance, avgHeartRate, activityDate, loading, error }
  // Returns null values if no recent activity found
  // Never throws — returns { loading: false, error: null, duration: null, ... } on failure
}
```

### MAF Lab Integration
In `src/components/maf-lab.tsx` (or equivalent file):
- Check if Strava is connected (`useStravaStatus()`)
- If connected: show "Auto-fill from Strava" button alongside existing Garmin button
- Button fills: duration, distance, heart rate fields
- Both buttons can coexist — user picks which source
- Guard: only show button when FEATURE_STRAVA is exposed to frontend (via env var `VITE_FEATURE_STRAVA`)

### Frontend Feature Flag
Add to Vite env handling:
```typescript
// src/config/features.ts (or similar)
export const FEATURE_STRAVA = import.meta.env.VITE_FEATURE_STRAVA === 'true';
```

Add `VITE_FEATURE_STRAVA=true` to `.env.local` for development.

## Athlete Stats Endpoint (Optional, Low Priority)

Strava provides athlete stats (total runs, total distance, recent totals):
```
GET https://www.strava.com/api/v3/athletes/{athlete_id}/stats
```

If requested by product, add `GET /strava/stats` endpoint. **Out of scope for this phase — defer unless explicitly needed.**

## Implementation Steps

1. Fill out `strava-cron.service.ts` with `@Cron('0 3 * * *')` daily sync
2. Add global Redis lock to cron (`strava:cron:lock`, NX, EX 3600)
3. Add `ScheduleModule` to `strava.module.ts` if not already added (Phase 3 may have added it)
4. Add `GET /strava/activities` and `GET /strava/activities/:id` to controller
5. Fill out `StravaActivityQueryDto` in `dto/strava-activity-query.dto.ts`
6. Add `getActivities()` and `getActivity()` to `strava.service.ts`
7. Create `src/hooks/use-strava-auto-fill.ts`
8. Add `VITE_FEATURE_STRAVA` env var handling to frontend config
9. Update `maf-lab.tsx`: add "Auto-fill from Strava" button (gated by feature flag + connection status)
10. Compile check: `cd api && npx tsc --noEmit`
11. Compile check frontend: `cd .. && npx tsc --noEmit`
12. Test auto-fill with a real synced activity

## Todo

- [x] strava-cron.service.ts — daily 3am cron with Redis global lock
- [x] strava.module.ts — confirm ScheduleModule registered
- [x] strava.controller.ts — GET /strava/activities, GET /strava/activities/:id
- [x] dto/strava-activity-query.dto.ts — page, limit, type, excludeDuplicates
- [x] strava.service.ts — getActivities(), getActivity()
- [x] src/hooks/use-strava-auto-fill.ts
- [x] VITE_FEATURE_STRAVA env var added to frontend config
- [x] maf-lab.tsx — "Auto-fill from Strava" button (gated)
- [x] Backend compile check passes
- [x] Frontend compile check passes
- [x] Auto-fill end-to-end test

## Success Criteria

- Cron runs at 3am, syncs users not synced in 25h, doesn't double-sync
- GET /strava/activities returns paginated running activities
- `excludeDuplicates=true` filters out isDuplicate=true records
- MAF Lab shows Strava auto-fill button when connected
- Auto-fill populates duration, distance, HR from latest run
- Both Garmin and Strava auto-fill buttons work independently
- No crash if Strava disconnected while MAF Lab is open

## Security Considerations

- Activity list endpoint is authenticated — users see only their own activities
- Auto-fill hook reads from authenticated endpoint — no cross-user data
- Cron logs user count synced, not individual data
- Cron global lock prevents thundering herd on restart
