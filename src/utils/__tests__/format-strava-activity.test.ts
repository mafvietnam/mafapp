/**
 * Tests for Strava activity display formatters
 * Covers pace/distance/date edge cases and MAF HR-zone coloring
 */

import { describe, it, expect } from 'vitest';
import {
  formatActivityDate,
  formatDistanceKm,
  formatPace,
  hrZone,
} from '../format-strava-activity';

describe('formatActivityDate', () => {
  it('formats a valid ISO date as vi-VN short date', () => {
    const result = formatActivityDate('2026-10-12T08:00:00Z');
    expect(result).toMatch(/12/);
  });

  it('returns em-dash for an invalid date string', () => {
    expect(formatActivityDate('not-a-date')).toBe('—');
  });
});

describe('formatDistanceKm', () => {
  it('converts meters to km with 2 decimals', () => {
    expect(formatDistanceKm(5000)).toBe('5.00 km');
  });

  it('handles zero distance without dividing by zero', () => {
    expect(formatDistanceKm(0)).toBe('0.00 km');
  });

  it('handles negative distance gracefully', () => {
    expect(formatDistanceKm(-100)).toBe('0.00 km');
  });
});

describe('formatPace', () => {
  it('prefers explicit avgPace (min/km) when present', () => {
    // 4.75 min/km = 4:45 /km
    expect(formatPace({ avgPace: 4.75, movingTime: 0, distance: 0 })).toBe('4:45 /km');
  });

  it('formats a whole-number avgPace (min/km) correctly', () => {
    // 7.0 min/km = 7:00 /km (regression: was mis-read as 7 sec/km => 0:07)
    expect(formatPace({ avgPace: 7.0, movingTime: 0, distance: 0 })).toBe('7:00 /km');
  });

  it('derives pace from movingTime/distance when avgPace missing', () => {
    // 1800s moving over 5000m = 5km => 360 sec/km = 6:00 /km
    expect(formatPace({ avgPace: null, movingTime: 1800, distance: 5000 })).toBe('6:00 /km');
  });

  it('returns em-dash when distance is zero (guards divide-by-zero)', () => {
    expect(formatPace({ avgPace: null, movingTime: 1800, distance: 0 })).toBe('—');
  });

  it('returns em-dash when movingTime is zero and avgPace missing', () => {
    expect(formatPace({ avgPace: null, movingTime: 0, distance: 5000 })).toBe('—');
  });

  it('returns em-dash when both avgPace and moving data are unknown', () => {
    expect(formatPace({ avgPace: null, movingTime: 0, distance: 0 })).toBe('—');
  });

  it('pads seconds under 10 with a leading zero', () => {
    // 6.1 min/km = 366 sec/km = 6:06 /km
    expect(formatPace({ avgPace: 6.1, movingTime: 0, distance: 0 })).toBe('6:06 /km');
  });
});

describe('hrZone', () => {
  it('returns em-dash label + neutral color when avgHr is null', () => {
    const result = hrZone(null, 150);
    expect(result.label).toBe('—');
    expect(result.warn).toBe(false);
    expect(result.colorClass).toBe('text-maf-violet');
  });

  it('warns red when avgHr exceeds mafHr', () => {
    const result = hrZone(160, 150);
    expect(result.warn).toBe(true);
    expect(result.colorClass).toBe('text-maf-red');
    expect(result.label).toBe('160 bpm');
  });

  it('colors emerald when avgHr is within the MAF zone', () => {
    const result = hrZone(140, 150);
    expect(result.warn).toBe(false);
    expect(result.colorClass).toBe('text-emerald-400');
  });

  it('is neutral (no warn) when mafHr is 0 (incomplete profile)', () => {
    const result = hrZone(160, 0);
    expect(result.warn).toBe(false);
    expect(result.colorClass).toBe('text-maf-violet');
    expect(result.label).toBe('160 bpm');
  });

  it('is neutral when mafHr is negative', () => {
    const result = hrZone(160, -5);
    expect(result.warn).toBe(false);
    expect(result.colorClass).toBe('text-maf-violet');
  });
});
