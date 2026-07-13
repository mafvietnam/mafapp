/**
 * Pure date helpers for the running journal. No React, no I/O — unit-tested in
 * isolation (see __tests__/journal-date-utils.test.ts).
 *
 * TIMEZONE (locked, see phase-02 plan RT-6): all getters are runtime-LOCAL.
 * Strava `startDate` is stored UTC, but users view their journal in their own
 * browser, and all app users are VN (UTC+7), so grouping by viewer-local time
 * yields the athlete's real local Monday-of-week. Tests build fixtures with the
 * LOCAL Date constructor so week assertions stay deterministic on any CI TZ.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local Monday 00:00 of the week containing `d` (week starts Monday, VN convention). */
export function mondayOf(d: Date): Date {
  const day = d.getDay(); // Sun=0 … Sat=6
  const daysFromMonday = day === 0 ? 6 : day - 1; // Sun is 6 days after Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** "dd/M – dd/M" range label for the week starting at `monday` (Mon → Sun). */
export function weekRangeLabel(monday: Date): string {
  const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
  const dd = (x: Date) => x.getDate().toString().padStart(2, '0');
  const m = (x: Date) => x.getMonth() + 1;
  return `${dd(monday)}/${m(monday)} – ${dd(sunday)}/${m(sunday)}`;
}

/**
 * Subtract `months` calendar months from `date` (local), preserving time-of-day
 * so a window is exactly "N months back from this instant". Day may clamp via JS
 * rollover — acceptable, boundaries computed identically so adjacent windows tile.
 */
function subMonths(date: Date, months: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() - months,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export interface WindowRange {
  since: string; // ISO — inclusive lower bound (backend `gte`)
  until: string; // ISO — exclusive upper bound (backend `lt`)
}

/**
 * The Nth back-to-back 6-month fetch window (index 0 = most recent).
 * Half-open [since, until): until = now - index*6mo, since = now - (index+1)*6mo.
 * IMPORTANT: pass a SINGLE stable `now` for every index (the hook captures it
 * once at mount) so adjacent windows tile exactly — since(index) === until(index+1).
 */
export function windowRange(now: Date, index: number): WindowRange {
  const until = index === 0 ? now : subMonths(now, index * 6);
  const since = subMonths(now, (index + 1) * 6);
  return { since: since.toISOString(), until: until.toISOString() };
}
