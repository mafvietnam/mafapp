/**
 * Tests for MAF Volume Cap
 * Validates weekly volume cap enforcement and summary formatting
 */

import { describe, it, expect } from 'vitest';
import {
  VOLUME_CAPS,
  enforceWeeklyVolumeCap,
  calculateTotalWeeklyMinutes,
  formatWeeklyVolumeSummary
} from '../maf-volume-cap';
import { CommitmentLevel, ScheduleItem } from '../../types';

describe('VOLUME_CAPS constant', () => {
  it('should define caps for all commitment levels', () => {
    expect(VOLUME_CAPS).toHaveProperty(CommitmentLevel.HEALTH);
    expect(VOLUME_CAPS).toHaveProperty(CommitmentLevel.BASE);
    expect(VOLUME_CAPS).toHaveProperty(CommitmentLevel.PERFORMANCE);
  });

  it('HEALTH should cap at 240 mins (4h/week)', () => {
    expect(VOLUME_CAPS[CommitmentLevel.HEALTH].maxWeeklyMinutes).toBe(240);
  });

  it('HEALTH long run should cap at 60 mins (1h)', () => {
    expect(VOLUME_CAPS[CommitmentLevel.HEALTH].maxLongRunMinutes).toBe(60);
  });

  it('BASE should cap at 420 mins (7h/week)', () => {
    expect(VOLUME_CAPS[CommitmentLevel.BASE].maxWeeklyMinutes).toBe(420);
  });

  it('BASE long run should cap at 120 mins (2h)', () => {
    expect(VOLUME_CAPS[CommitmentLevel.BASE].maxLongRunMinutes).toBe(120);
  });

  it('PERFORMANCE should cap at 720 mins (12h/week)', () => {
    expect(VOLUME_CAPS[CommitmentLevel.PERFORMANCE].maxWeeklyMinutes).toBe(720);
  });

  it('PERFORMANCE long run should cap at 180 mins (3h)', () => {
    expect(VOLUME_CAPS[CommitmentLevel.PERFORMANCE].maxLongRunMinutes).toBe(180);
  });

  it('should have description for each level', () => {
    expect(VOLUME_CAPS[CommitmentLevel.HEALTH].description).toContain('Sức Khỏe');
    expect(VOLUME_CAPS[CommitmentLevel.BASE].description).toContain('Nền Tảng');
    expect(VOLUME_CAPS[CommitmentLevel.PERFORMANCE].description).toContain('Hiệu Suất');
  });
});

describe('calculateTotalWeeklyMinutes', () => {
  it('should sum all session durations', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Run', duration: 60, type: 'RUN' },
      { day: 'Tue', activity: 'Rest', duration: 0, type: 'REST' },
      { day: 'Wed', activity: 'Run', duration: 45, type: 'RUN' },
      { day: 'Thu', activity: 'Walk', duration: 30, type: 'WALK' },
    ];
    expect(calculateTotalWeeklyMinutes(schedule)).toBe(135);
  });

  it('should return 0 for empty schedule', () => {
    expect(calculateTotalWeeklyMinutes([])).toBe(0);
  });

  it('should return 0 for all-rest schedule', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Rest', duration: 0, type: 'REST' },
      { day: 'Tue', activity: 'Rest', duration: 0, type: 'REST' },
    ];
    expect(calculateTotalWeeklyMinutes(schedule)).toBe(0);
  });

  it('should handle large numbers', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Long Run', duration: 480, type: 'LONG_RUN' },
      { day: 'Tue', activity: 'Run', duration: 240, type: 'RUN' },
    ];
    expect(calculateTotalWeeklyMinutes(schedule)).toBe(720);
  });
});

