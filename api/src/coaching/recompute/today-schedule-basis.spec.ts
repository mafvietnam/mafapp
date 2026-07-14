import {
  computeMafHr,
  computeTodayScheduleItem,
  weekdayLabel,
  type MafHrProfile,
  type ScheduleSafetyProfile,
} from './today-schedule-basis.js';

function mafProfile(overrides: Partial<MafHrProfile> = {}): MafHrProfile {
  return {
    age: 40,
    isRecovering: false,
    isMedicatedOrInjured: false,
    isProbation: false,
    experience: 'NONE',
    ...overrides,
  };
}

function safetyProfile(
  overrides: Partial<ScheduleSafetyProfile> = {},
): ScheduleSafetyProfile {
  return {
    age: 40,
    bmi: 22,
    experience: 'NONE',
    isRecovering: false,
    isProbation: false,
    ...overrides,
  };
}

describe('weekdayLabel', () => {
  it('maps a UTC-midnight Date to the VN weekday label used by SCHEDULES', () => {
    // 2026-07-14 is a Tuesday
    expect(weekdayLabel(new Date('2026-07-14T00:00:00.000Z'))).toBe('Thứ 3');
    // 2026-07-12 is a Sunday
    expect(weekdayLabel(new Date('2026-07-12T00:00:00.000Z'))).toBe('Chủ Nhật');
  });
});

describe('computeMafHr', () => {
  it('180-formula baseline: 180 - age', () => {
    expect(computeMafHr(mafProfile({ age: 40 }))).toBe(140);
  });

  it('isRecovering => -10', () => {
    expect(computeMafHr(mafProfile({ isRecovering: true }))).toBe(130);
  });

  it('isMedicatedOrInjured => -5', () => {
    expect(computeMafHr(mafProfile({ isMedicatedOrInjured: true }))).toBe(135);
  });

  it('isProbation => -10', () => {
    expect(computeMafHr(mafProfile({ isProbation: true }))).toBe(130);
  });

  it('ADVANCED experience => +5; INCONSISTENT => -5', () => {
    expect(computeMafHr(mafProfile({ experience: 'ADVANCED' }))).toBe(145);
    expect(computeMafHr(mafProfile({ experience: 'INCONSISTENT' }))).toBe(135);
  });

  it('all adjustments stack', () => {
    expect(
      computeMafHr(
        mafProfile({
          isRecovering: true,
          isMedicatedOrInjured: true,
          isProbation: true,
          experience: 'INCONSISTENT',
        }),
      ),
    ).toBe(140 - 10 - 5 - 10 - 5);
  });
});

describe('computeTodayScheduleItem', () => {
  it('selects the BASE-commitment Tuesday RUN 60min with no adjustments', () => {
    const item = computeTodayScheduleItem('BASE', 'Thứ 3', safetyProfile());
    expect(item).toEqual({
      type: 'RUN',
      duration: 60,
      day: 'Thứ 3',
      activity: '',
    });
  });

  it('RULE 1 — BMI>=30 converts a RUN/LONG_RUN day to low-impact WALK', () => {
    const item = computeTodayScheduleItem(
      'BASE',
      'Thứ 7',
      safetyProfile({ bmi: 32 }),
    ); // Sat = LONG_RUN 90min
    expect(item.type).toBe('WALK');
  });

  it('RULE 1 — BMI>=30 does not touch an already-REST day', () => {
    const item = computeTodayScheduleItem(
      'BASE',
      'Thứ 2',
      safetyProfile({ bmi: 32 }),
    ); // Mon = REST
    expect(item.type).toBe('REST');
  });

  it('RULE 2 — newbie (NONE/INCONSISTENT) caps duration at 60min', () => {
    const item = computeTodayScheduleItem(
      'BASE',
      'Thứ 7',
      safetyProfile({ experience: 'NONE' }),
    ); // 90min LONG_RUN
    expect(item.duration).toBe(60);
  });

  it('RULE 3 — senior (age>=60) caps duration at 90min', () => {
    const item = computeTodayScheduleItem(
      'PERFORMANCE',
      'Thứ 7',
      safetyProfile({ age: 65, experience: 'ADVANCED' }),
    ); // 120min LONG_RUN
    expect(item.duration).toBe(90);
  });

  it('RULE 4 — isRecovering converts RUN/LONG_RUN to WALK capped at 45min', () => {
    const item = computeTodayScheduleItem(
      'BASE',
      'Thứ 3',
      safetyProfile({ isRecovering: true, experience: 'ADVANCED' }),
    ); // 60min RUN
    expect(item.type).toBe('WALK');
    expect(item.duration).toBe(45);
  });

  it('probation reduces duration by 30%, floored at 15min', () => {
    const item = computeTodayScheduleItem(
      'BASE',
      'Thứ 3',
      safetyProfile({ isProbation: true, experience: 'ADVANCED' }),
    ); // 60min RUN
    expect(item.duration).toBe(42); // round(60*0.7)
  });

  it('probation floors a small reduced session at 15min', () => {
    const item = computeTodayScheduleItem(
      'HEALTH',
      'Thứ 3',
      safetyProfile({ isProbation: true, experience: 'ADVANCED' }),
    ); // 30min RUN -> 21, still >15
    expect(item.duration).toBeGreaterThanOrEqual(15);
  });

  it('falls back to the template first entry when the weekday label is unrecognized', () => {
    const item = computeTodayScheduleItem('BASE', 'not-a-day', safetyProfile());
    expect(item.day).toBe('Thứ 2');
  });
});
