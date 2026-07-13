# Phase 04 — MAF UI Components, Degradation States, Dashboard Links

## Context Links
- Depends on phase-02 (page skeleton, types, hook) + phase-03 (`maf-activity-analysis.ts`).
- Existing: `src/components/dashboard/activity-list-mobile.tsx` + `activity-table-desktop.tsx` (click targets), `src/utils/format-strava-activity.ts` (`hrZone`, `formatPace`), `src/components/strava-logo.tsx`.
- recharts: NEW frontend dependency (only chart lib in repo). **Pin `recharts@^3`** — v3 has genuine React 19 support (`react-is` bundled). Do NOT rely on `--legacy-peer-deps` on a v2 line: it silences the peer error but leaves a `react-is` runtime mismatch → chart builds green but renders BLANK, only caught in prod E2E (Assumption/Scope red-team).

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Build the MAF-first analysis sections, wire them into the phase-02 page, implement graceful degradation (no-HR-stream, hydrated:false + retry), add recharts, and turn dashboard activity rows/cards into `<Link>`s to `/activities/:id`.

## Key Insights
- MAF zone reaches components as `zone={lower:mafHr-10, upper:mafHr}` from the page (phase-02). If `mafHr<=0` (no profile), hide ALL MAF sections, show a "complete your profile" notice; still show stats grid.
- **Degradation tiers:** (1) `hydrated:false` → stats grid + reason notice + retry button (`refetch`), **except `rate_limited` → retry disabled with a cooldown hint** ("thử lại sau ~15 phút") so users don't hammer the shared Strava quota. (2) `hydrated:true` but `streams===null` (manual/no-HR) → hide time-in-zone + HR chart + drift; keep verdict-from-avgHR (if avg present), splits, stats. (3) full data → all sections.
- recharts `ReferenceArea y1={lower} y2={upper}` draws the MAF band behind the HR `Line`. X axis = elapsed minutes (`time[i]/60`). Downsampled ≤1000 pts → smooth + performant.
- Splits: `average_heartrate` present per split → flag `> zone.upper` red (over MAF). Reuse `hrZone`-style coloring.
- **Calories:** stats grid must show `detail.calories` (real kcal from detail endpoint) when hydrated; the summary `activity.calories` is kilojoules (mislabeled) — do NOT show it as "Calo". Fall back to hiding the tile if neither present.
- **`laps` cut for v1** (red-team scope): Strava auto-laps ≈ `splits_metric`; no `LapsSection`, no `laps` in whitelist.
- Keep EACH component <200 LOC; split if a section grows. Vietnamese copy throughout.

## Requirements
### Functional
- MAF verdict card: `verdict(activity.avgHeartRate, zone)` → status badge (Dưới/Trong/Trên vùng MAF) + delta bpm + color (below=violet, in=emerald, above=maf-red).
- Time-in-zone bar: `timeInZone(streams.heartrate, streams.time, zone)` → stacked % bar (below emerald-ish / in emerald / above red) with legend + seconds.
- HR chart: recharts LineChart of heartrate vs elapsed-min + MAF band ReferenceArea + avg HR reference line.
- Splits table: per-km rows (pace from `average_speed`, avg HR, MAF flag). Collapsible if many.
- Cardiac drift card: `cardiacDrift(...)` → % + interpretation text (<5% good aerobic coupling; >5% drift). Label **"ước tính"** (approximate — see phase-03 moving-filter caveat).
- Aerobic efficiency: `aerobicEfficiency(avgSpeed, avgHr)` stat tile.
- Dashboard mobile card + desktop row → navigate to `/activities/:id`.
### Non-functional
- `recharts@^3` added to `package.json` (FE only). Lazy page already isolates its bundle (phase-02). Dark theme tokens. <200 LOC/file.

