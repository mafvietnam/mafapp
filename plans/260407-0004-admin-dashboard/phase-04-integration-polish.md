---
phase: 4
title: "Integration & Polish"
status: pending
effort: 2h
depends_on: [2, 3]
---

# Phase 4: Integration & Polish

## Context Links
- Admin dashboard: `src/pages/admin/admin-dashboard-page.tsx`
- Admin users: `src/pages/admin/admin-users-page.tsx`
- Auth context: `src/contexts/auth-context.tsx`
- User dashboard nav: `src/components/layout/desktop-top-nav.tsx`
- System architecture doc: `docs/system-architecture.md`
- Code standards doc: `docs/code-standards.md`

## Overview

End-to-end verification, seed an admin user, add admin link for admin users in the user-facing nav, update docs, and fix any integration issues found during testing.

## Implementation Steps

### 1. Seed Admin User

Create a one-time script or Prisma seed to set a specific user as ADMIN.

Option A (recommended for simplicity): SQL command via psql:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = '<admin-email>';
```

Option B: Prisma seed file `api/prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) { console.log('Set ADMIN_EMAIL to seed admin user'); return; }
  await prisma.user.updateMany({
    where: { email: adminEmail },
    data: { role: 'ADMIN' },
  });
  console.log(`Set ${adminEmail} as ADMIN`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Add to `api/package.json`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

### 2. Add Admin Link in User Nav (Conditional)

In `src/components/layout/desktop-top-nav.tsx`, add admin link visible only to ADMIN users:

```typescript
const { user } = useAuth();
// ... existing nav items
{user?.role === 'ADMIN' && (
  <a href="/admin" className="text-slate-400 hover:text-white transition-colors flex items-center gap-1">
    <Shield className="w-4 h-4" />
    Admin
  </a>
)}
```

Small, non-intrusive change. Shield icon from lucide-react.

### 3. Update Auth Context (if needed)

Verify `useAuth()` exposes `user.role`. If AuthUser interface was updated in Phase 1 and `getMe()` returns role, this should work automatically. No code change expected — just verification.

### 4. End-to-End Test Checklist

Manual verification flow:

**As regular USER:**
- [ ] Login normally → dashboard works as before
- [ ] Navigate to `/admin` → redirected to `/dashboard`
- [ ] No "Admin" link visible in top nav
- [ ] API call to `GET /admin/stats` → 403

**As ADMIN user:**
- [ ] Login → dashboard works, "Admin" link visible in top nav
- [ ] Click Admin → `/admin` loads with sidebar + header
- [ ] Dashboard shows correct totalUsers count
- [ ] Dashboard shows recent users with avatars
- [ ] Navigate to Users page → paginated list loads
- [ ] Search by name → results filter correctly
- [ ] Change a user's role → saves, reflected on refresh
- [ ] Delete a user → removed from list (test on throwaway account)
- [ ] Navigate back to user dashboard → works normally
- [ ] All sidebar links navigate correctly (placeholders show "đang phát triển")

### 5. Update Documentation

**`docs/system-architecture.md`** — Add:
- Admin module to backend architecture diagram
- Admin routes to frontend route tree
- Role enum to database schema section
- Admin API endpoints to API table

**`docs/code-standards.md`** — Add (if applicable):
- Admin component patterns (if they differ from user-facing)
- Guard stacking pattern note

**`docs/project-changelog.md`** — Add entry:
```
## [Unreleased]
### Added
- Admin panel with dashboard and user management
- Role-based access control (USER, COACH, ADMIN)
- Admin API endpoints (/admin/stats, /admin/users CRUD)
- Admin route protection (frontend + backend)
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/desktop-top-nav.tsx` | Add conditional admin link |
| `docs/system-architecture.md` | Add admin module docs |
| `docs/code-standards.md` | Note guard pattern |
| `docs/project-changelog.md` | Add changelog entry |

## Files to Create

| File | Purpose |
|------|---------|
| `api/prisma/seed.ts` | Admin user seed script |

## Todo List

- [ ] Create seed script or document SQL command for admin promotion
- [ ] Run seed to promote test user to ADMIN
- [ ] Add conditional admin link in desktop-top-nav.tsx
- [ ] Run full E2E test checklist as USER
- [ ] Run full E2E test checklist as ADMIN
- [ ] Fix any integration bugs found
- [ ] Update system-architecture.md
- [ ] Update project-changelog.md
- [ ] Final compile check: `npm run build` (frontend + backend)
- [ ] Final lint check: `npm run lint`

## Success Criteria

- Complete E2E flow works: login as admin → see dashboard with real data → manage users → return to user dashboard
- Non-admin users see zero changes to their experience
- Docs updated to reflect new admin capabilities
- Both frontend and backend compile and lint cleanly
- At least one user has ADMIN role in database

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Seed script accidentally promotes wrong user | Require explicit ADMIN_EMAIL env var; no default |
| Desktop nav change breaks mobile layout | Admin link uses same pattern as existing nav items; mobile nav unchanged |
| Docs become stale | Update in same PR as code changes |

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Admin dashboard shows 0 users but DB has users | Check API response in browser devtools | Verify Prisma query, check DB connection |
| Role update doesn't persist | Check network tab for PATCH response | Verify DTO validation, check Prisma update |
| Admin link shows for non-admin | Check user.role value in React devtools | Verify getMe() returns role field |
| Redirect loop on /admin | Check AdminProtectedRoute logic | Ensure redirect target (/dashboard) is not behind admin guard |
