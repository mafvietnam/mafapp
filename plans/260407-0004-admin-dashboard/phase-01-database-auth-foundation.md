---
phase: 1
title: "Database & Auth Foundation"
status: pending
effort: 2h
---

# Phase 1: Database & Auth Foundation

## Context Links
- Prisma schema: `api/prisma/schema.prisma`
- Auth types: `api/src/auth/auth.types.ts`
- JWT strategy: `api/src/auth/jwt.strategy.ts`
- Auth service: `api/src/auth/auth.service.ts`
- Auth guard: `api/src/auth/auth.guard.ts`
- User controller: `api/src/user/user.controller.ts`
- Frontend auth service: `src/services/auth-service.ts`

## Overview

Add `role` enum to User model, propagate through JWT, and create reusable RBAC guard infrastructure. This phase touches only auth plumbing — no new endpoints or UI.

## Key Insights

- Prisma supports native PostgreSQL enums via `enum Role { USER COACH ADMIN }`
- JWT `TokenPayload` currently has `{ sub, email }` — add `role` field
- JwtStrategy.validate() attaches to `req.user` — must include role
- Existing JwtAuthGuard stays unchanged; new RolesGuard layers on top
- Default `USER` role ensures zero-impact on existing rows

## Architecture

```
schema.prisma                    auth.types.ts
  enum Role { USER COACH ADMIN }   TokenPayload { sub, email, role }
       │                                  │
       ▼                                  ▼
  User.role  ────▶  auth.service.ts  ────▶  jwt.strategy.ts
  @default(USER)    (includes role          (validate returns
                     in JWT sign)            { id, email, role })
                                                   │
                                                   ▼
                                            roles.guard.ts
                                            + roles.decorator.ts
                                            (metadata-based check)
```

## Files to Modify

| File | Change |
|------|--------|
| `api/prisma/schema.prisma` | Add `enum Role`, add `role` field to User model |
| `api/src/auth/auth.types.ts` | Add `role` to TokenPayload |
| `api/src/auth/jwt.strategy.ts` | Return `role` from validate() |
| `api/src/auth/auth.service.ts` | Include `role` when signing JWT |
| `api/src/auth/auth.guard.ts` | Add RolesGuard class, Roles decorator |
| `api/src/user/user.controller.ts` | Return `role` in getMe() response |
| `src/services/auth-service.ts` | Add `role` to AuthUser interface |

## Files to Create

| File | Purpose |
|------|---------|
| `api/src/auth/roles.decorator.ts` | `@Roles('ADMIN')` metadata decorator |
| `api/src/auth/roles.guard.ts` | CanActivate guard that reads `@Roles` metadata |

## Implementation Steps

### 1. Update Prisma Schema

Add enum and field to `api/prisma/schema.prisma`:

```prisma
enum Role {
  USER
  COACH
  ADMIN
}

model User {
  // ... existing fields
  role      Role         @default(USER)
  // ... existing relations
}
```

Run: `cd api && npx prisma db push` (project uses db push, no migrations dir exists)

### 2. Update TokenPayload

In `api/src/auth/auth.types.ts`, add `role` to TokenPayload:

```typescript
export interface TokenPayload {
  sub: string;
  email: string;
  role: string; // 'USER' | 'COACH' | 'ADMIN'
}
```

### 3. Update Auth Service — Include Role in JWT

In `api/src/auth/auth.service.ts`, modify `generateAccessToken`:

```typescript
private async generateAccessToken(userId: string, email: string, role: string): Promise<string> {
  const payload: TokenPayload = { sub: userId, email, role };
  return this.jwt.signAsync(payload, { expiresIn: '15m' });
}
```

Update callers (`login`, `loginWithGoogle`, `refreshToken`) to pass `user.role`.

### 4. Update JWT Strategy — Return Role

In `api/src/auth/jwt.strategy.ts`, update validate:

```typescript
validate(payload: TokenPayload) {
  return { id: payload.sub, email: payload.email, role: payload.role ?? 'USER' };
}
```

The `?? 'USER'` fallback ensures backwards compat with tokens issued before this change.

### 5. Create Roles Decorator

New file `api/src/auth/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### 6. Create Roles Guard

New file `api/src/auth/roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { role } = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(role);
  }
}
```

### 7. Update User Controller — Expose Role

In `api/src/user/user.controller.ts`, add `role` to getMe response:

```typescript
return {
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
};
```

### 8. Update Frontend AuthUser

In `src/services/auth-service.ts`, add role to interface:

```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string; // 'USER' | 'COACH' | 'ADMIN'
}
```

## Todo List

- [ ] Add Role enum + User.role field to schema.prisma
- [ ] Run prisma db push
- [ ] Add role to TokenPayload in auth.types.ts
- [ ] Update generateAccessToken signature in auth.service.ts
- [ ] Update login(), loginWithGoogle(), refreshToken() to pass role
- [ ] Update jwt.strategy.ts validate() to return role
- [ ] Create roles.decorator.ts
- [ ] Create roles.guard.ts
- [ ] Update user.controller.ts getMe() to return role
- [ ] Update AuthUser interface in auth-service.ts
- [ ] Verify: existing login flow still works (role defaults to USER)
- [ ] Verify: compile passes (`npm run build` in api/)

## Success Criteria

- `prisma db push` succeeds; existing User rows gain `role: 'USER'`
- JWT tokens contain `role` claim
- `GET /users/me` returns `role` field
- Existing auth flow unaffected (login, refresh, logout all work)
- RolesGuard blocks when role doesn't match `@Roles()` metadata
- API compiles without errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Old JWT tokens lack `role` field | `?? 'USER'` fallback in jwt.strategy.ts |
| Prisma db push on prod data | `@default(USER)` = safe; no data loss |
| RolesGuard applied globally breaks public routes | NOT applied globally — used per-controller with @UseGuards |

## Security Considerations

- Role stored in JWT = fast authz checks without DB hit per request
- Trade-off: role changes don't take effect until token refresh (max 15 min)
- Acceptable for admin panel since role changes are rare
- RolesGuard requires JwtAuthGuard to run first (stacked guards)
