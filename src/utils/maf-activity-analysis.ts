/**
 * Pure MAF (Maximum Aerobic Function) analysis helpers for the activity detail
 * page. No React, no I/O — computed from plain arrays/numbers so they stay
 * unit-testable in isolation (see __tests__) and don't couple to stream types.
 *
 * MAF zone convention (locked, see phase-03 plan): zone = { lower: mafHr - 10,
 * upper: mafHr }. Boundaries (== lower or == upper) count as IN zone. This is
 * a richer 3-state model than the dashboard's `hrZone` (which only flags
 * avgHr > mafHr) — do not conflate the two.
 */

/** Inclusive MAF heart-rate band: [lower, upper]. */
export interface MafZone {
  lower: number;
  upper: number;
}

/** Time-weighted seconds/percent spent below/in/above the MAF band. */
export interface TimeInZone {
  belowSec: number;
  inSec: number;
  aboveSec: number;
  belowPct: number;
  inPct: number;
  abovePct: number;
  totalSec: number;
}

export type VerdictStatus = 'below' | 'in' | 'above';

/** deltaBpm is always >=0 — distance from the nearest zone edge (0 when in-zone). */
export interface MafVerdict {
  status: VerdictStatus;
  deltaBpm: number;
}

/** Ignore any interval gap larger than this (seconds) — treated as an auto-pause, not real elapsed time. */
const GAP_CAP_SEC = 30;
/** Below this instantaneous speed (m/s) a sample is considered "stopped" (traffic light, aid station, etc). */
const MOVING_SPEED_THRESHOLD = 0.5;
/**
 * Aerobic decoupling / cardiac-drift threshold (%). ≥ this = a fatigue/heat/
 * aerobic-deficiency signal (Friel-style heuristic, NOT a Maffetone page number).
 * Shared by cardiac-drift-card + maf-coaching-insights so the cutoff stays in one place.
 */
export const DRIFT_THRESHOLD = 5;

/**
 * Weight HR samples by time deltas into below/in/above MAF band buckets.
 * WHY time-weighted, not sample-count: Strava streams can have non-uniform
 * `time[]` (esp. after server-side downsampling), so a naive per-sample count
 * would misrepresent actual seconds spent in each zone.
 * Returns null if hr/time missing or empty (nothing to compute).
 */
export function timeInZone(
  hr: number[] | undefined,
  time: number[] | undefined,
  zone: MafZone
): TimeInZone | null {
  if (!hr || !time || hr.length === 0 || time.length === 0) return null;

  const n = Math.min(hr.length, time.length);
  let belowSec = 0;
  let inSec = 0;
  let aboveSec = 0;

  for (let i = 1; i < n; i++) {
    const dt = time[i] - time[i - 1];
    // Skip non-positive or huge gaps (auto-pause) — one HR sample must not
    // get credited with an unrealistic block of time.
    if (dt <= 0 || dt > GAP_CAP_SEC) continue;
    const h = hr[i];
    if (h === undefined || Number.isNaN(h)) continue;

    if (h > zone.upper) aboveSec += dt;
    else if (h < zone.lower) belowSec += dt;
    else inSec += dt; // boundary (== lower or == upper) counts as in-zone
  }

  const totalSec = belowSec + inSec + aboveSec;
  if (totalSec <= 0) return null;

  const pct = distributePercentages(belowSec, inSec, aboveSec, totalSec);
  return { belowSec, inSec, aboveSec, totalSec, ...pct };
}

/**
 * Round three time buckets to whole percentages that sum exactly to 100
 * (largest-remainder method) — avoids 99.9/100.1 display drift from naive
 * independent rounding.
 */
function distributePercentages(belowSec: number, inSec: number, aboveSec: number, totalSec: number) {
  const raw = [belowSec, inSec, aboveSec].map((sec) => (sec / totalSec) * 100);
  const floors = raw.map(Math.floor);
  let leftover = 100 - floors.reduce((sum, f) => sum + f, 0);

  // Give the remaining whole points to buckets with the largest fractional remainder.
  const order = [0, 1, 2].sort((a, b) => raw[b] - floors[b] - (raw[a] - floors[a]));
  for (const idx of order) {
    if (leftover <= 0) break;
    floors[idx] += 1;
    leftover -= 1;
  }

  return { belowPct: floors[0], inPct: floors[1], abovePct: floors[2] };
}