## Architecture / Data flow
```
activity-detail-page (phase-02 slots filled) — keep page a THIN router over sections;
  extract the section tree into <ActivityDetailSections/> so the page stays <200 LOC (red-team scope F7):
  mafHr>0 ? render MAF sections : <ProfileNoticeCard/>
  !hydrated → <HydrationNotice reason onRetry={refetch}/> + stats only   (retry disabled when reason==='rate_limited')
  hydrated:
    <MafVerdictCard avgHr zone/>
    streams ? <TimeInZoneBar/> <HrChart streams zone avgHr/> : <NoHrNotice/>
    detail?.splitsMetric.length ? <SplitsTable splits zone/>
    (streams && streams.velocitySmooth) ? <CardiacDriftCard .../> : hidden
    <AerobicEfficiencyStat/> (from summary avgSpeed/avgHr)
```

## Related Code Files
### Create (`src/components/activity-detail/`)
- `activity-detail-sections.tsx` — composition of the section tree + degradation branching (keeps page thin)
- `maf-verdict-card.tsx`
- `time-in-zone-bar.tsx`
- `hr-chart.tsx` (recharts; keep <200 LOC — extract tooltip if needed)
- `splits-table.tsx`
- `cardiac-drift-card.tsx`
- `degradation-notices.tsx` (`HydrationNotice` + retry, `NoHrNotice`, `ProfileNoticeCard`)
- (aerobic-efficiency tile: inline in stats-grid/sections — do NOT create a separate file for a trivial tile, red-team scope F4. `laps-section` cut.)
### Modify
- `src/pages/activity-detail-page.tsx` — render `<ActivityDetailSections/>`, keep thin
- `src/components/dashboard/activity-list-mobile.tsx` — wrap each card in `<Link to={`/activities/${a.id}`}>`
- `src/components/dashboard/activity-table-desktop.tsx` — wrap row (or name cell) in navigation to `/activities/${a.id}`
- `package.json` — add `recharts`
### Delete
- none

## Implementation Steps
1. **Install recharts v3** (root, FE only):
   ```bash
   npm install recharts@^3
   ```
   v3 supports React 19 natively — a clean install should NOT need `--legacy-peer-deps`. If it still errors, add a `react-is` override matching React 19 rather than blanket `--legacy-peer-deps`. **Must verify the chart actually RENDERS** (phase-05 manual smoke) — `tsc`/`build` passing does not prove render.
