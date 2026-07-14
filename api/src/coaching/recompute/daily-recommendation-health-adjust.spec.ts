import { applyHealthDurationRules } from './daily-recommendation-health-adjust.js';
import type { HealthAdjustment } from './health-condition-rules.js';

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
  it('no active levers behaves exactly like computeDurationBreakdown', () => {
    const result = applyHealthDurationRules(45, health());
    expect(result).toEqual({
      totalMinutes: 45,
      warmupMin: 9,
      cooldownMin: 9,
      mainMinutes: 27,
      allEasy: false,
    });
  });

  it('durationCapMin caps total before the breakdown', () => {
    const result = applyHealthDurationRules(90, health({ durationCapMin: 60 }));
    expect(result.totalMinutes).toBe(60);
  });

  it('extendWarmCool stretches warm/cool to >=15min, shrinking symmetrically if it would starve main<5', () => {
    const result = applyHealthDurationRules(
      45,
      health({ extendWarmCool: true }),
    );
    expect(result.warmupMin).toBeGreaterThanOrEqual(15);
    expect(result.cooldownMin).toBeGreaterThanOrEqual(15);
    expect(result.mainMinutes).toBeGreaterThanOrEqual(5);
  });

  it('extendWarmCool is a no-op on an all-easy (<35min) breakdown', () => {
    const result = applyHealthDurationRules(
      30,
      health({ extendWarmCool: true }),
    );
    expect(result.allEasy).toBe(true);
    expect(result.warmupMin).toBe(0);
    expect(result.mainMinutes).toBe(30);
  });
});
