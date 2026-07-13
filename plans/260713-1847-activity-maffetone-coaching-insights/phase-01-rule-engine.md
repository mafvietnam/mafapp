# Phase 01 — Rule Engine Util + Types  (v2 — red-teamed)

**Priority:** High · **Status:** pending
**File to create:** `src/utils/maf-coaching-insights.ts` (<200 lines)

> **RED TEAM applied:** A1 avgHr-only no-snap, A2 conditional overreach, A4 warm-up via split-pattern, A6 raw-fraction tier, A7 unconditional zone finding, A9 importance ordinal, A8 negative-drift/eff≤0, A10 finite guards. See plan.md `## Red Team Review`.

## Overview
Pure, deterministic function turning already-computed per-activity metrics into a book-grounded `CoachingInsight`. No React, no I/O — mirrors `maf-activity-analysis.ts`.

## Types
```ts
export type InsightSeverity = 'good' | 'warn' | 'info';
export type BookRef = 'CH3' | 'CH4' | 'CH5' | 'CH8' | 'CH9';
export type EffectivenessTier = 'aerobic-effective' | 'mixed' | 'above-zone';

export interface CoachingFinding {
  severity: InsightSeverity;
  text: string;            // Vietnamese
  bookRef: BookRef;
  importance: number;      // A9: fixed rank; sort desc, then slice 4 (survives new rules)
}
export interface CoachingRecommendation { text: string; bookRef: BookRef; priority: number; }

export interface CoachingInsight {
  tier: EffectivenessTier;
  tierLabel: string;                          // Vietnamese
  findings: CoachingFinding[];                // ≤4, importance-ranked (importance stripped OK or kept)
  recommendations: CoachingRecommendation[];  // ≤3, priority-ranked
}

export interface CoachingInput {
  verdict: MafVerdict | null;
  timeInZone: TimeInZone | null;
  drift: number | null;
  aerobicEff: number | null;
  splits: StravaSplitMetric[];
  zone: MafZone;
  activityType: string;
  movingTimeSec: number;
  avgHr: number | null;
}
```

## Constants — HEURISTICS, not book-grounded (A6 relabel)
```ts
// Decoupling cut = Friel-style ≥5% (reused from cardiac-drift-card); NOT a Maffetone number.
const DRIFT_THRESHOLD = 5;              // import from maf-activity-analysis (DRY — also refactor cardiac-drift-card to use it)
// Tier cut-points on the RAW above-time fraction (heuristic, no page cite):
const ABOVE_ZONE_FRAC = 0.40;
const MIXED_FRAC = 0.10;
const MIN_BASE_RUN_SEC = 20 * 60;       // overreach only on runs ≥20min
const BASE_TYPES = ['Run', 'Walk', 'Hike', 'TrailRun', 'VirtualRun'];
```

## Function `coachingInsights(input): CoachingInsight | null`

### 1. Guards
- `if (zone.upper <= 0) return null;`
- `if (!verdict && !timeInZone) return null;` (no-HR → card hides; NoHrNotice already covers, DRY)

### 2. Derive (A6 — use RAW fraction, never rounded abovePct for tier)
```ts
const hasDist = timeInZone != null;
const aboveFrac = hasDist ? timeInZone.aboveSec / timeInZone.totalSec : null; // totalSec>0 guaranteed by timeInZone()
const driftBad = drift != null && drift >= DRIFT_THRESHOLD;
const avgAbove = verdict?.status === 'above';
```

### 3. Tier (A1 — avgHr-only never escalates past `mixed`)
```ts
let tier: EffectivenessTier;
if (hasDist) {
  tier = aboveFrac! > ABOVE_ZONE_FRAC ? 'above-zone'
       : (aboveFrac! >= MIXED_FRAC || driftBad) ? 'mixed'
       : 'aerobic-effective';
} else {
  tier = avgAbove ? 'mixed' : 'aerobic-effective';  // single average can't prove distribution
}
```

### 4. Findings — build all applicable, push `{importance}`, then sort importance desc, slice 4

- **Zone (CH3, importance 100) — ALWAYS emitted (A7):**
  - `hasDist`: `abovePct = timeInZone.abovePct`; if `aboveFrac >= MIXED_FRAC` → `warn` "…{abovePct}% thời gian trên vùng MAF — chuyển hoá yếm khí, đốt đường nhiều hơn, ít xây nền hiếu khí." else `good` "…{inPct+belowPct}% thời gian trong/dưới vùng MAF — đốt mỡ, xây nền hiếu khí hiệu quả."
  - else avgHr-only (avgHr guaranteed non-null since verdict!=null ⟹ avgHr!=null): `avgAbove` → `warn` "Nhịp tim TB {avgHr} vượt trần vùng MAF ({zone.upper} bpm) — thiên về yếm khí (cần dữ liệu chi tiết để phân tích sâu)." else `good` "Nhịp tim TB {avgHr} trong/dưới vùng MAF ({zone.lower}-{zone.upper}) — buổi chạy nền hiếu khí."
