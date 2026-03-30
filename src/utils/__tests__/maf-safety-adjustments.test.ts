/**
 * Tests for MAF Safety Adjustments
 * Validates probation period reduction and safety rules based on BMI/age/experience
 */

import { describe, it, expect } from 'vitest';
import { adjustForProbation, adjustScheduleForSafety } from '../maf-safety-adjustments';
import { ExperienceLevel, UserProfile } from '../../types';
import { ScheduleItem } from '../../types';

describe('adjustForProbation', () => {
  const mockSchedule: ScheduleItem[] = [
    { day: 'Monday', activity: 'Run', duration: 60, type: 'RUN' },
    { day: 'Tuesday', activity: 'Rest', duration: 0, type: 'REST' },
    { day: 'Wednesday', activity: 'Long Run', duration: 90, type: 'LONG_RUN' },
    { day: 'Thursday', activity: 'Walk', duration: 45, type: 'WALK' },
  ];

  it('should reduce active session duration by 30% (multiply by 0.7)', () => {
    const result = adjustForProbation(mockSchedule);
    // 60 * 0.7 = 42
    expect(result[0].duration).toBe(42);
  });

  it('should enforce 15-minute minimum duration floor', () => {
    const shortSchedule: ScheduleItem[] = [
      { day: 'Monday', activity: 'Run', duration: 20, type: 'RUN' },
    ];
    const result = adjustForProbation(shortSchedule);
    // 20 * 0.7 = 14 < 15, so floor to 15
    expect(result[0].duration).toBe(15);
  });

  it('should not reduce REST days (duration 0)', () => {
    const result = adjustForProbation(mockSchedule);
    expect(result[1].duration).toBe(0);
  });

  it('should reduce long run and cap to minimum 15 mins', () => {
    const result = adjustForProbation(mockSchedule);
    // 90 * 0.7 = 63
    expect(result[2].duration).toBe(63);
  });

  it('should mark LONG_RUN activities as recovery-limited when activity contains "Chạy dài (Long Run)"', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Sat', activity: 'Chạy dài (Long Run)', duration: 90, type: 'LONG_RUN' },
    ];
    const result = adjustForProbation(schedule);
    expect(result[0].activity).toContain('Giới hạn Hồi phục');
  });

  it('should not modify non-LONG_RUN activity descriptions', () => {
    const result = adjustForProbation(mockSchedule);
    expect(result[0].activity).toBe('Run');
  });

  it('should handle various durations correctly', () => {
    const testCases = [
      { input: 100, expected: 70 },  // 100 * 0.7 = 70
      { input: 50, expected: 35 },   // 50 * 0.7 = 35
      { input: 25, expected: 18 },   // 25 * 0.7 = 17.5 → 18
      { input: 15, expected: 15 },   // 15 * 0.7 = 10.5 → 15 (floored)
    ];

    testCases.forEach(({ input, expected }) => {
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Test', duration: input, type: 'RUN' },
      ];
      const result = adjustForProbation(schedule);
      expect(result[0].duration).toBe(expected);
    });
  });

  it('should preserve schedule structure (same length, day, type)', () => {
    const result = adjustForProbation(mockSchedule);
    expect(result).toHaveLength(mockSchedule.length);
    result.forEach((item, idx) => {
      expect(item.day).toBe(mockSchedule[idx].day);
      expect(item.type).toBe(mockSchedule[idx].type);
    });
  });

  it('should round durations to nearest integer', () => {
    const schedule: ScheduleItem[] = [
      { day: 'Test', activity: 'Test', duration: 33, type: 'RUN' }, // 33 * 0.7 = 23.1 → 23
    ];
    const result = adjustForProbation(schedule);
    expect(result[0].duration).toBe(23);
  });
});

