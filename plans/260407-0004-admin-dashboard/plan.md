---
title: "Admin Backend & Dashboard"
description: "Add role-based auth and admin panel with dashboard, user management for MAF Running Coach"
status: pending
priority: P1
effort: 12h
branch: kai/feat/admin-dashboard
tags: [admin, rbac, dashboard, nestjs, react]
created: 2026-04-07
---

# Admin Backend & Dashboard

## Summary

Add admin capabilities to MAF Running Coach: role field on User, backend guards + admin API endpoints, and a React admin panel at `/admin/*` with sidebar nav, dark theme, and real data from existing User/UserProfile models.

## Architecture Overview

```
                    ┌──────────────────────────────┐
                    │       Prisma Schema           │
                    │  User.role: USER|COACH|ADMIN  │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐  ┌─────▼──────┐  ┌──────▼──────────┐
     │ JwtStrategy    │  │ RolesGuard │  │ AdminModule      │
     │ (adds role to  │  │ (checks    │  │ ├ AdminController │
     │  req.user)     │  │  metadata) │  │ ├ AdminService    │
     └────────────────┘  └────────────┘  │ └ DTOs            │
                                         └─────────────────┘
                                                │
     ┌──────────────────────────────────────────┘
     │ API Endpoints
     │  GET  /admin/stats        → dashboard counters
     │  GET  /admin/users        → paginated user list
     │  GET  /admin/users/:id    → user detail + profile
     │  PATCH /admin/users/:id   → update role/status
     │  DELETE /admin/users/:id  → soft/hard delete
     └──────────────────────────────────────────

     Frontend:
     /admin/*  → AdminLayout (sidebar + header + outlet)
                 ├ /admin           → AdminDashboardPage
                 ├ /admin/users     → AdminUsersPage
                 └ /admin/settings  → placeholder
```

## Data Flow

1. **Login** → JWT now includes `role` in TokenPayload → cookie
2. **Frontend** → `getMe()` returns `role` field → stored in AuthContext
3. **Admin routes** → `AdminProtectedRoute` checks `user.role === 'ADMIN'`
4. **API calls** → `RolesGuard` + `@Roles('ADMIN')` decorator on admin endpoints
5. **Dashboard** → Calls `GET /admin/stats` + `GET /admin/users?limit=5` for recent users

## Dependency Graph

```
Phase 1 (DB + Auth)  ──blocks──▶  Phase 2 (Backend API)  ──blocks──▶  Phase 3 (Frontend)
                                                                            │
                                                          Phase 4 (Integration) ◀──┘
```

## Phases

| # | Phase | Status | Effort | Files |
|---|-------|--------|--------|-------|
| 1 | [Database & Auth Foundation](phase-01-database-auth-foundation.md) | Pending | 2h | 7 files |
| 2 | [Admin Backend API](phase-02-admin-backend-api.md) | Pending | 3h | 8 files |
| 3 | [Admin Frontend Shell & Dashboard](phase-03-admin-frontend-shell.md) | Pending | 5h | 14 files |
| 4 | [Integration & Polish](phase-04-integration-polish.md) | Pending | 2h | 4 files |

## Risk Assessment

| Risk | L x I | Mitigation |
|------|-------|------------|
| Prisma schema change breaks existing queries | M x H | `role` has DEFAULT 'USER'; no breaking change to existing rows |
| JWT payload change invalidates active sessions | M x M | Old tokens without `role` treated as USER (backwards compat) |
| Admin route accessible without guard | L x H | Double protection: backend RolesGuard + frontend route guard |
| File ownership conflict between phases | L x M | Phases touch distinct file sets; only `schema.prisma` + `auth.types.ts` shared (Phase 1 only) |

## Backwards Compatibility

- Existing users get `role: USER` via Prisma default — zero data migration needed
- JWT tokens without `role` field (issued before deploy) default to `'USER'` in JwtStrategy
- No existing API endpoint behavior changes
- No existing frontend route changes
- `getMe()` gains optional `role` field — non-breaking addition

## Rollback Plan

| Phase | Rollback |
|-------|----------|
| 1 | Revert migration: `ALTER TABLE "User" DROP COLUMN "role"`. Remove role from JWT. |
| 2 | Delete `api/src/admin/` module. Remove import from `app.module.ts`. |
| 3 | Delete `src/pages/admin/`, `src/components/admin/`. Remove admin routes from `app.tsx`. |
| 4 | No standalone rollback needed — covered by Phase 3 revert. |

## Success Criteria

- [ ] Admin user can log in and see `/admin` dashboard with real user count, profile count, recent registrations
- [ ] Non-admin users get 403 on `/admin` API endpoints and are redirected away from `/admin/*` frontend routes
- [ ] User list page shows paginated users with search
- [ ] Role can be changed via admin panel (ADMIN can promote/demote)
- [ ] All files < 200 LOC
- [ ] No breaking changes to existing user-facing features
