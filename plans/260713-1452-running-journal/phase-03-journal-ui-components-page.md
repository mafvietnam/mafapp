# Phase 03 — Journal UI components + page

## Context links
- Brainstorm: `plans/reports/brainstorm-260713-1452-running-journal.md` (Frontend, Edge cases)
- Depends on **Phase 01** (`since`/`until` API) + **Phase 02** (analytics/date utils).
- Patterns to mirror: `src/pages/activity-detail-page.tsx` (single responsive layout, mafHr from profile), `src/hooks/use-strava-activities.ts` (cancel-flag fetch), `src/components/dashboard/activity-section.tsx` (Empty/Loading/Error states), `src/components/activity-detail/hr-chart.tsx` (recharts + dark theme).
- Reuse: formatters (`format-strava-activity.ts`), `verdict` (`maf-activity-analysis.ts`), `use-user-profile` + `use-maf-calculator` for `mafHr`.

## Overview
- **Priority:** P1
- **Status:** pending
- Frontend fetch hook (6-mo windows + load-more) + presentational journal components + the `/journal` page. Extend the API client with `since`/`until`.

## Key insights
- `mafHr = calculateRawMaf(userProfile) ?? 0` (same as dashboard/detail). `<=0` → no MAF configured → banner, hide chart + verdict badges (rows still list km/pace/HR).
- No-connection state reuses dashboard heuristic: not loading, not error, zero activities → EmptyState + CTA. No extra `/strava/status` call (KISS; dashboard does the same).
- Gate the "no MAF" banner on `profileLoading` to avoid a flash before profile loads.
- Journal presents weekly-grouped **card rows** for both breakpoints (single responsive layout like detail page) — see plan.md open question.

## Requirements
**Functional**
- `getStravaActivities(page, limit, type?, excludeDuplicates?, since?, until?)` — append 2 optional params.
- `useJournalActivities()` → `{ activities, loading, loadingMore, error, loadMoreError, loadMore, hasMore }`.
  - **[RedTeam] Hardened contract** (mirrors cancel-flag from `use-strava-activities.ts`, but adds pagination that ref hook lacks):
  - `nowRef = useRef(new Date())` captured ONCE at mount — every `windowRange(nowRef.current, i)` uses the SAME instant → windows tile exactly (no drift/overlap). [RT-3]
  - `loadingRef = useRef(false)` — **synchronous** re-entrancy lock; `loadMore` first line `if (loadingRef.current || !hasMore) return; loadingRef.current = true;`; reset in `finally`. Guards double-click that state-based guard misses. [RT-1]
  - `seenIds = useRef(new Set())` — seed from window-0 rows on initial load; `seenIds.current.add(id)` for EVERY appended row; append via functional `setActivities(prev => [...prev, ...fresh])`. [RT-3]
  - Empty/short window ≠ end of history: on a 0-row window, **keep advancing** to the next older window (not stop) until a non-empty window OR the 4-window (2yr) cap. Only the cap terminates `hasMore`. [RT-4]
  - `loadMore` failure = **non-clobbering**: `getStravaActivities` null → set `loadMoreError=true` (inline retry affordance), **preserve** loaded weeks, and do NOT set `hasMore=false` (transient failure ≠ no more data). Distinguish null(fail) from `data.length===0`(real empty). [RT-2]
  - Initial-load failure still → `error=true` (full-page error is acceptable only when nothing is loaded yet).
  - If any window returns exactly `limit` (365) rows → `console.warn` (runs-only DB makes this near-impossible; safety net, no within-window pagination — YAGNI). [RT downgrade]
- Components: stats header, trend chart, week group, activity row + shared states.

**Non-functional**
- Each file < 200 LOC. Lazy-loadable page (recharts in shared chunk).

