/**
 * Direct tests for daily-readiness-signals.ts, focused on `trendSignal` (the
 * cardiac-drift PROXY signal — needs an optional `mafHr` not part of the
 * documented ReadinessInput minimal shape) plus a few isolated edge cases for
 * the other signals not already exercised via daily-readiness-score.test.ts.
 */

import { describe, it, expect } from 'vitest';
import type { StravaActivity } from '../../services/strava-service';
import type { GarminDailySummary } from '../../services/garmin-service';
import { rhrSignal, trendSignal, loadSignal, stressSignal, type SignalContext } from '../daily-readiness-signals';

const TODAY = new Date(2026, 6, 14); // Tuesday

function ctx(overrides: Partial<SignalContext> = {}): SignalContext {
  return { recentActivities: [], dailySummaries: [], checkin: null, today: TODAY, ...overrides };
}

function run(dateStr: string, avgSpeed: number, avgHeartRate: number): StravaActivity {
  return {
    id: dateStr, stravaActivityId: dateStr, source: 'STRAVA', name: 'Run', type: 'Run',
    startDate: new Date(dateStr).toISOString(), distance: 8000, movingTime: 2400, elapsedTime: 2400,
    avgHeartRate, maxHeartRate: avgHeartRate + 10, avgSpeed, maxSpeed: avgSpeed + 0.5, totalElevationGain: 20,
    calories: 400, avgPace: null, isDuplicate: false,
  };
}

describe('trendSignal — cardiac-drift proxy (optional mafHr)', () => {
  it('no mafHr => [] (signal not part of the documented minimal input)', () => {
    expect(trendSignal(ctx({ recentActivities: [run('2026-07-07', 3.0, 140)] }))).toEqual([]);
  });

  it('mafHr<=0 => []', () => {
    expect(trendSignal(ctx({ mafHr: 0, recentActivities: [run('2026-07-07', 3.0, 140)] }))).toEqual([]);
  });

  it('fewer than 3 weeks of efficiency data => []', () => {
    const activities = [run('2026-07-07', 3.0, 140), run('2026-07-08', 2.8, 140)]; // same week, 1 data point
    expect(trendSignal(ctx({ mafHr: 150, recentActivities: activities }))).toEqual([]);
  });

  it('3 consecutive weeks of falling efficiency => warn with CH4 citation', () => {
    const activities = [
      run('2026-06-23', 3.0, 140), // week 1 (oldest): eff = 3.0*60/140 ≈ 1.286
      run('2026-06-30', 2.8, 140), // week 2: eff = 1.2
      run('2026-07-07', 2.5, 140), // week 3 (most recent): eff ≈ 1.071 — falling
    ];
    const result = trendSignal(ctx({ mafHr: 150, recentActivities: activities }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: 'efficiency_falling', severity: 'warn', bookRef: 'CH4' });
  });

  it('3 consecutive weeks of RISING efficiency => no reason', () => {
    const activities = [
      run('2026-06-23', 2.5, 140),
      run('2026-06-30', 2.8, 140),
      run('2026-07-07', 3.0, 140),
    ];
    expect(trendSignal(ctx({ mafHr: 150, recentActivities: activities }))).toEqual([]);
  });
});

describe('loadSignal — direct edge cases', () => {
  it('exact ratio boundary (not > 1.5x) => no warn', () => {
    const prior = [run('2026-07-04', 3.0, 140)]; // 8km at day -10
    // last7 exactly 1.5x prior with delta>=5 would warn; construct a case just under ratio.
    const recent = [run('2026-07-13', 3.0, 140)]; // 8km, same as prior => ratio 1.0
    const result = loadSignal(ctx({ recentActivities: [...prior, ...recent] }));
    expect(result).toEqual([]);
  });

  it('spike with ratio>1.5 but delta<5km absolute => no warn (avoids noise on tiny bases)', () => {
    // prior 1km, last7 2km: ratio=2x but delta=1km < LOAD_SPIKE_MIN_KM_DELTA(5)
    const prior = [run('2026-07-04', 3.0, 140)];
    prior[0].distance = 1000;
    const recent = [run('2026-07-13', 3.0, 140)];
    recent[0].distance = 2000;
    const result = loadSignal(ctx({ recentActivities: [...prior, ...recent] }));
    expect(result).toEqual([]);
  });
});

describe('stressSignal — no Garmin summary for today', () => {
  it('no matching dailySummary for today => []', () => {
    expect(stressSignal(ctx({ dailySummaries: [] }))).toEqual([]);
  });
});

function summary(dateOffsetDays: number, overrides: Partial<GarminDailySummary> = {}): GarminDailySummary {
  const d = new Date(TODAY.getTime() - dateOffsetDays * 86400000);
  return {
    id: `s${dateOffsetDays}`, date: d.toISOString(), steps: null, restingHeartRate: 50, avgHeartRate: null,
    sleepDuration: null, sleepScore: null, stressAvg: null, calories: null, activeMinutes: null, ...overrides,
  };
}

describe('rhrSignal — n>=7 baseline but no today value at all', () => {
  it('no check-in restingHr AND no today Garmin summary => [] (nothing to compare against baseline)', () => {
    const dailySummaries = Array.from({ length: 7 }, (_, i) => summary(i + 1, { restingHeartRate: 50 }));
    const result = rhrSignal(ctx({ dailySummaries, checkin: null }));
    expect(result).toEqual([]);
  });
});

describe('loadSignal — distance fallback', () => {
  it('activities with distance=0/undefined do not inflate the km total or crash', () => {
    const prior = [run('2026-07-04', 3.0, 140)];
    prior[0].distance = 10000;
    const recent = [run('2026-07-13', 3.0, 140)];
    recent[0].distance = 0;
    const result = loadSignal(ctx({ recentActivities: [...prior, ...recent] }));
    expect(result).toEqual([]);
  });
});
