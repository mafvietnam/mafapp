import { buildStructuredInput } from './coaching-prompt.js';
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
    tier: 'AMBER',
    reasons: [
      {
        code: 'soreness_warn',
        severity: 'warn',
        bookRef: 'CH7',
        text: 'Bạn báo đau nhức (một ghi chú tự do bất kỳ của người dùng ở đây) — chuyển sang vận động nhẹ nhàng hơn.',
      },
    ],
    citations: ['CH5', 'CH6', 'CH7'],
    adjustmentNote: 'Đã giảm còn 30 phút vì bạn báo đau nhức.',
    ...overrides,
  };
}

describe('buildStructuredInput — RED TEAM FIX #1 trust boundary', () => {
  it('includes only tier/dayType/numbers/hrZone/reasonCodes/citations', () => {
    const structured = buildStructuredInput(rec());
    expect(Object.keys(structured).sort()).toEqual(
      [
        'tier',
        'dayType',
        'totalMinutes',
        'warmupMin',
        'mainMinutes',
        'cooldownMin',
        'hrZone',
        'reasonCodes',
        'citations',
      ].sort(),
    );
  });

  it('reasonCodes are the enum `code` strings only — never `text` (which can embed a user free-tag)', () => {
    const structured = buildStructuredInput(rec());
    expect(structured.reasonCodes).toEqual(['soreness_warn']);
    const serialized = JSON.stringify(structured);
    expect(serialized).not.toContain(
      'một ghi chú tự do bất kỳ của người dùng ở đây',
    );
  });

  it('never forwards title/restCopy/adjustmentNote (VN prose, out of the structured-only contract)', () => {
    const structured = buildStructuredInput(
      rec({ restCopy: 'some VN prose that must not leak' }),
    );
    const serialized = JSON.stringify(structured);
    expect(serialized).not.toContain('Chạy nhẹ nhàng'); // title
    expect(serialized).not.toContain('Đã giảm còn 30 phút'); // adjustmentNote
    expect(serialized).not.toContain('must not leak'); // restCopy
  });

  it('hrZone null passes through as null (child / mafHr<=0 case)', () => {
    const structured = buildStructuredInput(rec({ hrZone: null }));
    expect(structured.hrZone).toBeNull();
  });

  it('carries the numeric fields and citations verbatim', () => {
    const structured = buildStructuredInput(rec());
    expect(structured.totalMinutes).toBe(45);
    expect(structured.warmupMin).toBe(9);
    expect(structured.mainMinutes).toBe(27);
    expect(structured.cooldownMin).toBe(9);
    expect(structured.citations).toEqual(['CH5', 'CH6', 'CH7']);
  });
});
