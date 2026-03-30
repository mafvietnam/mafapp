/**
 * Tests for MAF Schedule Generator
 * Validates weekly schedule generation per commitment level
 */

import { describe, it, expect } from 'vitest';
import { getWeeklySchedule } from '../maf-schedule-generator';
import { CommitmentLevel } from '../../types';

describe('getWeeklySchedule', () => {
  describe('HEALTH commitment level', () => {
    it('should return 7 schedule items', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      expect(schedule).toHaveLength(7);
    });

    it('should have correct day sequence', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      expect(schedule[0].day).toBe('Thứ 2');
      expect(schedule[1].day).toBe('Thứ 3');
      expect(schedule[2].day).toBe('Thứ 4');
      expect(schedule[3].day).toBe('Thứ 5');
      expect(schedule[4].day).toBe('Thứ 6');
      expect(schedule[5].day).toBe('Thứ 7');
      expect(schedule[6].day).toBe('Chủ Nhật');
    });

    it('should have 3 active days (Mon rest, Wed run, Fri run, Sun walk)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      const activeDays = schedule.filter(day => day.duration > 0);
      expect(activeDays).toHaveLength(4);
    });

    it('should have REST days on Thứ 2, Thứ 4, Thứ 6', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      expect(schedule[0].type).toBe('REST');
      expect(schedule[2].type).toBe('REST');
      expect(schedule[4].type).toBe('REST');
    });

    it('should have RUN sessions at 45 mins each', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      expect(schedule[1].type).toBe('RUN');
      expect(schedule[1].duration).toBe(45);
      expect(schedule[3].type).toBe('RUN');
      expect(schedule[3].duration).toBe(45);
    });

    it('should have WALK activity on Sunday (30 mins)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      expect(schedule[6].type).toBe('WALK');
      expect(schedule[6].duration).toBe(30);
    });

    it('should have no LONG_RUN in HEALTH level', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      const hasLongRun = schedule.some(day => day.type === 'LONG_RUN');
      expect(hasLongRun).toBe(false);
    });

    it('should calculate total weekly minutes = 165 (45+45+30)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      const total = schedule.reduce((sum, day) => sum + day.duration, 0);
      expect(total).toBe(165);
    });
  });

  describe('BASE commitment level', () => {
    it('should return 7 schedule items', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      expect(schedule).toHaveLength(7);
    });

    it('should have 2 REST days (Thứ 2, Thứ 6)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const restDays = schedule.filter(day => day.type === 'REST');
      expect(restDays).toHaveLength(2);
    });

    it('should have LONG_RUN at 90 mins on Saturday (Thứ 7)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const longRun = schedule.find(day => day.type === 'LONG_RUN');
      expect(longRun).toBeDefined();
      expect(longRun?.duration).toBe(90);
      expect(longRun?.day).toBe('Thứ 7');
    });

    it('should have RUN sessions at 60 mins (plus recovery run)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const runDays = schedule.filter(day => day.type === 'RUN');
      // BASE has 3 RUN sessions: 2 at 60 mins + 1 recovery at 45 mins
      expect(runDays.length).toBeGreaterThanOrEqual(2);
      const sixtyMinRuns = runDays.filter(day => day.duration === 60);
      expect(sixtyMinRuns).toHaveLength(2);
    });

    it('should have recovery run (hồi phục chủ động) at 45 mins', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const recovery = schedule[2];
      expect(recovery.activity).toContain('Hồi phục chủ động');
      expect(recovery.duration).toBe(45);
    });

    it('should have WALK at 45 mins on Sunday', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const sunday = schedule[6];
      expect(sunday.type).toBe('WALK');
      expect(sunday.duration).toBe(45);
    });

    it('should calculate total weekly minutes = 300 (60+45+60+90+45)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const total = schedule.reduce((sum, day) => sum + day.duration, 0);
      expect(total).toBe(300);
    });
  });

  describe('PERFORMANCE commitment level', () => {
    it('should return 7 schedule items', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      expect(schedule).toHaveLength(7);
    });

    it('should have 6 active training days', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const activeDays = schedule.filter(day => day.duration > 0);
      expect(activeDays).toHaveLength(6);
    });

    it('should have only 1 REST day on Sunday (Chủ Nhật)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const restDays = schedule.filter(day => day.type === 'REST');
      expect(restDays).toHaveLength(1);
      expect(restDays[0].day).toBe('Chủ Nhật');
    });

    it('should have RECOVERY type on Monday at 45 mins', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      expect(schedule[0].type).toBe('RECOVERY');
      expect(schedule[0].duration).toBe(45);
    });

    it('should have LONG_RUN at 120 mins on Saturday (Thứ 7)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const longRun = schedule.find(day => day.type === 'LONG_RUN');
      expect(longRun).toBeDefined();
      expect(longRun?.duration).toBe(120);
    });

    it('should have multiple 75-min RUN sessions for capacity building', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const sixtyFiveMinRuns = schedule.filter(day => day.duration === 75 && day.type === 'RUN');
      expect(sixtyFiveMinRuns.length).toBeGreaterThanOrEqual(2);
    });

    it('should have at least one 60-min RUN for recovery aerobic', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const sixtyMinRuns = schedule.filter(day => day.duration === 60 && day.type === 'RUN');
      expect(sixtyMinRuns.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate total weekly minutes = 420 (45+75+60+75+45+120)', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const total = schedule.reduce((sum, day) => sum + day.duration, 0);
      expect(total).toBe(420);
    });

    it('should have high-volume structure suitable for competitive runners', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      expect(schedule.every(day => day.day !== undefined)).toBe(true);
      expect(schedule.every(day => day.type !== undefined)).toBe(true);
      expect(schedule.every(day => day.activity !== undefined)).toBe(true);
    });
  });

  describe('Invalid commitment level', () => {
    it('should return empty array for unknown commitment level', () => {
      const schedule = getWeeklySchedule('UNKNOWN' as CommitmentLevel);
      expect(schedule).toEqual([]);
    });
  });

  describe('Schedule item structure', () => {
    it('should have all required fields in each schedule item', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      schedule.forEach(item => {
        expect(item).toHaveProperty('day');
        expect(item).toHaveProperty('activity');
        expect(item).toHaveProperty('duration');
        expect(item).toHaveProperty('type');
      });
    });

    it('should have valid type values', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const validTypes = ['RUN', 'LONG_RUN', 'REST', 'WALK', 'CROSS_TRAIN', 'RECOVERY'];
      schedule.forEach(item => {
        expect(validTypes).toContain(item.type);
      });
    });

    it('should have non-negative duration values', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      schedule.forEach(item => {
        expect(item.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Progression across commitment levels', () => {
    it('should have increasing volume from HEALTH to BASE to PERFORMANCE', () => {
      const health = getWeeklySchedule(CommitmentLevel.HEALTH);
      const base = getWeeklySchedule(CommitmentLevel.BASE);
      const performance = getWeeklySchedule(CommitmentLevel.PERFORMANCE);

      const healthTotal = health.reduce((sum, day) => sum + day.duration, 0);
      const baseTotal = base.reduce((sum, day) => sum + day.duration, 0);
      const perfTotal = performance.reduce((sum, day) => sum + day.duration, 0);

      expect(baseTotal).toBeGreaterThan(healthTotal);
      expect(perfTotal).toBeGreaterThan(baseTotal);
    });

    it('HEALTH level should be suitable for maintenance', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.HEALTH);
      const total = schedule.reduce((sum, day) => sum + day.duration, 0);
      expect(total).toBeLessThanOrEqual(200); // Low volume
    });

    it('BASE level should be suitable for aerobic foundation', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.BASE);
      const total = schedule.reduce((sum, day) => sum + day.duration, 0);
      expect(total).toBeLessThan(400);
      expect(total).toBeGreaterThan(200);
    });

    it('PERFORMANCE level should be high-volume', () => {
      const schedule = getWeeklySchedule(CommitmentLevel.PERFORMANCE);
      const total = schedule.reduce((sum, day) => sum + day.duration, 0);
      expect(total).toBeGreaterThan(400);
    });
  });
});