## Architecture
```
JournalPage
 ├─ useUserProfile → profileLoading, userProfile ─┐
 ├─ useMafCalculator → calculateRawMaf ───────────┴─▶ mafHr
 ├─ useJournalActivities → activities, loading, loadingMore, error, loadMore, hasMore
 ├─ groupByWeek(activities, mafHr) ─▶ WeekGroup[]
 ├─ monthlySummary(activities, mafHr) ─▶ header data
 └─ mafTrendSeries(activities, mafHr) ─▶ chart points
render:
  profileLoading → skeleton
  no activities (not loading/error) → <JournalEmptyState/> (CTA /profile)
  mafHr<=0 → <NoMafBanner/> + hide chart + hide verdict badges
  else → <JournalStatsHeader/> <MafTrendChart/> <WeekGroup/>×n + "Tải thêm"(hasMore)
row click → navigate(`/activities/${id}`)
```

## Related code files
**Modify**
- `src/services/strava-service.ts` — extend `getStravaActivities` signature + query params.

**Create**
- `src/hooks/use-journal-activities.ts`
- `src/components/journal/journal-stats-header.tsx`
- `src/components/journal/maf-trend-chart.tsx`
- `src/components/journal/week-group.tsx`
- `src/components/journal/journal-activity-row.tsx`
- `src/components/journal/journal-states.tsx` (Loading/Empty/Error/NoMafBanner)
- `src/pages/journal-page.tsx`

**Delete:** none.
**Ownership note:** Phase 03 touches only these `src/` files. `src/app.tsx`, nav, and `activity-section.tsx` belong to Phase 04.

## Implementation steps
1. **API client** (`strava-service.ts`): add `since?: string, until?: string` params to `getStravaActivities`; `if (since) params.set('since', since); if (until) params.set('until', until);`. Existing callers unaffected (positional optional).
2. **Hook** (`use-journal-activities.ts`):
   - State: `activities`, `loading`, `loadingMore`, `error`, `hasMore`; ref `windowIndex` + `seenIds` Set.
   - `fetchWindow(index)`: `const {since,until} = windowRange(new Date(), index); return getStravaActivities(1, 365, undefined, true, since, until);`
   - Initial `useEffect` (cancel-flag pattern from `use-strava-activities.ts`): load index 0; on null → `error=true`; set `hasMore` per rule.
   - `loadMore()`: guard `!loadingMore && hasMore`; increment index; append rows whose `id` not in `seenIds`; update `hasMore` (`rows.length===0 || nextIndex+1 >= 4 → false`).
3. **journal-states.tsx**: export `JournalLoading` (spinner, reuse detail skeleton style), `JournalEmptyState` (**[RedTeam RT-4] neutral copy** — shown only after all windows exhausted; "Chưa có buổi chạy nào trong nhật ký. Kết nối Strava hoặc đồng bộ để bắt đầu." + `Link to="/profile"` — must NOT assert "not connected" since a connected user could simply have no runs in range), `JournalError` (retry → `window.location.reload()`), `LoadMoreError` (**[RT-2] inline, non-clobbering** — small red text + "Thử lại" button that re-calls `loadMore`, rendered beside the button; never replaces the loaded list), `NoMafBanner` (amber note: "Cập nhật hồ sơ để xem phân tích MAF" + `Link to="/profile"`).
4. **journal-activity-row.tsx**: props `{ activity, mafHr, showVerdict }`. Render name, `formatActivityDate`, `formatDistanceKm`, `formatPace`, avgHR (`bpm` or `—`). If `showVerdict && avgHeartRate!=null`: `verdict(avgHeartRate,{lower:mafHr-10,upper:mafHr})` → badge: `in`=emerald "Đúng vùng", `above`=maf-red "Vượt", `below`=slate "Dưới". No HR → `—`, no badge. Whole card `onClick`/Link → `/activities/${activity.id}` (glass-card hover, mirror mobile list).
5. **week-group.tsx**: props `{ group: WeekGroup, mafHr, showVerdict }`. Header row: `group.label`, `formatDistanceKm(totalKm*1000)` (or format km directly), `sessionCount` buổi, `%MAF` (`inZonePct==null?'—':inZonePct+'%'`). Body: map `group.activities` → `<JournalActivityRow/>`.
6. **journal-stats-header.tsx**: props `{ summary, monthLabel, showMaf }`. Three stat tiles (km, buổi, %MAF) in glass/desktop-card; `%MAF` hidden or `—` when `!showMaf`.
7. **maf-trend-chart.tsx**: props `{ points }`. **[RedTeam] per-series gates, not just point count:**
   - `pacePts = points.filter(p => p.paceAtMaf != null).length`; `effPts = points.filter(p => p.efficiency != null).length`.
   - If `pacePts < 3 && effPts < 3` → empty message card ("Cần ≥3 tuần dữ liệu để vẽ xu hướng"). [RT-11: avoids degenerate all-null pace axis]
   - Else recharts `ResponsiveContainer > LineChart` (mirror `hr-chart.tsx`): X = `label`; render the pace axis+line ONLY when `pacePts >= 3`, the efficiency axis+line ONLY when `effPts >= 3`.
   - **Each `<Line>` MUST carry its `yAxisId`** (recharts v3 defaults to id `0`; unmatched → mis-scaled/warning). [RT-10]
     - `<YAxis yAxisId="pace" reversed …/>` + `<Line yAxisId="pace" dataKey="paceAtMaf" connectNulls/>` (reversed → faster/up = better).
     - `<YAxis yAxisId="eff" orientation="right" …/>` + `<Line yAxisId="eff" dataKey="efficiency" connectNulls/>`.
   - `Tooltip`/`Legend`; `isAnimationActive={false}`; format pace tick `m:ss`.