2. **Degradation notices** `degradation-notices.tsx`:
   - `HydrationNotice({reason, onRetry})` → maps reason → vi copy (`deleted`→"Hoạt động đã bị xoá trên Strava", `unauthorized`→"Kết nối Strava cần được cấp lại quyền", `rate_limited`→"Strava đang giới hạn truy cập, thử lại sau ~15 phút", `error`→"Không tải được chi tiết"). Retry button hidden for `deleted`, **disabled for `rate_limited`** (cooldown — don't re-fire the shared quota).
   - `NoHrNotice()` → "Hoạt động này không có dữ liệu nhịp tim — các phân tích MAF theo nhịp tim bị ẩn."
   - `ProfileNoticeCard()` → "Hoàn tất hồ sơ (tuổi) để xem phân tích vùng MAF." link `/plan`.
3. **MAF verdict card** — call `verdict`; badge + delta; Powered-by not needed here (header has it).
4. **Time-in-zone bar** — call `timeInZone`; 3-segment flex bar widths = pct; legend with secs (`formatDuration`).
5. **HR chart** `hr-chart.tsx` — recharts `<ResponsiveContainer>` `<LineChart data={points}>` where `points=streams.time.map((t,i)=>({min:+(t/60).toFixed(2), hr:streams.heartrate[i]}))`. Add `<ReferenceArea y1={zone.lower} y2={zone.upper} fill maf-emerald opacity/>`, `<ReferenceLine y={avgHr}/>`, dark axes (`stroke` white/opacity), `<Tooltip/>`. Guard: render only when `streams.heartrate?.length`.
6. **Splits table** — rows from `splitsMetric`; pace = derive from `average_speed` (m/s → min/km = `1000/average_speed/60`); HR cell colored via zone; MAF flag icon when `average_heartrate > zone.upper`. Reuse existing lucide icons (Flame/AlertTriangle).
7. **Cardiac drift card** — call `cardiacDrift(streams.velocitySmooth, streams.heartrate, streams.time)`; show % + vi interpretation + "ước tính" label. Hide when null.
8. **Aerobic efficiency stat** — `aerobicEfficiency(activity.avgSpeed, activity.avgHeartRate)`; tile "m/nhịp" (inline in sections/stats-grid, no separate file).
9. **Stats grid calories** — show `detail.calories` (kcal) when hydrated; never render summary `activity.calories` (kJ) as "Calo".
10. **Wire page** — page renders `<ActivityDetailSections .../>`; sections gate MAF on `mafHr>0`; stats grid + header always shown. Keep page file <200 LOC.
11. **Dashboard Links** — `activity-list-mobile.tsx`: wrap each card `<Link to={`/activities/${a.id}`} className="block">` (preserve styling; add `hover` affordance). `activity-table-desktop.tsx`: make row navigate — wrap the name cell content in `<Link>` or use `useNavigate` on row `onClick` (keep the existing `cursor-pointer`/`group-hover:text-maf-red`). Do NOT change props/data flow.
12. **Verify**:
    ```bash
    npm run lint
    npx tsc --noEmit
    npm test          # existing dashboard util tests + phase-03 tests still green
    ```

## Todo List
- [ ] `npm install recharts@^3` (react-is override, NOT blanket --legacy-peer-deps)
- [ ] degradation-notices (hydration/no-hr/profile) with vi copy + retry (rate_limited retry disabled)
- [ ] maf-verdict-card (below = neutral/informational, not warning), time-in-zone-bar
- [ ] hr-chart (recharts + MAF band + avg line) — verify actual render
- [ ] splits-table (pace + HR + MAF flag)
- [ ] cardiac-drift-card ("ước tính"), aerobic-efficiency inline tile
- [ ] stats grid uses detail.calories (kcal), not summary kJ
- [ ] activity-detail-sections.tsx composition + wire into thin page
- [ ] dashboard mobile card + desktop row → Link to /activities/:id
- [ ] lint + tsc + vitest green

## Success Criteria
- Full-data activity: verdict + time-in-zone + HR chart w/ MAF band + splits + drift + efficiency + laps all render with real values.
- No-HR activity: HR sections hidden, NoHrNotice shown, stats+splits+laps still render.
- hydrated:false: reason notice + working retry (re-hydrates), stats grid intact.
- No profile: MAF sections hidden, ProfileNotice shown, stats grid intact.
- Clicking any dashboard activity (mobile + desktop) opens its detail page. No lint/tsc/test regressions.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| recharts React 19 blank-render (v2 + --legacy-peer-deps) | Med | High | Pin `recharts@^3` (native React 19); react-is override if needed; **verify actual render in phase-05**, not just build |
| recharts inflates main bundle | Low | Med | Page already React.lazy (phase-02) → separate chunk |
| activity-detail-page >200 LOC (8 sections + 3 tiers) | Med | Low | Extract `<ActivityDetailSections/>` up front; page = thin router |
| hr-chart file >200 LOC | Med | Low | Extract custom tooltip / axis config to sibling file |
| Split pace math wrong (m/s vs min/km) | Med | Med | Unit-check against `formatPace`; `average_speed` m/s → min/km = 1000/(v*60) |
| Desktop row Link breaks table semantics | Low | Low | Wrap cell content, not `<tr>`, in `<Link>` OR useNavigate onClick |
| avgHeartRate null on summary → verdict null | Med | Low | verdict returns null → hide card gracefully |

## Security Considerations
- External Strava links `rel="noopener noreferrer"`. No secrets client-side. No `dangerouslySetInnerHTML` for `description` (render as plain text — avoid XSS from Strava-sourced content).

## Next Steps
- Phase-05 verifies the whole stack locally before deploy.
</content>
