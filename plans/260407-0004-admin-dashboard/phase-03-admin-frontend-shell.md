---
phase: 3
title: "Admin Frontend Shell & Dashboard"
status: pending
effort: 5h
depends_on: [1, 2]
---

# Phase 3: Admin Frontend Shell & Dashboard

## Context Links
- Existing layout: `src/components/layout/app-layout.tsx` (pattern to follow)
- Protected route: `src/components/layout/protected-route.tsx`
- Auth context: `src/contexts/auth-context.tsx`
- API client: `src/services/api-client.ts`
- Router: `src/app.tsx`
- Dashboard page: `src/pages/dashboard-page.tsx` (dark theme reference)

## Overview

Build the admin frontend: layout shell (sidebar + header), admin route guard, admin API service, and two functional pages (dashboard with real data, users with paginated table). Remaining sidebar items (Coaches, Training Library, Challenges, Settings, Permissions) are placeholder pages.

## Key Insights

- Design spec: dark theme `bg-[#0B1121]` body, `bg-[#111827]` cards, gradient `#F42A68 → #9130F8`
- Vietnamese language UI throughout
- Sidebar nav with sections: Overview (Dashboard, Stats), Management (Users, etc.), System (Settings, Permissions)
- Glass header with search, notifications bell, user profile avatar
- Admin layout is completely separate from user AppLayout — no shared nav
- Reuse existing `api` client from `src/services/api-client.ts` for admin API calls

## Architecture

```
src/
├── pages/admin/
│   ├── admin-dashboard-page.tsx      # Main dashboard with stats + recent users
│   ├── admin-users-page.tsx          # User list with pagination + search
│   └── admin-placeholder-page.tsx    # Reusable placeholder for unbuilt pages
│
├── components/admin/
│   ├── admin-layout.tsx              # Sidebar + header + <Outlet />
│   ├── admin-sidebar.tsx             # Navigation sidebar
│   ├── admin-header.tsx              # Glass top bar: search, notifs, profile
│   ├── admin-stat-card.tsx           # Single stat card (icon, label, value)
│   ├── admin-recent-users-table.tsx  # Recent users table for dashboard
│   ├── admin-alerts-widget.tsx       # System alerts/notifications widget
│   └── admin-system-resources.tsx    # System health mini widget
│
├── components/layout/
│   └── admin-protected-route.tsx     # Checks role === 'ADMIN', redirects otherwise
│
├── services/
│   └── admin-service.ts             # API calls: getStats, getUsers, updateUser, deleteUser
│
└── app.tsx                          # Add /admin/* route tree
```

## Data Flow

```
AdminDashboardPage
  │
  ├── useEffect → adminService.getStats()
  │     → GET /admin/stats
  │     → { totalUsers, totalProfiles, newUsersToday, recentUsers }
  │
  ├── AdminStatCard × 4 (totalUsers, totalProfiles, newUsersToday, activeCoaches=0)
  │
  ├── AdminRecentUsersTable (recentUsers array)
  │
  ├── AdminAlertsWidget (static/placeholder alerts for v1)
  │
  └── AdminSystemResources (static placeholder for v1)

AdminUsersPage
  │
  ├── useState: page, search, users[], total
  │
  ├── useEffect → adminService.getUsers({ page, limit: 20, search })
  │     → GET /admin/users?page=1&limit=20&search=...
  │     → { data, total, page, limit }
  │
  ├── Search input → debounced setSearch → re-fetch
  │
  ├── Table rows: name, email, role badge, created date, actions
  │
  └── Pagination controls: prev/next buttons
```

