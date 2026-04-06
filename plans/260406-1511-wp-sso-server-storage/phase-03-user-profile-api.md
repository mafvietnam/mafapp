# Phase 3: User Profile API

## Context
- [System Architecture](../../docs/system-architecture.md) — Data Structures section
- [Frontend types.ts](../../src/types.ts) — UserProfile interface
- [use-user-profile.ts](../../src/hooks/use-user-profile.ts) — Current localStorage hook

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 2 days
- **Blocked by:** Phase 1

Server-side storage for user profile data that currently lives only in React state. Maps directly to the existing `UserProfile` TypeScript interface. CRUD endpoints for authenticated users.

## Key Insights
- Current `useUserProfile` hook uses `useState` with no persistence — data lost on refresh
- Frontend `UserProfile` interface has: age, height, weight, experience, commitment, health flags, probation, long-run history
- MAF calculation logic remains client-side (pure functions, no server dependency)
- Profile is 1:1 with User — each user has exactly one profile
- Profile stores MAF-specific data; User stores WordPress identity data

## Requirements

### Functional
- `GET /users/me/profile` — return user's MAF profile
- `PUT /users/me/profile` — create/update user's MAF profile
- Profile fields match frontend `UserProfile` interface exactly
- Return 404 if profile doesn't exist yet (new user)

### Non-Functional
- Profile API response <100ms
- Input validation on all fields (age 1-120, height 100-250, weight 30-200)
- Protected by AuthGuard (JWT required)

## Architecture

### Database Schema (Prisma)

```prisma
model UserProfile {
  id                          String    @id @default(uuid())
  userId                      String    @unique
  age                         Int
  height                      Float     // cm
  weight                      Float     // kg
  experience                  String    // ExperienceLevel enum value
  commitment                  String    // CommitmentLevel enum value
  isRecovering                Boolean   @default(false)
  isMedicatedOrInjured        Boolean   @default(false)
  isMedicalClearanceConfirmed Boolean   @default(false)
  previousMonthPace           String?   // e.g. "7:15"
  isProbation                 Boolean   @default(false)
  probationStartDate          DateTime?
  lastLongRunDuration         Int?      // minutes
  lastLongRunHeartRate        Int?      // bpm
  lastLongRunFeeling          String?   // GOOD | TIRED | VERY_TIRED
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt
  user                        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Update User model to add relation:
```prisma
model User {
  // ... existing fields
  profile UserProfile?
}
```

### Module Structure

```
api/src/profile/
├── profile.module.ts
├── profile.controller.ts    — GET/PUT /users/me/profile
├── profile.service.ts       — CRUD logic
└── profile.dto.ts           — CreateProfileDto, UpdateProfileDto with validation
```

## Related Code Files

### Files to Create
- `api/src/profile/profile.module.ts`
- `api/src/profile/profile.controller.ts`
- `api/src/profile/profile.service.ts`
- `api/src/profile/profile.dto.ts`

### Files to Modify
- `api/prisma/schema.prisma` — add UserProfile model + User relation
- `api/src/app.module.ts` — import ProfileModule

## Implementation Steps

1. Add `class-validator` and `class-transformer` packages to api
1b. Configure `ValidationPipe` globally in `main.ts`:
    ```typescript
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    }));
    ```
    **Critical:** Frontend sends `age`/`height`/`weight` as strings (from `<input>` elements). `enableImplicitConversion` coerces `"35"` → `35` before `@IsInt()` validation. Without this, every profile save returns 400.
    <!-- Red Team: Type mismatch fix — frontend string types vs backend number types -->
2. Add UserProfile model to Prisma schema (as shown above)
3. Run `npx prisma migrate dev --name add-user-profile`
4. Create `profile.dto.ts` with validation:
   ```typescript
   import { IsInt, IsNumber, IsEnum, IsBoolean, IsOptional, IsString, Min, Max } from 'class-validator';

   export class UpdateProfileDto {
     @IsInt() @Min(1) @Max(120)
     age: number;

     @IsNumber() @Min(100) @Max(250)
     height: number;

     @IsNumber() @Min(30) @Max(200)
     weight: number;

     @IsEnum(['NONE', 'INCONSISTENT', 'REGULAR_NEW', 'ADVANCED'])
     experience: string;

     @IsEnum(['HEALTH', 'BASE', 'PERFORMANCE'])
     commitment: string;

     @IsBoolean()
     isRecovering: boolean;

     @IsBoolean()
     isMedicatedOrInjured: boolean;

     @IsBoolean()
     isMedicalClearanceConfirmed: boolean;

     @IsOptional() @IsString()
     previousMonthPace?: string;

     @IsOptional() @IsBoolean()
     isProbation?: boolean;

     @IsOptional() @IsString()
     probationStartDate?: string;

     @IsOptional() @IsInt() @Min(0) @Max(300)
     lastLongRunDuration?: number;

     @IsOptional() @IsInt() @Min(40) @Max(220)
     lastLongRunHeartRate?: number;

     @IsOptional() @IsEnum(['GOOD', 'TIRED', 'VERY_TIRED'])
     lastLongRunFeeling?: string;
   }
   ```

5. Create `ProfileService`:
   - `getProfile(userId)` — find by userId, return null if not found
   - `upsertProfile(userId, dto)` — create or update profile

6. Create `ProfileController`:
   - `GET /users/me/profile` — AuthGuard, extracts userId from JWT, returns profile or 404
   - `PUT /users/me/profile` — AuthGuard, validates body with UpdateProfileDto, upserts

7. Register ProfileModule in AppModule
   <!-- Red Team: Swagger removed — YAGNI, no second API consumer. Add later if needed. -->

## Todo List
- [x] UserProfile model added to Prisma schema
- [x] Prisma migration ran successfully
- [x] DTOs with class-validator validation
- [x] GET /users/me/profile returns profile (or 404)
- [x] PUT /users/me/profile creates/updates profile
- [x] All endpoints protected by AuthGuard
- [x] Input validation working (age, height, weight ranges)

## Success Criteria
- `PUT /users/me/profile` with valid data → 200, profile saved
- `GET /users/me/profile` → returns saved profile with all fields
- Invalid data (age=999) → 400 with validation errors
- Unauthenticated request → 401
- New user with no profile → 404 on GET

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Frontend sends strings for age/height/weight | ValidationPipe with `enableImplicitConversion: true` coerces before validation |
| Schema drift between frontend and backend | Types derived from same source of truth |
| Data loss during migration | Profile creation is additive — no existing data to lose |

## Security Considerations
- All endpoints require valid JWT
- Input validation prevents invalid data
- userId from JWT token, never from request body (prevents IDOR)
- Cascade delete: profile deleted when user deleted

## Next Steps
- Phase 4: Frontend fetches profile from API instead of using local state
