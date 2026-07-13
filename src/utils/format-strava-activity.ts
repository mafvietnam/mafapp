/**
 * Pure formatting helpers for Strava activity display on the dashboard.
 * No React — keep these unit-testable in isolation (see __tests__).
 */

import type { StravaActivity } from '../services/strava-service';

/** "12 Thg 10" style vi-VN short date */
export function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
}

/** Meters -> "X.XX km" */
export function formatDistanceKm(meters: number): string {
  if (!meters || meters <= 0) return '0.00 km';
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Numeric pace in seconds/km — the single source of the pace formula.
 * Prefer explicit `avgPace` from the API (stored as MIN/km — see Prisma schema
 * and StravaSyncService: movingTime/60 / km); otherwise derive sec/km from
 * movingTime / (distance in km). Returns null when underivable (guards
 * divide-by-zero and unknown values). Consumed by both `formatPace` (display)
 * and journal analytics (trend math) so the two never diverge.
 */
export function paceSecPerKm(
  activity: Pick<StravaActivity, 'avgPace' | 'movingTime' | 'distance'>,
): number | null {
  let secPerKm: number | null = null;

  if (activity.avgPace != null && activity.avgPace > 0) {
    secPerKm = activity.avgPace * 60; // avgPace is min/km → convert to sec/km
  } else if (activity.distance > 0 && activity.movingTime > 0) {
    secPerKm = activity.movingTime / (activity.distance / 1000);
  }

  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
  return secPerKm;
}

/** Formats pace as "m:ss /km". Em-dash when pace is underivable. */
export function formatPace(activity: Pick<StravaActivity, 'avgPace' | 'movingTime' | 'distance'>): string {
  const secPerKm = paceSecPerKm(activity);
  if (secPerKm == null) return '—';

  const totalSec = Math.round(secPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

/** Seconds -> "h:mm:ss" (or "m:ss" when under an hour). Em-dash for null/invalid/negative. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** m/s -> "X.X km/h". Em-dash for null/invalid/non-positive. */
export function formatSpeedKmh(metersPerSecond: number | null | undefined): string {
  if (metersPerSecond == null || !Number.isFinite(metersPerSecond) || metersPerSecond <= 0) return '—';
  return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
}

export interface HrZoneResult {
  label: string;
  colorClass: string;
  warn: boolean;
}

/**
 * Colors the average HR against the user's MAF ceiling (mafHr).
 * warn (red) = above MAF ceiling; emerald = within/at zone; violet = neutral (no mafHr).
 */
export function hrZone(avgHr: number | null, mafHr: number): HrZoneResult {
  if (avgHr == null) return { label: '—', colorClass: 'text-maf-violet', warn: false };

  const warn = mafHr > 0 && avgHr > mafHr;
  const label = `${avgHr} bpm`;

  if (warn) return { label, colorClass: 'text-maf-red', warn: true };
  if (mafHr > 0) return { label, colorClass: 'text-emerald-400', warn: false };
  return { label, colorClass: 'text-maf-violet', warn: false };
}
