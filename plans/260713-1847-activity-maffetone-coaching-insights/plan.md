---
title: Activity Maffetone Coaching Insights
slug: activity-maffetone-coaching-insights
date: 2026-07-13
status: completed
approach: A — deterministic rule engine (frontend)
blockedBy: []
blocks: []
---

# Plan — Maffetone Coaching Insights on Activity Detail

## Goal
Add a book-grounded "training effectiveness analysis + recommendations" section to each Strava activity detail view. Deterministic rule engine (offline, testable). Focused depth: 1 tier verdict + ≤4 findings + ≤3 recommendations, each citing a Maffetone chapter.

## Context
- Brainstorm: `reports/brainstorm-summary.md` (Approach A + Focused approved)
- Book thresholds: `reports/researcher-book-principles.md` (page-cited)
- Existing metrics reused: `verdict`, `timeInZone`, `cardiacDrift`, `aerobicEfficiency`, `splits` (all already computed in `src/utils/maf-activity-analysis.ts` + `strava-service` types).

## Architecture (one-liner)
`coachingInsights(input)` pure util → `CoachingInsight` → `<TrainingEffectivenessCard/>` rendered in `activity-detail-sections.tsx` (top of MAF block, after `MafVerdictCard`). No backend, no new fetch.

## Phases
| # | Phase | File | Status |
|---|-------|------|--------|
| 1 | Rule engine util + types | `phase-01-rule-engine.md` | pending |
| 2 | Card component + wiring | `phase-02-card-and-wiring.md` | pending |
| 3 | Unit tests + typecheck/build | `phase-03-tests.md` | pending |

## Key Dependencies
- `src/utils/maf-activity-analysis.ts` (MafZone, MafVerdict, TimeInZone types + drift threshold)
- `src/services/strava-service.ts` (StravaSplitMetric, StravaActivity)
- `src/components/activity-detail/activity-detail-sections.tsx` (integration point)

## Success Criteria
- Correct tier + findings for: in-zone, above-zone, high-drift, avgHr-only (no streams), no-HR (card hidden).
- Every finding/rec cites a chapter. All rules unit-tested + degradation covered.
- `npm run test`, `npx tsc --noEmit`, `npm run build` all clean.

## Non-Goals (YAGNI)
- No LLM/RAG, no backend endpoint, no per-user history trend (single-activity only).
- No new Strava data — only re-interprets what detail endpoint already returns.

## Red Team Review
3 hostile reviewers (Security Adversary, Assumption Destroyer, Failure Mode Analyst). 11 findings, all **Accepted** (cheap correctness gains). Applied to phase-01/02/03.

| ID | Sev | Finding | Fix (phase) |
|----|-----|---------|-------------|
| A1 | HIGH | avgHr-only snaps to 100% above → false "overreach" on 1-bpm overage | avgHr-only tier capped at `mixed`; overreach gated on `timeInZone!=null` (P1 §3,§4) |
| A2 | HIGH | overreach fires on intentional workouts; researcher's conditional phrasing not encoded | conditional "Nếu đây là buổi chạy nền/dễ…" copy (P1 §4,§5) |
| A3 | HIGH | mixed-tier common case → empty "Khuyến nghị" box | mixed fallback rec + card guards empty arrays (P1 §5, P2) |
| A4 | MED | warm-up rule (raw first-split HR) mislabels hard/hilly starts | split-pattern signal via `average_speed`, suppress on above-zone, info on aerobic-effective (P1 §4) |
| A5 | MED | `splits[0]?.average_heartrate > upper` → tsc TS18048 | avoid optional-field relational; use required `average_speed` (P1 §4) |
| A6 | MED | tier from display-rounded `abovePct` flips at boundary; constants over-claimed as book-grounded | tier from raw `aboveSec/totalSec`; constants relabeled heuristics (P1 §2, consts) |
| A7 | MED | zero-findings if zone-finding conditional | zone finding unconditional across both branches (P1 §4) |
| A8 | LOW | avgSpeed=0→eff 0 "0 m/nhịp"; negative-drift copy odd | skip eff≤0; negative-drift "cải thiện" copy (P1 §4) |
| A9 | LOW | ≤4 cap safe only by 4==4 coincidence | explicit `importance` ordinal + sort (P1 types,§4) |
| A10 | LOW | non-finite number could render; XSS defense-in-depth | interpolate only narrowed vars; XSS-discipline comment in card (P1 §5, P2) |
| A11 | — | test gaps (empty-recs, avgHr-only in/below, undefined-split, card render) | added regression + card tests (P3) |

Security verdict: surface minimal — `activityType` dead-ends in a boolean, React auto-escapes, no `dangerouslySetInnerHTML`. No XSS/injection/leakage.

## Validation Log (self-adjudicated — autonomous run)
Decision points resolved with defaults (all reversible UI polish; no irreversible fork needs user):
1. **Card placement** → after `MafVerdictCard`, before `TimeInZoneBar` (verdict → coaching → detail charts). Summary-first reading order.
2. **Below-zone avgHr-only tier** → collapses into `aerobic-effective` (running below MAF is neutral/fine per book + existing `MafVerdictCard` treats "below" as informational, not a warning). Zone finding copy still says "trong/dưới vùng MAF" so it's not misleading.
3. **Overreach strictness** → conditional phrasing ("Nếu đây là buổi chạy nền/dễ…") + gated on `hasDist` + BASE_TYPES + ≥20min. NOT additionally requiring `driftBad` (would suppress legitimate warnings on genuinely over-cooked base runs). Phrasing is the false-positive mitigation.
4. **Efficiency info finding** → keep as lowest-importance `info`; drops off automatically when 4 warns present. Single-activity m/beat has limited standalone meaning → framed as "track the trend."
5. **Book attribution footer** → include (credibility; core to "book-grounded" goal).
6. **Mixed-tier badge color** → `amber-400` (tailwind built-in; palette has no dedicated token). emerald/amber/maf-red = good/mixed/above.

Recommendation: **proceed to cook** — plan validated, red-teamed, defaults documented.
