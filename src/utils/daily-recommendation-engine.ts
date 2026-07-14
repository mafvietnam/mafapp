/**
 * Pure daily-workout recommendation engine. Consumes the ORCHESTRATOR's
 * adjusted schedule item + adjusted mafHr (RED TEAM FIX #4 — never the raw
 * SCHEDULES template or `calculateRawMaf`, which omits the probation -10) and
 * layers today's readiness tier on top. No React, no I/O.
 */

import type { ScheduleItem, DailyRecommendation, ReadinessResult, ReasonCode, ReadinessTier } from '../types';
import type { MafZone } from './maf-activity-analysis';
import type { BookRef } from './maf-coaching-insights';
import { computeDurationBreakdown, roundToNearest5 } from './daily-recommendation-math';
import { applyHealthDurationRules } from './daily-recommendation-health-adjust';
import type { HealthAdjustment } from './health-condition-rules';
import {
  CHILD_COPY,
  REST_MINIMAL_COPY,
  TITLE_LABEL,
  REASON_SHORT_VN,
  JOINT_ADJUSTMENT_NOTE,
  JOINT_EXTENDED_WARM_COOL_SUFFIX,
} from './daily-recommendation-copy';

export interface RecommendationInput {
  adjustedScheduleItem: ScheduleItem;
  mafHr: number;
  readiness: ReadinessResult;
  profile: { age: number; bmi: number };
  /** Phase 3 — JOINT_ISSUES walk-first/extended-warm-cool/duration-cap effects
   *  (health-condition-rules.ts). Optional — omitted callers behave exactly as
   *  before (all existing tests pass an undefined healthAdjustment). */
  healthAdjustment?: HealthAdjustment;
}

const AMBER_REDUCTION_FACTOR = 0.65; // -35% (placeholder, see phase-01 plan)

type DayType = DailyRecommendation['dayType'];

function buildTitle(dayType: DayType, totalMinutes: number): string {
  return dayType === 'REST' ? 'Ngày nghỉ' : `${TITLE_LABEL[dayType]} ${totalMinutes} phút`;
}

/**
 * DailyRecommendation.dayType has no CROSS_TRAIN bucket — RECOVERY is the
 * closest low-impact semantic (documented P1 simplification; CROSS_TRAIN only
 * appears for fast-pace non-obese users' Thursday swap — see maf-calculator-
 * schedule-builder.ts addPaceWarnings).
 */
function mapDayType(type: ScheduleItem['type']): DayType {
  if (type === 'RUN' || type === 'LONG_RUN' || type === 'WALK' || type === 'RECOVERY' || type === 'REST') {
    return type;
  }
  return 'RECOVERY';
}

function zoneOf(mafHr: number): MafZone | null {
  return mafHr > 0 ? { lower: mafHr - 10, upper: mafHr } : null;
}

function restRecommendation(
  tier: ReadinessTier,
  zone: MafZone | null,
  reasons: ReasonCode[],
  restCopy: string,
  citations: BookRef[],
): DailyRecommendation {
  return {
    dayType: 'REST',
    title: 'Ngày nghỉ',
    totalMinutes: 0,
    warmupMin: 0,
    cooldownMin: 0,
    mainMinutes: 0,
    hrZone: zone,
    tier,
    reasons,
    citations,
    restCopy,
  };
}

/** RED TEAM FIX #13: RED is REST or a gentle recovery WALK only — NEVER a run. */
function buildRed(zone: MafZone | null, readiness: ReadinessResult): DailyRecommendation {
  const badReason = readiness.reasons.find((r) => r.severity === 'bad');
  const restCopy = badReason
    ? `Hôm nay nên NGHỈ. ${badReason.text}`
    : 'Hôm nay nên NGHỈ để cơ thể hồi phục tốt hơn (Chương 7).';
  return restRecommendation('RED', zone, readiness.reasons, restCopy, ['CH7']);
}

