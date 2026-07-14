/**
 * Tests for daily-readiness-score.ts. Covers every RED TEAM FIX called out in
 * phase-01: #3 (AMBER floor, not ceiling), #5 (Garmin bonus-only + RHR n>=7
 * guard + zero-data day-1 GREEN), plus each individual signal and the
 * additive-penalty tier mapping.
 */

import { describe, it, expect } from 'vitest';
import type { StravaActivity } from '../../services/strava-service';
import type { GarminDailySummary } from '../../services/garmin-service';
import type { DailyCheckin } from '../../types';
import { computeReadiness, type ReadinessInput, type ReadinessProfile } from '../daily-readiness-score';

const TODAY = new Date(2026, 6, 14); // Tuesday, local midnight

function profile(overrides: Partial<ReadinessProfile> = {}): ReadinessProfile {
  return { age: 35, bmi: 22, isProbation: false, isRecovering: false, isMedicatedOrInjured: false, ...overrides };
}

function checkin(overrides: Partial<DailyCheckin> = {}): DailyCheckin {
  return { id: 'c1', date: '2026-07-14', sleepQuality: 4, fatigue: 2, soreness: null, note: null, restingHr: null, ...overrides };
}

function summary(dateOffsetDays: number, overrides: Partial<GarminDailySummary> = {}): GarminDailySummary {
  const d = new Date(TODAY.getTime() - dateOffsetDays * 86400000);
  return {
    id: `s${dateOffsetDays}`,
    date: d.toISOString(),
    steps: 5000,
    restingHeartRate: 50,
    avgHeartRate: null,
    sleepDuration: 420,
    sleepScore: null,
    stressAvg: null,
    calories: null,
    activeMinutes: null,
    ...overrides,
  };
}

/** 14 days of baseline RHR at `bpm`, offsets 1..14 (excludes today = offset 0). */
function rhrBaseline(bpm: number, days = 14): GarminDailySummary[] {
  return Array.from({ length: days }, (_, i) => summary(i + 1, { restingHeartRate: bpm }));
}

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 'a1', stravaActivityId: 's1', source: 'STRAVA', name: 'Run', type: 'Run',
    startDate: new Date().toISOString(), distance: 5000, movingTime: 1800, elapsedTime: 1800,
    avgHeartRate: 140, maxHeartRate: 150, avgSpeed: 2.8, maxSpeed: 3.5, totalElevationGain: 10,
    calories: 300, avgPace: null, isDuplicate: false,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    recentActivities: [], dailySummaries: [], checkin: null, profile: profile(), today: TODAY,
    ...overrides,
  };
}

describe('graceful degradation (RED TEAM FIX #5)', () => {
  it('zero check-in + zero Garmin (day-1) => GREEN, no reasons, no crash', () => {
    const result = computeReadiness(baseInput());
    expect(result.tier).toBe('GREEN');
    expect(result.reasons).toEqual([]);
    expect(result.score).toBe(0);
  });
});

describe('RHR signal — n>=7 baseline guard (RED TEAM FIX #5)', () => {
  it('n<7 baseline days => RHR signal IGNORED even with a huge today delta', () => {
    const result = computeReadiness(
      baseInput({ dailySummaries: rhrBaseline(50, 6), checkin: checkin({ restingHr: 70 }) }),
    );
    expect(result.reasons.some((r) => r.code.startsWith('rhr_'))).toBe(false);
    expect(result.tier).toBe('GREEN');
  });

  it('n>=7 baseline + check-in restingHr +7bpm => bad + RED, with Ch7 citation', () => {
    const result = computeReadiness(
      baseInput({ dailySummaries: rhrBaseline(50, 7), checkin: checkin({ restingHr: 57 }) }),
    );
    const rhrReason = result.reasons.find((r) => r.code === 'rhr_bad');
    expect(rhrReason).toBeDefined();
    expect(rhrReason?.severity).toBe('bad');
    expect(rhrReason?.bookRef).toBe('CH7');
    expect(result.tier).toBe('RED');
  });

  it('+5bpm delta => warn (not bad), AMBER tier', () => {
    const result = computeReadiness(
      baseInput({ dailySummaries: rhrBaseline(50, 10), checkin: checkin({ restingHr: 55 }) }),
    );
    expect(result.reasons.find((r) => r.code === 'rhr_warn')).toBeDefined();
    expect(result.tier).toBe('AMBER');
  });

  it('check-in restingHr is PRIMARY over Garmin todaySummary', () => {
    const dailySummaries = [...rhrBaseline(50, 10), summary(0, { restingHeartRate: 90 })]; // today's Garmin says +40
    const result = computeReadiness(baseInput({ dailySummaries, checkin: checkin({ restingHr: 51 }) }));
    // check-in (51, delta ~1) wins over Garmin's 90 => no rhr reason
    expect(result.reasons.some((r) => r.code.startsWith('rhr_'))).toBe(false);
  });

  it('falls back to Garmin today value when no check-in restingHr present', () => {
    const dailySummaries = [...rhrBaseline(50, 10), summary(0, { restingHeartRate: 58 })];
    const result = computeReadiness(baseInput({ dailySummaries, checkin: null }));
    expect(result.reasons.find((r) => r.code === 'rhr_bad')).toBeDefined();
  });
});

