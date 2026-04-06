# Phase 4: Frontend Auth + Data Migration

## Context
- [Codebase Summary](../../docs/codebase-summary.md)
- [Code Standards](../../docs/code-standards.md)
- [use-user-profile.ts](../../src/hooks/use-user-profile.ts) — current hook to migrate
- [app.tsx](../../src/app.tsx) — current routing setup
- [types.ts](../../src/types.ts) — UserProfile interface

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 3 days
- **Blocked by:** Phase 2 (SSO), Phase 3 (Profile API)

Add authentication layer to React frontend. Create API client with JWT cookie handling. Migrate `useUserProfile` from local-only state to API-backed persistence. Add login page, protected routes, and auth context.

## Key Insights
- Current `useUserProfile` uses `useState` with no persistence — fresh state on every page load
- JWT sent via httpOnly cookie (automatic on same-domain requests) — no manual token handling needed
- API client uses `credentials: 'include'` for cookie pass-through
- Existing calculator must keep working for anonymous users (no regression)
- react-router-dom v7 already installed
- Profile fetched on mount for authenticated users, fallback to local state for anonymous

## Requirements

### Functional
- Auth context: `user`, `isAuthenticated`, `isLoading`, `login()`, `logout()`
- API client with automatic cookie handling + 401 refresh retry
- Login page with "Login with WordPress" button
- Protected route wrapper (redirect to login if not authenticated)
- `useUserProfile` fetches/saves profile via API when authenticated
- Profile page for viewing/editing MAF profile

### Non-Functional
- Auth state persists across page refreshes (cookie-based)
- Graceful loading states during auth check
- <100ms perceived interaction latency
- No bundle size regression (minimal new deps)

## Architecture

### New File Structure

```
src/
├── contexts/
│   └── auth-context.tsx       — AuthProvider: user state, login/logout
├── services/
│   ├── api-client.ts          — fetch wrapper with credentials + refresh retry
│   ├── auth-service.ts        — login(), logout(), refreshToken(), getMe()
│   └── profile-service.ts     — getProfile(), updateProfile()
├── components/
│   ├── layout/
│   │   └── protected-route.tsx — Route guard
│   └── auth/
│       └── login-button.tsx   — WordPress SSO button
├── hooks/
│   └── use-auth.ts            — thin hook wrapping auth context
├── pages/
│   ├── login-page.tsx         — Login page (dark theme)
│   └── profile-page.tsx       — Profile view/edit (dark theme)
```

### Auth Flow

```
App mounts
  ↓
AuthProvider checks: GET /users/me (with cookie)
  ├── 200: user authenticated → set user state
  ├── 401: not authenticated → try refresh → if fails, set user=null
  └── Network error → set user=null, continue as anonymous
  ↓
Routes render
  ├── / → Calculator (existing, no auth required)
  ├── /login → LoginPage (redirect to /dashboard if already authenticated)
  ├── /dashboard → ProtectedRoute → DashboardPage (Phase 5)
  └── /profile → ProtectedRoute → ProfilePage
```

### useUserProfile Migration

```
BEFORE (anonymous only):
  useState(defaults) → in-memory only → lost on refresh

AFTER (dual mode):
  If authenticated:
    Mount → GET /users/me/profile → populate state
    On explicit Save button click → PUT /users/me/profile → save to server
  If anonymous:
    Same as before (useState with defaults, no persistence)
<!-- Red Team: Updated to explicit save (not debounced auto-save) per validation -->
```

## Related Code Files

### Files to Create
- `src/contexts/auth-context.tsx`
- `src/services/api-client.ts`
- `src/services/auth-service.ts`
- `src/services/profile-service.ts`
- `src/hooks/use-auth.ts`
- `src/components/layout/protected-route.tsx`
- `src/components/auth/login-button.tsx`
- `src/pages/login-page.tsx`
- `src/pages/profile-page.tsx`

### Files to Modify
- `src/app.tsx` — wrap with AuthProvider, add new routes (/login, /dashboard, /profile)
- `src/hooks/use-user-profile.ts` — add API fetch/save when authenticated
- `src/index.tsx` — ensure BrowserRouter wraps AuthProvider
- `vite.config.ts` — add dev proxy for `/api` → `http://localhost:3001`

## Implementation Steps

### Week 1: API Client + Auth Context
1. Create `src/services/api-client.ts` with **refresh mutex** (prevents race condition):
   ```typescript
   const API_BASE = import.meta.env.VITE_API_URL || '/api';

   // Refresh mutex: concurrent 401s share one refresh call
   let refreshPromise: Promise<boolean> | null = null;

   async function refreshToken(): Promise<boolean> {
     if (refreshPromise) return refreshPromise;
     refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
       method: 'POST', credentials: 'include'
     }).then(r => r.ok).finally(() => { refreshPromise = null; });
     return refreshPromise;
   }

   async function apiFetch(path: string, options?: RequestInit, retried = false) {
     const res = await fetch(`${API_BASE}${path}`, {
       ...options,
       credentials: 'include',
       headers: { 'Content-Type': 'application/json', ...options?.headers },
     });
     if (res.status === 401 && !retried) {
       const ok = await refreshToken();
       if (ok) return apiFetch(path, options, true); // retry once
       window.location.href = '/login';
       throw new Error('Unauthorized');
     }
     return res;
   }

   export const api = {
     get: (path: string) => apiFetch(path),
     put: (path: string, body: unknown) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
     post: (path: string, body?: unknown) => apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
   };
   ```
   <!-- Red Team: Refresh mutex prevents parallel 401 → parallel refresh → token rotation kills session.
        `retried` flag prevents infinite 401 loops. -->

