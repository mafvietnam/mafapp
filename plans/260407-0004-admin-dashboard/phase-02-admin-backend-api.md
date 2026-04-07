---
phase: 2
title: "Admin Backend API"
status: pending
effort: 3h
depends_on: [1]
---

# Phase 2: Admin Backend API

## Context Links
- Phase 1 output: roles guard, decorator, JWT with role
- Existing patterns: `api/src/profile/profile.module.ts` (module structure)
- User service: `api/src/user/user.service.ts` (Prisma queries)
- App module: `api/src/app.module.ts` (module registration)

## Overview

Create NestJS `AdminModule` with controller + service exposing dashboard stats and user management CRUD. All endpoints require `@Roles('ADMIN')`.

## Key Insights

- Follow existing NestJS module pattern (controller + service + module + dto)
- Reuse PrismaService from SharedModule (already globally available)
- User + UserProfile are separate models — admin needs joined queries
- Pagination via `?page=1&limit=20&search=query` query params
- Keep controller thin, service handles all Prisma logic

## Architecture

```
api/src/admin/
├── admin.module.ts          # imports SharedModule, registers controller+service
├── admin.controller.ts      # routes: /admin/stats, /admin/users, /admin/users/:id
├── admin.service.ts         # Prisma queries for stats + user CRUD
├── admin-stats.dto.ts       # response shape for stats
├── admin-user-query.dto.ts  # query params validation (page, limit, search)
└── admin-update-user.dto.ts # PATCH body validation (role)
```

## API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/admin/stats` | Dashboard counters | `{ totalUsers, totalProfiles, recentUsers, newUsersToday }` |
| GET | `/admin/users` | Paginated user list | `{ data: User[], total, page, limit }` |
| GET | `/admin/users/:id` | User detail + profile | `User & { profile: UserProfile }` |
| PATCH | `/admin/users/:id` | Update user role | `User` |
| DELETE | `/admin/users/:id` | Delete user + cascade profile | `{ ok: true }` |

## Data Flow

```
Client → GET /admin/stats
  → JwtAuthGuard (validates cookie)
    → RolesGuard (checks role === 'ADMIN')
      → AdminController.getStats()
        → AdminService.getStats()
          → prisma.user.count() + prisma.userProfile.count()
            + prisma.user.findMany({ orderBy: createdAt, take: 5 })
          → return StatsDto
```

## Files to Create

| File | Purpose | Est. LOC |
|------|---------|----------|
| `api/src/admin/admin.module.ts` | Module registration | ~15 |
| `api/src/admin/admin.controller.ts` | Route handlers with guards | ~90 |
| `api/src/admin/admin.service.ts` | Prisma query methods | ~120 |
| `api/src/admin/admin-stats.dto.ts` | Stats response interface | ~20 |
| `api/src/admin/admin-user-query.dto.ts` | Query params DTO | ~25 |
| `api/src/admin/admin-update-user.dto.ts` | PATCH body DTO | ~15 |

## Files to Modify

| File | Change |
|------|--------|
| `api/src/app.module.ts` | Import AdminModule |
| `api/src/auth/auth.module.ts` | Export RolesGuard (so AdminModule can use it) |

## Implementation Steps

### 1. Create admin-stats.dto.ts

```typescript
export interface AdminStatsResponse {
  totalUsers: number;
  totalProfiles: number;
  newUsersToday: number;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    createdAt: string;
  }>;
}
```

### 2. Create admin-user-query.dto.ts

```typescript
import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminUserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}
```

### 3. Create admin-update-user.dto.ts

```typescript
import { IsOptional, IsIn } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsIn(['USER', 'COACH', 'ADMIN'])
  role?: string;
}
```

### 4. Create admin.service.ts

Key methods:
- `getStats()` — 3 parallel Prisma queries: user count, profile count, recent 5 users
- `getUsers(query)` — paginated findMany with optional `search` (name/email contains)
- `getUserById(id)` — findUnique with profile include
- `updateUser(id, dto)` — update role
- `deleteUser(id)` — delete (cascades profile via Prisma relation)

Search implementation:
```typescript
where: search ? {
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ],
} : undefined
```

Pagination:
```typescript
const [data, total] = await Promise.all([
  this.prisma.user.findMany({
    where, skip: (page - 1) * limit, take: limit,
    orderBy: { createdAt: 'desc' },
    include: { profile: true },
  }),
  this.prisma.user.count({ where }),
]);
return { data, total, page, limit };
```

### 5. Create admin.controller.ts

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() { return this.adminService.getStats(); }

  @Get('users')
  getUsers(@Query() query: AdminUserQueryDto) { return this.adminService.getUsers(query); }

  @Get('users/:id')
  getUserById(@Param('id') id: string) { return this.adminService.getUserById(id); }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) { return this.adminService.deleteUser(id); }
}
```

### 6. Create admin.module.ts

```typescript
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

### 7. Register in app.module.ts

Add `AdminModule` to imports array.

### 8. Export RolesGuard from auth.module.ts

Add to exports: `RolesGuard` (alongside AuthService, JwtStrategy).
Actually — RolesGuard uses Reflector which is globally available. It doesn't need to be exported from AuthModule. The controller imports the guard class directly. No change to auth.module.ts needed.

## Todo List

- [ ] Create `api/src/admin/` directory
- [ ] Create admin-stats.dto.ts
- [ ] Create admin-user-query.dto.ts
- [ ] Create admin-update-user.dto.ts
- [ ] Create admin.service.ts with getStats, getUsers, getUserById, updateUser, deleteUser
- [ ] Create admin.controller.ts with all routes guarded by JwtAuthGuard + RolesGuard + @Roles('ADMIN')
- [ ] Create admin.module.ts
- [ ] Add AdminModule import to app.module.ts
- [ ] Verify: compile passes
- [ ] Verify: non-admin user gets 403 on all /admin/* endpoints
- [ ] Verify: admin user can hit /admin/stats and get real data

## Success Criteria

- All 5 endpoints respond correctly for ADMIN-role user
- Non-admin users receive 403 Forbidden on all admin endpoints
- Unauthenticated requests receive 401 Unauthorized
- Pagination works: `?page=2&limit=10` returns correct offset
- Search works: `?search=john` filters by name/email
- Stats return accurate counts matching database
- API compiles, no lint errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Admin deletes themselves | Frontend will hide delete button for own account; backend can add check too |
| N+1 queries on user list | Use `include: { profile: true }` in single findMany (Prisma handles join) |
| Large dataset pagination perf | Offset pagination fine for admin panel (<10k users); cursor-based YAGNI |

## Security Considerations

- Double guard stack: JwtAuthGuard (authn) + RolesGuard (authz)
- `@Roles('ADMIN')` at controller level = applies to ALL routes in controller
- Self-role-escalation: admin could set any user to ADMIN — acceptable for v1 (single admin)
- Delete is hard delete with cascade — consider soft delete if audit trail needed later (YAGNI for now)