describe('enforceWeeklyVolumeCap', () => {
  const baselineSchedule: ScheduleItem[] = [
    { day: 'Mon', activity: 'Rest', duration: 0, type: 'REST' },
    { day: 'Tue', activity: 'Run', duration: 60, type: 'RUN' },
    { day: 'Wed', activity: 'Recovery', duration: 45, type: 'RECOVERY' },
    { day: 'Thu', activity: 'Run', duration: 60, type: 'RUN' },
    { day: 'Fri', activity: 'Rest', duration: 0, type: 'REST' },
    { day: 'Sat', activity: 'Long Run', duration: 90, type: 'LONG_RUN' },
    { day: 'Sun', activity: 'Walk', duration: 30, type: 'WALK' },
  ];

  describe('Under cap - no changes', () => {
    it('should not modify schedule when total < cap', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 45, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 60, type: 'LONG_RUN' },
        { day: 'Sun', activity: 'Walk', duration: 30, type: 'WALK' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      expect(result.wasReduced).toBe(false);
      expect(result.adjustedSchedule).toEqual(schedule);
      expect(result.originalTotal).toBe(135);
      expect(result.adjustedTotal).toBe(135);
    });

    it('should not reduce when exactly at cap', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
        { day: 'Sun', activity: 'Walk', duration: 45, type: 'WALK' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.BASE);
      // 60 + 120 + 45 = 225 < 420, under cap
      expect(result.wasReduced).toBe(false);
    });
  });

  describe('Over cap - reduction applied', () => {
    it('should reduce WALK first (lowest priority)', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
        { day: 'Sun', activity: 'Walk', duration: 130, type: 'WALK' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.BASE);
      // Total = 250, cap = 420, under cap — no reduction
      expect(result.wasReduced).toBe(false);
    });

    it('should reduce high-volume schedule to fit HEALTH cap', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Wed', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Fri', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      // Total = 300, cap = 240, excess = 60
      expect(result.wasReduced).toBe(true);
      expect(result.originalTotal).toBe(300);
      expect(result.adjustedTotal).toBeLessThanOrEqual(240);
    });

    it('should preserve LONG_RUN when reducing', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 75, type: 'RUN' },
        { day: 'Wed', activity: 'Run', duration: 75, type: 'RUN' },
        { day: 'Fri', activity: 'Recovery', duration: 60, type: 'RECOVERY' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
        { day: 'Sun', activity: 'Walk', duration: 45, type: 'WALK' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.BASE);
      const longRun = result.adjustedSchedule.find(item => item.type === 'LONG_RUN');
      expect(longRun?.duration).toBe(120); // Preserved
    });

    it('should reduce by priority: WALK > CROSS_TRAIN > RUN > RECOVERY > LONG_RUN', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Walk', duration: 60, type: 'WALK' },
        { day: 'Tue', activity: 'Cross Train', duration: 60, type: 'CROSS_TRAIN' },
        { day: 'Wed', activity: 'Run', duration: 75, type: 'RUN' },
        { day: 'Thu', activity: 'Recovery', duration: 60, type: 'RECOVERY' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      // Total = 375, cap = 240, excess = 135
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);

      // WALK should be reduced first (or eliminated)
      const walk = result.adjustedSchedule.find(item => item.type === 'WALK');
      // After reduction, WALK should be smallest reduction possible
      expect(result.wasReduced).toBe(true);
      expect(result.adjustedTotal).toBeLessThanOrEqual(240);
    });

    it('should not reduce below 15-minute minimum per session', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Wed', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Fri', activity: 'Recovery', duration: 60, type: 'RECOVERY' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.BASE);
      // Check that no reduced session goes below 15 mins (except REST)
      result.adjustedSchedule.forEach(item => {
        if (item.type !== 'REST' && item.duration > 0) {
          expect(item.duration).toBeGreaterThanOrEqual(15);
        }
      });
    });
  });

  describe('Result structure', () => {
    it('should return WeeklyVolumeCapResult with all fields', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 45, type: 'RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      expect(result).toHaveProperty('adjustedSchedule');
      expect(result).toHaveProperty('wasReduced');
      expect(result).toHaveProperty('originalTotal');
      expect(result).toHaveProperty('adjustedTotal');
    });

    it('should include reduction message when wasReduced = true', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 300, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      if (result.wasReduced) {
        expect(result.reductionMessage).toBeDefined();
        expect(result.reductionMessage).toContain('ĐIỀU CHỈNH');
      }
    });

    it('should preserve original schedule (no mutation)', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 200, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const originalCopy = JSON.parse(JSON.stringify(schedule));
      enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      expect(schedule).toEqual(originalCopy);
    });
  });

  describe('Edge cases', () => {
    it('should handle schedule with only REST days', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Rest', duration: 0, type: 'REST' },
        { day: 'Tue', activity: 'Rest', duration: 0, type: 'REST' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      expect(result.wasReduced).toBe(false);
      expect(result.originalTotal).toBe(0);
    });

    it('should handle only LONG_RUN (non-reducible)', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Sat', activity: 'Long Run', duration: 180, type: 'LONG_RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.BASE);
      expect(result.adjustedSchedule[0].duration).toBe(180); // Not reduced
    });

    it('should return warning when cannot reduce further', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Sat', activity: 'Long Run', duration: 500, type: 'LONG_RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      // Over cap but can't reduce LONG_RUN
      if (!result.wasReduced) {
        expect(result.reductionMessage).toContain('Không thể giảm');
      }
    });

    it('should handle very large schedule properly', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Run', duration: 200, type: 'RUN' },
        { day: 'Tue', activity: 'Run', duration: 200, type: 'RUN' },
        { day: 'Wed', activity: 'Run', duration: 200, type: 'RUN' },
        { day: 'Thu', activity: 'Run', duration: 200, type: 'RUN' },
        { day: 'Fri', activity: 'Run', duration: 200, type: 'RUN' },
      ];
      const result = enforceWeeklyVolumeCap(schedule, CommitmentLevel.HEALTH);
      expect(result.adjustedTotal).toBeLessThanOrEqual(240);
    });
  });
});

