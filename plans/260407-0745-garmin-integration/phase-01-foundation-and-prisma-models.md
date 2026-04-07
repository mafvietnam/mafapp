# Phase 1: Foundation & Prisma Models

## Context Links
- [Plan Overview](plan.md)
- [Design Doc](../reports/brainstorm-260407-0733-garmin-integration-design.md)
- [API Research](../reports/researcher-260407-0732-garmin-api-research.md)
- Current schema: `api/prisma/schema.prisma`
- Existing module pattern: `api/src/auth/auth.module.ts`

## Overview
- **Priority:** P1 (blocks all subsequent phases)
- **Status:** Pending
- **Effort:** 2 days
- **Description:** Add Garmin-related Prisma models, run migration, create GarminModule skeleton with encryption utility for token storage, install `garmin-connect` npm package.

## Key Insights
- Prisma schema uses `uuid()` for IDs, `@updatedAt` for timestamps — follow same pattern
- User model uses `@unique` on external IDs (`wpUserId`, `googleId`) — Garmin connection is 1:1 per user via `@unique` on `userId`
- SharedModule is `@Global()` — PrismaService and RedisService available everywhere without importing
- Token encryption needed because Garmin tokens stored in PostgreSQL (not ephemeral Redis)

## Requirements

### Functional
- GarminConnection model: stores OAuth tokens (encrypted), connection status, sync metadata
- GarminActivity model: stores synced activities with HR data, pace, distance
- GarminDailySummary model: stores daily health metrics (steps, HR, sleep, stress)
- Encryption utility: AES-256-GCM encrypt/decrypt for token fields
- GarminModule skeleton: registered in AppModule, empty controller + service

### Non-Functional
- Migration must be non-destructive (additive only — new tables + enum)
- Encryption key loaded from env var `GARMIN_ENCRYPTION_KEY`
- All new files under 200 lines

## Architecture

### New Prisma Models

```prisma
enum GarminConnectionStatus {
  CONNECTED
  DISCONNECTED
  TOKEN_EXPIRED
  ERROR
}

model GarminConnection {
  id            String                 @id @default(uuid())
  userId        String                 @unique
  user          User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  garminUserId  String?                @unique
  accessToken   String                 // AES-256-GCM encrypted
  refreshToken  String                 // AES-256-GCM encrypted
  tokenExpiry   DateTime?
  status        GarminConnectionStatus @default(CONNECTED)
  lastSyncAt    DateTime?
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt
}

model GarminActivity {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  garminActivityId String   @unique
  activityType     String   // RUNNING, WALKING, CYCLING, etc.
  startTime        DateTime
  duration         Int      // seconds
  distance         Float?   // meters
  avgHeartRate     Int?
  maxHeartRate     Int?
  minHeartRate     Int?
  avgPace          Float?   // min/km
  calories         Int?
  vo2Max           Float?
  trainingEffect   Float?
  createdAt        DateTime @default(now())
  // rawData removed — Validation: strip PII (GPS, device IDs), don't store unbounded JSON

  @@index([userId, startTime])
}

model GarminDailySummary {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date             DateTime @db.Date
  steps            Int?
  restingHeartRate Int?
  avgHeartRate     Int?
  maxHeartRate     Int?
  minHeartRate     Int?
  sleepDuration    Int?     // minutes
  sleepScore       Float?
  stressAvg        Int?
  calories         Int?
  activeMinutes    Int?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  // rawData removed — Validation: strip PII, don't store

  @@unique([userId, date])
  @@index([userId, date])
}
```

### User Model Update

Add relation fields to existing `User` model:

```prisma
model User {
  // ... existing fields ...
  garminConnection  GarminConnection?
  garminActivities  GarminActivity[]
  garminDailySummaries GarminDailySummary[]
}
```

### Module Structure

```
api/src/garmin/
  garmin.module.ts           -- NestJS module, imports SharedModule
  garmin.controller.ts       -- Empty skeleton (endpoints added Phase 2)
  garmin.service.ts          -- Empty skeleton (business logic Phase 2+)
  garmin-encryption.service.ts -- AES-256-GCM encrypt/decrypt
```

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `api/prisma/schema.prisma` | Add 3 new models + enum + User relations |
| `api/src/app.module.ts` | Import GarminModule |
| `api/package.json` | Add `garmin-connect` dependency |

### Files to Create
| File | Purpose |
|------|---------|
| `api/src/garmin/garmin.module.ts` | NestJS module definition |
| `api/src/garmin/garmin.controller.ts` | Controller skeleton (empty routes) |
| `api/src/garmin/garmin.service.ts` | Service skeleton |
| `api/src/garmin/garmin-encryption.service.ts` | Token encrypt/decrypt utility |

## Implementation Steps

### Step 1: Install garmin-connect package
```bash
cd api && npm install garmin-connect
```
Verify it appears in `package.json` dependencies.

### Step 2: Update Prisma schema

2.1. Open `api/prisma/schema.prisma`

2.2. Add `GarminConnectionStatus` enum after the existing `Role` enum:
```prisma
enum GarminConnectionStatus {
  CONNECTED
  DISCONNECTED
  TOKEN_EXPIRED
  ERROR
}
```

2.3. Add `GarminConnection` model (see Architecture section above for full definition)

2.4. Add `GarminActivity` model

