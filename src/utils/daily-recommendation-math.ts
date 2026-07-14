/**
 * Pure warm-up/cool-down + main-set duration math for daily-recommendation-engine.ts.
 * RED TEAM FIX #13: warm/cool are PROPORTIONAL (not fixed 15/15) so a reduced
 * session never degenerates to 0 main minutes; sessions under 35min fold
 * warm/cool entirely (all-easy band) instead of leaving a 0-minute main set.
 */

const ALL_EASY_THRESHOLD_MIN = 35;
const WARMUP_FRACTION = 0.2;
const WARMUP_MIN_CLAMP = 5;
const WARMUP_MAX_CLAMP = 15;
const MIN_MAIN_MINUTES = 5;

export interface DurationBreakdown {
  totalMinutes: number;
  warmupMin: number;
  cooldownMin: number;
  mainMinutes: number;
  allEasy: boolean;
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Round `n` to the nearest multiple of 5 (used for the AMBER -35% duration reduction). */
export function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Split a session's total minutes into warmup/main/cooldown.
 * - total<=0 -> everything zero (REST-equivalent).
 * - total<35 -> all-easy: warm/cool folded into the main set (RED TEAM FIX #13
 *   worked example: 45min AMBER -35% = 30 -> 30 all-easy main minutes, not 0).
 * - total>=35 -> warmup=cooldown=clamp(round(total*0.20),5,15); main floored >=5
 *   by shrinking warm/cool first (defensive — unreachable with these clamps at
 *   total>=35, kept in case thresholds are retuned later).
 */
export function computeDurationBreakdown(totalMinutes: number): DurationBreakdown {
  const total = Math.max(0, Math.round(totalMinutes));

  if (total <= 0) {
    return { totalMinutes: 0, warmupMin: 0, cooldownMin: 0, mainMinutes: 0, allEasy: true };
  }
  if (total < ALL_EASY_THRESHOLD_MIN) {
    return { totalMinutes: total, warmupMin: 0, cooldownMin: 0, mainMinutes: total, allEasy: true };
  }

  let warmup = clamp(Math.round(total * WARMUP_FRACTION), WARMUP_MIN_CLAMP, WARMUP_MAX_CLAMP);
  let cooldown = warmup;
  let main = total - warmup - cooldown;

  if (main < MIN_MAIN_MINUTES) {
    const deficit = MIN_MAIN_MINUTES - main;
    warmup = Math.max(0, warmup - Math.ceil(deficit / 2));
    cooldown = Math.max(0, cooldown - Math.floor(deficit / 2));
    main = total - warmup - cooldown;
  }

  return { totalMinutes: total, warmupMin: warmup, cooldownMin: cooldown, mainMinutes: main, allEasy: false };
}
