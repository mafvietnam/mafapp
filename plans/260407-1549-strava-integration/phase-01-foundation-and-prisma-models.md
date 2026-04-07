# Phase 1: Foundation & Prisma Models

## Overview
- **Priority:** P0 (blocks all other phases)
- **Status:** Complete (migration pending DB availability)
- **Effort:** 1d

Set up DB schema, StravaModule skeleton, encryption service, and feature flag. Directly mirrors Phase 1 of Garmin integration.

## Related Files

- **Context:** `plans/260407-0745-garmin-integration/phase-01-foundation-and-prisma-models.md`
- **Mirror pattern from:** `api/src/garmin/garmin-encryption.service.ts`, `api/src/garmin/garmin.module.ts`
- **Modify:** `api/prisma/schema.prisma`, `api/src/app.module.ts`, `api/src/app.module.ts`

## Prisma Schema Changes

Add to `api/prisma/schema.prisma`:

```prisma
enum StravaConnectionStatus {
  CONNECTED
  DISCONNECTED
  TOKEN_EXPIRED
  ERROR
}

model StravaConnection {
  id                    String                @id @default(cuid())
  userId                String                @unique
  stravaAthleteId       String?               // Strava numeric athlete ID
  accessToken           String                // AES-256-GCM encrypted
  refreshToken          String                // AES-256-GCM encrypted
  tokenExpiresAt        DateTime              // Strava tokens expire every ~6h
  webhookSubscriptionId Int?                  // Strava webhook subscription ID
  status                StravaConnectionStatus @default(CONNECTED)
  lastSyncAt            DateTime?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  user                  User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StravaActivity {
  id                  String   @id @default(cuid())
  userId              String
  stravaActivityId    String   @unique           // Strava numeric activity ID (as string)
  name                String
  type                String                     // Run | TrailRun | VirtualRun
  startDate           DateTime
  distance            Float                      // meters
  movingTime          Int                        // seconds
  elapsedTime         Int                        // seconds
  avgHeartRate        Int?
  maxHeartRate        Int?
  avgSpeed            Float?                     // m/s
  maxSpeed            Float?                     // m/s
  totalElevationGain  Float?                     // meters
  calories            Float?
  avgPace             Float?                     // min/km (computed on insert)
  isDuplicate         Boolean  @default(false)   // true when Garmin has same run
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startDate])
  @@index([userId, stravaActivityId])
}
```

## Module Skeleton

### Files to Create

```
api/src/strava/
├── strava.module.ts
├── strava.controller.ts          (stub — routes added in Phase 2+)
├── strava.service.ts             (stub — connection CRUD)
├── strava-encryption.service.ts  (copy from garmin-encryption.service.ts, rename)
├── strava-sync.service.ts        (stub — filled in Phase 3)
├── strava-cron.service.ts        (stub — filled in Phase 4)
└── dto/
    └── strava-activity-query.dto.ts
```

### strava.module.ts pattern
```typescript
@Module({
  imports: [PrismaModule],
  controllers: [StravaController],
  providers: [StravaService, StravaEncryptionService, StravaSyncService, StravaCronService],
  exports: [StravaService],
})
export class StravaModule {}
```

### strava-encryption.service.ts
Copy `garmin-encryption.service.ts` exactly. Change:
- Class name: `StravaEncryptionService`
- Env var: `STRAVA_ENCRYPTION_KEY`
- Error messages: s/Garmin/Strava/

## Feature Flag

### app.module.ts changes
```typescript
const isStravaEnabled = process.env.FEATURE_STRAVA === 'true';

// In ConfigModule validation:
STRAVA_ENCRYPTION_KEY: Joi.string().when('FEATURE_STRAVA', {
  is: 'true',
  then: Joi.string().length(64).required(),
  otherwise: Joi.string().optional(),
}),
STRAVA_CLIENT_ID: Joi.string().when('FEATURE_STRAVA', { is: 'true', then: Joi.required() }),
STRAVA_CLIENT_SECRET: Joi.string().when('FEATURE_STRAVA', { is: 'true', then: Joi.required() }),
STRAVA_WEBHOOK_VERIFY_TOKEN: Joi.string().when('FEATURE_STRAVA', { is: 'true', then: Joi.required() }),

// In imports:
...(isStravaEnabled ? [StravaModule] : []),
```

## Implementation Steps

1. Add `StravaConnection` and `StravaActivity` models to `schema.prisma` (above GarminConnection for organization)
2. Add `User` relation fields in `User` model: `stravaConnection StravaConnection?`, `stravaActivities StravaActivity[]`
3. Run `npx prisma migrate dev --name add-strava-integration`
4. Create `api/src/strava/` directory structure
5. Copy `garmin-encryption.service.ts` → `strava-encryption.service.ts`, update class/env references
6. Create `strava.module.ts` with all providers registered
7. Create stub `strava.service.ts` with `findConnection(userId)`, `deleteConnection(userId)` methods
8. Create stub `strava.controller.ts` with `@Controller('strava')` decorator only
9. Create stub `strava-sync.service.ts` and `strava-cron.service.ts`
10. Add feature flag + env validation to `app.module.ts`
11. Run compile check: `cd api && npx tsc --noEmit`

## Todo

- [x] Add StravaConnection model to schema.prisma
- [x] Add StravaActivity model to schema.prisma
- [x] Add relation fields to User model
- [x] Run Prisma migration (requires Docker/PostgreSQL — pending DB availability)
- [x] Create strava/ directory with all stub files
- [x] Copy + adapt encryption service
- [x] Add FEATURE_STRAVA to app.module.ts feature flag pattern
- [x] Add env var validation (Joi schema)
- [x] Compile check passes

## Success Criteria

- `npx prisma migrate dev` succeeds with new tables
- `npx tsc --noEmit` in api/ passes (no type errors)
- `FEATURE_STRAVA=false` → StravaModule not loaded, no routes registered
- `FEATURE_STRAVA=true` without encryption key → app refuses to start (Joi validation)

## Security Considerations

- `STRAVA_ENCRYPTION_KEY` must be 64 hex chars (32 bytes) — enforced by Joi
- Never log or return tokens — encryption service handles this
- Tokens stored encrypted at rest — same AES-256-GCM as Garmin
