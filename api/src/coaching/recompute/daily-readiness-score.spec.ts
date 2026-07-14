import {
  computeReadiness,
  type ReadinessInput,
  type ReadinessProfile,
} from './daily-readiness-score.js';
import type { RecomputeActivity, RecomputeCheckin } from './recompute-types.js';

const TODAY = new Date('2026-07-14T00:00:00.000Z');

function profile(overrides: Partial<ReadinessProfile> = {}): ReadinessProfile {
  return {
    isProbation: false,
    isRecovering: false,
    isMedicatedOrInjured: false,
    ...overrides,
  };
}

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    recentActivities: [],
    checkin: null,
    rhrHistory: [],
    profile: profile(),
    today: TODAY,
    ...overrides,
  };
}

function checkin(overrides: Partial<RecomputeCheckin> = {}): RecomputeCheckin {
  return {
    sleepQuality: 4,
    fatigue: 2,
    soreness: null,
    restingHr: null,
    ...overrides,
  };
}

describe('graceful degradation — zero check-in, zero activity => GREEN', () => {
  it('empty everything yields GREEN with no reasons', () => {
    const result = computeReadiness(input());
    expect(result.tier).toBe('GREEN');
    expect(result.reasons).toEqual([]);
  });
});

describe('RHR signal — needs >=7 days history', () => {
  it('fewer than 7 days of history => signal ignored entirely', () => {
    const result = computeReadiness(
      input({ rhrHistory: [50, 51, 50], checkin: checkin({ restingHr: 70 }) }),
    );
    expect(
      result.reasons.find((r) => r.code.startsWith('rhr_')),
    ).toBeUndefined();
  });

  it('+7bpm over a >=7-day baseline => rhr_bad => RED', () => {
    const history = [50, 50, 50, 50, 50, 50, 50];
    const result = computeReadiness(
      input({ rhrHistory: history, checkin: checkin({ restingHr: 57 }) }),
    );
    expect(result.reasons.some((r) => r.code === 'rhr_bad')).toBe(true);
    expect(result.tier).toBe('RED');
  });

  it('+5bpm over baseline => rhr_warn => AMBER', () => {
    const history = [50, 50, 50, 50, 50, 50, 50];
    const result = computeReadiness(
      input({ rhrHistory: history, checkin: checkin({ restingHr: 55 }) }),
    );
    expect(result.reasons.some((r) => r.code === 'rhr_warn')).toBe(true);
    expect(result.tier).toBe('AMBER');
  });
});

describe('sleep + fatigue + soreness signals', () => {
  it('low sleepQuality => sleep_warn', () => {
    const result = computeReadiness(
      input({ checkin: checkin({ sleepQuality: 1 }) }),
    );
    expect(result.reasons.some((r) => r.code === 'sleep_warn')).toBe(true);
  });

  it('fatigue>=5 => fatigue_bad (bad severity) => RED', () => {
    const result = computeReadiness(
      input({ checkin: checkin({ fatigue: 5 }) }),
    );
    expect(result.reasons.some((r) => r.code === 'fatigue_bad')).toBe(true);
    expect(result.tier).toBe('RED');
  });

  it('soreness free-tag (non-"none") => soreness_warn, text embeds the raw tag (never sent to the LLM — see coaching-prompt.ts)', () => {
    const result = computeReadiness(
      input({ checkin: checkin({ soreness: 'đầu gối' }) }),
    );
    const reason = result.reasons.find((r) => r.code === 'soreness_warn');
    expect(reason?.text).toContain('đầu gối');
  });

  it('soreness="none" => no reason', () => {
    const result = computeReadiness(
      input({ checkin: checkin({ soreness: 'none' }) }),
    );
    expect(
      result.reasons.find((r) => r.code === 'soreness_warn'),
    ).toBeUndefined();
  });
});

describe('load-spike signal', () => {
  function activity(daysAgo: number, km: number): RecomputeActivity {
    return {
      startDate: new Date(TODAY.getTime() - daysAgo * 86400000 + 3600000),
      distanceMeters: km * 1000,
    };
  }

  it('no prior-week baseline => never fires (no fabricated spike from zero history)', () => {
    const result = computeReadiness(
      input({ recentActivities: [activity(1, 50)] }),
    );
    expect(result.reasons.find((r) => r.code === 'load_spike')).toBeUndefined();
  });

  it('last-7-day km > 1.5x prior week AND delta>=5km => load_spike', () => {
    const activities = [activity(10, 10), activity(1, 20)]; // prior week 10km, last week 20km
    const result = computeReadiness(input({ recentActivities: activities }));
    expect(result.reasons.some((r) => r.code === 'load_spike')).toBe(true);
  });
});

describe('tier composition', () => {
  it('2+ warn reasons => RED (even with no bad reason)', () => {
    const result = computeReadiness(
      input({ checkin: checkin({ sleepQuality: 1, fatigue: 4 }) }),
    );
    expect(result.tier).toBe('RED');
  });

  it('medicated_or_injured profile flag adds a warn reason', () => {
    const result = computeReadiness(
      input({ profile: profile({ isMedicatedOrInjured: true }) }),
    );
    expect(result.reasons.some((r) => r.code === 'medicated_or_injured')).toBe(
      true,
    );
    expect(result.tier).toBe('AMBER');
  });
});

describe('AMBER floor — never a ceiling', () => {
  it('isProbation floors GREEN => AMBER via profile_floor reason', () => {
    const result = computeReadiness(
      input({ profile: profile({ isProbation: true }) }),
    );
    expect(result.tier).toBe('AMBER');
    expect(result.reasons.some((r) => r.code === 'profile_floor')).toBe(true);
  });

  it('a bad signal still reaches RED even for a probation/recovering user (floor is a MINIMUM, not a cap)', () => {
    const result = computeReadiness(
      input({
        profile: profile({ isProbation: true }),
        checkin: checkin({ fatigue: 5 }),
      }),
    );
    expect(result.tier).toBe('RED');
  });

  it('external tierFloor="AMBER" (health-condition gate) floors GREEN => AMBER', () => {
    const result = computeReadiness(input(), 'AMBER');
    expect(result.tier).toBe('AMBER');
  });
});
