# Phase 02 — Card Component + Wiring

**Priority:** High · **Status:** pending · **Depends:** phase-01
**Create:** `src/components/activity-detail/training-effectiveness-card.tsx` (<200 lines)
**Modify:** `src/components/activity-detail/activity-detail-sections.tsx`

## Card Component
Props: `{ insight: CoachingInsight }` (parent computes; card is pure render — testable, matches existing card pattern e.g. `MafVerdictCard`).

Layout (glass-card, matches siblings). **XSS-discipline comment at top of file** (A10/L2): mirror `activity-detail-sections.tsx:51` — all copy is static Vietnamese + interpolated numbers; never interpolate Strava free text; never `dangerouslySetInnerHTML`.
- Header: icon (lucide `Sparkles` or `ClipboardCheck`) + "Phân tích hiệu quả buổi tập".
- Tier badge: color by tier — aerobic-effective→emerald, mixed→amber, above-zone→maf-red (reuse existing badge classes from MafVerdictCard).
- Findings list: **guard `{insight.findings.length > 0 && (...)}`** (A3). Each row = severity dot (good=emerald, warn=maf-red, info=white/50) + text + small chapter chip (e.g. "CH3").
- Recommendations block: **guard `{insight.recommendations.length > 0 && (...)}`** (A3 — no empty "Khuyến nghị" heading). heading "Khuyến nghị" + bulleted list, each with chapter chip.
- Book attribution footer: "Theo Dr. Phil Maffetone — The Big Book of Endurance Training and Racing." (small, white/40).

Severity → dot color map + BookRef → label are small const records at top of file.

## Wiring (activity-detail-sections.tsx)
Inside the `hydrated && mafHr>0` branch, after `<MafVerdictCard/>`:
```tsx
const insight = coachingInsights({
  verdict: verdict(activity.avgHeartRate, zone),
  timeInZone: streams ? timeInZone(streams.heartrate, streams.time, zone) : null,
  drift: streams?.velocitySmooth ? cardiacDrift(streams.velocitySmooth, streams.heartrate, streams.time) : null,
  aerobicEff: aerobicEfficiency(activity.avgSpeed, activity.avgHeartRate),
  splits: detail?.splitsMetric ?? [],
  zone,
  activityType: activity.type,
  movingTimeSec: activity.movingTime,
  avgHr: activity.avgHeartRate,
});
{insight && <TrainingEffectivenessCard insight={insight} />}
```
- Import `verdict`, `timeInZone`, `cardiacDrift`, `aerobicEfficiency`, `coachingInsights`.
- Place card ABOVE `TimeInZoneBar` (summary-first: verdict → coaching → detail charts).
- Note: `TimeInZoneBar`/`CardiacDriftCard` already recompute internally; calling the same pure fns here is cheap + DRY-acceptable (no memo needed for one activity). Keep as-is.

## Success Criteria
- Card renders for all tiers; hidden when `insight == null`.
- No `dangerouslySetInnerHTML`. Mobile-first (matches responsive classes of siblings).
- `npx tsc --noEmit` clean.
