/**
 * SOURCE OF TRUTH: src/utils/daily-recommendation-engine.ts — server-local port (DRY
 * debt, reconcile if logic changes). AMBER/GREEN branches split out to
 * daily-recommendation-tier-builders.ts and small helpers to daily-recommendation-
 * helpers.ts to keep this file under the 200-LOC modularization guideline.
 */

import type {
  ReadinessResult,
  DailyRecommendation,
} from './recompute-types.js';
import type { HealthAdjustment } from './health-condition-rules.js';
import { CHILD_COPY } from './daily-recommendation-copy.js';
import { zoneOf, restRecommendation } from './daily-recommendation-helpers.js';
import {
  buildAmber,
  buildGreen,
} from './daily-recommendation-tier-builders.js';
import type { ScheduleItem } from './recompute-types.js';

export interface RecommendationInput {
  adjustedScheduleItem: ScheduleItem;
  mafHr: number;
  readiness: ReadinessResult;
  profile: { age: number };
  healthAdjustment?: HealthAdjustment;
}

/** RED is REST or a gentle recovery WALK only — NEVER a run. */
function buildRed(
  zone: ReturnType<typeof zoneOf>,
  readiness: ReadinessResult,
): DailyRecommendation {
  const badReason = readiness.reasons.find((r) => r.severity === 'bad');
  const restCopy = badReason
    ? `Hôm nay nên NGHỈ. ${badReason.text}`
    : 'Hôm nay nên NGHỈ để cơ thể hồi phục tốt hơn (Chương 7).';
  return restRecommendation('RED', zone, readiness.reasons, restCopy, ['CH7']);
}

export function buildDailyRecommendation(
  input: RecommendationInput,
): DailyRecommendation {
  const { adjustedScheduleItem, mafHr, readiness, profile, healthAdjustment } =
    input;

  // Child (age<16) short-circuit: no structured workout, no HR zone, ever.
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
  if (readiness.tier === 'AMBER')
    return buildAmber(adjustedScheduleItem, zone, readiness, healthAdjustment);
  return buildGreen(adjustedScheduleItem, zone, readiness, healthAdjustment);
}
