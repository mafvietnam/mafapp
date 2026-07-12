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
 * Prefer explicit `avgPace` (sec/km) from the API; otherwise derive from
 * movingTime / (distance in km). Guards divide-by-zero and unknown values.
 */
export function formatPace(activity: Pick<StravaActivity, 'avgPace' | 'movingTime' | 'distance'>): string {
  let secPerKm: number | null = null;

  if (activity.avgPace != null && activity.avgPace > 0) {
    secPerKm = activity.avgPace;
  } else if (activity.distance > 0 && activity.movingTime > 0) {
    secPerKm = activity.movingTime / (activity.distance / 1000);
  }

  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '—';

  const totalSec = Math.round(secPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
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
