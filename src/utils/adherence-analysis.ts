/**
 * Pure adherence-strip analysis: compares the orchestrator's ADJUSTED weekly
 * schedule against actual StravaActivity rows for that local week. No React,
 * no I/O. Reuses `mondayOf`-style local-date semantics (DRY) — the caller
 * passes `weekStart` computed via `mondayOf` from journal-date-utils.ts.
 *
 * RED TEAM FIX #12: "today" without a matching activity is NEVER auto-`missed`
 * — only a day strictly BEFORE `today` can be `missed`. A manual "đã chạy hôm
 * nay" ack (or a synced activity) marks today `done`.
 */

import type { ScheduleItem } from '../types';
import type { StravaActivity } from '../services/strava-service';
import { isSameLocalDate } from './local-today';

export type AdherenceStatus = 'done' | 'missed' | 'rest' | 'upcoming' | 'extra';

export interface AdherenceDay {
  weekday: string; // VN label (ScheduleItem.day)
  planned: ScheduleItem;
  status: AdherenceStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_LENGTH = 7;

/** Local calendar date of `weekStart + dayOffset` days (weekStart assumed local midnight). */
function dateAtOffset(weekStart: Date, dayOffset: number): Date {
  return new Date(weekStart.getTime() + dayOffset * DAY_MS);
}

function hasActivityOn(activities: StravaActivity[], date: Date): boolean {
  return activities.some((a) => isSameLocalDate(new Date(a.startDate), date));
}

/**
 * @param weekSchedule Orchestrator-ADJUSTED week (Mon..Sun order, 7 items — matches SCHEDULES/constants.ts ordering).
 * @param activities Any StravaActivity rows (caller may pre-filter; only rows within the week's 7 days matter here).
 * @param weekStart Local Monday 00:00 of the week to analyze (see `mondayOf`).
 * @param today Local midnight "today" (see `localToday`).
 * @param todayAck Manual "đã chạy hôm nay" acknowledgement — only affects TODAY's cell (RED TEAM FIX #12).
 */
export function computeAdherence(
  weekSchedule: ScheduleItem[],
  activities: StravaActivity[],
  weekStart: Date,
  today: Date,
  todayAck: boolean,
): AdherenceDay[] {
  // Defensive: child result / malformed schedule shape (e.g. buildChildResult's 1-item
  // 'Hằng ngày' schedule) has no weekly structure to render as a 7-day strip.
  if (weekSchedule.length !== WEEK_LENGTH) return [];

  return weekSchedule.map((planned, index) => {
    const date = dateAtOffset(weekStart, index);
    const matched = hasActivityOn(activities, date);
    const isToday = isSameLocalDate(date, today);
    const isPast = date.getTime() < today.getTime();

    let status: AdherenceStatus;
    if (planned.type === 'REST') {
      status = matched ? 'extra' : 'rest';
    } else if (matched || (isToday && todayAck)) {
      status = 'done';
    } else if (isPast) {
      status = 'missed';
    } else {
      // today (no match/ack yet) or a future day — day hasn't "closed" (RED TEAM FIX #12)
      status = 'upcoming';
    }

    return { weekday: planned.day, planned, status };
  });
}
