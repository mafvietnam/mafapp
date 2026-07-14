/**
 * Tests for adherence-analysis.ts. Covers RED TEAM FIX #12: a matching
 * StravaActivity or a manual "đã chạy hôm nay" ack marks TODAY done; absence
 * alone is never auto-`missed` until the day closes (i.e. becomes a past day).
 */

import { describe, it, expect } from 'vitest';
import type { ScheduleItem } from '../../types';
import type { StravaActivity } from '../../services/strava-service';
import { computeAdherence } from '../adherence-analysis';

// Monday 2026-07-13 .. Sunday 2026-07-19 (verified weekday order in local-today.test.ts)
const WEEK_START = new Date(2026, 6, 13);

const WEEK_SCHEDULE: ScheduleItem[] = [
  { day: 'Thứ 2', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
  { day: 'Thứ 3', activity: 'Chạy MAF', duration: 45, type: 'RUN' },
  { day: 'Thứ 4', activity: 'Chạy MAF', duration: 45, type: 'RUN' },
  { day: 'Thứ 5', activity: 'Chạy MAF', duration: 60, type: 'RUN' },
  { day: 'Thứ 6', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
  { day: 'Thứ 7', activity: 'Chạy dài (Long Run)', duration: 90, type: 'LONG_RUN' },
  { day: 'Chủ Nhật', activity: 'Đi bộ', duration: 45, type: 'WALK' },
];

function activityOn(date: Date, overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: `a-${date.toISOString()}`, stravaActivityId: 's', source: 'STRAVA', name: 'Run', type: 'Run',
    startDate: date.toISOString(), distance: 5000, movingTime: 1800, elapsedTime: 1800,
    avgHeartRate: 140, maxHeartRate: 150, avgSpeed: 2.8, maxSpeed: 3.5, totalElevationGain: 10,
    calories: 300, avgPace: null, isDuplicate: false,
    ...overrides,
  };
}

describe('computeAdherence — basic shape', () => {
  it('returns 7 days in Mon..Sun order with VN weekday labels from the schedule', () => {
    const today = new Date(2026, 6, 10); // before the week — everything "upcoming"
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, false);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.weekday)).toEqual(['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']);
  });

  it('returns [] for a malformed/non-weekly schedule (e.g. the 1-item child schedule)', () => {
    const childSchedule: ScheduleItem[] = [{ day: 'Hằng ngày', activity: 'VUI CHƠI TỰ NHIÊN', duration: 0, type: 'REST' }];
    expect(computeAdherence(childSchedule, [], WEEK_START, new Date(2026, 6, 14), false)).toEqual([]);
  });
});

describe('REST days', () => {
  it('REST with no activity => rest', () => {
    const today = new Date(2026, 6, 15); // Wed — Monday already past
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, false);
    expect(days[0].status).toBe('rest'); // Monday
  });

  it('activity logged on a REST day => extra', () => {
    const monday = new Date(2026, 6, 13);
    const today = new Date(2026, 6, 15);
    const days = computeAdherence(WEEK_SCHEDULE, [activityOn(monday)], WEEK_START, today, false);
    expect(days[0].status).toBe('extra');
  });
});

describe('past run-days', () => {
  it('past run-day WITH a matching activity => done', () => {
    const tuesday = new Date(2026, 6, 14);
    const today = new Date(2026, 6, 16); // Thursday — Tue is past
    const days = computeAdherence(WEEK_SCHEDULE, [activityOn(tuesday)], WEEK_START, today, false);
    expect(days[1].status).toBe('done'); // Tuesday
  });

  it('past run-day WITHOUT a matching activity => missed', () => {
    const today = new Date(2026, 6, 16); // Thursday — Tue/Wed are past, no activities logged
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, false);
    expect(days[1].status).toBe('missed'); // Tuesday
    expect(days[2].status).toBe('missed'); // Wednesday
  });
});

describe('future days', () => {
  it('future run-day => upcoming', () => {
    const today = new Date(2026, 6, 13); // Monday — everything after is future
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, false);
    expect(days[1].status).toBe('upcoming'); // Tuesday
    expect(days[6].status).toBe('upcoming'); // Sunday
  });
});

describe('RED TEAM FIX #12 — today is never auto-missed', () => {
  it('today with NO matching activity and NO ack => upcoming (not missed)', () => {
    const today = new Date(2026, 6, 14); // Tuesday = today
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, false);
    expect(days[1].status).toBe('upcoming');
  });

  it('today with a matching activity => done', () => {
    const today = new Date(2026, 6, 14);
    const days = computeAdherence(WEEK_SCHEDULE, [activityOn(today)], WEEK_START, today, false);
    expect(days[1].status).toBe('done');
  });

  it('today with a manual "đã chạy hôm nay" ack (no synced activity) => done', () => {
    const today = new Date(2026, 6, 14);
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, true);
    expect(days[1].status).toBe('done');
  });

  it('ack only affects TODAY — a different past day with no activity still shows missed', () => {
    const today = new Date(2026, 6, 16); // Thursday = today
    const days = computeAdherence(WEEK_SCHEDULE, [], WEEK_START, today, true);
    expect(days[1].status).toBe('missed'); // Tuesday — ack doesn't retroactively cover it
    expect(days[3].status).toBe('done'); // Thursday = today, no activity, but ack=true covers today
  });
});
