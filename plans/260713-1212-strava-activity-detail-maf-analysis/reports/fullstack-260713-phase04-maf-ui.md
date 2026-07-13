# Phase 04 — MAF UI Components, Degradation States, Dashboard Links

## Executed Phase
- Phase: phase-04-maf-ui-components-degradation
- Plan: D:\Data\Projects\app.maf.run\plans\260713-1212-strava-activity-detail-maf-analysis
- Status: completed

## Files Modified
### Created (`src/components/activity-detail/`)
- `activity-detail-sections.tsx` (87 LOC) — section-tree composition + degradation branching, inline `AerobicEfficiencyTile`
- `maf-verdict-card.tsx` (61 LOC) — verdict badge, below=neutral violet / in=emerald / above=maf-red warning
- `time-in-zone-bar.tsx` (47 LOC) — 3-segment stacked % bar + legend
- `hr-chart.tsx` (92 LOC) — recharts LineChart, MAF band ReferenceArea, avg-HR ReferenceLine, ≤1000-pt decimation
- `splits-table.tsx` (84 LOC) — per-km pace/HR table, MAF-over flag, collapse >10 rows
- `cardiac-drift-card.tsx` (51 LOC) — % + vi interpretation, "ước tính" label
- `degradation-notices.tsx` (92 LOC) — `HydrationNotice`, `NoHrNotice`, `ProfileNoticeCard`

### Modified
- `src/pages/activity-detail-page.tsx` (40 LOC) — renders `<ActivityDetailSections/>`, removed now-obsolete eslint-disable on `zone`
- `src/components/dashboard/activity-list-mobile.tsx` — each card wrapped in `<Link to="/activities/:id" className="block">`, inner div classes untouched, added hover affordance
- `src/components/dashboard/activity-table-desktop.tsx` — row `onClick={() => navigate(...)}` + `useNavigate`, kept existing `cursor-pointer`/`group-hover` styling
- `package.json` — added `recharts: ^3.9.2` to `dependencies`

## Tasks Completed
- [x] `npm install recharts@^3` — resolved 3.9.2, react-is@19.2.7 auto-installed as recharts' own dependency, no `--legacy-peer-deps`, no manual override needed
- [x] degradation-notices (hydration/no-hr/profile) vi copy + retry (rate_limited disabled, deleted hides retry)
- [x] maf-verdict-card (below=neutral/informational), time-in-zone-bar
- [x] hr-chart (recharts + MAF band + avg line), bundled in isolated lazy chunk
- [x] splits-table (pace + HR + MAF flag, collapsible >10 rows)
- [x] cardiac-drift-card ("ước tính"), aerobic-efficiency inline tile (in sections.tsx, no dedicated file)
- [x] stats grid already used `detail.calories` (kcal) from phase-02 — verified untouched/correct, no summary kJ leak
- [x] activity-detail-sections.tsx composition wired into thin page (40 LOC)
- [x] dashboard mobile card + desktop row → navigate to `/activities/:id`
- [x] lint + build + vitest green (root `tsc --noEmit` intentionally not used as gate per instructions — noisy/pre-existing)
- [x] plain-text description rendering added (no `dangerouslySetInnerHTML`) — Strava-sourced free text, whitespace-pre-wrap

## Tests Status
- Lint: pass (4 pre-existing errors / warnings in unrelated files — `maf-lab.tsx`, `strava-connect-card.tsx`, `admin-users-page.tsx`, `sso-callback-page.tsx`, test files — none touch phase-04 files)
- Build (vite): pass — `dist/assets/activity-detail-page-*.js` = 384.74 kB (113.26 kB gzip), confirms recharts isolated to the lazy chunk, main `index-*.js` unaffected
- Unit tests (vitest): 8 files / 231 tests, all pass (no regressions)

## Recharts Verification
- `npm ls recharts react-is` → clean tree, `recharts@3.9.2 -> react-is@19.2.7` (matches React 19, no peer conflicts)
- Built chunk contains `LineChart`/`ReferenceArea` symbols — confirms recharts code is actually bundled, not silently dropped
- Code-level render-safety check: `ResponsiveContainer` sits inside a fixed `h-64 w-full` div (non-zero width/height ancestor — the #1 real cause of "builds but blank"), `isAnimationActive={false}` avoids animation-timing edge cases, decimation caps points at 1000
- Could NOT do a live authenticated-browser screenshot check: `/activities/:id` sits behind `ProtectedRoute` (SSO login redirect), and no Playwright/Puppeteer is installed in this repo — installing a new heavy browser-automation dep for a one-off smoke check was out of scope (YAGNI) and the phase file's own "Next Steps" / Risk Assessment explicitly defer the manual authenticated-browser render check to phase-05
- Recommend phase-05 do the actual visual/E2E confirmation with a real logged-in session + hydrated activity data (per plan)

## Issues Encountered
None blocking. One scope judgment call: phase file didn't specify exactly where Strava `description` text renders (only forbade `dangerouslySetInnerHTML` in Security Considerations). Added a small plain-text description card in `activity-detail-sections.tsx`, shown whenever `hydrated && detail?.description` (independent of MAF-zone gating, since it's general Strava content, not MAF analysis).

## Next Steps
- Phase-05: full local stack verification incl. live browser check that `HrChart` actually paints the SVG line/area/reference-line (not blank) using a real authenticated session + real/seeded activity data across all 4 degradation tiers (full data / no-HR / hydrated:false / no-profile).

## Unresolved Questions
- None blocking. Confirm with reviewer whether the inline description card's placement/visibility (shown independent of `mafHr>0`) matches intent, since phase file didn't explicitly specify a slot for it.

**Status:** DONE
**Summary:** All phase-04 components implemented (verdict/time-in-zone/HR-chart/splits/drift/degradation notices/dashboard links), recharts@3.9.2 installed cleanly (no legacy-peer-deps, no override needed), lint/build/231 tests all green, recharts bundle confirmed isolated + code-reviewed for blank-render pitfalls (live authenticated browser screenshot deferred to phase-05 per plan).
**Concerns/Blockers:** None. Live-browser chart render confirmation deferred to phase-05 (auth-gated route, no browser automation tooling in repo — matches plan's own phasing).
