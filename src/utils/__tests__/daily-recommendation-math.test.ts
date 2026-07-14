/**
 * Direct tests for the RED TEAM FIX #13 duration-breakdown math (split out of
 * daily-recommendation-engine.test.ts since this is the safety-critical
 * primitive — "never a degenerate 0-minute main set").
 */

import { describe, it, expect } from 'vitest';
import { computeDurationBreakdown, roundToNearest5 } from '../daily-recommendation-math';

describe('roundToNearest5', () => {
  it.each([
    [29.25, 30],
    [0, 0],
    [12, 10],
    [13, 15],
    [7.5, 10],
    [2, 0],
  ])('roundToNearest5(%f) => %i', (input, expected) => {
    expect(roundToNearest5(input)).toBe(expected);
  });
});

describe('computeDurationBreakdown', () => {
  it('total<=0 => everything zero, allEasy=true (REST-equivalent)', () => {
    expect(computeDurationBreakdown(0)).toEqual({ totalMinutes: 0, warmupMin: 0, cooldownMin: 0, mainMinutes: 0, allEasy: true });
    expect(computeDurationBreakdown(-5)).toEqual({ totalMinutes: 0, warmupMin: 0, cooldownMin: 0, mainMinutes: 0, allEasy: true });
  });

  it('total<35 => all-easy band, warm/cool folded into main (RED TEAM FIX #13)', () => {
    expect(computeDurationBreakdown(30)).toEqual({ totalMinutes: 30, warmupMin: 0, cooldownMin: 0, mainMinutes: 30, allEasy: true });
    expect(computeDurationBreakdown(34)).toEqual({ totalMinutes: 34, warmupMin: 0, cooldownMin: 0, mainMinutes: 34, allEasy: true });
  });

  it('total=35 (boundary) => NOT all-easy; proportional warm/cool applies', () => {
    const b = computeDurationBreakdown(35);
    expect(b.allEasy).toBe(false);
    expect(b.warmupMin).toBe(7); // clamp(round(35*0.2),5,15) = 7
    expect(b.cooldownMin).toBe(7);
    expect(b.mainMinutes).toBe(21);
  });

  it('warmup/cooldown clamp at the 5min floor for small-but->=35 totals', () => {
    // 0.2*35=7 already >5, so use a value where round(total*0.2) would dip below 5 if unclamped — not
    // reachable since threshold is 35, but verify the clamp floor constant directly at total=35..40.
    const b = computeDurationBreakdown(36);
    expect(b.warmupMin).toBeGreaterThanOrEqual(5);
  });

  it('warmup/cooldown clamp at the 15min ceiling for large totals', () => {
    const b = computeDurationBreakdown(120); // 0.2*120=24 -> clamp to 15
    expect(b.warmupMin).toBe(15);
    expect(b.cooldownMin).toBe(15);
    expect(b.mainMinutes).toBe(90);
  });

  it('mainMinutes never drops below 5 for any total>=35 across a sweep', () => {
    for (let total = 35; total <= 200; total += 1) {
      const b = computeDurationBreakdown(total);
      expect(b.mainMinutes).toBeGreaterThanOrEqual(5);
      expect(b.warmupMin + b.cooldownMin + b.mainMinutes).toBe(b.totalMinutes);
    }
  });

  it('fractional totals are rounded before splitting', () => {
    const b = computeDurationBreakdown(44.6);
    expect(b.totalMinutes).toBe(45);
  });
});
