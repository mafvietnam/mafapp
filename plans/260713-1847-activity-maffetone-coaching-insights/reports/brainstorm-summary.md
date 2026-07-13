# Brainstorm Summary — Maffetone Coaching Insights on Activity Detail

**Date:** 2026-07-13 · **Status:** APPROVED → proceed to plan

## Problem
Activity-detail view shows raw MAF metrics (verdict, time-in-zone, cardiac drift, aerobic efficiency, splits) but no book-grounded interpretation of *training effectiveness* or actionable recommendations. Goal: add a per-activity "training effectiveness analysis + recommendations" section grounded in Dr. Maffetone's *The Big Book of Endurance Training and Racing* (docs/, 895pg).

## Requirements
- Per-activity effectiveness verdict + prioritized recommendations.
- Each finding cites a book chapter (traceability/credibility).
- Offline-first, deterministic, fully testable (supports E2E + redeploy loop).
- Focused depth: 1 tier verdict + top 2–4 findings + 1–3 recommendations. Mobile-first, scannable.
- Vietnamese UI copy (app language).

## Approaches Evaluated
| # | Approach | Verdict |
|---|----------|---------|
| A | Deterministic rule engine (frontend pure util + card), thresholds grounded in book chapters | **CHOSEN** |
| B | Backend LLM/RAG over 895pg book, generated per view | Rejected — breaks offline-first, per-view cost/latency, non-deterministic (hard to E2E), new infra |
| C | Hybrid rule engine + cached LLM narrative | Rejected (for now) — premature complexity, still needs LLM infra; revisit only if wording quality proves insufficient |

**Why A:** Maffetone's method is literally a set of HR/effort thresholds + rest rules → a rule engine represents it *faithfully*, not as an approximation. Matches app's existing pattern (every analysis card = pure util + card). Zero API cost, deterministic, unit- + E2E-testable.

## Recommended Solution (A)
- **New pure util** `src/utils/maf-coaching-insights.ts`:
  - `CoachingInsight { tier, findings[], recommendations[] }`, findings carry `{ text, severity, bookRef }`.
  - Consumes already-computed metrics: `verdict`, `timeInZone`, `cardiacDrift`, `aerobicEfficiency`, `splits`, activity `type`/`duration`.
  - No new data fetching — pure function over existing detail response + MAF zone.
- **New card** `src/components/activity-detail/training-effectiveness-card.tsx` rendered in `activity-detail-sections.tsx` (only when `hydrated` + `mafHr>0`, like other MAF cards).
- **Book grounding** codified as thresholds + Vietnamese copy, each finding tagged with chapter (CH3/CH4/CH5/CH8/CH9).

### Rule dimensions (grounded)
1. Aerobic vs anaerobic classification from time-in-zone (CH3).
2. Aerobic deficiency / fatigue from cardiac drift ≥5% (CH4/CH8).
3. Effectiveness of aerobic base session (mostly in/below zone) (CH3).
4. Overreaching / "less means success" when base run runs hot (CH8/CH9).
5. Warm-up quality from early-split HR ramp / positive split (CH5).
6. Aerobic-efficiency context note (m/beat as MAF-test-style signal) (CH4).

## Risks
- **Threshold accuracy** → mitigate by extracting exact page-cited numbers from book before coding (research phase).
- **Copy overload** → Focused depth cap (max 4 findings, 3 recs), severity-ranked.
- **Degradation states** (no HR / no streams / not hydrated) → engine must return partial/empty gracefully; card hidden or shows "insufficient data" note.

## Success Criteria
- Card renders correct tier + findings for in-zone, above-zone, high-drift, and no-HR activities.
- Every finding cites a chapter. Unit tests cover each rule + degradation.
- Builds clean, E2E passes, deployed live.

## Next Steps
1. Extract book thresholds (research) → 2. ck:plan → 3. red-team + validate → 4. cook --auto → 5. tony-ship → 6. E2E loop.

## Unresolved Questions
- None blocking. (Exact drift/warm-up numeric thresholds to be finalized from book extraction.)
