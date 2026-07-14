/**
 * Pure JOINT_ISSUES duration post-processing for an already tier-adjusted
 * total-minutes value: duration cap then extended warm-up/cool-down (mirrors
 * the existing senior 15/15 rule — MAF_RULES_SUMMARY §2 — reusing
 * computeDurationBreakdown's clamp/round rules for consistency, RED TEAM
 * FIX #13). No React, no I/O. Kept out of daily-recommendation-engine.ts to
 * stay under the 200-LOC modularization guideline (companion module to
 * daily-recommendation-math.ts).
 */
import { computeDurationBreakdown, type DurationBreakdown } from './daily-recommendation-math';
import type { HealthAdjustment } from './health-condition-rules';

const EXTENDED_WARM_COOL_MIN = 15; // mirrors MAF_RULES_SUMMARY §2 senior 15/15 rule
const MIN_MAIN_MINUTES = 5; // mirrors daily-recommendation-math.ts's own floor (RED TEAM FIX #13)

/**
 * Stretches warm-up/cool-down to >=15min each on a non-all-easy breakdown,
 * shrinking symmetrically if that would starve the main set below 5min
 * (mirrors computeDurationBreakdown's own deficit correction). All-easy
 * (short, <35min) sessions are left untouched — extending warm/cool on an
 * already-easy-paced short session would starve the main set for no benefit.
 */
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
 * tier-adjusted total. Safe to call unconditionally — when neither lever is
 * set, returns the plain `computeDurationBreakdown(totalMinutes)` result
 * (identical to callers that never pass a HealthAdjustment).
 */
export function applyHealthDurationRules(totalMinutes: number, health: HealthAdjustment): DurationBreakdown {
  const capped = health.durationCapMin != null ? Math.min(totalMinutes, health.durationCapMin) : totalMinutes;
  const breakdown = computeDurationBreakdown(capped);
  return health.extendWarmCool ? extendWarmCool(breakdown) : breakdown;
}