## Files to Create

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/services/admin-service.ts` | Admin API client functions | ~60 |
| `src/components/layout/admin-protected-route.tsx` | Role-based route guard | ~25 |
| `src/components/admin/admin-layout.tsx` | Shell: sidebar + header + outlet | ~40 |
| `src/components/admin/admin-sidebar.tsx` | Nav sidebar with sections/links | ~120 |
| `src/components/admin/admin-header.tsx` | Glass top bar | ~60 |
| `src/components/admin/admin-stat-card.tsx` | Reusable stat card | ~35 |
| `src/components/admin/admin-recent-users-table.tsx` | Dashboard recent users | ~80 |
| `src/components/admin/admin-alerts-widget.tsx` | Alerts panel | ~50 |
| `src/components/admin/admin-system-resources.tsx` | System health widget | ~45 |
| `src/pages/admin/admin-dashboard-page.tsx` | Dashboard page composing widgets | ~90 |
| `src/pages/admin/admin-users-page.tsx` | User management page | ~150 |
| `src/pages/admin/admin-placeholder-page.tsx` | Placeholder for unbuilt pages | ~20 |

## Files to Modify

| File | Change |
|------|--------|
| `src/app.tsx` | Add `/admin/*` route tree with AdminLayout + admin pages |
| `src/contexts/auth-context.tsx` | Expose `role` from user object (AuthUser already updated in Phase 1) |

## Implementation Steps

### 1. Create admin-service.ts

```typescript
import { api } from './api-client';

export interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  newUsersToday: number;
  recentUsers: AdminUserSummary[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  profile: { /* UserProfile fields */ } | null;
}

export interface PaginatedUsers {
  data: AdminUserDetail[];
  total: number;
  page: number;
  limit: number;
}

export async function getAdminStats(): Promise<AdminStats | null> {
  const res = await api.get('/admin/stats');
  if (!res.ok) return null;
  return res.json();
}

