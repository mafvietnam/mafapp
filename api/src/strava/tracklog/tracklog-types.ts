/**
 * Shared types, error classes, and pure helpers for tracklog (GPX/TCX) parsing.
 * No HTTP, no Prisma — fully unit-testable.
 */

/** A single parsed trackpoint. `t` is epoch ms; other fields absent when not in the file. */
export interface TrackPoint {
  t: number; // epoch ms
  lat?: number;
  lon?: number;
  ele?: number; // meters
  hr?: number; // bpm
  distM?: number; // cumulative distance from device (TCX) in meters
}

/** Intermediate result each format parser returns before summarization. */
export interface RawParse {
  name: string;
  type: string; // 'Run' | 'Ride' | 'Walk' (mapped)
  calories: number | null; // kcal (TCX only)
  points: TrackPoint[];
  distanceHint: number | null; // explicit total distance (TCX lap sum), meters
  movingTimeHint: number | null; // explicit moving/total time (TCX lap sum), seconds
}

/** Final normalized activity summary + ordered points (streams built downstream). */
export interface ParsedTracklog {
  name: string;
  type: string;
  startDate: Date;
  distance: number; // meters
  movingTime: number; // seconds
  elapsedTime: number; // seconds
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgSpeed: number | null; // m/s
  totalElevationGain: number | null; // meters
  calories: number | null; // kcal
  points: TrackPoint[];
}

/** File format not GPX/TCX. */
export class UnsupportedTracklogError extends Error {}
/** File parsed but has no usable data (no time, <2 points, no distance & no HR, too large). */
export class InvalidTracklogError extends Error {}

// -- Limits / validation constants (RT-H3/H4) --
export const MAX_TRACKPOINTS = 50_000; // reject before O(n) work
export const MAX_NAME_LEN = 256;
export const MIN_MOVING_SPEED = 0.5; // m/s — below this a segment counts as paused (RT-M5)
export const ELE_GAIN_THRESHOLD = 1; // meters — ignore sub-meter jitter
export const HR_MIN = 1;
export const HR_MAX = 300;
export const MAX_DISTANCE_M = 1_000_000; // 1000 km sanity cap
const MIN_DATE_MS = Date.UTC(2000, 0, 1);

// Control chars (C0 range + DEL). Built via RegExp(string) so the SOURCE contains no literal
// control bytes (a literal NUL would make git treat this file as binary).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');

/** fast-xml-parser yields an object for one child, an array for many, undefined for none. Normalize to array. */
export function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Parse to a finite number or undefined (never NaN/Infinity). */
export function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Trim, strip control chars, cap length. Falls back to `fallback` when empty. */
export function cleanName(v: unknown, fallback: string, max = MAX_NAME_LEN): string {
  const s = String(v ?? '').replace(CONTROL_CHARS, ' ').trim();
  return s ? s.slice(0, max) : fallback;
}

/** A start date is valid only if finite and within [2000-01-01, now + 1 day] (RT-H4/M3). */
export function isValidStart(ms: number): boolean {
  return Number.isFinite(ms) && ms >= MIN_DATE_MS && ms <= Date.now() + 86_400_000;
}

/** Map a raw GPX/TCX activity type token to our stored type. Defaults to 'Run' (RT-M11). */
export function mapActivityType(raw: unknown): string {
  const s = String(raw ?? '').toLowerCase();
  if (!s) return 'Run';
  if (s.includes('ride') || s.includes('bik') || s.includes('cycl') || s === '1') return 'Ride';
  if (s.includes('walk') || s.includes('hik')) return 'Walk';
  return 'Run';
}