describe('sleep signal', () => {
  it('check-in sleepQuality<=2 => warn', () => {
    const result = computeReadiness(baseInput({ checkin: checkin({ sleepQuality: 2 }) }));
    expect(result.reasons.find((r) => r.code === 'sleep_warn')).toBeDefined();
  });

  it('check-in sleepQuality present and fine => no warn, ignores Garmin', () => {
    const dailySummaries = [summary(0, { sleepDuration: 200 })]; // would warn if used
    const result = computeReadiness(baseInput({ checkin: checkin({ sleepQuality: 4 }), dailySummaries }));
    expect(result.reasons.some((r) => r.code === 'sleep_warn')).toBe(false);
  });

  it('falls back to Garmin sleepDuration<6h when no check-in', () => {
    const dailySummaries = [summary(0, { sleepDuration: 300 })];
    const result = computeReadiness(baseInput({ dailySummaries, checkin: null }));
    expect(result.reasons.find((r) => r.code === 'sleep_warn')).toBeDefined();
  });
});

describe('stress signal — Garmin bonus-only', () => {
  it('stressAvg>=60 => warn', () => {
    const dailySummaries = [summary(0, { stressAvg: 65 })];
    const result = computeReadiness(baseInput({ dailySummaries }));
    expect(result.reasons.find((r) => r.code === 'stress_warn')).toBeDefined();
  });

  it('missing stressAvg contributes nothing', () => {
    const result = computeReadiness(baseInput({ dailySummaries: [summary(0, { stressAvg: null })] }));
    expect(result.reasons.some((r) => r.code === 'stress_warn')).toBe(false);
  });
});

describe('fatigue/soreness signal', () => {
  it('fatigue>=5 => bad', () => {
    const result = computeReadiness(baseInput({ checkin: checkin({ fatigue: 5 }) }));
    expect(result.reasons.find((r) => r.code === 'fatigue_bad')).toBeDefined();
    expect(result.tier).toBe('RED');
  });

  it('fatigue>=4 (<5) => warn', () => {
    const result = computeReadiness(baseInput({ checkin: checkin({ fatigue: 4 }) }));
    expect(result.reasons.find((r) => r.code === 'fatigue_warn')).toBeDefined();
  });

  it('soreness present (non-"none") => warn with code soreness_warn', () => {
    const result = computeReadiness(baseInput({ checkin: checkin({ soreness: 'calf' }) }));
    expect(result.reasons.find((r) => r.code === 'soreness_warn')).toBeDefined();
  });

  it('soreness "none" => no reason', () => {
    const result = computeReadiness(baseInput({ checkin: checkin({ soreness: 'none' }) }));
    expect(result.reasons.some((r) => r.code === 'soreness_warn')).toBe(false);
  });
});

describe('load spike signal', () => {
  it('no prior-week baseline => never fabricates a spike', () => {
    const spikeActivities = Array.from({ length: 5 }, (_, i) => activity({
      id: `spike${i}`, startDate: new Date(TODAY.getTime() - i * 86400000).toISOString(), distance: 10000,
    }));
    const result = computeReadiness(baseInput({ recentActivities: spikeActivities }));
    expect(result.reasons.some((r) => r.code === 'load_spike')).toBe(false);
  });

  it('last-7-day km > 1.5x prior-7-day km (with >=5km absolute delta) => warn', () => {
    const prior = [activity({ id: 'p1', startDate: new Date(TODAY.getTime() - 10 * 86400000).toISOString(), distance: 5000 })];
    const recent = Array.from({ length: 3 }, (_, i) => activity({
      id: `r${i}`, startDate: new Date(TODAY.getTime() - i * 86400000).toISOString(), distance: 8000,
    }));
    const result = computeReadiness(baseInput({ recentActivities: [...prior, ...recent] }));
    expect(result.reasons.find((r) => r.code === 'load_spike')).toBeDefined();
  });
});

describe('medicated/injured profile flag', () => {
  it('always contributes a warn reason', () => {
    const result = computeReadiness(baseInput({ profile: profile({ isMedicatedOrInjured: true }) }));
    expect(result.reasons.find((r) => r.code === 'medicated_or_injured')).toBeDefined();
    expect(result.tier).toBe('AMBER');
  });
});

describe('RED TEAM FIX #3 — AMBER floor is a floor, not a ceiling', () => {
  it('probation + clean signals => floor pushes GREEN up to AMBER (with a floor reason)', () => {
    const result = computeReadiness(baseInput({ profile: profile({ isProbation: true }) }));
    expect(result.tier).toBe('AMBER');
    expect(result.reasons.find((r) => r.code === 'profile_floor')).toBeDefined();
  });

  it('recovering + a bad signal (RHR +7) still reaches RED — floor does NOT cap it', () => {
    const dailySummaries = rhrBaseline(50, 7);
    const result = computeReadiness(
      baseInput({ profile: profile({ isRecovering: true }), dailySummaries, checkin: checkin({ restingHr: 57 }) }),
    );
    expect(result.tier).toBe('RED');
  });

  it('external tierFloor param composes with the internal profile floor', () => {
    const result = computeReadiness(baseInput(), 'AMBER');
    expect(result.tier).toBe('AMBER');
  });
});

describe('tier mapping — multiple warns escalate to RED without any bad signal', () => {
  it('2 warn-severity reasons => RED', () => {
    const result = computeReadiness(
      baseInput({ checkin: checkin({ sleepQuality: 1, soreness: 'knee' }) }),
    );
    const warnCount = result.reasons.filter((r) => r.severity === 'warn').length;
    expect(warnCount).toBeGreaterThanOrEqual(2);
    expect(result.tier).toBe('RED');
  });

  it('exactly 1 warn => AMBER', () => {
    const result = computeReadiness(baseInput({ checkin: checkin({ sleepQuality: 1 }) }));
    expect(result.tier).toBe('AMBER');
  });
});
