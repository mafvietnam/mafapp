# Maffetone Coaching Insights — Shipped (2026-07-13)

**Feature:** Book-grounded training-effectiveness analysis + recommendations on each Strava activity detail view. Live on prod (`app.maf.run`, v1.8.0, SHA `5efad51`).

## What
New "Phân tích hiệu quả buổi tập" card that turns the already-computed per-activity metrics into an effectiveness verdict (tier) + prioritized recommendations, each citing a chapter of Dr. Maffetone's *Big Book of Endurance*. Pure deterministic rule engine — offline, no LLM, no backend, no new fetch.

- `src/utils/maf-coaching-insights.ts` — `coachingInsights()` → tier / findings[] / recommendations[].
- `src/components/activity-detail/training-effectiveness-card.tsx` — pure render.
- Wired into `activity-detail-sections.tsx`; DRY-hoisted shared `DRIFT_THRESHOLD`.

## Process (combo: brainstorm → plan → red-team → validate → cook → ship → E2E)
- **Book grounding:** extracted CH3/CH4/CH5/CH8/CH9 thresholds from the 895pg PDF (180 formula, MAF zone = [mafHr-10, mafHr], aerobic vs anaerobic, drift, warm-up, overtraining, "less means success").
- **Red team** (3 hostile reviewers, 11 findings, all applied): biggest were **avgHr-only mode fabricating 100%-above → false overreach** (fixed: cap tier at `mixed`, gate overreach on real distribution) and **mixed-tier empty recommendations** (fixed: fallback rec + card guards). Others: split-pattern warm-up (vs raw first-split HR), raw-fraction tier (not rounded), importance-ordinal cap, negative-drift copy.
- **Code review:** production-ready, no Critical/High; applied 2 nits (3% warm-up tolerance, interpolate `${DRIFT_THRESHOLD}` into copy).

## E2E on live prod (owner JWT via httpOnly cookie + Playwright)
- Above-zone (hr=176): tier "vượt vùng hiếu khí" + slow-down rec ✓
- 23.8km @ hr=144: **overreach CH9 "less means success"** fires on long base run ✓ (conditional phrasing)
- 3km @ hr=131: "pha trộn" (mixed) — 12% above-time despite in-zone avg (distribution catches what average masks) + non-empty recs ✓
- No-HR activity: card correctly hidden (NoHrNotice) ✓
- Regression sweep: dashboard / journal / plan / admin all render, no new console errors.

## Notes / observations
- 27 new unit tests (284 total pass). Frontend-only deploy (`maf-app` rebuild, api untouched).
- Pre-existing cosmetic 404s (`favicon.svg`, a `/profile` resource) — unrelated to this change, left as-is (out of scope).
- No bugs found in the shipped feature → fix/redeploy loop not triggered.

## Unresolved
- None. Future idea: cross-activity m/beat trend already lives on `/journal`; per-activity card intentionally single-activity (YAGNI).
