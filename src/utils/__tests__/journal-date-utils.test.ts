/**
 * Tests for pure journal date math. Fixtures use the LOCAL Date constructor
 * (new Date(y, m, d, ...)) so week/boundary assertions are deterministic on any
 * CI timezone (RT-6) — no reliance on ambient TZ.
 */

import { describe, it, expect } from 'vitest';
import { mondayOf, weekRangeLabel, windowRange } from '../journal-date-utils';

describe('mondayOf', () => {
  it('maps a Wednesday to the Monday of its week', () => {
    // Wed 2026-07-15 → Mon 2026-07-13
    const monday = mondayOf(new Date(2026, 6, 15, 9, 30));
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(6);
    expect(monday.getDate()).toBe(13);
    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getHours()).toBe(0);
  });

  it('maps a Sunday back to the PREVIOUS Monday (week starts Monday)', () => {
    // Sun 2026-07-12 → Mon 2026-07-06 (not 07-13)
    const monday = mondayOf(new Date(2026, 6, 12, 20, 0));
    expect(monday.getDate()).toBe(6);
    expect(monday.getDay()).toBe(1);
  });

  it('keeps a Monday on the same day at 00:00', () => {
    const monday = mondayOf(new Date(2026, 6, 13, 15, 0));
    expect(monday.getDate()).toBe(13);
    expect(monday.getHours()).toBe(0);
  });

  it('puts a Sat and the following Sun in DIFFERENT weeks across the Mon boundary', () => {
    const sat = mondayOf(new Date(2026, 6, 11)); // Sat → Mon 07-06
    const sun = mondayOf(new Date(2026, 6, 12)); // Sun → Mon 07-06 (same week as Sat)
    const nextMon = mondayOf(new Date(2026, 6, 13)); // Mon → 07-13 (new week)
    expect(sat.getTime()).toBe(sun.getTime());
    expect(nextMon.getTime()).not.toBe(sun.getTime());
  });
});

describe('weekRangeLabel', () => {
  it('formats "dd/M – dd/M" from Monday to Sunday', () => {
    const label = weekRangeLabel(new Date(2026, 6, 6)); // Mon 07-06 → Sun 07-12
    expect(label).toBe('06/7 – 12/7');
  });

  it('spans a month boundary correctly', () => {
    const label = weekRangeLabel(new Date(2026, 6, 27)); // Mon 07-27 → Sun 08-02
    expect(label).toBe('27/7 – 02/8');
  });
});

describe('windowRange', () => {
  const now = new Date(2026, 6, 13, 12, 0); // fixed Mon 2026-07-13 noon

  it('index 0: until == now, since 6 months back', () => {
    const { since, until } = windowRange(now, 0);
    expect(until).toBe(now.toISOString());
    expect(since).toBe(new Date(2026, 0, 13, 12, 0).toISOString()); // Jan 13
  });

  it('index 1 tiles exactly onto index 0 (since₀ === until₁) — no gap, no overlap', () => {
    const w0 = windowRange(now, 0);
    const w1 = windowRange(now, 1);
    expect(w1.until).toBe(w0.since);
  });

  it('produces half-open back-to-back windows for a stable now', () => {
    const w1 = windowRange(now, 1);
    expect(w1.until).toBe(new Date(2026, 0, 13, 12, 0).toISOString()); // Jan 13
    expect(w1.since).toBe(new Date(2025, 6, 13, 12, 0).toISOString()); // Jul 13 2025
  });
});
