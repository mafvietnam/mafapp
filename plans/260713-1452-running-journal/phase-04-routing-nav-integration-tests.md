# Phase 04 — Routing + nav integration + verification

## Context links
- Depends on **Phase 03** (`src/pages/journal-page.tsx` must exist).
- Routing: `src/app.tsx` (lazy `ActivityDetailPage` + `routeSuspenseFallback` pattern, lines 22, 65-72).
- Navs: `src/components/layout/desktop-top-nav.tsx:7`, `src/components/layout/mobile-bottom-tabs.tsx:6`.
- Dashboard link: `src/components/dashboard/activity-section.tsx:84` ("Xem tất cả" `<a href="#">`).

## Overview
- **Priority:** P1 (ships the feature; final quality gate)
- **Status:** pending
- Wire `/journal` route (lazy + Suspense), repoint both nav placeholders + dashboard "Xem tất cả", then run full tsc/build/test gate across frontend + backend.

## Key insights
- Nav active-highlight is automatic: both navs compare `location.pathname === to`; setting `to:'/journal'` lights the tab on that route. No extra code.
- Route must sit inside `ProtectedRoute` → `AppLayout` (auth + chrome), alongside `/dashboard`.
- Lazy import shares the recharts chunk with `ActivityDetailPage` — same `Suspense` fallback.
- `activity-section.tsx` already imports `Link` (line 1) — swap `<a href="#">` → `<Link to="/journal">`, no new import.

## Requirements
**Functional**
- `/journal` renders `JournalPage` (auth-gated, lazy, Suspense fallback).
- Desktop nav "Nhật ký chạy" → `/journal`; mobile tab "Nhật ký" → `/journal`; dashboard "Xem tất cả" → `/journal`.
- Active tab highlighted on `/journal` in both navs.

**Non-functional**
- No `#` placeholders remain for journal. Green tsc/build/test.

## Architecture
```
app.tsx: const JournalPage = lazy(() => import('./pages/journal-page'));
<Route element={ProtectedRoute}> <Route element={AppLayout}>
   <Route path="/journal" element={<Suspense fallback={routeSuspenseFallback}><JournalPage/></Suspense>} />
```
Nav data-flow: static NAV arrays `to` value `#` → `/journal`; `useLocation().pathname` drives active class (unchanged logic).

## Related code files
**Modify**
- `src/app.tsx` — lazy import + `/journal` route.
- `src/components/layout/desktop-top-nav.tsx` — `NAV_LINKS` "Nhật ký chạy" `to:'#'` → `'/journal'`.
- `src/components/layout/mobile-bottom-tabs.tsx` — `TABS` "Nhật ký" `to:'#'` → `'/journal'`.
- `src/components/dashboard/activity-section.tsx` — `<a href="#">Xem tất cả</a>` → `<Link to="/journal">`.

**Create:** none. **Delete:** none.
**Ownership note:** none of these 4 files touched by Phases 01-03. No overlap.

## Implementation steps
1. **`app.tsx`**: after line 22 add `const JournalPage = lazy(() => import('./pages/journal-page'));`. Inside `AppLayout` route group (near `/dashboard`, line 61) add:
   ```tsx
   <Route
     path="/journal"
     element={<Suspense fallback={routeSuspenseFallback}><JournalPage /></Suspense>}
   />
   ```
2. **`desktop-top-nav.tsx`**: change `{ to: '#', label: 'Nhật ký chạy' }` → `{ to: '/journal', label: 'Nhật ký chạy' }`.
3. **`mobile-bottom-tabs.tsx`**: change `{ to: '#', icon: BarChart2, label: 'Nhật ký' }` → `{ to: '/journal', icon: BarChart2, label: 'Nhật ký' }`.
4. **`activity-section.tsx`**: replace
   ```tsx
   <a href="#" className="text-sm font-medium text-maf-red hover:text-white transition-colors">Xem tất cả</a>
   ```
   with `<Link to="/journal" className="...same classes...">Xem tất cả</Link>` (`Link` already imported).
