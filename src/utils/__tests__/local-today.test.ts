/**
 * Tests for local-today.ts — the client DISPLAY-only "today" helpers.
 * Covers the ICT midnight boundary (RED TEAM FIX #7's #1 bug risk), weekday
 * label mapping against SCHEDULES' VN labels, and a parity test proving the
 * client's Intl-based calendar date agrees with a fixed-offset (+07, DST-free)
 * server-equivalent computation — mirroring `deriveIctDate` in
 * `api/src/checkin/checkin.service.ts` (duplicated here deliberately: frontend
 * and backend are separate packages/runtimes, so this proves algorithmic
 * parity rather than sharing code across the boundary).
 */

import { describe, it, expect } from 'vitest';
import { localToday, localWeekdayLabel, ictDateString, isSameLocalDate } from '../local-today';

/** Mirrors api/src/checkin/checkin.service.ts `deriveIctDate` (fixed UTC+7, no DST). */
function serverIctDate(now: Date): string {
  const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + ICT_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

describe('localToday — midnight boundary (Asia/Ho_Chi_Minh, fixed +07)', () => {
  it('23:30 ICT stays on the same calendar date', () => {
    // 2026-07-14T16:30:00Z = 2026-07-14 23:30 ICT
    const now = new Date('2026-07-14T16:30:00.000Z');
    const today = localToday('Asia/Ho_Chi_Minh', now);
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(6); // July (0-indexed)
    expect(today.getDate()).toBe(14);
  });

  it('00:30 ICT flips to the next calendar date', () => {
    // 2026-07-14T17:30:00Z = 2026-07-15 00:30 ICT
    const now = new Date('2026-07-14T17:30:00.000Z');
    const today = localToday('Asia/Ho_Chi_Minh', now);
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(6);
    expect(today.getDate()).toBe(15);
  });

  it('the exact 17:00:00.000Z instant is the first moment of the next ICT date', () => {
    const justBefore = localToday('Asia/Ho_Chi_Minh', new Date('2026-07-14T16:59:59.999Z'));
    const atBoundary = localToday('Asia/Ho_Chi_Minh', new Date('2026-07-14T17:00:00.000Z'));
    expect(justBefore.getDate()).toBe(14);
    expect(atBoundary.getDate()).toBe(15);
  });

  it('returns a Date at local midnight (hours/minutes/seconds/ms all zero)', () => {
    const today = localToday('Asia/Ho_Chi_Minh', new Date('2026-07-14T16:30:00.000Z'));
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
    expect(today.getSeconds()).toBe(0);
    expect(today.getMilliseconds()).toBe(0);
  });
});

describe('localWeekdayLabel — matches SCHEDULES VN labels (constants.ts)', () => {
  const cases: Array<[string, string]> = [
    ['2026-07-13', 'Thứ 2'], // Monday
    ['2026-07-14', 'Thứ 3'], // Tuesday
    ['2026-07-15', 'Thứ 4'], // Wednesday
    ['2026-07-16', 'Thứ 5'], // Thursday
    ['2026-07-17', 'Thứ 6'], // Friday
    ['2026-07-18', 'Thứ 7'], // Saturday
    ['2026-07-19', 'Chủ Nhật'], // Sunday
  ];

  it.each(cases)('%s -> %s', (ymd, expected) => {
    const [y, m, d] = ymd.split('-').map(Number);
    expect(localWeekdayLabel(new Date(y, m - 1, d))).toBe(expected);
  });
});

describe('RED TEAM FIX #7 — client/server ICT date parity', () => {
  const instants = [
    '2026-07-14T16:30:00.000Z', // 23:30 ICT
    '2026-07-14T17:30:00.000Z', // 00:30 ICT (next day)
    '2026-07-14T16:59:59.999Z', // just before midnight ICT
    '2026-07-14T17:00:00.000Z', // exactly midnight ICT
    '2026-01-01T00:00:00.000Z', // arbitrary mid-day instant
    '2026-12-31T23:59:59.999Z', // year boundary
  ];

  it.each(instants)('client ictDateString(%s) == server-equivalent fixed-offset date', (iso) => {
    const now = new Date(iso);
    expect(ictDateString(now)).toBe(serverIctDate(now));
  });

  it('localToday()s Y/M/D matches ictDateString()s Y/M/D for the same instant', () => {
    const now = new Date('2026-07-14T17:30:00.000Z');
    const today = localToday('Asia/Ho_Chi_Minh', now);
    const [y, m, d] = ictDateString(now).split('-').map(Number);
    expect(today.getFullYear()).toBe(y);
    expect(today.getMonth() + 1).toBe(m);
    expect(today.getDate()).toBe(d);
  });
});

describe('isSameLocalDate', () => {
  it('true for same Y/M/D regardless of time-of-day', () => {
    expect(isSameLocalDate(new Date(2026, 6, 14, 0, 0), new Date(2026, 6, 14, 23, 59))).toBe(true);
  });

  it('false across a date boundary', () => {
    expect(isSameLocalDate(new Date(2026, 6, 14, 23, 59), new Date(2026, 6, 15, 0, 0))).toBe(false);
  });
});
