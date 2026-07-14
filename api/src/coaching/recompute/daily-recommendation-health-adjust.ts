/**
 * SOURCE OF TRUTH: src/utils/daily-recommendation-health-adjust.ts — server-local port
 * (DRY debt, reconcile if logic changes). Verbatim port.
 */
import {
  computeDurationBreakdown,
  type DurationBreakdown,
} from './daily-recommendation-math.js';
import type { HealthAdjustment } from './health-condition-rules.js';

const EXTENDED_WARM_COOL_MIN = 15;
const MIN_MAIN_MINUTES = 5;

function extendWarmCool(breakdown: DurationBreakdown): DurationBreakdown {
  if (breakdown.allEasy) return breakdown;

  let warmupMin = Math.max(breakdown.warmupMin, EXTENDED_WARM_COOL_MIN);
  let cooldownMin = Math.max(breakdown.cooldownMin, EXTENDED_WARM_COOL_MIN);
  let mainMinutes = breakdown.totalMinutes - warmupMin - cooldownMin;

  if (mainMinutes < MIN_MAIN_MINUTES) {
    const deficit = MIN_MAIN_MINUTES - mainMinutes;
    warmupMin = Math.max(0, warmupMin - Math.ceil(deficit / 2));
    cooldownMin = Math.max(0, cooldownMin - Math.floor(deficit / 2));
    mainMinutes = breakdown.totalMinutes - warmupMin - cooldownMin;
  }

  return { ...breakdown, warmupMin, cooldownMin, mainMinutes };
}

/**
 * Applies JOINT_ISSUES's `durationCapMin` then `extendWarmCool` to an already
 * tier-adjusted total. Safe to call unconditionally.
 */
export function applyHealthDurationRules(
  totalMinutes: number,
  health: HealthAdjustment,
): DurationBreakdown {
  const capped =
    health.durationCapMin != null
      ? Math.min(totalMinutes, health.durationCapMin)
      : totalMinutes;
  const breakdown = computeDurationBreakdown(capped);
  return health.extendWarmCool ? extendWarmCool(breakdown) : breakdown;
}