function buildAmber(
  item: ScheduleItem,
  zone: MafZone | null,
  readiness: ReadinessResult,
  healthAdjustment?: HealthAdjustment,
): DailyRecommendation {
  if (item.type === 'REST') {
    return restRecommendation('AMBER', zone, readiness.reasons, REST_MINIMAL_COPY, ['CH7']);
  }

  const reducedTotal = roundToNearest5(item.duration * AMBER_REDUCTION_FACTOR);
  const breakdown = healthAdjustment
    ? applyHealthDurationRules(reducedTotal, healthAdjustment)
    : computeDurationBreakdown(reducedTotal);
  const hasSoreness = readiness.reasons.some((r) => r.code === 'soreness_warn');
  let dayType = mapDayType(item.type);
  const sorenessSwap = hasSoreness && dayType !== 'WALK';
  const healthSwap = !!healthAdjustment?.walkFirst && (dayType === 'RUN' || dayType === 'LONG_RUN');
  const swapped = sorenessSwap || healthSwap;
  if (swapped) dayType = 'WALK';

  const shortPhrases = readiness.reasons.map((r) => REASON_SHORT_VN[r.code]).filter((p): p is string => Boolean(p));
  const reasonText = shortPhrases.length > 0 ? shortPhrases.join(' & ') : 'tín hiệu hồi phục thấp';
  let adjustmentNote =
    `Đã giảm còn ${breakdown.totalMinutes} phút${swapped ? ' và chuyển sang đi bộ' : ''} vì bạn ${reasonText}.`;
  if (healthAdjustment?.extendWarmCool) {
    adjustmentNote += JOINT_EXTENDED_WARM_COOL_SUFFIX;
  }

  return {
    dayType,
    title: buildTitle(dayType, breakdown.totalMinutes),
    ...breakdown,
    hrZone: zone,
    tier: 'AMBER',
    reasons: readiness.reasons,
    citations: ['CH5', 'CH6', 'CH7'],
    adjustmentNote,
  };
}

function buildGreen(
  item: ScheduleItem,
  zone: MafZone | null,
  readiness: ReadinessResult,
  healthAdjustment?: HealthAdjustment,
): DailyRecommendation {
  if (item.type === 'REST') {
    return restRecommendation('GREEN', zone, readiness.reasons, REST_MINIMAL_COPY, ['CH7']);
  }
  const breakdown = healthAdjustment
    ? applyHealthDurationRules(item.duration, healthAdjustment)
    : computeDurationBreakdown(item.duration);
  let dayType = mapDayType(item.type);
  const healthSwap = !!healthAdjustment?.walkFirst && (dayType === 'RUN' || dayType === 'LONG_RUN');
  if (healthSwap) dayType = 'WALK';

  const healthTriggered =
    healthSwap ||
    !!healthAdjustment?.extendWarmCool ||
    (!!healthAdjustment?.durationCapMin && item.duration > healthAdjustment.durationCapMin);

  return {
    dayType,
    title: buildTitle(dayType, breakdown.totalMinutes),
    ...breakdown,
    hrZone: zone,
    tier: 'GREEN',
    reasons: readiness.reasons,
    citations: ['CH5', 'CH6'],
    ...(healthTriggered ? { adjustmentNote: JOINT_ADJUSTMENT_NOTE } : {}),
  };
}

export function buildDailyRecommendation(input: RecommendationInput): DailyRecommendation {
  const { adjustedScheduleItem, mafHr, readiness, profile, healthAdjustment } = input;

  // RED TEAM FIX #6 — child short-circuit: mirrors buildChildResult(); no
  // structured workout, no HR zone, ever. Skips all tier/adjustment logic.
  if (profile.age < 16) {
    return {
      dayType: 'REST',
      title: 'Vui chơi tự nhiên',
      totalMinutes: 0,
      warmupMin: 0,
      cooldownMin: 0,
      mainMinutes: 0,
      hrZone: null,
      tier: 'GREEN',
      reasons: [],
      citations: [],
      restCopy: CHILD_COPY,
    };
  }

  const zone = zoneOf(mafHr);
  if (readiness.tier === 'RED') return buildRed(zone, readiness);
  if (readiness.tier === 'AMBER') return buildAmber(adjustedScheduleItem, zone, readiness, healthAdjustment);
  return buildGreen(adjustedScheduleItem, zone, readiness, healthAdjustment);
}