export async function getAdminUsers(params: {
  page?: number; limit?: number; search?: string;
}): Promise<PaginatedUsers | null> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  const res = await api.get(`/admin/users?${qs}`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateAdminUser(id: string, data: { role?: string }) {
  const res = await api.patch(`/admin/users/${id}`, data);
  return res.ok;
}

export async function deleteAdminUser(id: string) {
  const res = await api.delete(`/admin/users/${id}`);
  return res.ok;
}
```

NOTE: `api.patch` and `api.delete` don't exist yet in api-client.ts. Add them:

```typescript
// Add to api-client.ts api object:
patch: (path: string, body: unknown) =>
  apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
delete: (path: string) =>
  apiFetch(path, { method: 'DELETE' }),
```

### 2. Create admin-protected-route.tsx

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';

export default function AdminProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1121]">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
```

### 3. Create admin-sidebar.tsx

Sections with icons (use lucide-react):
- **Overview**: LayoutDashboard (Tổng quan), BarChart3 (Thống kê)
- **Management**: Users (Người dùng), UserCog (Huấn luyện viên), BookOpen (Thư viện Training), Trophy (Thử thách & Sự kiện)
- **System**: Settings (Cài đặt), Shield (Phân quyền)

Active state: gradient left border + bg-white/5 + gradient text
Inactive: text-slate-400

Bottom: user avatar + name + "Quản trị viên" label

### 4. Create admin-header.tsx

Glass bar: `bg-[#111827]/80 backdrop-blur-xl border-b border-white/5`
- Left: breadcrumb or page title
- Center: search input (icon + placeholder "Tìm kiếm...")
- Right: notification bell (badge dot), user avatar dropdown

### 5. Create admin-layout.tsx

```typescript
import { Outlet } from 'react-router-dom';
import AdminSidebar from './admin-sidebar';
import AdminHeader from './admin-header';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#0B1121] flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col ml-64">
        <AdminHeader />
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

Sidebar width: `w-64` fixed. Content offset: `ml-64`.

### 6. Create admin-stat-card.tsx

Props: `icon`, `label`, `value`, `change` (optional % string), `color` (gradient class).
Design: `bg-[#111827] rounded-2xl p-6 border border-white/5` with icon in colored circle.

### 7. Create admin-recent-users-table.tsx

Props: `users: AdminUserSummary[]`
Columns: Avatar+Name, Email, Role (badge), Joined (relative date)
Design: `bg-[#111827] rounded-2xl border border-white/5`
Table rows: `border-b border-white/5 last:border-0`

### 8. Create admin-alerts-widget.tsx

Static alerts for v1 — placeholder data:
- "Hệ thống hoạt động bình thường" (green)
- "2 người dùng mới hôm nay" (blue)
Design: `bg-[#111827] rounded-2xl p-6`

### 9. Create admin-system-resources.tsx

Static placeholder showing:
- CPU / Memory / Disk progress bars (mock 45%, 62%, 38%)
- Design matches card pattern

### 10. Create admin-dashboard-page.tsx

Composition:
```
<h1>Tổng quan</h1>
<p>subtitle</p>
<div grid 4-col> <AdminStatCard /> × 4 </div>
<div grid 2-col>
  <AdminRecentUsersTable />
  <div col>
    <AdminAlertsWidget />
    <AdminSystemResources />
  </div>
</div>
```

Fetches stats via `useEffect` + `getAdminStats()`.

### 11. Create admin-users-page.tsx

Features:
- Search bar with debounce (300ms)
- Table: avatar, name, email, role (dropdown or badge), created, actions (edit role, delete)
- Pagination: page counter + prev/next buttons
- Role edit: inline select dropdown that calls `updateAdminUser`
- Delete: confirmation dialog before calling `deleteAdminUser`

### 12. Create admin-placeholder-page.tsx

```typescript
export default function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p>Tính năng đang được phát triển</p>
    </div>
  );
}
```

### 13. Update app.tsx — Add Admin Routes

```typescript
import AdminProtectedRoute from './components/layout/admin-protected-route';
import AdminLayout from './components/admin/admin-layout';
import AdminDashboardPage from './pages/admin/admin-dashboard-page';
import AdminUsersPage from './pages/admin/admin-users-page';
import AdminPlaceholderPage from './pages/admin/admin-placeholder-page';

// Inside <Routes>:
<Route element={<AdminProtectedRoute />}>
  <Route element={<AdminLayout />}>
    <Route path="/admin" element={<AdminDashboardPage />} />
    <Route path="/admin/users" element={<AdminUsersPage />} />
    <Route path="/admin/coaches" element={<AdminPlaceholderPage title="Huấn luyện viên" />} />
    <Route path="/admin/library" element={<AdminPlaceholderPage title="Thư viện Training" />} />
    <Route path="/admin/challenges" element={<AdminPlaceholderPage title="Thử thách & Sự kiện" />} />
    <Route path="/admin/settings" element={<AdminPlaceholderPage title="Cài đặt" />} />
    <Route path="/admin/permissions" element={<AdminPlaceholderPage title="Phân quyền" />} />
    <Route path="/admin/stats" element={<AdminPlaceholderPage title="Thống kê" />} />
  </Route>
</Route>
```

### 14. Update api-client.ts — Add PATCH and DELETE

Add `patch` and `delete` methods to the `api` export object.

## Todo List

- [ ] Add `patch` and `delete` to api-client.ts
- [ ] Create admin-service.ts
- [ ] Create admin-protected-route.tsx
- [ ] Create admin-sidebar.tsx
- [ ] Create admin-header.tsx
- [ ] Create admin-layout.tsx
- [ ] Create admin-stat-card.tsx
- [ ] Create admin-recent-users-table.tsx
- [ ] Create admin-alerts-widget.tsx
- [ ] Create admin-system-resources.tsx
- [ ] Create admin-dashboard-page.tsx
- [ ] Create admin-users-page.tsx
- [ ] Create admin-placeholder-page.tsx
- [ ] Update app.tsx with admin route tree
- [ ] Verify: non-admin redirected from /admin to /dashboard
- [ ] Verify: admin sees sidebar, header, dashboard with real stats
- [ ] Verify: user list loads with pagination and search
- [ ] Verify: all files < 200 LOC
- [ ] Verify: frontend compiles without errors

## Success Criteria

- Admin user navigates to `/admin` and sees dashboard with real user count from API
- Sidebar navigation works across all admin pages
- Recent users table shows last 5 registered users with correct data
- Users page shows paginated list, search filters by name/email
- Role can be updated inline from users page
- Non-admin user is redirected to `/dashboard` when accessing `/admin/*`
- All components follow dark theme spec exactly
- Vietnamese labels throughout

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Sidebar collapses poorly on small screens | Admin panel is desktop-only for v1 — add responsive later if needed |
| Too many components to keep under 200 LOC | Dashboard page delegates to widget components; each stays focused |
| API client missing PATCH/DELETE | Added in step 14; minimal change, no breaking impact |

## Security Considerations

- Frontend guard is UX convenience only — real protection is backend RolesGuard
- Admin routes not shown in user-facing nav (sidebar/tabs)
- No admin link in user dashboard — access via direct URL only for now