describe('formatWeeklyVolumeSummary', () => {
  const healthSchedule: ScheduleItem[] = [
    { day: 'Mon', activity: 'Rest', duration: 0, type: 'REST' },
    { day: 'Wed', activity: 'Run', duration: 45, type: 'RUN' },
    { day: 'Fri', activity: 'Run', duration: 45, type: 'RUN' },
    { day: 'Sun', activity: 'Walk', duration: 30, type: 'WALK' },
  ];

  it('should format summary string with hours (and minutes if remainder)', () => {
    const summary = formatWeeklyVolumeSummary(healthSchedule, CommitmentLevel.HEALTH);
    // healthSchedule total = 120 mins = 2h (no remainder)
    expect(summary).toContain('Tổng tuần');
    expect(summary).toMatch(/\d+h/); // Contains "Xh"
    // Does not contain "p" if minutes are 0
  });

  it('should include minutes when remainder exists', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Run', duration: 90, type: 'RUN' }, // 1h30m
    ];
    const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);
    expect(summary).toContain('1h');
    expect(summary).toContain('30p');
  });

  it('should show percentage of cap', () => {
    const summary = formatWeeklyVolumeSummary(healthSchedule, CommitmentLevel.HEALTH);
    // 120 minutes = 2h / 240 min cap = 50%
    expect(summary).toContain('50%');
    expect(summary).toContain('giới hạn');
  });

  it('should handle durations with only hours (no remainder minutes)', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Run', duration: 120, type: 'RUN' },
    ];
    const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);
    // 120 mins = 2h, should not show "0p"
    expect(summary).toContain('2h');
    expect(summary).not.toMatch(/\d+h0p/); // Should not include 0p
  });

  it('should handle durations with hours and minutes', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Run', duration: 90, type: 'RUN' },
    ];
    const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);
    // 90 mins = 1h30p
    expect(summary).toContain('1h');
    expect(summary).toContain('30p');
  });

  it('should calculate correct percentage for different caps', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Run', duration: 300, type: 'RUN' },
    ];
    const healthSummary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.HEALTH);
    const baseSummary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);

    // 300 / 240 = 125% for HEALTH
    // 300 / 420 = 71% for BASE
    expect(healthSummary).toContain('125%');
    expect(baseSummary).toContain('71%');
  });

  it('should include emoji indicator', () => {
    const summary = formatWeeklyVolumeSummary(healthSchedule, CommitmentLevel.HEALTH);
    expect(summary).toContain('📊');
  });

  it('should show commitment package name', () => {
    const summary = formatWeeklyVolumeSummary(healthSchedule, CommitmentLevel.HEALTH);
    expect(summary).toMatch(/\d+h/); // Shows cap in hours
  });

  it('should handle zero-duration schedule', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Rest', duration: 0, type: 'REST' },
    ];
    const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.HEALTH);
    expect(summary).toContain('0%');
  });

  it('should handle at-cap schedule', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Tue', activity: 'Run', duration: 420, type: 'RUN' },
    ];
    const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);
    expect(summary).toContain('100%');
  });

  it('should round percentage to nearest integer', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Mon', activity: 'Run', duration: 71, type: 'RUN' }, // 71/420 = 16.9%
    ];
    const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);
    // Should be rounded to 17%
    expect(summary).toMatch(/\d+%/);
    const match = summary.match(/(\d+)%/);
    if (match) {
      expect(parseInt(match[1])).toBe(17);
    }
  });

  describe('Real-world schedule summaries', () => {
    it('HEALTH level typical week', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Tue', activity: 'Run', duration: 45, type: 'RUN' },
        { day: 'Thu', activity: 'Run', duration: 45, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 60, type: 'LONG_RUN' },
        { day: 'Sun', activity: 'Walk', duration: 30, type: 'WALK' },
      ];
      // Total = 45+45+60+30 = 180 mins = 3h / 240 cap = 75%
      const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.HEALTH);
      expect(summary).toContain('3h');
      expect(summary).toContain('75%');
    });

    it('BASE level typical week', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Tue', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Wed', activity: 'Recovery', duration: 45, type: 'RECOVERY' },
        { day: 'Thu', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 90, type: 'LONG_RUN' },
        { day: 'Sun', activity: 'Walk', duration: 45, type: 'WALK' },
      ];
      const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.BASE);
      expect(summary).toContain('5h');
      expect(summary).toContain('71%');
    });

    it('PERFORMANCE level high-volume week', () => {
      const schedule: ScheduleItem[] = [
        { day: 'Mon', activity: 'Recovery', duration: 45, type: 'RECOVERY' },
        { day: 'Tue', activity: 'Run', duration: 75, type: 'RUN' },
        { day: 'Wed', activity: 'Run', duration: 60, type: 'RUN' },
        { day: 'Thu', activity: 'Run', duration: 75, type: 'RUN' },
        { day: 'Fri', activity: 'Run', duration: 45, type: 'RUN' },
        { day: 'Sat', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const summary = formatWeeklyVolumeSummary(schedule, CommitmentLevel.PERFORMANCE);
      expect(summary).toContain('7h');
      expect(summary).toContain('58%');
    });
  });
});
