/**
 * Pure, deterministic MAF coaching engine for the activity-detail page.
 * Turns already-computed per-activity metrics (verdict, time-in-zone, cardiac
 * drift, aerobic efficiency, splits) into a book-grounded effectiveness verdict
 * + prioritized recommendations. Every finding/rec cites a chapter of Dr. Phil
 * Maffetone's "The Big Book of Endurance Training and Racing".
 *
 * No React, no I/O — mirrors maf-activity-analysis.ts so it stays unit-testable.
 * Red-team decisions (avgHr-only capping, unconditional zone finding, split-
 * pattern warm-up, raw-fraction tier, importance cap) documented in
 * plans/260713-1847-activity-maffetone-coaching-insights/.
 */

import {
  DRIFT_THRESHOLD,
  type MafVerdict,
  type MafZone,
  type TimeInZone,
} from './maf-activity-analysis';
import type { StravaSplitMetric } from '../services/strava-service';

export type InsightSeverity = 'good' | 'warn' | 'info';
export type BookRef = 'CH3' | 'CH4' | 'CH5' | 'CH8' | 'CH9';
export type EffectivenessTier = 'aerobic-effective' | 'mixed' | 'above-zone';

export interface CoachingFinding {
  severity: InsightSeverity;
  text: string;
  bookRef: BookRef;
  /** Fixed rank; findings sorted desc then capped so a new rule can't silently drop a critical one. */
  importance: number;
}

export interface CoachingRecommendation {
  text: string;
  bookRef: BookRef;
  priority: number;
}

