import { buildTemplateNarrative } from './template-narrative.js';
import type { DailyRecommendation } from './recompute/recompute-types.js';

function rec(
  overrides: Partial<DailyRecommendation> = {},
): DailyRecommendation {
  return {
    dayType: 'RUN',
    title: 'Chạy nhẹ nhàng 45 phút',
    totalMinutes: 45,
    warmupMin: 9,
    cooldownMin: 9,
    mainMinutes: 27,
    allEasy: false,
    hrZone: { lower: 135, upper: 145 },
    tier: 'GREEN',
    reasons: [],
    citations: ['CH5', 'CH6'],
    ...overrides,
  };
}

describe('buildTemplateNarrative — deterministic, always-available fallback', () => {
  it('REST day uses rec.restCopy verbatim', () => {
    const narrative = buildTemplateNarrative(
      rec({
        dayType: 'REST',
        totalMinutes: 0,
        warmupMin: 0,
        cooldownMin: 0,
        mainMinutes: 0,
        hrZone: null,
        restCopy: 'Hôm nay nên NGHỈ.',
      }),
    );
    expect(narrative).toBe('Hôm nay nên NGHỈ.');
  });

  it('RUN day includes the duration, HR zone, and a warm sign-off', () => {
    const narrative = buildTemplateNarrative(rec());
    expect(narrative).toContain('45 phút');
    expect(narrative).toContain('135–145 bpm');
    expect(narrative).toContain('Cứ chậm mà chắc!');
  });

  it('allEasy session describes an easy pace instead of a warm/main/cool breakdown', () => {
    const narrative = buildTemplateNarrative(
      rec({
        totalMinutes: 30,
        warmupMin: 0,
        cooldownMin: 0,
        mainMinutes: 30,
        allEasy: true,
      }),
    );
    expect(narrative).toContain('nhẹ nhàng, thoải mái');
    expect(narrative).not.toContain('Khởi động');
  });

  it('appends adjustmentNote when present', () => {
    const narrative = buildTemplateNarrative(
      rec({ adjustmentNote: 'Đã giảm còn 30 phút vì bạn khá mệt.' }),
    );
    expect(narrative).toContain('Đã giảm còn 30 phút vì bạn khá mệt.');
  });

  it('is deterministic for identical input', () => {
    const a = buildTemplateNarrative(rec());
    const b = buildTemplateNarrative(rec());
    expect(a).toBe(b);
  });
});
