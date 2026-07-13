/**
 * Pure analytics for the running journal: weekly grouping, monthly summary,
 * long-term MAF trend series. No React, no I/O — unit-tested in isolation.
 *
 * Reuses the MAF formula (verdict, aerobicEfficiency) and the pace formula
 * (paceSecPerKm) — do NOT re-derive either here (DRY). MAF zone convention
 * matches the detail page: { lower: mafHr - 10, upper: mafHr }.
 */

import type { StravaActivity } from '../services/strava-service';
import { verdict, aerobicEfficiency, type MafZone } from './maf-activity-analysis';
import { paceSecPerKm } from './format-strava-activity';
import { mondayOf, weekRangeLabel } from './journal-date-utils';

export interface WeekGroup {
  weekStart: number; // epoch ms of local Monday 00:00 (bucket key)
  label: string; // "dd/M – dd/M"
  activities: StravaActivity[]; // newest-first within the week
  totalKm: number;
  sessionCount: number;
  inZonePct: number | null; // % of HR runs with verdict 'in'; null when no HR runs or mafHr<=0
}

export interface MonthlySummary {
  totalKm: number;
  sessionCount: number;
  inZonePct: number | null;
}

export interface TrendPoint {
  weekStart: number;
  label: string;
  paceAtMaf: number | null; // avg sec/km over verdict-'in' runs
  efficiency: number | null; // avg aerobic efficiency (m/beat) over runs with HR
}

const zoneOf = (mafHr: number): MafZone => ({ lower: mafHr - 10, upper: mafHr });

const totalKmOf = (runs: StravaActivity[]): number =>
  Math.round((runs.reduce((sum, r) => sum + (r.distance || 0), 0) / 1000) * 100) / 100;

/**
 * % of HR-bearing runs whose avg HR lands in the MAF zone. Denominator excludes
 * runs without HR (not counted as failures). null when no HR runs OR mafHr<=0
 * (verdict returns null when the zone is unconfigured) — lets the UI hide the
 * metric instead of showing a misleading 0%.
 */
function inZonePct(runs: StravaActivity[], mafHr: number): number | null {
  if (mafHr <= 0) return null;
  const zone = zoneOf(mafHr);
  const withHr = runs.filter((r) => r.avgHeartRate != null);
  if (withHr.length === 0) return null;
  const inCount = withHr.filter((r) => verdict(r.avgHeartRate, zone)?.status === 'in').length;
  return Math.round((inCount / withHr.length) * 100);
}

/** Average of the non-null values produced by `pick`, or null if none. */
function avgOf<T>(items: T[], pick: (item: T) => number | null): number | null {
  const vals = items.map(pick).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

/** Bucket activities into Monday-started weeks. Weeks newest-first; runs newest-first within each. */
export function groupByWeek(activities: StravaActivity[], mafHr: number): WeekGroup[] {
  const buckets = new Map<number, StravaActivity[]>();
  for (const a of activities) {
    const key = mondayOf(new Date(a.startDate)).getTime();
    const bucket = buckets.get(key);
    if (bucket) bucket.push(a);
    else buckets.set(key, [a]);
  }

  const groups: WeekGroup[] = [];
  for (const [weekStart, runs] of buckets) {
    runs.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    groups.push({
      weekStart,
      label: weekRangeLabel(new Date(weekStart)),
      activities: runs,
      totalKm: totalKmOf(runs),
      sessionCount: runs.length,
      inZonePct: inZonePct(runs, mafHr),
    });
  }
  groups.sort((a, b) => b.weekStart - a.weekStart); // newest week first
  return groups;
}

/** Aggregates over the calendar month+year of `now` (default: current month). */
export function monthlySummary(
  activities: StravaActivity[],
  mafHr: number,
  now: Date = new Date(),
): MonthlySummary {
  const y = now.getFullYear();
  const mo = now.getMonth();
  const inMonth = activities.filter((a) => {
    const d = new Date(a.startDate);
    return d.getFullYear() === y && d.getMonth() === mo;
  });
  return {
    totalKm: totalKmOf(inMonth),
    sessionCount: inMonth.length,
    inZonePct: inZonePct(inMonth, mafHr),
  };
}

/**
 * Per-week trend points (chronological / oldest-first for the chart).
 * paceAtMaf = avg pace over verdict-'in' runs (the true MAF signal);
 * efficiency = avg aerobic efficiency over all HR runs (denser fallback series).
 * A week is emitted only if it has ≥1 non-null series value.
 */
export function mafTrendSeries(activities: StravaActivity[], mafHr: number): TrendPoint[] {
  const weeks = groupByWeek(activities, mafHr); // newest-first
  const zone = zoneOf(mafHr);

  const points: TrendPoint[] = [];
  for (const w of weeks) {
    const inZoneRuns =
      mafHr > 0
        ? w.activities.filter((r) => verdict(r.avgHeartRate, zone)?.status === 'in')
        : [];
    const hrRuns = w.activities.filter((r) => r.avgHeartRate != null);

    const paceAtMaf = avgOf(inZoneRuns, (r) => paceSecPerKm(r));
    const efficiencyRaw = avgOf(hrRuns, (r) => aerobicEfficiency(r.avgSpeed, r.avgHeartRate));
    const efficiency = efficiencyRaw == null ? null : Math.round(efficiencyRaw * 100) / 100;

    if (paceAtMaf == null && efficiency == null) continue; // skip empty weeks
    points.push({
      weekStart: w.weekStart,
      label: w.label,
      paceAtMaf: paceAtMaf == null ? null : Math.round(paceAtMaf),
      efficiency,
    });
  }
  points.sort((a, b) => a.weekStart - b.weekStart); // oldest-first for chart X axis
  return points;
}