export interface CoachingInsight {
  tier: EffectivenessTier;
  tierLabel: string;
  findings: CoachingFinding[];
  recommendations: CoachingRecommendation[];
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

// Tier cut-points on the RAW above-time fraction (heuristics — not Maffetone page-cited).
const ABOVE_ZONE_FRAC = 0.4;
const MIXED_FRAC = 0.1;
const MIN_BASE_RUN_SEC = 20 * 60;
const BASE_TYPES = ['Run', 'Walk', 'Hike', 'TrailRun', 'VirtualRun'];
const MAX_FINDINGS = 4;
const MAX_RECOMMENDATIONS = 3;

const TIER_LABELS: Record<EffectivenessTier, string> = {
  'aerobic-effective': 'Buổi nền hiếu khí hiệu quả',
  mixed: 'Buổi tập pha trộn hiếu–yếm khí',
  'above-zone': 'Buổi tập vượt vùng hiếu khí',
};

/**
 * CH4/CH5 "sped up later ⇒ inadequate warm-up": a normal easy run positive-splits
 * (first quickest). If a LATER split is faster than the first, the warm-up was
 * likely too short. Uses the always-present `average_speed` (never the optional
 * `average_heartrate`). Suppressed on all-hard (above-zone) runs where a fast
 * later split is intensity, not a warm-up problem.
 */
function detectWarmup(splits: StravaSplitMetric[], tier: EffectivenessTier): boolean {
  if (tier === 'above-zone' || splits.length < 2) return false;
  const first = splits[0].average_speed;
  if (!(first > 0)) return false;
  // ~3% tolerance so GPS/terrain noise and intentional easy negative-splits don't
  // trip a false "inadequate warm-up" — only a clearly faster later split counts.
  return splits.slice(1).some((s) => s.average_speed > first * 1.03);
}

/**
 * Build the coaching insight, or null when there's nothing to interpret
 * (no MAF zone configured, or no HR data at all — the NoHrNotice covers that).
 */
export function coachingInsights(input: CoachingInput): CoachingInsight | null {
  const { verdict, timeInZone: tiz, drift, aerobicEff, splits, zone, activityType, movingTimeSec, avgHr } = input;

  if (zone.upper <= 0) return null;
  if (!verdict && !tiz) return null;

  const hasDist = tiz != null;
  const aboveFrac = hasDist ? tiz.aboveSec / tiz.totalSec : 0;
  const driftBad = drift != null && drift >= DRIFT_THRESHOLD;
  const avgAbove = verdict?.status === 'above';

  // avgHr-only mode never escalates past 'mixed' — a single average can't prove distribution.
  const tier: EffectivenessTier = hasDist
    ? aboveFrac > ABOVE_ZONE_FRAC
      ? 'above-zone'
      : aboveFrac >= MIXED_FRAC || driftBad
        ? 'mixed'
        : 'aerobic-effective'
    : avgAbove
      ? 'mixed'
      : 'aerobic-effective';

  // Overreach requires a real distribution (not just avgHr) + a base-type run of real length.
  const overreach =
    hasDist &&
    tier === 'above-zone' &&
    BASE_TYPES.includes(activityType) &&
    movingTimeSec >= MIN_BASE_RUN_SEC;
  const warmupFlag = detectWarmup(splits, tier);

  const findings: CoachingFinding[] = [];

  // Zone (CH3) — always emitted so every session gets ≥1 finding.
  if (hasDist) {
    if (aboveFrac >= MIXED_FRAC) {
      findings.push({
        severity: 'warn', importance: 100, bookRef: 'CH3',
        text: `${tiz.abovePct}% thời gian trên vùng MAF — cơ thể chuyển sang chuyển hoá yếm khí, đốt đường nhiều hơn và ít xây nền hiếu khí.`,
      });
    } else {
      findings.push({
        severity: 'good', importance: 100, bookRef: 'CH3',
        text: `${tiz.inPct + tiz.belowPct}% thời gian trong/dưới vùng MAF — đốt mỡ và xây nền hiếu khí hiệu quả.`,
      });
    }
  } else if (avgHr != null) {
    // avgHr-only: verdict is non-null here (guard above), so avgHr is present.
    findings.push(
      avgAbove
        ? {
            severity: 'warn', importance: 100, bookRef: 'CH3',
            text: `Nhịp tim trung bình ${avgHr} vượt trần vùng MAF (${zone.upper} bpm) — thiên về yếm khí (cần dữ liệu chi tiết để phân tích sâu hơn).`,
          }
        : {
            severity: 'good', importance: 100, bookRef: 'CH3',
            text: `Nhịp tim trung bình ${avgHr} trong/dưới vùng MAF (${zone.lower}-${zone.upper} bpm) — buổi chạy nền hiếu khí.`,
          },
    );
  }

  // Drift (CH4) — only when measured; negative drift = efficiency improved.
  if (drift != null) {
    if (driftBad) {
      findings.push({
        severity: 'warn', importance: 90, bookRef: 'CH4',
        text: `Trôi tim mạch +${drift}% (≥${DRIFT_THRESHOLD}%) — dấu hiệu thiếu hụt hiếu khí, mệt mỏi hoặc nắng nóng.`,
      });
    } else if (drift < 0) {
      findings.push({
        severity: 'good', importance: 90, bookRef: 'CH4',
        text: `Hiệu suất tim mạch cải thiện về cuối buổi — nền hiếu khí tốt.`,
      });
    } else {
      findings.push({
        severity: 'good', importance: 90, bookRef: 'CH4',
        text: `Trôi tim mạch +${drift}% (<${DRIFT_THRESHOLD}%) — nhịp tim ổn định so với tốc độ suốt buổi.`,
      });
    }
  }

  // Overreach (CH8/CH9) — conditional phrasing avoids false-alarming intentional workouts.
  if (overreach) {
    findings.push({
      severity: 'warn', importance: 80, bookRef: 'CH9',
      text: `Nếu đây là buổi chạy nền/dễ, việc vượt vùng hiếu khí kéo dài dễ dẫn tới quá tải — "less means success".`,
    });
  }

  // Warm-up (CH5) — info on a green session so it doesn't contradict the tier badge.
  if (warmupFlag) {
    findings.push({
      severity: tier === 'aerobic-effective' ? 'info' : 'warn', importance: 70, bookRef: 'CH5',
      text: `Có quãng sau nhanh hơn quãng đầu — thường do khởi động chưa đủ.`,
    });
  }

  // Efficiency (CH4) — lowest importance; drops off automatically when 4 warnings exist.
  if (aerobicEff != null && aerobicEff > 0) {
    findings.push({
      severity: 'info', importance: 10, bookRef: 'CH4',
      text: `Hiệu suất hiếu khí ${aerobicEff} m/nhịp — theo dõi chỉ số này tăng dần qua các buổi (MAF test).`,
    });
  }

  findings.sort((a, b) => b.importance - a.importance);
  const cappedFindings = findings.slice(0, MAX_FINDINGS);

  const recs: CoachingRecommendation[] = [];
  if (tier === 'above-zone' || (!hasDist && avgAbove)) {
    recs.push({ priority: 100, bookRef: 'CH3', text: `Giảm tốc hoặc đi bộ để giữ nhịp tim ≤ ${zone.upper} bpm, ở lại vùng hiếu khí.` });
  }
  if (driftBad) {
    recs.push({ priority: 90, bookRef: 'CH4', text: `Bổ sung nước và điện giải, tránh nắng gắt, và tăng dần khối lượng nền hiếu khí.` });
  }
  if (overreach) {
    recs.push({ priority: 80, bookRef: 'CH9', text: `Thêm ít nhất 1 ngày nghỉ trong tuần và giảm khối lượng để hồi phục.` });
  }
  if (warmupFlag) {
    recs.push({ priority: 70, bookRef: 'CH5', text: `Khởi động 12–15 phút, nâng nhịp tim từ từ trước khi vào nhịp chính.` });
  }
  // Mixed sessions must never render an empty recommendations block.
  if (tier === 'mixed' && recs.length === 0) {
    recs.push({ priority: 50, bookRef: 'CH3', text: `Giảm bớt thời gian vượt vùng MAF để tăng hiệu quả xây nền hiếu khí.` });
  }
  const noWarn = !cappedFindings.some((f) => f.severity === 'warn');
  if (tier === 'aerobic-effective' && noWarn) {
    recs.push({ priority: 40, bookRef: 'CH4', text: `Giữ vững cường độ hiếu khí này; theo dõi m/nhịp tăng dần qua các buổi (MAF test).` });
  }
  recs.sort((a, b) => b.priority - a.priority);

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    findings: cappedFindings,
    recommendations: recs.slice(0, MAX_RECOMMENDATIONS),
  };
}