interface MovingSample {
  t: number;
  dt: number;
  speed: number;
  hr: number;
}

/**
 * Aerobic decoupling % (Pw:Hr / cardiac drift): compares efficiency factor
 * (speed/HR) in the first half of the run vs the second half. Positive =
 * HR drifted up relative to pace (fatigue/heat) — a key MAF signal.
 *
 * WHY filter to moving samples + gap cap: raw `velocity_smooth` includes
 * stops (traffic lights, aid stations) and Strava `time[]` includes paused
 * time, so a mid-run stop would skew both the halfway split point and the
 * time-weighted average if not filtered out first.
 * Returns null (never NaN/Infinity) for degenerate/all-stopped input.
 */
export function cardiacDrift(
  speed: number[] | undefined,
  hr: number[] | undefined,
  time: number[] | undefined
): number | null {
  if (!speed || !hr || !time) return null;

  const n = Math.min(speed.length, hr.length, time.length);
  if (n < 4) return null;

  const moving: MovingSample[] = [];
  for (let i = 1; i < n; i++) {
    const dt = time[i] - time[i - 1];
    if (dt <= 0 || dt > GAP_CAP_SEC) continue;
    const s = speed[i];
    const h = hr[i];
    if (s === undefined || h === undefined || Number.isNaN(s) || Number.isNaN(h)) continue;
    if (s <= MOVING_SPEED_THRESHOLD) continue; // stopped — exclude from drift calc
    moving.push({ t: time[i], dt, speed: s, hr: h });
  }
  if (moving.length < 4) return null;

  // Midpoint of elapsed *moving* time (not wall-clock), so an asymmetric
  // mid-run pause doesn't shift the half-split.
  const midTime = moving[0].t + (moving[moving.length - 1].t - moving[0].t) / 2;
  const first = moving.filter((m) => m.t < midTime);
  const second = moving.filter((m) => m.t >= midTime);
  if (first.length < 2 || second.length < 2) return null;

  const ef1 = efficiencyFactor(first);
  const ef2 = efficiencyFactor(second);
  if (ef1 === null || ef2 === null || ef1 === 0) return null;

  const drift = ((ef1 - ef2) / ef1) * 100;
  return Number.isFinite(drift) ? Math.round(drift * 10) / 10 : null;
}

/** Time-weighted mean speed / time-weighted mean HR for a half of moving samples, or null if degenerate. */
function efficiencyFactor(samples: MovingSample[]): number | null {
  const totalDt = samples.reduce((sum, s) => sum + s.dt, 0);
  if (totalDt <= 0) return null;
  const meanSpeed = samples.reduce((sum, s) => sum + s.speed * s.dt, 0) / totalDt;
  const meanHr = samples.reduce((sum, s) => sum + s.hr * s.dt, 0) / totalDt;
  return meanSpeed > 0 && meanHr > 0 ? meanSpeed / meanHr : null;
}

/**
 * Meters covered per heartbeat-minute: (avgSpeed m/s * 60) / avgHr. Higher =
 * more efficient. Null if avgHr missing/<=0 or avgSpeed missing.
 */
export function aerobicEfficiency(avgSpeed: number | null, avgHr: number | null): number | null {
  if (!avgHr || avgHr <= 0 || avgSpeed == null) return null;
  return Math.round(((avgSpeed * 60) / avgHr) * 100) / 100;
}

/**
 * Compare average HR to the MAF zone → status + delta bpm from the nearest
 * edge (0 when in-zone). Null if avgHr is unknown or the zone is invalid
 * (mafHr <= 0 means the user hasn't configured MAF yet).
 */
export function verdict(avgHr: number | null, zone: MafZone): MafVerdict | null {
  if (avgHr == null || zone.upper <= 0) return null;
  if (avgHr > zone.upper) return { status: 'above', deltaBpm: avgHr - zone.upper };
  if (avgHr < zone.lower) return { status: 'below', deltaBpm: zone.lower - avgHr };
  return { status: 'in', deltaBpm: 0 };
}
