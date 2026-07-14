import {
  computeDurationBreakdown,
  roundToNearest5,
} from './daily-recommendation-math.js';

describe('roundToNearest5', () => {
  it('rounds to the nearest multiple of 5', () => {
    expect(roundToNearest5(29.25)).toBe(30); // 45 * 0.65 AMBER worked example
    expect(roundToNearest5(58.5)).toBe(60);
    expect(roundToNearest5(0)).toBe(0);
  });
});

describe('computeDurationBreakdown', () => {
  it('total<=0 => everything zero, allEasy true', () => {
    expect(computeDurationBreakdown(0)).toEqual({
      totalMinutes: 0,
      warmupMin: 0,
      cooldownMin: 0,
      mainMinutes: 0,
      allEasy: true,
    });
    expect(computeDurationBreakdown(-10)).toEqual({
      totalMinutes: 0,
      warmupMin: 0,
      cooldownMin: 0,
      mainMinutes: 0,
      allEasy: true,
    });
  });

  it('total<35 => all-easy, warm/cool folded into main', () => {
    const result = computeDurationBreakdown(30);
    expect(result).toEqual({
      totalMinutes: 30,
      warmupMin: 0,
      cooldownMin: 0,
      mainMinutes: 30,
      allEasy: true,
    });
  });

  it('45min => proportional warm/cool clamp(round(45*0.2),5,15)=9, main=27', () => {
    const result = computeDurationBreakdown(45);
    expect(result).toEqual({
      totalMinutes: 45,
      warmupMin: 9,
      cooldownMin: 9,
      mainMinutes: 27,
      allEasy: false,
    });
  });

  it('warmup/cooldown clamp at 15 for a large session', () => {
    const result = computeDurationBreakdown(120);
    expect(result.warmupMin).toBe(15);
    expect(result.cooldownMin).toBe(15);
    expect(result.mainMinutes).toBe(90);
  });

  it('warmup/cooldown clamp at 5 minimum and mainMinutes never drops below 5', () => {
    const result = computeDurationBreakdown(35);
    expect(result.warmupMin).toBeGreaterThanOrEqual(5);
    expect(result.mainMinutes).toBeGreaterThanOrEqual(5);
    expect(result.warmupMin + result.cooldownMin + result.mainMinutes).toBe(35);
  });
});