describe('adjustScheduleForSafety', () => {
  const mockSchedule: ScheduleItem[] = [
    { day: 'Monday', activity: 'Run', duration: 60, type: 'RUN' },
    { day: 'Wednesday', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
    { day: 'Friday', activity: 'Walk', duration: 45, type: 'WALK' },
  ];

  describe('BMI >= 30 (joint safety)', () => {
    it('should convert RUN to CROSS_TRAIN when BMI >= 30', () => {
      const profile: UserProfile = {
        age: '45',
        height: '170',
        weight: '95',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'HEALTH' as any,
      };
      const result = adjustScheduleForSafety(mockSchedule, profile, 30);
      const runItem = result.find(item => item.day === 'Monday');
      expect(runItem?.type).toBe('CROSS_TRAIN');
      expect(runItem?.activity).toContain('Đi bộ nhanh / Đạp xe / Bơi lội');
    });

    it('should convert LONG_RUN to CROSS_TRAIN when BMI >= 30', () => {
      const profile: UserProfile = {
        age: '50',
        height: '165',
        weight: '100',
        experience: ExperienceLevel.REGULAR_NEW,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'BASE' as any,
      };
      const result = adjustScheduleForSafety(mockSchedule, profile, 32);
      const longRun = result.find(item => item.day === 'Wednesday');
      expect(longRun?.type).toBe('CROSS_TRAIN');
    });

    it('should preserve WALK and REST types when BMI >= 30', () => {
      const profile: UserProfile = {
        age: '40',
        height: '170',
        weight: '90',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'HEALTH' as any,
      };
      const result = adjustScheduleForSafety(mockSchedule, profile, 31);
      const walk = result.find(item => item.day === 'Friday');
      expect(walk?.type).toBe('WALK');
    });

    it('should not modify schedule when BMI < 30', () => {
      const profile: UserProfile = {
        age: '40',
        height: '180',
        weight: '75',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'HEALTH' as any,
      };
      const result = adjustScheduleForSafety(mockSchedule, profile, 23);
      expect(result[0].type).toBe('RUN');
      expect(result[1].type).toBe('LONG_RUN');
    });
  });

  describe('Beginner safety (experience NONE or INCONSISTENT)', () => {
    it('should cap duration at 60 mins for NONE experience', () => {
      const profile: UserProfile = {
        age: '35',
        height: '175',
        weight: '70',
        experience: ExperienceLevel.NONE,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 90, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 22);
      expect(result[0].duration).toBe(60);
    });

    it('should cap duration at 60 mins for INCONSISTENT experience', () => {
      const profile: UserProfile = {
        age: '40',
        height: '170',
        weight: '75',
        experience: ExperienceLevel.INCONSISTENT,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'BASE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Run', duration: 75, type: 'RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 24);
      expect(result[0].duration).toBe(60);
    });

    it('should not cap when duration <= 60 mins for beginners', () => {
      const profile: UserProfile = {
        age: '30',
        height: '180',
        weight: '70',
        experience: ExperienceLevel.NONE,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'HEALTH' as any,
      };
      const result = adjustScheduleForSafety(mockSchedule, profile, 21);
      const run = result.find(item => item.day === 'Monday');
      expect(run?.duration).toBe(60);
    });

    it('should not apply beginner cap for REGULAR_NEW experience', () => {
      const profile: UserProfile = {
        age: '35',
        height: '175',
        weight: '68',
        experience: ExperienceLevel.REGULAR_NEW,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Run', duration: 90, type: 'RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 22);
      expect(result[0].duration).toBe(90); // Not capped
    });
  });

  describe('Senior safety (age >= 60)', () => {
    it('should cap duration at 90 mins for age >= 60', () => {
      const profile: UserProfile = {
        age: '65',
        height: '170',
        weight: '75',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 26);
      expect(result[0].duration).toBe(90);
    });

    it('should not cap when duration <= 90 mins for seniors', () => {
      const profile: UserProfile = {
        age: '62',
        height: '168',
        weight: '72',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'BASE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Run', duration: 60, type: 'RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 25);
      expect(result[0].duration).toBe(60);
    });

    it('should not cap for age < 60', () => {
      const profile: UserProfile = {
        age: '59',
        height: '175',
        weight: '73',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 180, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 23);
      expect(result[0].duration).toBe(180); // Not capped at 90
    });
  });

  describe('Recovering runners', () => {
    it('should cap RUN duration at 45 mins when recovering', () => {
      const profile: UserProfile = {
        age: '40',
        height: '175',
        weight: '72',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: true,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Run', duration: 75, type: 'RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 23);
      expect(result[0].duration).toBe(45);
    });

    it('should convert RUN to WALK when recovering', () => {
      const profile: UserProfile = {
        age: '45',
        height: '170',
        weight: '75',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: true,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'BASE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Run', duration: 60, type: 'RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 26);
      expect(result[0].type).toBe('WALK');
      expect(result[0].activity).toContain('Đi bộ / Chạy rất nhẹ');
    });

    it('should convert LONG_RUN to WALK when recovering', () => {
      const profile: UserProfile = {
        age: '50',
        height: '172',
        weight: '78',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: true,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 26);
      expect(result[0].type).toBe('WALK');
      expect(result[0].duration).toBe(45); // Capped at 45
    });

    it('should preserve REST and WALK when recovering', () => {
      const profile: UserProfile = {
        age: '42',
        height: '175',
        weight: '73',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: true,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'HEALTH' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Rest', activity: 'Rest', duration: 0, type: 'REST' },
        { day: 'Walk', activity: 'Walk', duration: 30, type: 'WALK' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 24);
      expect(result[0].type).toBe('REST');
      expect(result[1].type).toBe('WALK');
    });
  });

  describe('Rule interactions and cumulative effects', () => {
    it('should apply multiple rules when applicable (beginner + BMI high)', () => {
      const profile: UserProfile = {
        age: '35',
        height: '165',
        weight: '100',
        experience: ExperienceLevel.NONE,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 36);
      expect(result[0].type).toBe('CROSS_TRAIN'); // BMI rule applied
      expect(result[0].duration).toBe(60); // Beginner cap applied
    });

    it('should prioritize recovery rule over other rules', () => {
      const profile: UserProfile = {
        age: '70',
        height: '168',
        weight: '80',
        experience: ExperienceLevel.NONE,
        isRecovering: true,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 180, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 28);
      expect(result[0].type).toBe('WALK'); // Recovery conversion
      expect(result[0].duration).toBe(45); // Recovery cap (not senior 90 or beginner 60)
    });
  });

  describe('Edge cases', () => {
    it('should handle age as string conversion', () => {
      const profile: UserProfile = {
        age: '60',
        height: '170',
        weight: '75',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Test', activity: 'Long Run', duration: 120, type: 'LONG_RUN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 26);
      expect(result[0].duration).toBe(90); // Senior rule applied at age 60
    });

    it('should preserve non-RUN/LONG_RUN types (RECOVERY, CROSS_TRAIN)', () => {
      const profile: UserProfile = {
        age: '50',
        height: '170',
        weight: '100',
        experience: ExperienceLevel.ADVANCED,
        isRecovering: false,
        isMedicatedOrInjured: false,
        isMedicalClearanceConfirmed: true,
        commitment: 'PERFORMANCE' as any,
      };
      const schedule: ScheduleItem[] = [
        { day: 'Recovery', activity: 'Active Recovery', duration: 60, type: 'RECOVERY' },
        { day: 'Cross', activity: 'Cycling', duration: 90, type: 'CROSS_TRAIN' },
      ];
      const result = adjustScheduleForSafety(schedule, profile, 34);
      expect(result[0].type).toBe('RECOVERY'); // Not converted
      expect(result[1].type).toBe('CROSS_TRAIN'); // Not converted
    });
  });
});