8. **journal-page.tsx** (thin router, mirror `activity-detail-page.tsx`): compute `mafHr`; call hook + `groupByWeek`/`monthlySummary`/`mafTrendSeries` (memoize with `useMemo` on `[activities,mafHr]`); branch to states; `max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8`; title "Nhật ký chạy"; render header + chart (if `mafHr>0`) + week groups + "Tải thêm" button (spinner when `loadingMore`, hidden when `!hasMore`).
9. **Verify:** `npx tsc --noEmit && npm run build` (route added in Phase 04; page compiles standalone via direct import check).

## Todo
- [ ] `getStravaActivities` gains `since`/`until`
- [ ] `use-journal-activities` (windows + loadMore + hasMore + dedupe)
- [ ] `journal-states` (Loading/Empty/Error/NoMafBanner)
- [ ] `journal-activity-row` (+ 3-state badge, no-HR `—`)
- [ ] `week-group` (header stats + rows)
- [ ] `journal-stats-header` (km/buổi/%MAF)
- [ ] `maf-trend-chart` (recharts, <3-point empty state)
- [ ] `journal-page` composition + memoized analytics
- [ ] all files < 200 LOC; `tsc` + `build` clean

## Success criteria
- Page renders weekly groups with correct headers; rows navigate to detail.
- `mafHr<=0` → banner shown, chart + badges hidden, rows still list data.
- Zero activities → EmptyState + CTA.
- "Tải thêm" appends older window; disappears at 0-row window or 4-window cap.
- Trend chart shows empty message below 3 points.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Analytics recompute every render | Med | Low | `useMemo` on `[activities, mafHr]` |
| Dual-axis chart cramped on mobile | Med | Med | Fixed `h-64`, `reversed` pace axis, legend; acceptable — same container as `hr-chart` |
| Duplicate rows across windows | Low | Med | `seenIds` Set dedupe on append (windows already non-overlapping) |
| Empty-but-connected vs no-connection conflated | Med | Low | Shared CTA covers both (matches dashboard); status call deferred (YAGNI) |
| File > 200 LOC (page) | Med | Low | States + chart + row extracted to own files; page stays thin |

## Security considerations
- All data via `getStravaActivities` under `JwtAuthGuard`; hook sends no userId (server-derived). `since`/`until` client-supplied but only narrow caller's own rows (Phase 01). No secrets in client.

## Next steps
- Unblocks **Phase 04** (route + nav wiring + full build/test gate).
</content>
