/**
 * Tests for the pure MAF coaching engine (tier verdict + findings + recs).
 * Covers each rule, the Focused caps, and every red-team regression
 * (avgHr-only capping, unconditional zone finding, split-pattern warm-up,
 * raw-fraction tier, negative drift, empty-recs, undefined split HR).
 */

import { describe, it, expect } from 'vitest';
import type { MafZone, MafVerdict, TimeInZone } from '../maf-activity-analysis';
import type { StravaSplitMetric } from '../../services/strava-service';
import { coachingInsights, type CoachingInput } from '../maf-coaching-insights';

const ZONE: MafZone = { lower: 140, upper: 150 };

function v(status: MafVerdict['status'], deltaBpm = status === 'in' ? 0 : 5): MafVerdict {
  return { status, deltaBpm };
}

function tiz(belowSec: number, inSec: number, aboveSec: number): TimeInZone {
  const totalSec = belowSec + inSec + aboveSec;
  const pct = (s: number) => Math.round((s / totalSec) * 100);
  return { belowSec, inSec, aboveSec, totalSec, belowPct: pct(belowSec), inPct: pct(inSec), abovePct: pct(aboveSec) };
}

function split(average_speed: number, average_heartrate?: number): StravaSplitMetric {
  return {
    distance: 1000, elapsed_time: 300, elevation_difference: 0, moving_time: 300,
    split: 1, average_speed, average_heartrate,
  };
}

function input(overrides: Partial<CoachingInput>): CoachingInput {
  return {
    verdict: null, timeInZone: null, drift: null, aerobicEff: null, splits: [],
    zone: ZONE, activityType: 'Run', movingTimeSec: 3600, avgHr: 145,
    ...overrides,
  };
}

const hasCH = (r: NonNullable<ReturnType<typeof coachingInsights>>, ch: string) =>
  r.findings.some((f) => f.bookRef === ch);

describe('tier', () => {
  it('all-in-zone + low drift → aerobic-effective', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: 3 }))!;
    expect(r.tier).toBe('aerobic-effective');
  });

  it('25% above-time → mixed', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 75, 25) }))!;
    expect(r.tier).toBe('mixed');
  });

  it('high drift alone downgrades in-zone run to mixed', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: 7 }))!;
    expect(r.tier).toBe('mixed');
  });

  it('55% above-time → above-zone', () => {
    const r = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 45, 55) }))!;
    expect(r.tier).toBe('above-zone');
  });

  it('A1: avgHr-only 1bpm over → capped at mixed, NOT above-zone, and no overreach', () => {
    const r = coachingInsights(input({ verdict: v('above', 1), timeInZone: null, avgHr: 151, movingTimeSec: 2400 }))!;
    expect(r.tier).toBe('mixed');
    expect(hasCH(r, 'CH9')).toBe(false); // overreach requires a real distribution
  });

  it('A7: avgHr-only in-zone → aerobic-effective with ≥1 finding + ≥1 rec', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: null, avgHr: 145 }))!;
    expect(r.tier).toBe('aerobic-effective');
    expect(r.findings.length).toBeGreaterThanOrEqual(1);
    expect(r.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('A7: avgHr-only below-zone → aerobic-effective with ≥1 finding', () => {
    const r = coachingInsights(input({ verdict: v('below'), timeInZone: null, avgHr: 135 }))!;
    expect(r.tier).toBe('aerobic-effective');
    expect(r.findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('findings', () => {
  it('zone finding cites CH3, warn when above-time present', () => {
    const r = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 40, 60) }))!;
    const zone = r.findings.find((f) => f.bookRef === 'CH3')!;
    expect(zone.severity).toBe('warn');
  });

  it('zone finding good when mostly in/below zone', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(10, 90, 0) }))!;
    expect(r.findings.find((f) => f.bookRef === 'CH3')!.severity).toBe('good');
  });

  it('drift ≥5 → CH4 warn', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: 7 }))!;
    expect(r.findings.some((f) => f.bookRef === 'CH4' && f.severity === 'warn')).toBe(true);
  });

  it('A8: negative drift → CH4 good, no "-8"/NaN artifact in copy', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: -8 }))!;
    const d = r.findings.find((f) => f.bookRef === 'CH4')!;
    expect(d.severity).toBe('good');
    expect(d.text).not.toContain('-8');
    expect(d.text).not.toContain('NaN');
  });

  it('A4: warm-up (sped-up-later) fires on non-above-zone, info on green session', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), splits: [split(3.0), split(3.5)] }))!;
    const w = r.findings.find((f) => f.bookRef === 'CH5')!;
    expect(w).toBeDefined();
    expect(w.severity).toBe('info'); // aerobic-effective tier
  });

  it('A4: warm-up suppressed on above-zone run', () => {
    const r = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 40, 60), splits: [split(3.0), split(3.5)] }))!;
    expect(hasCH(r, 'CH5')).toBe(false);
  });

  it('A2: overreach cites CH9 with conditional phrasing on a base run', () => {
    const r = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 40, 60), activityType: 'Run', movingTimeSec: 3600 }))!;
    const o = r.findings.find((f) => f.bookRef === 'CH9')!;
    expect(o.text).toContain('Nếu đây là buổi chạy nền/dễ');
  });

  it('overreach does NOT fire on non-base type or short run', () => {
    const workout = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 40, 60), activityType: 'Workout' }))!;
    expect(hasCH(workout, 'CH9')).toBe(false);
    const short = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 40, 60), activityType: 'Run', movingTimeSec: 600 }))!;
    expect(hasCH(short, 'CH9')).toBe(false);
  });

  it('efficiency info finding present when eff > 0, cites CH4', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), aerobicEff: 1.2 }))!;
    expect(r.findings.some((f) => f.bookRef === 'CH4' && f.text.includes('m/nhịp'))).toBe(true);
  });

  it('A8: efficiency skipped when eff is 0', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), aerobicEff: 0 }))!;
    expect(r.findings.some((f) => f.text.includes('m/nhịp'))).toBe(false);
  });

  it('A9: findings never exceed the Focused cap of 4', () => {
    // Max reachable = zone + drift + (overreach XOR warm-up) + efficiency = 4 (overreach & warm-up are mutually exclusive by tier).
    const r = coachingInsights(input({
      verdict: v('above'), timeInZone: tiz(0, 40, 60), drift: 8, aerobicEff: 1.2,
      splits: [split(3.0), split(3.5)], activityType: 'Run', movingTimeSec: 3600,
    }))!;
    expect(r.findings.length).toBeLessThanOrEqual(4);
  });
});