5. **Full verification gate:**
   - Frontend: `npx tsc --noEmit` → 0 errors.
   - Frontend build: `npm run build` → succeeds (journal chunk emitted).
   - Frontend tests: `npm test` (vitest) → journal-analytics + journal-date-utils + format-strava-activity + existing all green.
   - Backend: `cd api && npx tsc --noEmit && npm test` → strava specs (incl. new DTO + service where-clause) green.
6. **Manual smoke (dev):** `npm run dev` → click desktop "Nhật ký chạy" + mobile "Nhật ký" + dashboard "Xem tất cả" → all land on `/journal`; tab highlights; row click → `/activities/:id`; back works.
7. Delegate to `code-reviewer` after gate passes (per primary-workflow).

## Todo
- [ ] `/journal` lazy route in `app.tsx`
- [ ] desktop nav → `/journal`
- [ ] mobile tab → `/journal`
- [ ] dashboard "Xem tất cả" → `Link /journal`
- [ ] `tsc --noEmit` (fe) clean
- [ ] `npm run build` clean
- [ ] `npm test` (fe) green
- [ ] `cd api && npx tsc --noEmit && npm test` green
- [ ] manual nav smoke

## Success criteria
- No `to:'#'`/`href="#"` remains for journal entry points.
- Both navs highlight active tab on `/journal`.
- All 4 verification commands exit 0.
- Reviewer sign-off.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Missing Suspense → lazy import throws | Low | High | Wrap in `<Suspense>` with existing `routeSuspenseFallback` (copy detail-page pattern) |
| Route outside ProtectedRoute → unauth access | Low | Med | Place inside `ProtectedRoute` > `AppLayout` group (verified in step 1) |
| Build fails on recharts chunk | Low | Med | Same lazy pattern already proven for `ActivityDetailPage` |

## Security considerations
- `/journal` inside `ProtectedRoute` — unauth users redirected (same guard as `/dashboard`). Data still server-authorized by `JwtAuthGuard`. Nav changes are static string edits, no new surface.

## [RedTeam RT-5] Production deploy runbook (backend-first — MANDATORY)
`main.ts:28` sets `forbidNonWhitelisted: true` → the OLD backend **rejects** `since`/`until` (unknown) and `limit=365` (`@Max(100)`) with 400. If frontend ships first, `/journal` is fully broken for the deploy window.
1. **Deploy backend first** (params are backward-compatible — dashboard's `limit≤20` calls unaffected). Wait for API container healthy.
2. **Prod smoke the deployed API** BEFORE cutting over frontend: authenticated `GET /api/strava/activities?limit=365&since=<6mo ago>&until=<now>&excludeDuplicates=true` → expect **200** (not 400). Confirms new DTO is live.
3. **Then deploy frontend** (`/journal` route + nav). Single Docker compose rebuild deploys both images; ensure API is up/healthy before frontend serves the new bundle (compose `depends_on` + healthcheck, or deploy api image, verify, then app image).
4. **Post-deploy smoke:** load `/journal` on prod (mobile + desktop), click "Tải thêm", row → detail, verify weekly totals sane.

## Rollback
- **Frontend broken, backend fine:** revert the 4 frontend edits (route + 3 nav/link) → restores `#` placeholders. Backend `since`/`until`/`@Max(365)`/`@Throttle` changes are safe to LEAVE in place (backward-compatible, no consumer). Correction to earlier note: the DTO `@Max(365)` change is live regardless of the route, but harmless.
- **Backend broken:** revert `api/src/strava/**` Phase 01 edits + redeploy api image; frontend `/journal` then 400s → also revert frontend route (feature fully rolled back).

## Next steps
- Docs impact: minor — note `/journal` in `docs/system-architecture.md` + changelog (delegate `docs-manager`).
</content>