- **Drift (CH4, importance 90) — only if `drift != null`; A8 negative copy:**
  - `driftBad` → `warn` "Trôi tim mạch +{drift}% (≥5%) — dấu hiệu thiếu hụt hiếu khí, mệt mỏi hoặc nắng nóng."
  - `drift < 0` → `good` "Hiệu suất tim mạch cải thiện về cuối buổi — nền hiếu khí tốt."
  - else → `good` "Trôi tim mạch +{drift}% (<5%) — nền hiếu khí ổn định suốt buổi."
- **Overreach (CH9, importance 80) — only if `hasDist` (A1) && tier==='above-zone' && BASE_TYPES.includes(activityType) && movingTimeSec >= MIN_BASE_RUN_SEC:**
  - `warn` "Nếu đây là buổi chạy nền/dễ, việc vượt vùng hiếu khí kéo dài dễ dẫn tới quá tải — 'less means success'." (A2 conditional)
- **Warm-up (CH5, importance 70) — A4 redesigned via split PATTERN, not raw first-split HR:**
  - Requires `splits.length >= 2`. Use `average_speed` (required field, no null issue). If any later split has `average_speed > splits[0].average_speed` (i.e. sped up later = inadequate warm-up per CH4/CH5) **AND tier !== 'above-zone'** (suppress on all-hard runs):
    - severity = `tier === 'aerobic-effective' ? 'info' : 'warn'` (A4 — don't red-flag a green session)
    - "Có quãng sau nhanh hơn quãng đầu — thường do khởi động chưa đủ."
- **Efficiency (CH4, importance 10, info) — only if `aerobicEff != null && aerobicEff > 0` (A8):**
  - `info` "Hiệu suất hiếu khí {aerobicEff} m/nhịp — theo dõi chỉ số này tăng dần qua các buổi (MAF test)."

Then: `findings.sort((a,b)=>b.importance-a.importance).slice(0,4)`.

### 5. Recommendations — build, sort priority desc, slice 3
- `tier==='above-zone' || (!hasDist && avgAbove)` → prio 100, CH3: "Giảm tốc hoặc đi bộ để giữ nhịp tim ≤ {zone.upper} bpm, ở lại vùng hiếu khí."
- `driftBad` → prio 90, CH4: "Bổ sung nước & điện giải, tránh nắng gắt, tăng dần khối lượng nền hiếu khí."
- overreach condition (same as finding) → prio 80, CH9: "Thêm ít nhất 1 ngày nghỉ trong tuần và giảm khối lượng để hồi phục."
- warm-up flag (same as finding) → prio 70, CH5: "Khởi động 12–15 phút, nâng nhịp tim từ từ trước khi vào nhịp chính."
- **A3 mixed fallback:** after building, `if (tier==='mixed' && recs.length===0)` → prio 50, CH3: "Giảm bớt thời gian vượt vùng MAF để tăng hiệu quả xây nền hiếu khí."
- `tier==='aerobic-effective' && no warn finding` → prio 40, CH4: "Giữ vững cường độ hiếu khí này; theo dõi m/nhịp tăng dần qua MAF test."

Then slice 3. (Card ALSO guards empty arrays — belt & suspenders, phase-02.)

### 6. tierLabel
`aerobic-effective`→"Buổi nền hiếu khí hiệu quả" · `mixed`→"Buổi tập pha trộn hiếu–yếm khí" · `above-zone`→"Buổi tập vượt vùng hiếu khí"

## A10 finite-number note
All interpolated numbers already come from null-gated typed fns (drift/eff null-gated; avgHr a stored number; pct integers). Defensive: keep interpolation only on the already-narrowed variable; do NOT re-read `splits[x].average_heartrate` unguarded. No `NaN`/`undefined` reaches copy.

## Success Criteria
- Deterministic; returns null only on invalid zone / no verdict+tiz.
- Every session with verdict|tiz yields ≥1 finding (A7). Mixed tier yields ≥1 rec (A3).
- ≤4 findings, ≤3 recs, every item has bookRef. Compiles clean (A5 null-safe). File <200 lines.