2.5. Add `GarminDailySummary` model

2.6. Add relation fields to existing `User` model:
```prisma
garminConnection     GarminConnection?
garminActivities     GarminActivity[]
garminDailySummaries GarminDailySummary[]
```

### Step 3: Run Prisma migration
```bash
cd api && npx prisma migrate dev --name add-garmin-models
```
Verify migration file created in `api/prisma/migrations/`.

### Step 4: Create garmin-encryption.service.ts

Create `api/src/garmin/garmin-encryption.service.ts`:
- Injectable NestJS service
- Constructor injects `ConfigService`, reads `GARMIN_ENCRYPTION_KEY` env var
- `encrypt(plaintext: string): string` — AES-256-GCM, returns `iv:authTag:ciphertext` (all hex-encoded)
- `decrypt(encrypted: string): string` — splits on `:`, decrypts
- Use Node.js built-in `crypto` module (no external deps)
- Throw clear error if `GARMIN_ENCRYPTION_KEY` is missing or wrong length

```typescript
// Pseudocode structure
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

@Injectable()
export class GarminEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const keyHex = config.get<string>('GARMIN_ENCRYPTION_KEY', '');
    // key must be 32 bytes (64 hex chars) for AES-256
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedStr: string): string {
    const [ivHex, authTagHex, ciphertext] = encryptedStr.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
```

### Step 5: Create garmin.service.ts skeleton

Create `api/src/garmin/garmin.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';

@Injectable()
export class GarminService {
  private readonly logger = new Logger(GarminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly encryption: GarminEncryptionService,
  ) {}

  // Methods added in Phase 2 and 3
}
```

### Step 6: Create garmin.controller.ts skeleton

Create `api/src/garmin/garmin.controller.ts`:
```typescript
import { Controller } from '@nestjs/common';
import { GarminService } from './garmin.service.js';

@Controller('garmin')
export class GarminController {
  constructor(private readonly garminService: GarminService) {}

  // Endpoints added in Phase 2
}
```

### Step 7: Create garmin.module.ts

Create `api/src/garmin/garmin.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { GarminController } from './garmin.controller.js';
import { GarminService } from './garmin.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';

@Module({
  controllers: [GarminController],
  providers: [GarminService, GarminEncryptionService],
  exports: [GarminService],
})
export class GarminModule {}
```

### Step 8: Register GarminModule in AppModule

In `api/src/app.module.ts`:
- Add import: `import { GarminModule } from './garmin/garmin.module.js';`
- Conditionally register GarminModule based on `FEATURE_GARMIN` env var:
```typescript
...(process.env.FEATURE_GARMIN === 'true' ? [GarminModule] : []),
```
<!-- Validation: Feature flag gates all Garmin backend routes -->
- Add `GARMIN_ENCRYPTION_KEY` to Joi validation schema

### Step 9: Add env var to validation schema

In `api/src/app.module.ts`, add to the Joi schema:
```typescript
GARMIN_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
```
<!-- RED TEAM: Finding #3 — Key must be 64 hex chars (32 bytes). Required, no empty default. App must fail at startup if missing. -->

Also add an `onModuleInit()` check in `GarminEncryptionService`:
```typescript
onModuleInit() {
  if (this.key.length !== 32) {
    throw new Error('GARMIN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)');
  }
}
```

### Step 10: Verify build compiles

```bash
cd api && npm run build
```

Fix any TypeScript errors. Ensure `npx prisma generate` ran successfully after migration.

## Todo List

- [ ] Install `garmin-connect` npm package
- [ ] Add GarminConnectionStatus enum to Prisma schema
- [ ] Add GarminConnection model to Prisma schema
- [ ] Add GarminActivity model to Prisma schema
- [ ] Add GarminDailySummary model to Prisma schema
- [ ] Add Garmin relation fields to User model
- [ ] Run Prisma migration
- [ ] Create `garmin-encryption.service.ts` with AES-256-GCM
- [ ] Create `garmin.service.ts` skeleton
- [ ] Create `garmin.controller.ts` skeleton
- [ ] Create `garmin.module.ts`
- [ ] Register GarminModule in AppModule
- [ ] Add GARMIN_ENCRYPTION_KEY to env validation
- [ ] Verify build compiles without errors

## Success Criteria

- `npx prisma migrate dev` succeeds without errors
- `npm run build` compiles cleanly
- GarminModule is registered and injectable
- Encryption service can round-trip encrypt/decrypt a test string
- Three new tables exist in PostgreSQL: `GarminConnection`, `GarminActivity`, `GarminDailySummary`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `garmin-connect` package has breaking changes | Medium | Low | Pin exact version in package.json |
| Prisma migration conflicts with other branches | Low | Medium | Run migration on dev branch only, rebase before merge |
| Encryption key not set in prod env | Medium | High | Validate at startup, log warning if empty |

## Security Considerations

- `GARMIN_ENCRYPTION_KEY` must be 32 bytes (64 hex chars), generated via `openssl rand -hex 32`
- Never log decrypted tokens
- Encryption key must NOT be committed to git — `.env` only
- AES-256-GCM provides both confidentiality and integrity (auth tag)

## Next Steps

Phase 2 builds on this foundation: implements OAuth connect/disconnect flow using the GarminModule skeleton and encryption service created here.
