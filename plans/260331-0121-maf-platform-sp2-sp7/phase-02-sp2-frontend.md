# Phase 2: SP2 Frontend — Auth UI + Dashboard + Activity UI

## Context
- [Brainstorm Report](../reports/brainstorm-260331-0100-sprint-roadmap-sp2-sp7.md)
- [Codebase Summary](../../docs/codebase-summary.md)
- [Code Standards](../../docs/code-standards.md)
- [Design Guidelines](../../docs/design-guidelines.md)

## Overview
- **Priority:** P1 (Critical Path)
- **Owner:** Dev B (Frontend)
- **Status:** Pending
- **Effort:** 4 weeks
- **Runs parallel with:** Phase 1 (Backend)

Dev B transforms the React SPA from offline-only calculator into authenticated platform with routing, API integration, dashboard, and activity views. Works in `src/` only — no backend files.

## Key Insights
- Current app is single-page, no routing — need React Router
- All state is localStorage — migrate to API-backed with offline fallback
- Keep existing MAF calculator working offline (no regression)
- API contract from Dev A (OpenAPI spec) drives type generation
- Need API client layer with auth token handling

## Requirements

### Functional
- Login/logout via WordPress SSO (redirect flow)
- Protected routes (redirect to login if not authenticated)
- User profile page (view/edit MAF profile)
- Strava connect/disconnect UI
- Activity list page (paginated, with MAF zone indicators)
- Dashboard page (MAF pace trend chart, weekly stats, zone compliance)
- Navigation overhaul (sidebar or tabs for new pages)
- Existing calculator still works for anonymous users (offline mode)

### Non-Functional
- Auth state persists across page refreshes (JWT in cookie)
- Graceful loading states + error boundaries
- Mobile-responsive (existing Tailwind patterns)
- <100ms perceived interaction latency

## Architecture

### New Page Structure
```
src/
├── pages/
│   ├── home-page.tsx           # Landing / MAF calculator (existing, moved)
│   ├── login-page.tsx          # Login with WP SSO button
│   ├── dashboard-page.tsx      # MAF trends, stats, zone compliance
│   ├── activities-page.tsx     # Paginated activity list
│   ├── activity-detail-page.tsx # Single activity with MAF analysis
│   ├── profile-page.tsx        # User profile + settings
│   └── strava-callback-page.tsx # Strava OAuth callback handler
│
├── contexts/
│   └── auth-context.tsx        # AuthProvider: user state, login/logout, token refresh
│
├── services/
│   ├── api-client.ts           # Axios/fetch wrapper with auth interceptor
│   ├── auth-service.ts         # login(), logout(), refreshToken(), getMe()
│   ├── strava-service.ts       # connect(), disconnect(), getStatus()
│   ├── activity-service.ts     # getActivities(), getActivity()
│   └── dashboard-service.ts    # getStats(), getTrends(), getMafTests()
│
├── components/
│   ├── layout/
│   │   ├── app-layout.tsx      # Main layout with nav + content area
│   │   ├── sidebar-nav.tsx     # Navigation sidebar (or bottom tabs on mobile)
│   │   └── protected-route.tsx # Route guard component
│   │
│   ├── dashboard/
│   │   ├── maf-trend-chart.tsx     # Line chart: MAF pace over weeks
│   │   ├── weekly-stats-card.tsx   # Volume, runs, zone compliance
│   │   ├── zone-compliance-ring.tsx # Donut chart: % in zone
│   │   └── recent-activities-list.tsx # Last 5 activities summary
│   │
│   ├── activities/
│   │   ├── activity-list-item.tsx  # Single activity row
│   │   ├── activity-maf-badge.tsx  # Zone compliance indicator
│   │   └── activity-filters.tsx    # Date range, type filters
│   │
│   ├── auth/
│   │   ├── login-button.tsx        # WP SSO login button
│   │   ├── user-menu.tsx           # Avatar + dropdown (profile, logout)
│   │   └── strava-connect-btn.tsx  # Connect/disconnect Strava
│   │
│   └── (existing components remain here)
│
├── hooks/
│   ├── use-auth.ts             # Hook to access auth context
│   ├── use-api.ts              # Generic API fetch hook (SWR/React Query pattern)
│   └── (existing hooks remain)
│
└── types/
    ├── api-types.ts            # Types matching backend API responses
    └── (move existing types.ts here or keep at root)
```

