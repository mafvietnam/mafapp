/**
 * SOURCE OF TRUTH: src/utils/daily-recommendation-engine.ts (AMBER/GREEN branches) —
 * server-local port (DRY debt, reconcile if logic changes). Split out of
 * daily-recommendation-engine.ts to keep it under the 200-LOC modularization guideline.
 */
import type {
  ScheduleItem,
  DailyRecommendation,
  ReadinessResult,
  MafZone,
} from './recompute-types.js';
import {
  computeDurationBreakdown,
  roundToNearest5,
} from './daily-recommendation-math.js';
import { applyHealthDurationRules } from './daily-recommendation-health-adjust.js';
import type { HealthAdjustment } from './health-condition-rules.js';
import {
  REST_MINIMAL_COPY,
  REASON_SHORT_VN,
  JOINT_ADJUSTMENT_NOTE,
  JOINT_EXTENDED_WARM_COOL_SUFFIX,
} from './daily-recommendation-copy.js';
import {
  buildTitle,
  mapDayType,
  restRecommendation,
} from './daily-recommendation-helpers.js';

const AMBER_REDUCTION_FACTOR = 0.65; // -35%

export function buildAmber(
  item: ScheduleItem,
  zone: MafZone | null,
  readiness: ReadinessResult,
  healthAdjustment?: HealthAdjustment,
): DailyRecommendation {
  if (item.type === 'REST') {
    return restRecommendation(
      'AMBER',
      zone,
      readiness.reasons,
      REST_MINIMAL_COPY,
      ['CH7'],
    );
  }

  const reducedTotal = roundToNearest5(item.duration * AMBER_REDUCTION_FACTOR);
  const breakdown = healthAdjustment
    ? applyHealthDurationRules(reducedTotal, healthAdjustment)
    : computeDurationBreakdown(reducedTotal);
  const hasSoreness = readiness.reasons.some((r) => r.code === 'soreness_warn');
  let dayType = mapDayType(item.type);
  const sorenessSwap = hasSoreness && dayType !== 'WALK';
  const healthSwap =
    !!healthAdjustment?.walkFirst &&
    (dayType === 'RUN' || dayType === 'LONG_RUN');
  const swapped = sorenessSwap || healthSwap;
  if (swapped) dayType = 'WALK';

  const shortPhrases = readiness.reasons
    .map((r) => REASON_SHORT_VN[r.code])
    .filter((p): p is string => Boolean(p));
  const reasonText =
    shortPhrases.length > 0
      ? shortPhrases.join(' & ')
      : 'tín hiệu hồi phục thấp';
  let adjustmentNote = `Đã giảm còn ${breakdown.totalMinutes} phút${swapped ? ' và chuyển sang đi bộ' : ''} vì bạn ${reasonText}.`;
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

export function buildGreen(
  item: ScheduleItem,
  zone: MafZone | null,
  readiness: ReadinessResult,
  healthAdjustment?: HealthAdjustment,
): DailyRecommendation {
  if (item.type === 'REST') {
    return restRecommendation(
      'GREEN',
      zone,
      readiness.reasons,
      REST_MINIMAL_COPY,
      ['CH7'],
    );
  }
  const breakdown = healthAdjustment
    ? applyHealthDurationRules(item.duration, healthAdjustment)
    : computeDurationBreakdown(item.duration);
  let dayType = mapDayType(item.type);
  const healthSwap =
    !!healthAdjustment?.walkFirst &&
    (dayType === 'RUN' || dayType === 'LONG_RUN');
  if (healthSwap) dayType = 'WALK';

  const healthTriggered =
    healthSwap ||
    !!healthAdjustment?.extendWarmCool ||
    (!!healthAdjustment?.durationCapMin &&
      item.duration > healthAdjustment.durationCapMin);

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
