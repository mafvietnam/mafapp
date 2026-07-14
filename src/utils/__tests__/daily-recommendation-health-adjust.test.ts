/**
 * Tests for daily-recommendation-health-adjust.ts — JOINT_ISSUES duration
 * cap + extended warm/cool post-processing (companion to daily-recommendation-
 * engine.ts's GREEN/AMBER branches).
 */
import { describe, it, expect } from 'vitest';
import { applyHealthDurationRules } from '../daily-recommendation-health-adjust';
import type { HealthAdjustment } from '../health-condition-rules';

function health(overrides: Partial<HealthAdjustment> = {}): HealthAdjustment {
  return {
    forceHealthCommitment: false,
    requiresClearanceGate: false,
    tierFloor: 'AMBER',
    mafDelta: 0,
    durationCapMin: null,
    walkFirst: false,
    extendWarmCool: false,
    reasons: [],
    needsSafetyCard: true,
    ...overrides,
  };
}

describe('applyHealthDurationRules', () => {
  it('neither lever set => identical to plain computeDurationBreakdown', () => {
    const result = applyHealthDurationRules(45, health());
    expect(result).toEqual({ totalMinutes: 45, warmupMin: 9, cooldownMin: 9, mainMinutes: 27, allEasy: false });
  });

  it('durationCapMin caps a longer total down before breakdown', () => {
    const result = applyHealthDurationRules(90, health({ durationCapMin: 60 }));
    expect(result.totalMinutes).toBe(60);
  });

  it('durationCapMin has no effect when total is already under the cap', () => {
    const result = applyHealthDurationRules(45, health({ durationCapMin: 60 }));
    expect(result.totalMinutes).toBe(45);
  });

  it('extendWarmCool stretches warm/cool to >=15min on a non-all-easy session', () => {
    const result = applyHealthDurationRules(45, health({ extendWarmCool: true }));
    expect(result.warmupMin).toBe(15);
    expect(result.cooldownMin).toBe(15);
    expect(result.mainMinutes).toBe(15);
    expect(result.totalMinutes).toBe(45);
  });

  it('extendWarmCool leaves all-easy (<35min) sessions untouched', () => {
    const result = applyHealthDurationRules(30, health({ extendWarmCool: true }));
    expect(result.allEasy).toBe(true);
    expect(result.warmupMin).toBe(0);
    expect(result.cooldownMin).toBe(0);
    expect(result.mainMinutes).toBe(30);
  });

  it('extendWarmCool never starves mainMinutes below 5 — shrinks symmetrically instead', () => {
    // total=35 (just above all-easy threshold): 15+15=30 leaves 5 main, exactly at the floor.
    const result = applyHealthDurationRules(35, health({ extendWarmCool: true }));
    expect(result.mainMinutes).toBeGreaterThanOrEqual(5);
    expect(result.warmupMin + result.cooldownMin + result.mainMinutes).toBe(35);
  });

  it('durationCapMin + extendWarmCool compose: cap first, then extend on the capped total', () => {
    const result = applyHealthDurationRules(90, health({ durationCapMin: 60, extendWarmCool: true }));
    expect(result.totalMinutes).toBe(60);
    expect(result.warmupMin).toBe(15);
    expect(result.cooldownMin).toBe(15);
    expect(result.mainMinutes).toBe(30);
  });

  it('capping down into the all-easy band (<35min) then extending leaves it untouched', () => {
    const result = applyHealthDurationRules(40, health({ durationCapMin: 30, extendWarmCool: true }));
    expect(result.allEasy).toBe(true);
    expect(result.mainMinutes).toBe(30);
  });
});