### Routing

```typescript
// src/app.tsx (updated)
<BrowserRouter>
  <AuthProvider>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/strava/callback" element={<StravaCallbackPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/activities/:id" element={<ActivityDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

## Related Code Files

### Files to Create
- `src/pages/` — all page components (6 files)
- `src/contexts/auth-context.tsx` — auth state management
- `src/services/` — API client + service modules (5 files)
- `src/components/layout/` — layout components (3 files)
- `src/components/dashboard/` — dashboard widgets (4 files)
- `src/components/activities/` — activity UI (3 files)
- `src/components/auth/` — auth UI (3 files)
- `src/hooks/use-auth.ts` — auth hook
- `src/hooks/use-api.ts` — data fetching hook
- `src/types/api-types.ts` — API response types

### Files to Modify
- `src/app.tsx` — add Router, AuthProvider, route definitions
- `src/index.tsx` — wrap with BrowserRouter if needed
- `package.json` — add `react-router-dom`, `recharts` (or `chart.js`), `axios`
- `nginx.conf` — add `try_files $uri /index.html` for SPA routing (if not already)
- `vite.config.ts` — proxy API calls to backend in dev

### Files Unchanged (Keep Working)
- All existing `src/components/*.tsx` — MAF calculator UI untouched
- All existing `src/hooks/*.ts` — calculator hooks untouched
- All existing `src/utils/*.ts` — calculation logic untouched

## Implementation Steps

### Week 1: Routing + Auth Foundation
1. Install deps: `react-router-dom@6`, `axios`, `recharts`
2. Create `src/services/api-client.ts`:
   - Axios instance with `baseURL: import.meta.env.VITE_API_URL`
   - Request interceptor: attach JWT from cookie (or header)
   - Response interceptor: on 401 → try refresh → retry or redirect to login
3. Create `src/contexts/auth-context.tsx`:
   - State: `user | null`, `isLoading`, `isAuthenticated`
   - On mount: call `GET /users/me` → set user or null
   - `login()` → redirect to `api.maf.run/auth/login`
   - `logout()` → call `POST /auth/logout` → clear state → redirect to `/`
4. Create `src/hooks/use-auth.ts` — thin wrapper around AuthContext
5. Create `src/components/layout/protected-route.tsx`:
   - If loading → spinner
   - If not authenticated → redirect to `/login`
   - If authenticated → render `<Outlet />`
6. Create `src/pages/login-page.tsx` — login button + "Continue as guest" link
7. Update `src/app.tsx` — add BrowserRouter, AuthProvider, routes
8. Move existing calculator UI to `src/pages/home-page.tsx` (or keep in app.tsx as `/` route)
9. Verify: existing calculator still works at `/` without login

### Week 2: Layout + Profile + Strava Connect
10. Create `src/components/layout/app-layout.tsx`:
    - Sidebar nav (desktop) / bottom tabs (mobile)
    - Links: Dashboard, Activities, Calculator, Profile
    - User menu in top-right (avatar, name, logout)
11. Create `src/components/layout/sidebar-nav.tsx`:
    - Active state highlighting
    - Responsive: sidebar on desktop, bottom bar on mobile
12. Create `src/components/auth/user-menu.tsx` — avatar dropdown
13. Create `src/components/auth/login-button.tsx` — styled WP SSO button
14. Create `src/pages/profile-page.tsx`:
    - Display user info (from WP: name, email, avatar)
    - MAF profile form (age, height, weight, experience, commitment)
    - Save → `PUT /users/me/profile`
    - Strava connection status + connect/disconnect button
15. Create `src/components/auth/strava-connect-btn.tsx`:
    - If not connected: "Connect Strava" → redirect to `/strava/connect`
    - If connected: show Strava username + "Disconnect" button
16. Create `src/pages/strava-callback-page.tsx`:
    - Extract auth code from URL
    - Call `POST /strava/callback` with code
    - Redirect to `/profile` with success toast
17. Create `src/services/strava-service.ts` — connect, disconnect, getStatus

### Week 3: Dashboard
18. Create `src/services/dashboard-service.ts`:
    - `getStats()` → `GET /dashboard/stats`
    - `getTrends()` → `GET /dashboard/trends`
    - `getMafTests()` → `GET /dashboard/maf-tests`
19. Create `src/hooks/use-api.ts`:
    - Generic data fetching hook with loading/error/data states
    - Auto-refetch on focus (SWR-like)
    - Cache results in memory
20. Create `src/pages/dashboard-page.tsx`:
    - Grid layout: stats cards top, trend chart middle, recent activities bottom
    - Loading skeletons while data fetches
21. Create `src/components/dashboard/maf-trend-chart.tsx`:
    - Recharts LineChart: x=week, y=pace (min/km)
    - Highlight improvements in green, regressions in red
    - Tooltip with exact pace + date
22. Create `src/components/dashboard/weekly-stats-card.tsx`:
    - Total distance, total time, number of runs, avg HR
23. Create `src/components/dashboard/zone-compliance-ring.tsx`:
    - Donut chart: % time in MAF zone vs out of zone
24. Create `src/components/dashboard/recent-activities-list.tsx`:
    - Last 5 activities with type, distance, duration, MAF badge

### Week 4: Activities + Polish
25. Create `src/services/activity-service.ts`:
    - `getActivities(page, limit, filters)` → `GET /activities`
    - `getActivity(id)` → `GET /activities/:id`
26. Create `src/pages/activities-page.tsx`:
    - Paginated list with infinite scroll or page buttons
    - Filter bar: date range, activity type
    - Each row: date, name, distance, duration, MAF zone badge
27. Create `src/components/activities/activity-list-item.tsx`:
    - Compact row with key metrics
    - Click → navigate to detail page
28. Create `src/components/activities/activity-maf-badge.tsx`:
    - Green "In Zone" / Yellow "Partial" / Red "Out of Zone"
    - Based on `mafZonePercent` from API
29. Create `src/pages/activity-detail-page.tsx`:
    - Full activity details: map placeholder, splits, HR chart
    - MAF analysis section: zone %, cardiac drift, efficiency
30. Add `vite.config.ts` proxy: `/api` → `http://localhost:3001` for dev
31. Polish: loading skeletons, error boundaries, empty states
32. Cross-browser testing + mobile responsive check

## Todo List
- [ ] React Router installed + routes configured
- [ ] Auth context + protected routes working
- [ ] Login page with WP SSO redirect
- [ ] App layout with sidebar nav + user menu
- [ ] Profile page with MAF profile form
- [ ] Strava connect/disconnect flow
- [ ] Dashboard page with MAF trend chart
- [ ] Weekly stats cards + zone compliance ring
- [ ] Activities page with pagination
- [ ] Activity detail page with MAF analysis
- [ ] API client with auth interceptor
- [ ] Loading states + error handling
- [ ] Mobile responsive verified

## Success Criteria
- Anonymous user can still use MAF calculator at `/` (no regression)
- Login → WP SSO → redirect back → user menu shows name/avatar
- Dashboard shows MAF pace trend chart with real Strava data
- Activities page shows paginated list with MAF zone badges
- Profile page saves MAF profile to backend
- Strava connect → activities appear in list
- All pages mobile-responsive
- No console errors in production build

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| API not ready when frontend starts | Use mock API (MSW) with agreed types; swap to real API later |
| Chart library performance on mobile | Recharts is lightweight; test with 100+ data points |
| Cookie auth + CORS issues | Dev proxy handles this; production: same-domain cookies via Cloudflare |
| SPA routing conflicts with Nginx | Ensure `try_files $uri /index.html` is configured |

## Security Considerations
- Never store JWT in localStorage (XSS risk) — use httpOnly cookies
- CSRF protection: SameSite=Lax cookies + custom header check
- Sanitize all user-generated content before rendering
- No sensitive data in URL params (use POST for auth codes)
- Strava tokens never reach frontend — backend only

## Next Steps
- Phase 3: Integration testing with backend (Dev A)
- Ensure API contract matches between services/* and backend endpoints
