/**
 * Tests for pure MAF analysis math (time-in-zone, cardiac drift, aerobic
 * efficiency, verdict). Covers happy paths + the null/edge guards that let
 * the UI render degradation states instead of crashing on bad stream data.
 */

import { describe, it, expect } from 'vitest';
import {
  timeInZone,
  cardiacDrift,
  aerobicEfficiency,
  verdict,
  type MafZone,
} from '../maf-activity-analysis';

// zone = { lower: mafHr - 10, upper: mafHr } convention, e.g. mafHr 150 -> [140, 150]
const ZONE: MafZone = { lower: 140, upper: 150 };

describe('timeInZone', () => {
  it('returns 100% in-zone for uniform 1s samples all within the band', () => {
    const hr = [145, 145, 145, 145, 145];
    const time = [0, 1, 2, 3, 4];
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    expect(result!.inPct).toBe(100);
    expect(result!.belowPct).toBe(0);
    expect(result!.abovePct).toBe(0);
    expect(result!.totalSec).toBe(4);
  });

  it('accumulates exact seconds per bucket for mixed below/in/above with known dts', () => {
    // t=0->2 (dt2) hr=130 below; t=2->5 (dt3) hr=145 in; t=5->9 (dt4) hr=160 above
    const hr = [130, 130, 145, 160];
    const time = [0, 2, 5, 9];
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    expect(result!.belowSec).toBe(2);
    expect(result!.inSec).toBe(3);
    expect(result!.aboveSec).toBe(4);
    expect(result!.totalSec).toBe(9);
    expect(result!.belowPct + result!.inPct + result!.abovePct).toBe(100);
  });

  it('weights by non-uniform dt rather than sample count', () => {
    // Only 2 samples contribute after i=0 baseline: dt=1 below, dt=19 in.
    // Sample count would split 50/50; time-weighting must skew heavily to "in".
    const hr = [130, 130, 145];
    const time = [0, 1, 20];
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    expect(result!.belowSec).toBe(1);
    expect(result!.inSec).toBe(19);
    expect(result!.inPct).toBeGreaterThan(result!.belowPct);
  });

  it('returns null when hr is undefined', () => {
    expect(timeInZone(undefined, [0, 1, 2], ZONE)).toBeNull();
  });

  it('returns null when hr is empty', () => {
    expect(timeInZone([], [], ZONE)).toBeNull();
  });

  it('returns null when time is undefined', () => {
    expect(timeInZone([145, 145], undefined, ZONE)).toBeNull();
  });

  it('uses the shorter array length when hr/time are mismatched', () => {
    const hr = [145, 145, 145, 145]; // longer
    const time = [0, 1, 2]; // shorter -> n=3, contributes dt at i=1,2
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    expect(result!.totalSec).toBe(2);
  });

  it('classifies hr exactly at lower/upper boundary as in-zone', () => {
    // hr[0]=100 is only the dt baseline (never classified); i=1 hits the
    // lower boundary (140), i=2 hits the upper boundary (150) — both "in".
    const hr = [100, 140, 150];
    const time = [0, 5, 10];
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    expect(result!.inSec).toBe(10);
    expect(result!.belowSec).toBe(0);
    expect(result!.aboveSec).toBe(0);
  });

  it('skips intervals with dt > 30s (auto-pause gap)', () => {
    // dt=5 in-zone counted, dt=40 skipped entirely (gap cap)
    const hr = [145, 145, 145];
    const time = [0, 5, 45];
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    expect(result!.totalSec).toBe(5);
  });

  it('skips a sample whose hr value is undefined', () => {
    const hr = [145, undefined as unknown as number, 145];
    const time = [0, 3, 6];
    const result = timeInZone(hr, time, ZONE);
    expect(result).not.toBeNull();
    // interval i=1 (dt=3, hr[1] undefined) skipped; interval i=2 (dt=3, hr[2]=145) counted
    expect(result!.totalSec).toBe(3);
    expect(result!.inSec).toBe(3);
  });

  it('returns null when every interval is skipped (all gaps too large)', () => {
    const hr = [145, 145];
    const time = [0, 40];
    expect(timeInZone(hr, time, ZONE)).toBeNull();
  });
});

