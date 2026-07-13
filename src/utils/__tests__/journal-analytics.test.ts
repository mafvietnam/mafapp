/**
 * Tests for pure journal analytics (weekly grouping, monthly summary, MAF trend).
 * Fixtures use local-constructor dates (deterministic on any CI TZ). MAF zone
 * convention: mafHr 150 → band [140, 150].
 */

import { describe, it, expect } from 'vitest';
import { groupByWeek, monthlySummary, mafTrendSeries } from '../journal-analytics';
import type { StravaActivity } from '../../services/strava-service';

const MAF = 150; // zone [140, 150]

/** Build a StravaActivity fixture with sensible defaults; override per test. */
function run(partial: Partial<StravaActivity> & { startDate: string }): StravaActivity {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    stravaActivityId: partial.stravaActivityId ?? '1',
    name: partial.name ?? 'Run',
    type: partial.type ?? 'Run',
    distance: partial.distance ?? 10000, // 10 km
    movingTime: partial.movingTime ?? 3600,
    elapsedTime: partial.elapsedTime ?? 3600,
    avgHeartRate: partial.avgHeartRate ?? null,
    maxHeartRate: partial.maxHeartRate ?? null,
    avgSpeed: partial.avgSpeed ?? 2.78,
    maxSpeed: partial.maxSpeed ?? null,
    totalElevationGain: partial.totalElevationGain ?? null,
    calories: partial.calories ?? null,
    avgPace: partial.avgPace ?? 6, // 6 min/km
    isDuplicate: partial.isDuplicate ?? false,
    startDate: partial.startDate,
  };
}

// Local ISO helper — build a Date in local time, serialize to the ISO the API returns.
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();

describe('groupByWeek', () => {
  it('separates a Sunday and the following Monday into different weeks', () => {
    const activities = [
      run({ startDate: at(2026, 6, 12) }), // Sun → week of Mon 07-06
      run({ startDate: at(2026, 6, 13) }), // Mon → week of Mon 07-13
    ];
    const weeks = groupByWeek(activities, MAF);
    expect(weeks).toHaveLength(2);
    // newest week first
    expect(weeks[0].label).toBe('13/7 – 19/7');
    expect(weeks[1].label).toBe('06/7 – 12/7');
  });

  it('sums totalKm and sessionCount within a week', () => {
    const activities = [
      run({ startDate: at(2026, 6, 13), distance: 8000 }),
      run({ startDate: at(2026, 6, 15), distance: 12000 }),
    ];
    const [week] = groupByWeek(activities, MAF);
    expect(week.sessionCount).toBe(2);
    expect(week.totalKm).toBe(20); // 8 + 12
  });

  it('orders activities newest-first within a week', () => {
    const activities = [
      run({ id: 'older', startDate: at(2026, 6, 13) }),
      run({ id: 'newer', startDate: at(2026, 6, 16) }),
    ];
    const [week] = groupByWeek(activities, MAF);
    expect(week.activities[0].id).toBe('newer');
    expect(week.activities[1].id).toBe('older');
  });

  it('inZonePct counts only HR runs (no-HR runs excluded from denominator)', () => {
    const activities = [
      run({ startDate: at(2026, 6, 13), avgHeartRate: 145 }), // in
      run({ startDate: at(2026, 6, 14), avgHeartRate: 148 }), // in
      run({ startDate: at(2026, 6, 15), avgHeartRate: 165 }), // above
      run({ startDate: at(2026, 6, 16), avgHeartRate: null }), // no HR → excluded
    ];
    const [week] = groupByWeek(activities, MAF);
    expect(week.inZonePct).toBe(67); // 2 in / 3 HR runs
  });

  it('inZonePct is null when mafHr <= 0 (profile unconfigured)', () => {
    const activities = [run({ startDate: at(2026, 6, 13), avgHeartRate: 145 })];
    const [week] = groupByWeek(activities, 0);
    expect(week.inZonePct).toBeNull();
  });

  it('inZonePct is null when a week has no HR runs at all', () => {
    const activities = [run({ startDate: at(2026, 6, 13), avgHeartRate: null })];
    const [week] = groupByWeek(activities, MAF);
    expect(week.inZonePct).toBeNull();
  });
});

describe('monthlySummary', () => {
  it('aggregates only the calendar month of `now`', () => {
    const activities = [
      run({ startDate: at(2026, 6, 5), distance: 10000, avgHeartRate: 145 }), // July - in
      run({ startDate: at(2026, 6, 20), distance: 5000, avgHeartRate: 165 }), // July - above
      run({ startDate: at(2026, 5, 30), distance: 9000, avgHeartRate: 145 }), // June - excluded
    ];
    const summary = monthlySummary(activities, MAF, new Date(2026, 6, 13));
    expect(summary.sessionCount).toBe(2);
    expect(summary.totalKm).toBe(15); // 10 + 5, June run excluded
    expect(summary.inZonePct).toBe(50); // 1 in / 2 HR runs
  });

  it('returns zero/null for a month with no activities', () => {
    const summary = monthlySummary([], MAF, new Date(2026, 6, 13));
    expect(summary.sessionCount).toBe(0);
    expect(summary.totalKm).toBe(0);
    expect(summary.inZonePct).toBeNull();
  });
});

describe('mafTrendSeries', () => {
  it('primary pace counts only in-zone runs; secondary efficiency counts all HR runs', () => {
    const activities = [
      run({ startDate: at(2026, 6, 13), avgHeartRate: 145, avgPace: 6, avgSpeed: 2.78 }), // in
      run({ startDate: at(2026, 6, 15), avgHeartRate: 165, avgPace: 5, avgSpeed: 3.33 }), // above (excluded from pace)
    ];
    const points = mafTrendSeries(activities, MAF);
    expect(points).toHaveLength(1);
    expect(points[0].paceAtMaf).toBe(360); // only the in-zone 6:00/km run
    expect(points[0].efficiency).not.toBeNull(); // both HR runs feed efficiency
  });

  it('omits a week with no HR runs (both series null)', () => {
    const activities = [
      run({ startDate: at(2026, 6, 6), avgHeartRate: 145 }), // week A: has data
      run({ startDate: at(2026, 6, 20), avgHeartRate: null, avgPace: 6 }), // week B: no HR → omitted
    ];
    const points = mafTrendSeries(activities, MAF);
    expect(points).toHaveLength(1);
    expect(points[0].label).toBe('06/7 – 12/7');
  });

  it('returns points oldest-first (chronological for chart X axis)', () => {
    const activities = [
      run({ startDate: at(2026, 6, 20), avgHeartRate: 145 }), // later week
      run({ startDate: at(2026, 6, 6), avgHeartRate: 145 }), // earlier week
    ];
    const points = mafTrendSeries(activities, MAF);
    expect(points).toHaveLength(2);
    expect(points[0].weekStart).toBeLessThan(points[1].weekStart);
  });

  it('paceAtMaf is null for a week whose HR runs are all above zone', () => {
    const activities = [run({ startDate: at(2026, 6, 13), avgHeartRate: 165, avgSpeed: 3.0 })];
    const points = mafTrendSeries(activities, MAF);
    expect(points).toHaveLength(1);
    expect(points[0].paceAtMaf).toBeNull(); // no in-zone runs
    expect(points[0].efficiency).not.toBeNull(); // still has an HR run
  });
});
