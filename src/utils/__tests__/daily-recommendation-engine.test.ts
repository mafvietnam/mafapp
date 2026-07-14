/**
 * Tests for daily-recommendation-engine.ts. Covers RED TEAM FIX #6 (child
 * short-circuit), #13 (proportional warm/cool, mainMinutes>=5, all-easy<35,
 * RED=rest/walk-only never a run), and the GREEN/AMBER/RED tier branches.
 */

import { describe, it, expect } from 'vitest';
import type { ScheduleItem, ReadinessResult, ReasonCode, ReadinessTier } from '../../types';
import { buildDailyRecommendation, type RecommendationInput } from '../daily-recommendation-engine';

function scheduleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return { day: 'Thứ 3', activity: 'Chạy MAF', duration: 45, type: 'RUN', ...overrides };
}

function readiness(tier: ReadinessTier, reasons: ReasonCode[] = []): ReadinessResult {
  return { tier, score: 0, reasons };
}

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    adjustedScheduleItem: scheduleItem(),
    mafHr: 145,
    readiness: readiness('GREEN'),
    profile: { age: 35, bmi: 22 },
    ...overrides,
  };
}

describe('RED TEAM FIX #6 — child (age<16) short-circuit', () => {
  it('returns play-only REST with no HR zone, no citations, GREEN tier', () => {
    const rec = buildDailyRecommendation(input({ profile: { age: 10, bmi: 0 } }));
    expect(rec.dayType).toBe('REST');
    expect(rec.hrZone).toBeNull();
    expect(rec.totalMinutes).toBe(0);
    expect(rec.citations).toEqual([]);
    expect(rec.restCopy).toContain('VUI CHƠI');
    expect(rec.tier).toBe('GREEN');
  });

  it('skips tier/adjustment logic even when readiness is RED', () => {
    const rec = buildDailyRecommendation(
      input({ profile: { age: 8, bmi: 0 }, readiness: readiness('RED', [{ code: 'rhr_bad', severity: 'bad', text: 'x' }]) }),
    );
    expect(rec.dayType).toBe('REST');
    expect(rec.reasons).toEqual([]);
  });
});

describe('GREEN tier — as scheduled (orchestrator-adjusted)', () => {
  it('RUN 45min => title "Chạy nhẹ nhàng 45 phút", proportional warm/cool, MAF zone, CH5/CH6 citations', () => {
    const rec = buildDailyRecommendation(input());
    expect(rec.dayType).toBe('RUN');
    expect(rec.title).toBe('Chạy nhẹ nhàng 45 phút');
    expect(rec.totalMinutes).toBe(45);
    expect(rec.warmupMin).toBe(9); // clamp(round(45*0.2),5,15) = 9
    expect(rec.cooldownMin).toBe(9);
    expect(rec.mainMinutes).toBe(27);
    expect(rec.allEasy).toBe(false);
    expect(rec.hrZone).toEqual({ lower: 135, upper: 145 });
    expect(rec.citations).toEqual(['CH5', 'CH6']);
    expect(rec.tier).toBe('GREEN');
  });

  it('scheduled REST day stays REST with minimal P1 copy', () => {
    const rec = buildDailyRecommendation(input({ adjustedScheduleItem: scheduleItem({ type: 'REST', duration: 0 }) }));
    expect(rec.dayType).toBe('REST');
    expect(rec.restCopy).toContain('Tập luyện = Vận động + Nghỉ ngơi');
    expect(rec.citations).toEqual(['CH7']);
  });

  it('hrZone is null when mafHr<=0', () => {
    const rec = buildDailyRecommendation(input({ mafHr: 0 }));
    expect(rec.hrZone).toBeNull();
  });

  it('CROSS_TRAIN schedule type maps to RECOVERY dayType (union has no CROSS_TRAIN bucket)', () => {
    const rec = buildDailyRecommendation(input({ adjustedScheduleItem: scheduleItem({ type: 'CROSS_TRAIN', duration: 45 }) }));
    expect(rec.dayType).toBe('RECOVERY');
  });
});

