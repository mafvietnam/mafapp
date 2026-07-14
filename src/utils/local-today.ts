/**
 * Client-side "today" helpers for the Daily Run Recommendation feature.
 * DISPLAY-only (RED TEAM FIX #7): the SERVER is the single authoritative source
 * of "today" for any PERSISTED key (check-in unique (userId, date), Phase 4
 * coaching cache key) — see `api/src/checkin/checkin.service.ts` `deriveIctDate`.
 * The client NEVER sends its own "today" as the authoritative date; it only
 * uses these helpers to decide WHICH weekday to render and where the local
 * week (`mondayOf`) starts.
 *
 * Asia/Ho_Chi_Minh is a fixed UTC+7 offset with NO daylight-saving time, so a
 * calendar date computed here (via Intl) and one computed on the server (via
 * fixed-offset arithmetic) always agree — see the parity test in
 * `__tests__/local-today.test.ts`.
 *
 * No external timezone library (KISS) — `Intl.DateTimeFormat` with a `timeZone`
 * option is sufficient for a single fixed-offset zone.
 */

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

/** VN weekday labels used in `SCHEDULES` (constants.ts), indexed by JS `Date#getDay()` (0=Sun..6=Sat). */
const VN_WEEKDAY_LABELS = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

interface CalendarParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Y/M/D calendar parts of `instant` as observed in `tz`, via Intl (no external tz lib). */
function calendarPartsInZone(instant: Date, tz: string): CalendarParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/**
 * "Today" at local midnight, computed from the wall-clock calendar date in `tz`
 * (default Asia/Ho_Chi_Minh). Returns a `Date` built via the LOCAL JS `Date`
 * constructor (hours zeroed) — mirrors `mondayOf` in journal-date-utils.ts so
 * downstream week-math (adherence, `mondayOf`) stays consistent. `now` is
 * injectable so callers/tests stay deterministic on any CI timezone.
 */
export function localToday(tz: string = DEFAULT_TZ, now: Date = new Date()): Date {
  const { year, month, day } = calendarPartsInZone(now, tz);
  return new Date(year, month - 1, day);
}

/** Maps a Date (e.g. from `localToday()`) to the VN weekday label used in `SCHEDULES`. */
export function localWeekdayLabel(date: Date): string {
  return VN_WEEKDAY_LABELS[date.getDay()];
}

/**
 * YYYY-MM-DD calendar-date string in `tz` — used ONLY for the client==server
 * parity test (RED TEAM FIX #7); persisted date keys are computed server-side.
 */
export function ictDateString(now: Date = new Date(), tz: string = DEFAULT_TZ): string {
  const { year, month, day } = calendarPartsInZone(now, tz);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** True when `a` and `b` fall on the same LOCAL calendar date (Y/M/D), ignoring time-of-day. */
export function isSameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
