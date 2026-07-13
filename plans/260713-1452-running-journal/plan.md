---
title: "Nhật ký chạy (Running Journal) page at /journal"
description: "Full run history grouped by week + monthly stats header + long-term MAF trend chart, read-only from Strava sync."
status: complete
priority: P2
effort: 7-8h
branch: dev
tags: [frontend, backend, strava, maf, journal]
created: 2026-07-13
blockedBy: []
blocks: []
---

# Nhật ký chạy (Running Journal) — Implementation Plan

Full run history at route `/journal`: weekly-grouped list + current-month stats header + long-term MAF trend chart. Read-only from existing Strava sync. Nav links `#` → `/journal`. No new DB models, no new endpoints.

**Source of truth:** `plans/reports/brainstorm-260713-1452-running-journal.md` (approved). Design NOT re-litigated here.

## Phases (sequential 01 → 04, strict file ownership)

| # | Phase | Owns (files) | Status |
|---|-------|--------------|--------|
| 01 | [Backend date-range query](phase-01-backend-date-range-query.md) | `api/src/strava/**` only | done |
| 02 | [Journal analytics utils](phase-02-journal-analytics-utils.md) | `src/utils/journal-*`, `src/utils/format-strava-activity.ts` | done |
| 03 | [Journal UI components + page](phase-03-journal-ui-components-page.md) | `src/services/strava-service.ts`, `src/hooks/use-journal-activities.ts`, `src/components/journal/**`, `src/pages/journal-page.tsx` | done |
| 04 | [Routing + nav + tests](phase-04-routing-nav-integration-tests.md) | `src/app.tsx`, nav files, `src/components/dashboard/activity-section.tsx` | done |

**No file is touched by two phases** (verified in each phase's Related Code Files).

## Data flow (end-to-end)

```
JournalPage (mafHr from profile) → useJournalActivities (6-mo windows, since/until,
  excludeDuplicates, limit=365) → GET /strava/activities (JwtAuthGuard, userId-scoped,
  startDate gte/lt where) → StravaActivity[] → journal-analytics (groupByWeek /
  monthlySummary / mafTrendSeries, reuse verdict + aerobicEfficiency) →
  JournalStatsHeader + MafTrendChart + WeekGroup[] → JournalActivityRow → /activities/:id
```

## Key dependencies

- **01 → 03:** backend `since`/`until` params must ship before frontend client/hook use them.
- **02 → 03:** analytics + date-window utils consumed by hook, page, components.
- **03 → 04:** page must exist before routes/nav point at it; build/tsc/test gate is last.
- Reuse (DRY, no duplication): `verdict()`, `aerobicEfficiency()`, `MafZone` (`src/utils/maf-activity-analysis.ts`); formatters (`src/utils/format-strava-activity.ts`); `calculateRawMaf` (`use-maf-calculator.ts`) for `mafHr`.

## Cross-cutting constraints

- Every new code file < 200 LOC; kebab-case names.
- Frontend tests: vitest in `__tests__/`. Backend tests: jest `.spec.ts` colocated.
- Security: userId scoping already enforced by `JwtAuthGuard` + service `where.userId` — `since`/`until` only narrow within caller's own rows. No new attack surface.
- Backwards compatible: all new query params optional; no DB migration; `limit` Max relaxed 100→365 (superset). Dashboard's existing `getStravaActivities` call unaffected.

## Success criteria (measurable)

- `/journal` renders on mobile + desktop; both navs highlight active tab; no `#` placeholders remain.
- Weekly totals match hand-computed sums from the list.
- Trend chart renders with ≥3 points on real prod data (Tony account); empty message below 3.
- `npx tsc --noEmit`, `npm run build`, `npm test` (frontend) all clean; `cd api && npm test` green.

## Red Team Review

### Session — 2026-07-13
**Findings:** 19 raw → deduped; **12 accepted, 4 rejected, 3 downgraded/noted.**
**Severity:** 2 Critical, 7 High, rest Medium.

| # | Finding | Sev | Disposition | Applied |
|---|---------|-----|-------------|---------|
| 1 | loadMore double-click skips a window (state guard not re-entrant) | Crit | Accept | P03 hook: `loadingRef` sync lock |
| 2 | loadMore failure clobbers loaded weeks / silently ends pagination | Crit | Accept | P03 hook: separate `loadMoreError`, never `hasMore=false` on null |
| 3 | Unstable `new Date()` per call → window overlap; `seenIds` never populated | High | Accept | P03 hook: `nowRef` at mount; seed+add `seenIds`; functional setState |
| 4 | Empty window-0 → strands connected user w/ old history + shows "connect Strava" | High | Accept | P03 hook: auto-advance past empty windows to cap; neutral empty copy |
| 5 | Backend-first deploy mandatory (`forbidNonWhitelisted:true` → old API 400s on new params) | High | Accept | P04 deploy runbook + prod smoke |
| 6 | Monday-week TZ nondeterminism flips week tests on UTC CI | High | Accept | P02: pin `TZ=UTC` in vitest; group by viewer-local (all users VN) |
| 7 | No `@Throttle` on `/strava/activities` + limit 100→365 triples cost | High | Accept | P01: `@Throttle 30/min` **(done)** |
| 8 | Bulk HR (health) read, no `Cache-Control` on list | Med | Accept | P01: `private, no-store` **(done)** |
| 9 | Unbounded `page` offset (no `@Max`) | Med | Accept | P01: `@Max(100000)` on page **(done)** |
| 10 | Chart `<Line>` missing `yAxisId` → dual-axis mis-binds (recharts v3) | Med | Accept | P03 chart: explicit `yAxisId` per Line |
| 11 | Chart passes ≥3 gate with all-null pace → degenerate axis | Med | Accept | P03 chart: per-series render gate |
| 12 | Phase 01 already implemented, marked done | Med | Accept | Reconciled: P01 **done** (code+tests green) |
| — | Filter `type='Run'` server-side (all-types corrupt analytics) | High | **Reject** | Sync stores runs only (`RUN_TYPES`); filtering would wrongly drop TrailRun/VirtualRun |
| — | >365 rows/window truncation | High→Low | Downgrade | Runs-only DB → 2 runs/day sustained; `console.warn` on cap-hit safety net only |
| — | CF Tunnel collapses per-IP throttle to one bucket | High | **Note** | Pre-existing app-wide infra (trust-proxy); out of feature scope — follow-up |
| — | Security sections assert vs demonstrate | Med | Reject | Meta; addressed by findings 7-9 concrete fixes |

## Resolved (was unresolved)
- **Activity type filter:** No server filter. DB is run-only (`strava-sync.service.ts` `RUN_TYPES`); adding `type='Run'` would wrongly exclude TrailRun/VirtualRun.
- **Card rows vs desktop table:** Weekly-grouped card rows both breakpoints (single responsive layout, mirrors detail page). Confirmed in scope.
</content>
</invoke>