describe('recommendations', () => {
  it('above-zone → "Giảm tốc" rec (CH3), ≤3 recs', () => {
    const r = coachingInsights(input({ verdict: v('above'), timeInZone: tiz(0, 40, 60) }))!;
    expect(r.recommendations.some((x) => x.text.includes('Giảm tốc'))).toBe(true);
    expect(r.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('driftBad → hydration rec (CH4)', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: 9 }))!;
    expect(r.recommendations.some((x) => x.bookRef === 'CH4' && x.text.includes('nước'))).toBe(true);
  });

  it('A3: mixed tier never yields empty recommendations', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 75, 25), drift: 2 }))!;
    expect(r.tier).toBe('mixed');
    expect(r.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('good session → maintain rec (CH4)', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: 2 }))!;
    expect(r.recommendations.some((x) => x.bookRef === 'CH4' && x.text.includes('Giữ vững'))).toBe(true);
  });
});

describe('degradation / guards', () => {
  it('invalid zone (upper<=0) → null', () => {
    expect(coachingInsights(input({ verdict: v('in'), zone: { lower: -10, upper: 0 } }))).toBeNull();
  });

  it('no verdict AND no timeInZone → null', () => {
    expect(coachingInsights(input({ verdict: null, timeInZone: null }))).toBeNull();
  });

  it('empty splits → no warm-up finding, no throw', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), splits: [] }))!;
    expect(hasCH(r, 'CH5')).toBe(false);
  });

  it('drift null → no CH4 drift finding (efficiency may still add CH4)', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), drift: null }))!;
    expect(r.findings.some((f) => f.bookRef === 'CH4' && f.text.includes('Trôi tim mạch'))).toBe(false);
  });

  it('A5: splits with undefined average_heartrate → no NaN/undefined in any copy', () => {
    const r = coachingInsights(input({ verdict: v('in'), timeInZone: tiz(0, 100, 0), splits: [split(3.0, undefined), split(3.5, undefined)] }))!;
    for (const f of r.findings) {
      expect(f.text).not.toContain('NaN');
      expect(f.text).not.toContain('undefined');
    }
  });
});
