# Phase 2 — Frontend: Dashboard Real Data + Slot-Full UX + Callback Error Translation

## Context Links

- Plan: [plan.md](plan.md) · depends on Phase 1 API contract
- Files: `src/components/dashboard/activity-section.tsx`, `src/components/strava-connect-card.tsx`, `src/services/strava-service.ts`, `src/pages/dashboard-page.tsx`

## Overview

- **Priority:** P1 · **Status:** pending · **Effort:** 0.5d
- Replace hardcoded `SAMPLE_ACTIVITIES` on the dashboard with real `GET /strava/activities` data (loading/empty/error states, existing visual design kept). Add proactive "hết slot" state + 409 handling to the Strava card. Translate `?strava_error=full|invalid` to Vietnamese.

## Key Insights

- `api-client.ts` returns the raw `Response`; only 401 auto-retries → a **409 is returned as-is**, so `connectStrava()` can branch on `res.status === 409`.
- `use-strava-auto-fill.ts` already maps `StravaActivity` for MAF Lab — reuse its shape, but keep a **separate display formatter** for the dashboard (different output: relative date, pace, HR-zone color). Minor duplication < premature coupling.
- Error translation lives in **`strava-connect-card.tsx`** (rendered on the profile page), not `profile-page.tsx` — the card already `consumeQueryParam('strava_error')`. Extend its existing map.
- > 🔴 **RED TEAM #M15 (Medium):** `dashboard-page.tsx` mounts `<ActivitySection>` in BOTH the `lg:hidden` and `hidden lg:block` blocks — both are always mounted (CSS only hides one). If `ActivitySection` fetches in its own `useEffect`, that's a **double fetch** on every dashboard load. Fix: hoist the fetch into a single `use-strava-activities.ts` hook called ONCE in `dashboard-page.tsx`; pass results down as props → `ActivitySection` becomes presentational (renders both internal layouts from props, zero fetch).
- 🔴 **RED TEAM #M14:** Phase 1 `/strava/status` returns only `connectionLimitReached` (boolean, no numeric). `StravaStatus` must NOT add `slotsAvailable`.
- MAF-zone warn needs `mafHr`; `dashboard-page.tsx` already computes it → pass as prop. If `mafHr <= 0`, warn = false.

## Requirements

**Functional**
- Dashboard shows the user's real synced activities (default `excludeDuplicates=true`, latest first, ~10 rows), fetched **once**, with loading spinner, empty state (CTA "Kết nối Strava" → `/profile`), and error state.
- Not-connected + `connectionLimitReached` → Connect button disabled + inline "hết slot" text.
- `connectStrava()` 409 → surface "hết slot" message on the card.
- `?strava_error=full` → "Đã đạt giới hạn người dùng Strava (hết slot)…"; `?strava_error=invalid` → "Liên kết không hợp lệ hoặc đã hết hạn."; keep `denied` + generic.

**Non-functional**
- Keep the current glass-card/table visual design. All files < 200 LOC. No new deps. `npx tsc --noEmit` + `npm run lint` + `npm run build` clean.

## Related Code Files

**Modify**
- `src/services/strava-service.ts` — add `connectionLimitReached: boolean` to `StravaStatus` (NO `slotsAvailable`, 🔴 M14); change `connectStrava()` return to a result object.
- `src/components/strava-connect-card.tsx` — slot-full disable, 409 handling, `full`/`invalid` error strings.
- `src/pages/dashboard-page.tsx` — call `useStravaActivities()` once; pass `{ activities, loading, error, mafHr }` to both `<ActivitySection>` instances.
- `src/components/dashboard/activity-section.tsx` — convert to a **presentational** component driven by props (no fetch).

**Create**
- `src/hooks/use-strava-activities.ts` — single fetch hook (🔴 M15): `{ activities, loading, error }`.
- `src/components/dashboard/activity-list-mobile.tsx` — mobile card list (presentational).
- `src/components/dashboard/activity-table-desktop.tsx` — desktop table (presentational).
- `src/utils/format-strava-activity.ts` — date (vi-VN "12 Thg 10"), distance km, pace (M:SS/km), HR-zone color + warn.

**Delete** — none (remove `SAMPLE_ACTIVITIES` const only).

## Implementation Steps

1. **Service types + connect result** (`strava-service.ts`):
   - Extend `StravaStatus` with `connectionLimitReached: boolean;` **only** (🔴 M14 — no numeric `slotsAvailable`).
   - Change signature to `connectStrava(): Promise<{ ok: boolean; error?: 'full' | 'unknown' }>`:
     ```ts
     const res = await api.get('/strava/connect');
     if (res.status === 409) return { ok: false, error: 'full' };
     if (!res.ok) return { ok: false, error: 'unknown' };
     const { authUrl } = (await res.json()) as { authUrl: string };
     if (authUrl) window.location.href = authUrl;
     return { ok: true };
     ```
     Wrap in try/catch → `{ ok: false, error: 'unknown' }`.