2. Create `src/services/auth-service.ts`:
   - `getMe()` → `GET /users/me`
   - `logout()` → `POST /auth/logout`
   - `getLoginUrl()` → returns `${API_BASE}/auth/login` (full redirect)

3. Create `src/contexts/auth-context.tsx`:
   - State: `user: User | null`, `isLoading: boolean`
   - On mount: call `getMe()` → set user or null
   - `login()` → `window.location.href = getLoginUrl()`
   - `logout()` → call logout API → set user=null → redirect to `/`
   - Provide via React context

4. Create `src/hooks/use-auth.ts` — `useContext(AuthContext)` wrapper

5. Create `src/components/layout/protected-route.tsx`:
   - If loading → show spinner
   - If not authenticated → `<Navigate to="/login" />`
   - If authenticated → `<Outlet />`

### Week 1: Login Page + Routes
6. Create `src/pages/login-page.tsx`:
   - Dark theme background (`bg-[#0B1121]`)
   - MAF RUNNING gradient logo
   - "Đăng nhập với WordPress" gradient button → calls `login()`
   - "Tiếp tục không đăng nhập" link → navigates to `/` (calculator)

7. Create `src/components/auth/login-button.tsx`:
   - Gradient button (from-[#F42A68] to-[#9130F8])
   - onClick → `login()` from auth context

8. Update `src/app.tsx`:
   - Wrap with `<AuthProvider>`
   - Add routes: `/login`, `/dashboard` (placeholder), `/profile`
   - Protected routes use `<ProtectedRoute />` wrapper
   - Existing `/` route unchanged (calculator, no auth required)

9. Update `vite.config.ts`:
   - Add proxy: `'/api': { target: 'http://localhost:3001', changeOrigin: true, rewrite: path => path.replace(/^\/api/, '') }`

### Week 2: Profile Migration
10. Create `src/services/profile-service.ts`:
    - `getProfile()` → `GET /users/me/profile`
    - `updateProfile(data)` → `PUT /users/me/profile`

11. Modify `src/hooks/use-user-profile.ts`:
    - Add `isAuthenticated` parameter (from auth context)
    - On mount: if authenticated → fetch profile from API → populate state
    - Add `saveProfile()` function: explicit save (called on button click, NOT auto-save)
    - If anonymous → same behavior as before (no persistence)
    - Handle loading state while fetching profile
    <!-- Updated: Validation Session 1 - explicit save button, not auto-save/debounced -->

12. Create `src/pages/profile-page.tsx`:
    - Dark theme
    - Display user info (name, email, avatar from WordPress)
    - MAF profile form (reuse FormPersonalInfo, FormHealthChecklist, CommitmentSelector)
    - Explicit "Save Profile" button → calls updateProfile → success toast
    <!-- Updated: Validation Session 1 - explicit save, not auto-save -->

## Todo List
- [x] API client with credentials + 401 refresh retry
- [x] Auth context with login/logout/getMe
- [x] Protected route component
- [x] Login page (dark theme, WP SSO button)
- [x] Routes updated: /login, /dashboard, /profile
- [x] useUserProfile modified: fetch from API when authenticated
- [x] Profile explicit save (save button triggers PUT)
- [x] Profile page (view/edit MAF profile, dark theme)
- [x] Vite dev proxy configured
- [x] Calculator still works at / without login (no regression)

## Success Criteria
- Anonymous user uses calculator at `/` — unchanged behavior
- Click "Login" → redirect to WordPress → approve → redirect back to /dashboard with JWT cookie
- `useUserProfile` loads saved profile from server on mount
- Profile changes saved to server via explicit "Save Profile" button
<!-- Red Team: Fixed contradictory success criteria — was "auto-save", should be "explicit save" per validation -->
- Page refresh preserves auth state (cookie persists)
- Expired token → auto-refresh → seamless experience
- Logout → cookie cleared → redirect to home

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Cookie not sent cross-origin | Same parent domain (.maf.run) + sameSite=lax |
| Vite proxy issues in dev | Direct API URL fallback via VITE_API_URL env |
| Profile save race condition | Explicit save button — no concurrent writes |
| Breaking existing calculator | No changes to existing components/utils — only hook behavior changes |

## Security Considerations
- No token storage in localStorage/sessionStorage (XSS protection)
- API client always uses `credentials: 'include'` (httpOnly cookie)
- Login URL goes to backend (not directly to WordPress) — backend controls PKCE
- Profile updates validated server-side (DTO validation)

## Next Steps
- Phase 5: Build dashboard UI that uses auth context + profile data
