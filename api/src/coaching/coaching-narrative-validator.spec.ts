import { isNarrativeSafe } from './coaching-narrative-validator.js';
import type { StructuredCoachingInput } from './coaching-prompt.js';

function structuredInput(
  overrides: Partial<StructuredCoachingInput> = {},
): StructuredCoachingInput {
  return {
    tier: 'GREEN',
    dayType: 'RUN',
    totalMinutes: 45,
    warmupMin: 9,
    mainMinutes: 27,
    cooldownMin: 9,
    hrZone: { lower: 135, upper: 145 },
    reasonCodes: [],
    citations: ['CH5', 'CH6'],
    ...overrides,
  };
}

describe('isNarrativeSafe', () => {
  it('accepts narrative text that only reuses numbers present in the input', () => {
    const narrative =
      'Hôm nay chạy nhẹ 45 phút trong vùng 135–145 bpm. Khởi động 9 phút và thả lỏng 9 phút.';
    expect(isNarrativeSafe(narrative, structuredInput())).toBe(true);
  });

  it('accepts a chapter number reference (e.g. "Chương 7") drawn from citations', () => {
    const narrative = 'Chạy 45 phút nhé (Chương 6).';
    expect(
      isNarrativeSafe(narrative, structuredInput({ citations: ['CH6'] })),
    ).toBe(true);
  });

  it('rejects a narrative that invents a heart-rate number not in the input', () => {
    const narrative = 'Giữ nhịp tim dưới 160 bpm nhé.';
    expect(isNarrativeSafe(narrative, structuredInput())).toBe(false);
  });

  it('rejects a narrative that invents a duration not in the input', () => {
    const narrative = 'Chạy 90 phút hôm nay.';
    expect(isNarrativeSafe(narrative, structuredInput())).toBe(false);
  });

  it('rejects empty output', () => {
    expect(isNarrativeSafe('   ', structuredInput())).toBe(false);
  });

  it('rejects oversized output (sanity cap)', () => {
    const narrative = 'a'.repeat(1600);
    expect(isNarrativeSafe(narrative, structuredInput())).toBe(false);
  });

  it('accepts narrative with no digits at all', () => {
    expect(
      isNarrativeSafe(
        'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
        structuredInput(),
      ),
    ).toBe(true);
  });
});