2. **Fetch hook** (`use-strava-activities.ts`, 🔴 M15): `useEffect` calls `getStravaActivities(1, 10, undefined, true)` ONCE; returns `{ activities: StravaActivity[]; loading: boolean; error: boolean }`. Never throws (null response → `error=true`). Guard against setState-after-unmount.
3. **Format util** (`format-strava-activity.ts`): pure functions, no React.
   - `formatActivityDate(iso)` → `new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'short' })`.
   - `formatDistanceKm(meters)` → `(meters/1000).toFixed(2) + ' km'`.
   - `formatPace(a: StravaActivity)` → prefer `a.avgPace` (sec/km); else `movingTime / (distance/1000)`; guard divide-by-zero; format `M:SS /km`; `'—'` if unknown.
   - `hrZone(avgHr, mafHr)` → `{ label: '<n> bpm' | '—', colorClass, warn }`: `warn = mafHr>0 && avgHr!=null && avgHr>mafHr`; color red if warn, emerald if within zone, violet default.
4. **Presentational `ActivitySection`** (`activity-section.tsx`): `props { activities: StravaActivity[]; loading: boolean; error: boolean; mafHr: number }` — **no fetch** (🔴 M15).
   - loading → existing spinner style.
   - error → small inline "Không tải được hoạt động." with a retry link (reloads dashboard).
   - empty (`activities.length === 0`) → empty state: icon + "Chưa có hoạt động — kết nối Strava để đồng bộ." + link button to `/profile` (label "Kết nối Strava").
   - data → render `<ActivityListMobile activities mafHr/>` (lg:hidden) + `<ActivityTableDesktop activities mafHr/>` (hidden lg:block). Keep existing wrapper classes/headers ("Lịch Sử Hoạt Động", "Xem tất cả").
5. **Presentational split**: move the mobile card markup into `activity-list-mobile.tsx` and the desktop `<table>` into `activity-table-desktop.tsx`, both `map`ing real activities through the format util. Preserve icon logic (Footprints/Flame/AlertTriangle, source icon). Strava rows use `LinkIcon`.
6. **Dashboard wiring** (`dashboard-page.tsx`, 🔴 M15): call `const { activities, loading, error } = useStravaActivities();` ONCE at the top; pass `activities`/`loading`/`error`/`mafHr` to `<ActivitySection>` in both the mobile (line ~58) and desktop (line ~90) blocks. Both instances share the single fetch — no duplicate request.
7. **Card slot-full + errors** (`strava-connect-card.tsx`):
   - In the `strava_error` block add: `else if (errParam === 'full') setError('Đã đạt giới hạn người dùng Strava (hết slot). Vui lòng thử lại sau.');` and `else if (errParam === 'invalid') setError('Liên kết không hợp lệ hoặc đã hết hạn.');` (keep `denied` + trailing generic).
   - `handleConnect`: `const r = await connectStrava(); if (!r.ok) setError(r.error === 'full' ? '…hết slot…' : 'Không thể kết nối Strava. Vui lòng thử lại.');`
   - In the not-connected branch: derive `const capReached = status?.connectionLimitReached === true;`. Disable Connect button when `busy || capReached`; when `capReached` show label "Hết slot Strava" + a helper line "Ứng dụng đã đủ người dùng Strava. Vui lòng quay lại sau."
8. **Gates:** `npx tsc --noEmit && npm run lint && npm run build`. Add a vitest for `format-strava-activity.ts` (pace/distance/date/hr-zone edge cases: zero distance, null HR, mafHr=0).

## Todo List

- [ ] `StravaStatus` adds `connectionLimitReached` boolean only (🔴 M14); `connectStrava()` returns `{ok,error}` (409 → 'full')
- [ ] `use-strava-activities.ts` single-fetch hook (🔴 M15)
- [ ] `format-strava-activity.ts` util + vitest
- [ ] `activity-section.tsx` presentational (props-driven, no fetch)
- [ ] `activity-list-mobile.tsx` + `activity-table-desktop.tsx` presentational split
- [ ] `dashboard-page.tsx` calls hook once + passes props to both layouts
- [ ] Card: cap-reached disable + 409 message + `full`/`invalid` translations
- [ ] `tsc --noEmit` + `lint` + `build` clean; format util test green

## Success Criteria

- Connected user with synced runs sees them on the dashboard (mobile cards + desktop table) with correct pace/distance/date and MAF-zone HR coloring — fetched exactly **once** (verify one `/strava/activities` request in Network tab).
- No activities → empty state with a working "Kết nối Strava" link; API error → error state (no crash, no fake data).
- Cap reached → Connect button disabled with "Hết slot Strava"; a 409 mid-click shows the VN message.
- `?strava_error=full|invalid|denied` each render the correct Vietnamese line.
- All files touched stay < 200 LOC; build/lint/type-check pass.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Double fetch from twin mounts — 🔴 M15 | High×Med | Hoist fetch into `use-strava-activities.ts`, called once (step 2/6) |
| `activity-section.tsx` balloons > 200 LOC | High×Low | Split into presentational + 2 layout children + util |
| `avgPace` unit ambiguity (sec/km vs min/km) | Med×Med | Prefer explicit compute from `movingTime`/`distance`; unit test |
| Dashboard renders before Strava enabled (VITE flag off) | Med×Low | Empty/error states are safe no-ops; card hidden via existing `featureEnabled` gate |
| `mafHr` unavailable (incomplete profile) | Med×Low | `warn=false`, neutral color when `mafHr<=0` |

## Security Considerations

- No tokens/secrets touched client-side; activities are already-scoped per-user by the API.
- 409 path shows a generic message — no slot counts leaked to the user (aligns with 🔴 M14 boolean-only status).
- Empty-state link uses in-app `/profile` route (no external redirect).

## Next Steps

- After merge, Phase 3 ships this with `VITE_FEATURE_STRAVA=true` (build arg) so the dashboard + card activate on prod.
</content>
