import {
  buildDailyRecommendation,
  type RecommendationInput,
} from './daily-recommendation-engine.js';
import type {
  ScheduleItem,
  ReadinessResult,
  ReasonCode,
  ReadinessTier,
} from './recompute-types.js';
import type { HealthAdjustment } from './health-condition-rules.js';

function scheduleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    day: 'Thứ 3',
    activity: 'Chạy MAF',
    duration: 45,
    type: 'RUN',
    ...overrides,
  };
}

function readiness(
  tier: ReadinessTier,
  reasons: ReasonCode[] = [],
): ReadinessResult {
  return { tier, score: 0, reasons };
}

function input(
  overrides: Partial<RecommendationInput> = {},
): RecommendationInput {
  return {
    adjustedScheduleItem: scheduleItem(),
    mafHr: 145,
    readiness: readiness('GREEN'),
    profile: { age: 35 },
    ...overrides,
  };
}

function jointHealth(
  overrides: Partial<HealthAdjustment> = {},
): HealthAdjustment {
  return {
    forceHealthCommitment: false,
    requiresClearanceGate: false,
    tierFloor: 'AMBER',
    mafDelta: 0,
    durationCapMin: 60,
    walkFirst: true,
    extendWarmCool: true,
    reasons: [],
    needsSafetyCard: true,
    ...overrides,
  };
}

describe('child (age<16) short-circuit', () => {
  it('returns play-only REST with no HR zone, no citations, GREEN tier — even when readiness is RED', () => {
    const rec = buildDailyRecommendation(
      input({
        profile: { age: 8 },
        readiness: readiness('RED', [
          { code: 'rhr_bad', severity: 'bad', text: 'x' },
        ]),
      }),
    );
    expect(rec.dayType).toBe('REST');
    expect(rec.hrZone).toBeNull();
    expect(rec.totalMinutes).toBe(0);
    expect(rec.citations).toEqual([]);
    expect(rec.reasons).toEqual([]);
    expect(rec.tier).toBe('GREEN');
  });
});

describe('GREEN tier', () => {
  it('RUN 45min => title, proportional warm/cool, MAF zone, CH5/CH6 citations', () => {
    const rec = buildDailyRecommendation(input());
    expect(rec.dayType).toBe('RUN');
    expect(rec.title).toBe('Chạy nhẹ nhàng 45 phút');
    expect(rec.totalMinutes).toBe(45);
    expect(rec.hrZone).toEqual({ lower: 135, upper: 145 });
    expect(rec.citations).toEqual(['CH5', 'CH6']);
  });

  it('scheduled REST day stays REST', () => {
    const rec = buildDailyRecommendation(
      input({
        adjustedScheduleItem: scheduleItem({ type: 'REST', duration: 0 }),
      }),
    );
    expect(rec.dayType).toBe('REST');
    expect(rec.citations).toEqual(['CH7']);
  });

  it('hrZone is null when mafHr<=0', () => {
    const rec = buildDailyRecommendation(input({ mafHr: 0 }));
    expect(rec.hrZone).toBeNull();
  });
});

describe('AMBER duration math', () => {
  it('45min AMBER -35% => 30min, all-easy', () => {
    const rec = buildDailyRecommendation(
      input({
        readiness: readiness('AMBER', [
          { code: 'sleep_warn', severity: 'warn', text: 'x' },
        ]),
      }),
    );
    expect(rec.totalMinutes).toBe(30);
    expect(rec.allEasy).toBe(true);
    expect(rec.citations).toEqual(['CH5', 'CH6', 'CH7']);
  });

  it('soreness_warn swaps RUN => WALK on AMBER', () => {
    const rec = buildDailyRecommendation(
      input({
        readiness: readiness('AMBER', [
          { code: 'soreness_warn', severity: 'warn', text: 'x' },
        ]),
      }),
    );
    expect(rec.dayType).toBe('WALK');
  });
});

describe('RED is REST or gentle WALK only, NEVER a run', () => {
  const scheduledTypes: ScheduleItem['type'][] = [
    'RUN',
    'LONG_RUN',
    'WALK',
    'CROSS_TRAIN',
    'RECOVERY',
  ];

  it.each(scheduledTypes)(
    'RED always yields dayType=REST regardless of scheduled type (%s)',
    (type) => {
      const rec = buildDailyRecommendation(
        input({
          adjustedScheduleItem: scheduleItem({ type, duration: 60 }),
          readiness: readiness('RED', [
            { code: 'rhr_bad', severity: 'bad', bookRef: 'CH7', text: 'x' },
          ]),
        }),
      );
      expect(rec.dayType).toBe('REST');
      expect(rec.totalMinutes).toBe(0);
      expect(rec.citations).toEqual(['CH7']);
    },
  );
});

describe('healthAdjustment (JOINT_ISSUES)', () => {
  it('walkFirst swaps RUN => WALK on GREEN and adds the joint adjustmentNote', () => {
    const rec = buildDailyRecommendation(
      input({ healthAdjustment: jointHealth() }),
    );
    expect(rec.dayType).toBe('WALK');
    expect(rec.adjustmentNote).toContain('bảo vệ khớp');
  });

  it('durationCapMin caps a longer GREEN session', () => {
    const rec = buildDailyRecommendation(
      input({
        adjustedScheduleItem: scheduleItem({ duration: 90, type: 'RUN' }),
        healthAdjustment: jointHealth({
          walkFirst: false,
          extendWarmCool: false,
          durationCapMin: 60,
        }),
      }),
    );
    expect(rec.totalMinutes).toBe(60);
  });

  it('RED still reachable — healthAdjustment never overrides RED (REST/WALK-only stays intact)', () => {
    const rec = buildDailyRecommendation(
      input({
        readiness: readiness('RED', [
          { code: 'rhr_bad', severity: 'bad', text: 'x' },
        ]),
        healthAdjustment: jointHealth(),
      }),
    );
    expect(rec.dayType).toBe('REST');
  });
});