describe('cardiacDrift', () => {
  it('returns ~0 when efficiency factor is constant across both halves', () => {
    const n = 20;
    const speed = Array.from({ length: n }, () => 3);
    const hr = Array.from({ length: n }, () => 150);
    const time = Array.from({ length: n }, (_, i) => i);
    const result = cardiacDrift(speed, hr, time);
    expect(result).not.toBeNull();
    expect(Math.abs(result!)).toBeLessThanOrEqual(0.1);
  });

  it('returns positive drift when second-half HR is higher (fatigue)', () => {
    const n = 20;
    const speed = Array.from({ length: n }, () => 3);
    const hr = Array.from({ length: n }, (_, i) => (i < 10 ? 140 : 160));
    const time = Array.from({ length: n }, (_, i) => i);
    const result = cardiacDrift(speed, hr, time);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it('returns null when there are too few moving samples', () => {
    const result = cardiacDrift([3, 3, 3], [150, 150, 150], [0, 1, 2]);
    expect(result).toBeNull();
  });

  it('returns null when speed is always zero (nothing moving)', () => {
    const n = 10;
    const speed = Array.from({ length: n }, () => 0);
    const hr = Array.from({ length: n }, () => 150);
    const time = Array.from({ length: n }, (_, i) => i);
    expect(cardiacDrift(speed, hr, time)).toBeNull();
  });

  it('returns null for an all-stopped stream (never exceeds moving threshold)', () => {
    const n = 12;
    const speed = Array.from({ length: n }, () => 0.2); // below MOVING_SPEED_THRESHOLD
    const hr = Array.from({ length: n }, () => 150);
    const time = Array.from({ length: n }, (_, i) => i);
    expect(cardiacDrift(speed, hr, time)).toBeNull();
  });

  it('is not distorted by an asymmetric mid-run pause (stopped block + large dt gap in one half)', () => {
    // First half: 10 moving samples at constant EF (speed 3, hr 150).
    // Mid-run: a stopped block (speed 0) plus a >30s gap injected only in the
    // first half's time series, then second half: 10 moving samples same EF.
    // Because moving-filter + gap-cap exclude the pause entirely, drift should
    // stay ~0 despite the pause being asymmetric (only in first half).
    const speed: number[] = [];
    const hr: number[] = [];
    const time: number[] = [];
    let t = 0;

    // 10 moving samples (first half)
    for (let i = 0; i < 10; i++) {
      speed.push(3);
      hr.push(150);
      time.push(t);
      t += 1;
    }
    // asymmetric pause: stopped samples + big gap, only after first half
    speed.push(0);
    hr.push(150);
    time.push(t);
    t += 1;
    speed.push(0);
    hr.push(150);
    time.push(t);
    t += 45; // >30s gap on the next interval
    // 10 more moving samples (second half) at identical EF
    for (let i = 0; i < 10; i++) {
      speed.push(3);
      hr.push(150);
      time.push(t);
      t += 1;
    }

    const result = cardiacDrift(speed, hr, time);
    expect(result).not.toBeNull();
    expect(Math.abs(result!)).toBeLessThanOrEqual(0.5);
  });
});

describe('aerobicEfficiency', () => {
  it('computes meters-per-heartbeat-minute for known values', () => {
    // (2.5 m/s * 60) / 140 = 1.0714... -> 1.07
    expect(aerobicEfficiency(2.5, 140)).toBe(1.07);
  });

  it('returns null when avgHr is 0', () => {
    expect(aerobicEfficiency(2.5, 0)).toBeNull();
  });

  it('returns null when avgHr is null', () => {
    expect(aerobicEfficiency(2.5, null)).toBeNull();
  });

  it('returns null when avgSpeed is null', () => {
    expect(aerobicEfficiency(null, 140)).toBeNull();
  });
});

describe('verdict', () => {
  it('returns "below" with positive deltaBpm when avgHr is under the zone', () => {
    const result = verdict(130, ZONE);
    expect(result).toEqual({ status: 'below', deltaBpm: 10 });
  });

  it('returns "in" with deltaBpm 0 for a mid-zone avgHr', () => {
    const result = verdict(145, ZONE);
    expect(result).toEqual({ status: 'in', deltaBpm: 0 });
  });

  it('returns "above" with positive deltaBpm when avgHr exceeds the zone', () => {
    const result = verdict(160, ZONE);
    expect(result).toEqual({ status: 'above', deltaBpm: 10 });
  });

  it('treats avgHr exactly at the lower boundary as "in"', () => {
    expect(verdict(140, ZONE)).toEqual({ status: 'in', deltaBpm: 0 });
  });

  it('treats avgHr exactly at the upper boundary as "in"', () => {
    expect(verdict(150, ZONE)).toEqual({ status: 'in', deltaBpm: 0 });
  });

  it('returns null when avgHr is null', () => {
    expect(verdict(null, ZONE)).toBeNull();
  });

  it('returns null when zone.upper is 0 (mafHr not configured)', () => {
    expect(verdict(150, { lower: -10, upper: 0 })).toBeNull();
  });
});
