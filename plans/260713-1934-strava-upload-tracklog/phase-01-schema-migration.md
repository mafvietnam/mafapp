# Phase 01 — Schema + Migration + Scope Disconnect

**Priority:** P0 (blocks all) | **Status:** pending

## Overview
Thêm `source` discriminator vào `StravaActivity`, scope lại `disconnect()` để upload sống sót.

## Related files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<ts>_add_activity_source/migration.sql`
- Modify: `api/src/strava/strava.service.ts` (disconnect scope)

## Implementation steps
1. `schema.prisma`: thêm enum
   ```prisma
   enum ActivitySource { STRAVA UPLOAD }
   ```
2. `StravaActivity`: thêm field `source ActivitySource @default(STRAVA)`. Thêm `@@index([userId, source])` (dashboard/dedup queries).
3. Migration SQL (viết tay để khớp drift-safe):
   ```sql
   CREATE TYPE "ActivitySource" AS ENUM ('STRAVA', 'UPLOAD');
   ALTER TABLE "StravaActivity" ADD COLUMN "source" "ActivitySource" NOT NULL DEFAULT 'STRAVA';
   CREATE INDEX "StravaActivity_userId_source_idx" ON "StravaActivity"("userId", "source");
   ```
4. `npx prisma generate` (regenerate client → `source` có trong types).
5. `disconnect()` trong strava.service.ts:
   - `stravaActivity.deleteMany({ where: { userId, source: 'STRAVA' } })`
   - detail purge: `stravaActivityDetail.deleteMany({ where: { userId, NOT: { stravaActivityId: { startsWith: 'upload_' } } } })`
   - StravaConnection delete giữ nguyên.

## Todo
- [ ] Enum + field + index vào schema
- [ ] Migration SQL viết tay
- [ ] `prisma generate` chạy sạch
- [ ] disconnect() scope STRAVA + detail purge loại upload_
- [ ] `npx tsc --noEmit` trong api/ pass

## Success criteria
- Prisma client build có `source`. Migration apply local sạch. disconnect() chỉ xoá STRAVA rows + detail non-upload.

## Notes
- **Prod migration drift**: khi deploy KHÔNG `migrate deploy` mù. Apply SQL trên prod thủ công + `prisma migrate resolve --applied <name>`. Xem memory prod-prisma-migration-drift. (chi tiết ở phase-07)
