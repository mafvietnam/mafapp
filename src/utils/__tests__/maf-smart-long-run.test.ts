/**
 * Tests for MAF Smart Long Run Calculator
 * Validates history-based long run duration adjustment with HR zone analysis
 */

import { describe, it, expect } from 'vitest';
import { calculateSmartLongRun } from '../maf-smart-long-run';
import { CommitmentLevel, ExperienceLevel } from '../../types';

describe('calculateSmartLongRun', () => {
  const mafHr = 150;
  const age = 45;

  describe('No history scenario (safe defaults by experience)', () => {
    it('should return 45 mins for NONE experience (beginner)', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.NONE
      );
      expect(result.duration).toBe(45);
      expect(result.adjustmentType).toBe('MAINTAIN');
      expect(result.message).toContain('KHỞI ĐIỂM AN TOÀN');
    });

    it('should return 45 mins for INCONSISTENT experience', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.HEALTH, age, ExperienceLevel.INCONSISTENT
      );
      expect(result.duration).toBe(45);
    });

    it('should return 60 mins for REGULAR_NEW experience', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.REGULAR_NEW
      );
      expect(result.duration).toBe(60);
    });

    it('should return 75 mins for ADVANCED experience', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.PERFORMANCE, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(75);
    });

    it('should cap to package limit if default exceeds cap (HEALTH: 60 min cap)', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.HEALTH, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(60); // Capped to HEALTH max
    });

    it('should cap to age limit for 60+ (90 min cap)', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.PERFORMANCE, 65, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBeLessThanOrEqual(90);
    });
  });

  describe('Invalid data handling', () => {
    it('should reset to 90 mins if duration > 300 (unrealistic)', () => {
      const result = calculateSmartLongRun(
        301, 150, mafHr, CommitmentLevel.PERFORMANCE, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(90);
      expect(result.message).toContain('DỮ LIỆU BẤT THƯỜNG');
      expect(result.adjustmentType).toBe('MAINTAIN');
    });

    it('should reset to 45 mins if duration < 20 (too short for long run)', () => {
      const result = calculateSmartLongRun(
        15, 155, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(45);
      expect(result.message).toContain('KHÔNG HỢP LỆ');
    });

    it('should maintain duration if HR > 220 (unrealistic high)', () => {
      const result = calculateSmartLongRun(
        90, 225, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(90);
      expect(result.message).toContain('NHỊP TIM BẤT THƯỜNG');
      expect(result.adjustmentType).toBe('MAINTAIN');
    });

    it('should maintain duration if HR < 80 (unrealistic low)', () => {
      const result = calculateSmartLongRun(
        75, 75, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(75);
      expect(result.message).toContain('NHỊP TIM BẤT THƯỜNG');
    });
  });

  describe('HR too high (>MAF+5) - reduce or maintain', () => {
    it('should reduce 20% when VERY_TIRED and HR too high', () => {
      const result = calculateSmartLongRun(
        100, 160, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.duration).toBe(80); // 100 * 0.8
      expect(result.adjustmentType).toBe('DECREASE');
      expect(result.message).toContain('QUÁ TẢI NGHIÊM TRỌNG');
    });

    it('should enforce 30-minute floor when reducing VERY_TIRED', () => {
      const result = calculateSmartLongRun(
        30, 160, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.duration).toBe(30); // 30 * 0.8 = 24 → floored to 30? or 24?
      // Based on code: max(30, round(30*0.8)) = max(30, 24) = 30
      // Actually it uses Math.max(..., 30) so if result is < 30 it floors to 30
    });

    it('should reduce 10% when TIRED and HR too high', () => {
      const result = calculateSmartLongRun(
        100, 158, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'TIRED'
      );
      expect(result.duration).toBe(90); // 100 * 0.9
      expect(result.adjustmentType).toBe('DECREASE');
      expect(result.message).toContain('TIM QUÁ CAO');
    });

    it('should maintain when HR high but feeling OK (body adapting)', () => {
      const result = calculateSmartLongRun(
        90, 158, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.duration).toBe(90); // Unchanged
      expect(result.adjustmentType).toBe('MAINTAIN');
      expect(result.message).toContain('TIM HƠI CAO');
    });

    it('should detect HR too high with >= 5 bpm buffer', () => {
      // MAF = 150, HR = 156 (difference = 6, > 5 buffer)
      const result = calculateSmartLongRun(
        80, 156, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.message).toContain('TIM HƠI CAO');
      expect(result.adjustmentType).toBe('MAINTAIN');
    });

    it('should not trigger HR too high at boundary (MAF+5 = threshold)', () => {
      // MAF = 150, HR = 155 (difference = 5, at buffer boundary = in zone)
      const result = calculateSmartLongRun(
        100, 155, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED
      );
      // This should be treated as IN_ZONE, apply 10% rule
      expect(result.adjustmentType).toBe('INCREASE');
    });
  });

  describe('HR in zone (±5 bpm) - apply 10% rule', () => {
    it('should increase 10% when HR in zone and feeling GOOD (Maffetone rule)', () => {
      const result = calculateSmartLongRun(
        100, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.duration).toBe(110); // 100 * 1.1
      expect(result.adjustmentType).toBe('INCREASE');
      expect(result.message).toContain('TIẾN BỘ TỐT');
      expect(result.message).toContain('10%');
    });

    it('should maintain when HR in zone but feeling VERY_TIRED (overtraining sign)', () => {
      const result = calculateSmartLongRun(
        80, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.duration).toBe(80); // Unchanged
      expect(result.adjustmentType).toBe('MAINTAIN');
      expect(result.message).toContain('DUY TRÌ');
    });

    it('should increase 5% when HR in zone and feeling TIRED (cautious progress)', () => {
      const result = calculateSmartLongRun(
        100, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'TIRED'
      );
      expect(result.duration).toBe(105); // 100 * 1.05
      expect(result.adjustmentType).toBe('INCREASE');
      expect(result.message).toContain('TIẾN BỘ CẨN TRỌNG');
    });

    it('should cap at package limit when 10% increase exceeds cap', () => {
      const result = calculateSmartLongRun(
        115, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 115 * 1.1 = 126.5 → 127, but BASE cap = 120
      expect(result.duration).toBe(120);
      expect(result.adjustmentType).toBe('CAP');
      expect(result.isCapped).toBe(true);
      expect(result.message).toContain('ĐẠT TRẦN');
    });

    it('should cap at age limit (60+) when 10% increase exceeds age cap', () => {
      const result = calculateSmartLongRun(
        85, 150, mafHr, CommitmentLevel.PERFORMANCE, 65, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 85 * 1.1 = 93.5 → 94, but age 65 cap = 90
      expect(result.duration).toBe(90);
      expect(result.adjustmentType).toBe('CAP');
      expect(result.isCapped).toBe(true);
    });
  });

  describe('HR too low (<MAF-5) - spare capacity, increase 15%', () => {
    it('should increase 15% when HR too low and feeling GOOD', () => {
      const result = calculateSmartLongRun(
        100, 140, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.duration).toBe(115); // 100 * 1.15
      expect(result.adjustmentType).toBe('INCREASE');
      expect(result.message).toContain('CÒN DƯ SỨC');
    });

    it('should increase 15% when HR too low (145 = MAF-5 boundary)', () => {
      const result = calculateSmartLongRun(
        80, 145, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED
      );
      // 145 = 150 - 5, not < -5, so in zone (GOOD feeling)
      // Actually difference = 145 - 150 = -5, which is NOT < -5 (boundary), so IN_ZONE
      expect(result.adjustmentType).toBe('INCREASE');
    });

    it('should cap at package limit when 15% increase exceeds cap', () => {
      const result = calculateSmartLongRun(
        110, 140, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 110 * 1.15 = 126.5 → 127, but BASE cap = 120
      expect(result.duration).toBe(120);
      expect(result.adjustmentType).toBe('CAP');
    });

    it('should maintain when HR low but feeling VERY_TIRED (overtraining sign)', () => {
      const result = calculateSmartLongRun(
        80, 140, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.duration).toBe(80);
      expect(result.adjustmentType).toBe('MAINTAIN');
      expect(result.message).toContain('OVERTRAINING');
    });

    it('should detect HR too low (<MAF-5 = < 145 for MAF 150)', () => {
      const result = calculateSmartLongRun(
        100, 144, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.adjustmentType).toBe('INCREASE');
      expect(result.message).toContain('CÒN DƯ SỨC');
    });
  });

  describe('Commitment level caps', () => {
    it('HEALTH should cap at 60 mins', () => {
      const result = calculateSmartLongRun(
        55, 150, mafHr, CommitmentLevel.HEALTH, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 55 * 1.1 = 60.5 → 61, capped at 60
      expect(result.duration).toBeLessThanOrEqual(60);
      expect(result.adjustmentType).toBe('CAP');
    });

    it('BASE should cap at 120 mins', () => {
      const result = calculateSmartLongRun(
        110, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 110 * 1.1 = 121, capped at 120
      expect(result.duration).toBe(120);
    });

    it('PERFORMANCE should cap at 180 mins', () => {
      const result = calculateSmartLongRun(
        165, 150, mafHr, CommitmentLevel.PERFORMANCE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 165 * 1.1 = 181.5 → 182, capped at 180
      expect(result.duration).toBeLessThanOrEqual(180);
    });
  });

  describe('Age-based caps', () => {
    it('should cap at 90 mins for age >= 60', () => {
      const result = calculateSmartLongRun(
        85, 150, mafHr, CommitmentLevel.PERFORMANCE, 62, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 85 * 1.1 = 93.5, capped at 90 for age 62
      expect(result.duration).toBeLessThanOrEqual(90);
    });

    it('should cap at 150 mins for age 50-59', () => {
      const result = calculateSmartLongRun(
        140, 150, mafHr, CommitmentLevel.PERFORMANCE, 55, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 140 * 1.1 = 154, capped at 150 for age 50-59
      expect(result.duration).toBeLessThanOrEqual(150);
    });

    it('should not apply age cap for age < 50', () => {
      const result = calculateSmartLongRun(
        170, 150, mafHr, CommitmentLevel.PERFORMANCE, 45, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 170 * 1.1 = 187, only capped at PERFORMANCE 180
      expect(result.duration).toBe(180);
    });
  });

  describe('Message content validation', () => {
    it('should include current HR in message', () => {
      const result = calculateSmartLongRun(
        100, 155, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.message).toContain('155');
    });

    it('should include new duration in message', () => {
      const result = calculateSmartLongRun(
        80, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(result.message).toContain('88'); // 80 * 1.1
    });

    it('should differentiate cap messages by limit type (age vs package)', () => {
      const ageCapResult = calculateSmartLongRun(
        85, 150, mafHr, CommitmentLevel.PERFORMANCE, 65, ExperienceLevel.ADVANCED, 'GOOD'
      );
      const packageCapResult = calculateSmartLongRun(
        115, 150, mafHr, CommitmentLevel.BASE, 45, ExperienceLevel.ADVANCED, 'GOOD'
      );
      expect(ageCapResult.message).toContain('độ tuổi');
      expect(packageCapResult.message).toContain('gói');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle exactly MAF HR (no buffer zone)', () => {
      const result = calculateSmartLongRun(
        100, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // HR = MAF, hrDifference = 0, within ±5 buffer → IN_ZONE
      expect(result.adjustmentType).toBe('INCREASE');
    });

    it('should round calculated durations to integers', () => {
      const result = calculateSmartLongRun(
        33, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 33 * 1.1 = 36.3 → 36
      expect(Number.isInteger(result.duration)).toBe(true);
    });

    it('should handle feeling parameter as optional', () => {
      const result = calculateSmartLongRun(
        100, 150, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED
      );
      expect(result.duration).toBe(110); // Defaults to GOOD behavior
    });

    it('should return consistent message format with emoji indicators', () => {
      const result = calculateSmartLongRun(
        100, 160, mafHr, CommitmentLevel.BASE, age, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.message).toMatch(/^(?:🔴|⚠️|🏸|📈|💪|✅)/); // Starts with emoji
    });
  });

  describe('Real-world scenarios', () => {
    it('Runner A: Beginner starting out (no history, defaults to safe start)', () => {
      const result = calculateSmartLongRun(
        undefined, undefined, mafHr, CommitmentLevel.HEALTH, 35, ExperienceLevel.NONE
      );
      expect(result.adjustmentType).toBe('MAINTAIN');
      expect(result.duration).toBe(45); // Safe default for beginner
    });

    it('Runner B: Advanced athlete with HR in zone and room to grow', () => {
      const result = calculateSmartLongRun(
        100, 150, mafHr, CommitmentLevel.PERFORMANCE, 42, ExperienceLevel.ADVANCED, 'GOOD'
      );
      // 100 * 1.1 = 110, which is less than PERFORMANCE cap of 180
      expect(result.adjustmentType).toBe('INCREASE');
      expect(result.duration).toBe(110);
    });

    it('Runner C: Senior showing overtraining signs (low HR, very tired)', () => {
      const result = calculateSmartLongRun(
        70, 140, mafHr, CommitmentLevel.BASE, 68, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.adjustmentType).toBe('MAINTAIN');
      expect(result.message).toContain('OVERTRAINING');
    });

    it('Runner D: Recovering from illness (very high HR + tired)', () => {
      const result = calculateSmartLongRun(
        50, 158, mafHr, CommitmentLevel.BASE, 40, ExperienceLevel.ADVANCED, 'VERY_TIRED'
      );
      expect(result.adjustmentType).toBe('DECREASE');
      expect(result.duration).toBeLessThan(50);
    });
  });
});
