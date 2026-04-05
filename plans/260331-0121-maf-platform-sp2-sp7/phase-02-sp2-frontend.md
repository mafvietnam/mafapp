# Phase 2: SP2 Frontend — Auth UI + Dashboard + Activity UI

## Context
- [Brainstorm Report](../reports/brainstorm-260331-0100-sprint-roadmap-sp2-sp7.md)
- [Codebase Summary](../../docs/codebase-summary.md)
- [Code Standards](../../docs/code-standards.md)
- [Design Guidelines](../../docs/design-guidelines.md)
- **Dashboard Mockups:** `home_mobile.html` (mobile) + `home_pc.html` (desktop) in project root

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
- **NEW:** Dashboard redesign with dark theme from HTML mockups (`home_mobile.html`, `home_pc.html`)
- **Design shift:** Light theme → dark theme (#0B1121), new brand gradient (#F42A68 → #9130F8)
- **MVP scope (validated):** 3-4 essential widgets only: MAF zone card, activity list, trend chart, profile
- **Deferred to SP3:** Ecosystem icons, AI assistant widget, formula widget, glass-card effects
- **API-first (validated):** Generate frontend types from OpenAPI spec in Week 1, not Week 4
- **~20 files** (down from 38). Dark theme for authenticated pages only.
<!-- Updated: Validation Session 1 - MVP scope, API-first, reduced widgets -->

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
│   ├── home-page.tsx           # Landing / MAF calculator (existing, light theme)
│   ├── login-page.tsx          # Login with WP SSO button (dark theme)
│   ├── dashboard-page.tsx      # Home dashboard (dark theme, from HTML mockups)
│   ├── activities-page.tsx     # Activity history (dark theme)
│   ├── activity-detail-page.tsx # Single activity with MAF analysis
│   ├── profile-page.tsx        # User profile + settings
│   └── strava-callback-page.tsx # Strava OAuth callback handler
│
├── contexts/
│   ├── auth-context.tsx        # AuthProvider: user state, login/logout, token refresh
│   └── theme-context.tsx       # ThemeProvider: dark (authenticated) vs light (public)
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
│   │   ├── app-layout.tsx           # Dark theme layout shell
│   │   ├── mobile-bottom-tabs.tsx   # Bottom tab bar (mobile, from home_mobile.html)
│   │   ├── desktop-top-nav.tsx      # Top navigation bar (desktop, from home_pc.html)
│   │   └── protected-route.tsx      # Route guard component
│   │
│   ├── ui/
│   │   ├── glass-card.tsx           # Mobile glassmorphism card (backdrop-blur-28px)
│   │   ├── desktop-card.tsx         # Desktop solid card (gray-900, border, rounded-16)
│   │   └── gradient-button.tsx      # Brand gradient CTA (#F42A68 → #9130F8)
│   │
│   ├── dashboard/
│   │   ├── maf-zone-card.tsx            # "Vùng Nhịp Tim MAF 135-145 BPM" (glass-card mobile / desktop-card)
│   │   ├── maf-assistant-card.tsx       # AI assistant widget with schedule CTA
│   │   ├── ecosystem-icons.tsx          # Expandable icon row (coach, challenge, nutrition, jersey)
│   │   ├── latest-maf-test-card.tsx     # Pace + HR from last test
│   │   ├── maf-trend-chart.tsx          # SVG line chart (gradient line, tooltips)
│   │   ├── weekly-stats-row.tsx         # 3-column stats (HR zone, avg pace, weekly distance)
│   │   ├── activity-history-list.tsx    # Mobile: glass-card items with Strava badge
│   │   ├── activity-history-table.tsx   # Desktop: full data table with columns
│   │   ├── maf-formula-widget.tsx       # Desktop sidebar: age input + adjustment selector
│   │   └── ecosystem-links-widget.tsx   # Desktop sidebar: coach, supplements, nutrition list
│   │
│   ├── activities/
│   │   ├── activity-list-item.tsx  # Single activity row (glass-card or table row)
│   │   ├── activity-maf-badge.tsx  # Zone compliance indicator (green dot / red alert)
│   │   ├── activity-strava-badge.tsx # Strava sync indicator with orange icon
│   │   └── activity-filters.tsx    # Date range, type filters
│   │
│   ├── auth/
│   │   ├── login-button.tsx        # WP SSO login button (gradient style)
│   │   ├── user-menu.tsx           # Avatar + dropdown (name, plan tier, logout)
│   │   ├── strava-connect-btn.tsx  # Connect/disconnect Strava
│   │   └── notification-bell.tsx   # Bell icon with unread badge (desktop nav)
│   │
│   └── (existing components remain here)
│
├── hooks/
│   ├── use-auth.ts             # Hook to access auth context
│   ├── use-api.ts              # Generic API fetch hook (SWR/React Query pattern)
│   ├── use-responsive.ts       # Hook for mobile/tablet/desktop breakpoint detection
│   └── (existing hooks remain)
│
└── types/
    ├── api-types.ts            # Types matching backend API responses
    └── (move existing types.ts here or keep at root)
```

### Dashboard Design Specifications (from HTML mockups)

#### Design System (Dark Theme)

| Token | Mobile (glass) | Desktop (solid) |
|-------|---------------|-----------------|
| Background | `bg-slate-950` (#020617) + banner image overlay | `bg-[#0B1121]` |
| Card bg | `rgba(255,255,255,0.05)` + `backdrop-blur(28px)` | `#111827` (gray-900) |
| Card border | `rgba(255,255,255,0.15)` | `rgba(255,255,255,0.05)` |
| Card radius | `rounded-[20px]` | `rounded-[16px]` |
| Card shadow | `0 8px 32px rgba(0,0,0,0.3)` | `0 4px 20px rgba(0,0,0,0.2)` |
| Brand gradient | `from-[#F42A68] to-[#9130F8]` | Same |
| Primary text | `text-white` with `drop-shadow-md` | `text-white` |
| Secondary text | `text-white/60` to `text-white/80` | `text-slate-400` to `text-slate-500` |
| Label text | `text-[10px] uppercase tracking-wider font-bold` | `text-xs uppercase tracking-widest font-bold` |
| Value text | `text-2xl font-black` | `text-3xl font-black` |

#### Mobile Layout (< 768px) — from `home_mobile.html`

```
┌──────────────────────┐
│ Header: MAF RUNNING  │ ← gradient italic brand + avatar
│ (banner bg overlay)  │
├──────────────────────┤
│ ♥ MAF Zone 135-145   │ ← glass-card, gradient icon, formula badge
├──────────────────────┤
│ 🤖 MAF Assistant     │ ← glass-card, schedule CTA button
├──────────────────────┤
│ ○ ○ ○ ○ Ecosystem    │ ← 4 circular expandable icons
├──────────────────────┤
│ Latest MAF Test      │ ← glass-card, pace + HR stats
├──────────────────────┤
│ Activity History     │ ← glass-card list items, Strava badges
├──────────────────────┤
│ [Home][History][+][Community][Profile] │ ← bottom tabs, rounded-t-[32px]
└──────────────────────┘
```

#### Desktop Layout (≥ 1024px) — from `home_pc.html`

```
┌─────────────────────────────────────────────────┐
│ Top Nav: MAF RUNNING | Menu links | 🔔 | Avatar │ ← glass-nav sticky
├──────────────────────────────────────────────────┤
│ Welcome: "Tổng quan hiệu suất"  [+ Ghi mới]    │
├────────────────────────────┬─────────────────────┤
│ [HR Zone] [Avg Pace] [Dist]│ 🤖 MAF AI Assistant │ ← 3 stat cards | widget
├────────────────────────────┤                     │
│ MAF Trend Chart (SVG line) │ MAF Formula Config  │ ← chart | settings
├────────────────────────────┤                     │
│ Activity History Table     │ Ecosystem Links     │ ← data table | sidebar
│ (date, name, km, pace, HR)│                     │
└────────────────────────────┴─────────────────────┘
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

### Week 1: Routing + Auth + Dark Theme Foundation
1. Install deps: `react-router-dom@6`, `axios`, `recharts`
2. Create `src/services/api-client.ts`:
   - Axios instance with `baseURL: import.meta.env.VITE_API_URL`
   - Request interceptor: attach JWT from cookie (or header)
   - Response interceptor: on 401 → try refresh → retry or redirect to login
3. Create `src/contexts/auth-context.tsx`:
   - State: `user | null`, `isLoading`, `isAuthenticated`
   - On mount: call `GET /users/me` → set user or null
   - `login()` → redirect to `api.maf.run/auth/login` (WP OAuth PKCE)
   - `logout()` → call `POST /auth/logout` → clear state → redirect to `/`
4. Create `src/hooks/use-auth.ts` — thin wrapper around AuthContext
5. Create `src/hooks/use-responsive.ts` — breakpoint detection (mobile/tablet/desktop)
6. Create **dark theme base components**:
   - `src/components/ui/glass-card.tsx` — mobile glassmorphism (copy CSS from `home_mobile.html`)
   - `src/components/ui/desktop-card.tsx` — desktop solid card (copy CSS from `home_pc.html`)
   - `src/components/ui/gradient-button.tsx` — brand gradient CTA
7. Create `src/components/layout/protected-route.tsx`:
   - If loading → dark-themed skeleton
   - If not authenticated → redirect to `/login`
   - If authenticated → render `<Outlet />`
8. Create `src/pages/login-page.tsx` — dark theme, gradient login button + "Continue as guest"
9. Update `src/app.tsx` — add BrowserRouter, AuthProvider, routes
10. Move existing calculator UI to `src/pages/home-page.tsx` (keep light theme for public)
11. Verify: existing calculator still works at `/` without login

### Week 2: Layout + Navigation + Profile + Strava Connect
12. Create `src/components/layout/app-layout.tsx`:
    - Dark theme shell (`bg-[#0B1121] min-h-screen`)
    - Responsive: renders `desktop-top-nav` on lg:, `mobile-bottom-tabs` on mobile
    - Content area with `<Outlet />`
13. Create `src/components/layout/desktop-top-nav.tsx` (from `home_pc.html`):
    - Glass-nav: `rgba(11,17,33,0.7)` + `backdrop-blur(20px)`, sticky top
    - Left: MAF RUNNING gradient logo + menu links (Bảng điều khiển, Nhật ký chạy, Giáo án, Cộng đồng, Challenge)
    - Right: notification bell (with badge) + user menu (name, plan tier, avatar)
    - Max width: 1440px centered
14. Create `src/components/layout/mobile-bottom-tabs.tsx` (from `home_mobile.html`):
    - Glass-card bottom bar with `rounded-t-[32px]`
    - 5 tabs: Trang chủ, Lịch sử, (+) center gradient button, Cộng đồng, Hồ sơ
    - Center "+" button: 60px gradient circle, -top-6 offset, border-4 border-[#0B1121]
    - Active tab: white, inactive: white/50
15. Create `src/components/auth/user-menu.tsx` — avatar + name + plan tier (desktop)
16. Create `src/components/auth/notification-bell.tsx` — bell icon with red dot badge
17. Create `src/components/auth/login-button.tsx` — gradient WP SSO button
18. Create `src/pages/profile-page.tsx` (dark theme):
    - Display user info (from cached WP data: name, email, avatar)
    - MAF profile form (age, height, weight, experience, commitment) — dark inputs
    - Save → `PUT /users/me/profile`
    - Strava connection status + connect/disconnect button
19. Create `src/components/auth/strava-connect-btn.tsx`:
    - If not connected: "Connect Strava" → redirect to `/strava/connect`
    - If connected: show Strava username + "Disconnect" button
    - Strava orange (#FC4C02) accent color
20. Create `src/pages/strava-callback-page.tsx`:
    - Extract auth code from URL
    - Call `POST /strava/callback` with code
    - Redirect to `/dashboard` with success toast
21. Create `src/services/strava-service.ts` — connect, disconnect, getStatus

### Week 3: Dashboard (from HTML mockups)
22. Create `src/services/dashboard-service.ts`:
    - `getStats()` → `GET /dashboard/stats`
    - `getTrends()` → `GET /dashboard/trends`
    - `getMafTests()` → `GET /dashboard/maf-tests`
23. Create `src/hooks/use-api.ts`:
    - Generic data fetching hook with loading/error/data states
    - Auto-refetch on focus (SWR-like)
    - Cache results in memory
24. Create `src/pages/dashboard-page.tsx`:
    - **Mobile:** Single column scroll (from `home_mobile.html`)
      - Banner background image with gradient overlay
      - Header: MAF RUNNING gradient + avatar
      - Content: MAF zone → assistant → ecosystem → test → history
    - **Desktop:** 12-column grid (from `home_pc.html`)
      - Welcome banner + "Ghi hoạt động mới" gradient button
      - Left 8/12: stats row → chart → activity table
      - Right 4/12: AI assistant → formula config → ecosystem links
    - Dark skeleton loaders while data fetches
25. Create `src/components/dashboard/maf-zone-card.tsx`:
    - Mobile: glass-card with gradient heart icon, "135-145 BPM", formula badge "180 - 35"
    - Desktop: desktop-card with stats layout (label/value/icon pattern)
26. Create `src/components/dashboard/maf-assistant-card.tsx`:
    - Bot icon, feature list (calendar, sparkles), "Lên Lịch Tập" CTA
    - Desktop: full-width widget with recommendation text
27. Create `src/components/dashboard/ecosystem-icons.tsx`:
    - 4 circular icons: Coach (cyan), Challenges (orange), Nutrition (emerald), Jersey (violet)
    - Mobile: expandable on hover/tap (max-w-0 → max-w-[140px] transition)
    - Desktop: list layout with chevron-right
28. Create `src/components/dashboard/latest-maf-test-card.tsx`:
    - Date + distance badges, Avg Pace + Heart Rate stats
    - Green dot indicator for in-zone HR
29. Create `src/components/dashboard/maf-trend-chart.tsx`:
    - Recharts or SVG line chart with gradient stroke (#F42A68 → #9130F8)
    - X-axis: months, Y-axis: pace (min:sec/km)
    - Hover tooltips with exact pace
    - Desktop only (or simplified for mobile)
30. Create `src/components/dashboard/weekly-stats-row.tsx`:
    - Desktop: 3 stat cards in grid (HR zone, avg pace, weekly distance)
    - Each: label (uppercase), value (text-3xl font-black), icon circle
31. Create `src/components/dashboard/activity-history-list.tsx` (mobile):
    - Glass-card items with avatar icon, activity name, time, pace, HR
    - Strava sync badge (orange FC4C02 refresh icon)
    - Red alert for over-MAF zone runs
32. Create `src/components/dashboard/activity-history-table.tsx` (desktop):
    - Full data table: date, workout name, distance, pace, HR, source
    - Hover row highlight, Strava logo in source column
    - Over-MAF rows: alert-triangle icon + red HR text
33. Create `src/components/dashboard/maf-formula-widget.tsx` (desktop sidebar):
    - Age input + adjustment factor selector
    - "Cập nhật Vùng Nhịp Tim" button
34. Create `src/components/dashboard/ecosystem-links-widget.tsx` (desktop sidebar):
    - List: Coach, Supplements, Nutrition with icon + description + chevron

### Week 4: Activities + Polish
35. Create `src/services/activity-service.ts`:
    - `getActivities(page, limit, filters)` → `GET /activities`
    - `getActivity(id)` → `GET /activities/:id`
36. Create `src/pages/activities-page.tsx` (dark theme):
    - Mobile: glass-card list with infinite scroll
    - Desktop: full data table with pagination
    - Filter bar: date range, activity type
37. Create `src/components/activities/activity-list-item.tsx`:
    - Mobile: glass-card row (from activity-history-list pattern)
    - Desktop: table row (from activity-history-table pattern)
    - Click → navigate to detail page
38. Create `src/components/activities/activity-maf-badge.tsx`:
    - In zone: green dot with glow `ring-2 ring-[#00FF88]/30`
    - Partial: yellow/amber indicator
    - Over zone: red alert-circle icon + red text
39. Create `src/components/activities/activity-strava-badge.tsx`:
    - Strava orange (#FC4C02) sync indicator with refresh icon
40. Create `src/pages/activity-detail-page.tsx` (dark theme):
    - Full activity details: map placeholder, splits, HR chart
    - MAF analysis section: zone %, cardiac drift, efficiency
    - desktop-card or glass-card based on viewport
41. Add `vite.config.ts` proxy: `/api` → `http://localhost:3001` for dev
42. Update `tailwind.config.js` with new design tokens:
    - Colors: `maf-red: #F42A68`, `maf-violet: #9130F8`, `maf-dark: #0B1121`
    - Background: `dark-card: #111827`
43. Polish: dark-themed skeleton loaders, error boundaries, empty states
44. Cross-browser testing + mobile responsive check (dark theme contrast)

## Todo List
- [ ] React Router installed + routes configured
- [ ] Auth context + protected routes working
- [ ] Dark theme base components (glass-card, desktop-card, gradient-button)
- [ ] Login page with WP SSO redirect (dark theme)
- [ ] Desktop top navigation bar (glass-nav, from home_pc.html)
- [ ] Mobile bottom tab bar (glass-card, from home_mobile.html)
- [ ] Profile page with MAF profile form (dark theme)
- [ ] Strava connect/disconnect flow
- [ ] Dashboard page: mobile layout (glass-card stack, banner bg)
- [ ] Dashboard page: desktop layout (12-col grid, 8:4 split)
- [ ] MAF zone card + assistant card
- [ ] Ecosystem icons (expandable mobile, list desktop)
- [ ] MAF trend chart (gradient SVG line)
- [ ] Weekly stats row (3 desktop-cards)
- [ ] Activity history (mobile: glass-card list, desktop: data table)
- [ ] MAF formula widget + ecosystem links widget (desktop sidebar)
- [ ] Activities page with pagination/infinite scroll
- [ ] Activity detail page with MAF analysis
- [ ] API client with auth interceptor
- [ ] Tailwind config updated with new design tokens
- [ ] Loading states (dark skeletons) + error handling
- [ ] Mobile + desktop responsive verified

## Success Criteria
- Anonymous user can still use MAF calculator at `/` (no regression, light theme)
- Login → WP OAuth PKCE → redirect back → dark dashboard with user menu
- Dashboard mobile: matches `home_mobile.html` layout (glass-cards, bottom tabs, banner bg)
- Dashboard desktop: matches `home_pc.html` layout (top nav, 12-col grid, data table)
- MAF trend chart renders with gradient line and tooltips
- Activities page: glass-card list (mobile) / data table (desktop)
- Activity items show Strava sync badge and MAF zone indicator
- Profile page saves MAF profile to backend
- Strava connect → activities appear in dashboard
- Dark theme contrast meets WCAG AA on dark backgrounds
- No console errors in production build
- Bundle size: < 250KB gzipped (accounting for recharts + new components)

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