describe('RED TEAM FIX #13 — AMBER duration math (worked example)', () => {
  it('45min AMBER -35% => 30min, all-easy (30 main minutes, never 0)', () => {
    const rec = buildDailyRecommendation(
      input({ readiness: readiness('AMBER', [{ code: 'sleep_warn', severity: 'warn', text: 'ngủ ít' }]) }),
    );
    expect(rec.totalMinutes).toBe(30);
    expect(rec.allEasy).toBe(true);
    expect(rec.mainMinutes).toBe(30);
    expect(rec.warmupMin).toBe(0);
    expect(rec.cooldownMin).toBe(0);
    expect(rec.tier).toBe('AMBER');
    expect(rec.citations).toEqual(['CH5', 'CH6', 'CH7']);
    expect(rec.adjustmentNote).toContain('Đã giảm còn 30 phút');
  });

  it('larger AMBER session (90min -35%=~60) keeps mainMinutes>=5 with proportional warm/cool', () => {
    const rec = buildDailyRecommendation(
      input({
        adjustedScheduleItem: scheduleItem({ duration: 90, type: 'LONG_RUN' }),
        readiness: readiness('AMBER', [{ code: 'sleep_warn', severity: 'warn', text: 'x' }]),
      }),
    );
    expect(rec.mainMinutes).toBeGreaterThanOrEqual(5);
    expect(rec.totalMinutes).toBeGreaterThan(0);
  });

  it('AMBER on a scheduled REST day stays REST (no workout forced onto a rest day)', () => {
    const rec = buildDailyRecommendation(
      input({
        adjustedScheduleItem: scheduleItem({ type: 'REST', duration: 0 }),
        readiness: readiness('AMBER', [{ code: 'sleep_warn', severity: 'warn', text: 'x' }]),
      }),
    );
    expect(rec.dayType).toBe('REST');
    expect(rec.tier).toBe('AMBER');
  });

  it('soreness_warn reason swaps RUN => WALK on AMBER', () => {
    const rec = buildDailyRecommendation(
      input({ readiness: readiness('AMBER', [{ code: 'soreness_warn', severity: 'warn', text: 'đau bắp chân' }]) }),
    );
    expect(rec.dayType).toBe('WALK');
    expect(rec.adjustmentNote).toContain('chuyển sang đi bộ');
  });

  it('soreness_warn on an already-WALK scheduled day does not duplicate the swap phrase', () => {
    const rec = buildDailyRecommendation(
      input({
        adjustedScheduleItem: scheduleItem({ type: 'WALK', duration: 45 }),
        readiness: readiness('AMBER', [{ code: 'soreness_warn', severity: 'warn', text: 'x' }]),
      }),
    );
    expect(rec.dayType).toBe('WALK');
    expect(rec.adjustmentNote).not.toContain('chuyển sang đi bộ');
  });
});

describe('RED TEAM FIX #13 — RED is REST or gentle WALK only, NEVER a run', () => {
  const scheduledTypes: ScheduleItem['type'][] = ['RUN', 'LONG_RUN', 'WALK', 'CROSS_TRAIN', 'RECOVERY'];

  it.each(scheduledTypes)('RED always yields dayType=REST regardless of scheduled type (%s)', (type) => {
    const rec = buildDailyRecommendation(
      input({
        adjustedScheduleItem: scheduleItem({ type, duration: 60 }),
        readiness: readiness('RED', [{ code: 'rhr_bad', severity: 'bad', bookRef: 'CH7', text: 'Nhịp tim nghỉ tăng +7 bpm — dấu hiệu cơ thể cần hồi phục (Chương 7).' }]),
      }),
    );
    expect(rec.dayType).toBe('REST');
    expect(rec.totalMinutes).toBe(0);
    expect(rec.citations).toEqual(['CH7']);
  });

  it('restCopy surfaces the bad reason verbatim (VN copy sample)', () => {
    const rec = buildDailyRecommendation(
      input({ readiness: readiness('RED', [{ code: 'rhr_bad', severity: 'bad', bookRef: 'CH7', text: 'Nhịp tim nghỉ tăng +7 bpm — dấu hiệu cơ thể cần hồi phục (Chương 7).' }]) }),
    );
    expect(rec.restCopy).toBe('Hôm nay nên NGHỈ. Nhịp tim nghỉ tăng +7 bpm — dấu hiệu cơ thể cần hồi phục (Chương 7).');
  });

  it('falls back to a generic REST copy when RED has no bad-severity reason (e.g. multi-warn escalation)', () => {
    const rec = buildDailyRecommendation(
      input({ readiness: readiness('RED', [{ code: 'sleep_warn', severity: 'warn', text: 'x' }, { code: 'soreness_warn', severity: 'warn', text: 'y' }]) }),
    );
    expect(rec.restCopy).toContain('Hôm nay nên NGHỈ');
  });
});
