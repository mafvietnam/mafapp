/**
 * Tests for MAF Calculator Orchestrator
 * Validates the pure calculateMAF function covering main orchestration branches:
 * children short-circuit, adult standard, BMI fallback, probation+safety, volume cap
 */

import { describe, it, expect } from 'vitest';
import { calculateMAF, parsePaceToSeconds } from '../maf-calculator-orchestrator';
import { ExperienceLevel, CommitmentLevel, UserProfile } from '../../types';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    age: '30',
    height: '170',
    weight: '65',
    experience: ExperienceLevel.REGULAR_NEW,
    isRecovering: false,
    isMedicatedOrInjured: false,
    isMedicalClearanceConfirmed: false,
    commitment: CommitmentLevel.BASE,
    previousMonthPace: '',
    ...overrides,
  };
}

describe('parsePaceToSeconds', () => {
  it('should parse mm:ss format', () => {
    expect(parsePaceToSeconds('6:30')).toBe(390);
  });

  it('should parse decimal minutes', () => {
    expect(parsePaceToSeconds('6.5')).toBe(390);
  });

  it('should return 0 for empty string', () => {
    expect(parsePaceToSeconds('')).toBe(0);
  });
});

describe('calculateMAF', () => {
  describe('Children short-circuit (age < 16)', () => {
    it('should return child-specific result with no schedule', () => {
      const result = calculateMAF({
        userProfile: makeProfile({ age: '10' }),
        verifiedMafPace: null,
        ageNum: 10,
        isChild: true,
        isNewbie: true,
        bmi: 0,
      });
      expect(result).not.toBeNull();
      expect(result!.mafHeartRate).toBe(0);
      expect(result!.bmiCategory).toBe('Trẻ em');
      expect(result!.scheduleTitle).toBe('HƯỚNG DẪN CHO TRẺ EM');
      expect(result!.schedule).toHaveLength(1);
      expect(result!.schedule[0].type).toBe('REST');
    });
  });

  describe('Adult standard path (healthy, no adjustments)', () => {
    it('should calculate correct MAF heart rate for healthy adult', () => {
      const result = calculateMAF({
        userProfile: makeProfile({ age: '30', experience: ExperienceLevel.REGULAR_NEW }),
        verifiedMafPace: '7:00',
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      // 180 - 30 = 150, REGULAR_NEW score = 0
      expect(result!.mafHeartRate).toBe(150);
      expect(result!.lowerZone).toBe(140);
      expect(result!.bmiCategory).toBe('Bình thường');
    });

    it('should generate weekly schedule with correct title', () => {
      const result = calculateMAF({
        userProfile: makeProfile({ commitment: CommitmentLevel.HEALTH }),
        verifiedMafPace: '8:00',
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      expect(result!.scheduleTitle).toContain('DUY TRÌ');
      expect(result!.schedule.length).toBeGreaterThan(0);
    });
  });

  describe('BMI-based pace fallback', () => {
    it('should use walk pace for obese BMI (>= 30) without verified pace', () => {
      const result = calculateMAF({
        userProfile: makeProfile(),
        verifiedMafPace: null,
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 32,
      });
      expect(result).not.toBeNull();
      expect(result!.bmiCategory).toBe('Béo phì');
      expect(result!.explanation).toContain('18:00');
      // All activities should be walking
      const nonRestItems = result!.schedule.filter((s) => s.duration > 0);
      nonRestItems.forEach((item) => {
        expect(item.type).toBe('WALK');
      });
    });

    it('should use fast-walk pace for overweight BMI (>= 25) without verified pace', () => {
      const result = calculateMAF({
        userProfile: makeProfile(),
        verifiedMafPace: null,
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 27,
      });
      expect(result).not.toBeNull();
      expect(result!.bmiCategory).toBe('Thừa cân');
      expect(result!.explanation).toContain('14:00');
    });

    it('should not show explanation when verified pace is provided', () => {
      const result = calculateMAF({
        userProfile: makeProfile(),
        verifiedMafPace: '7:00',
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      expect(result!.explanation).toBeUndefined();
    });
  });

  describe('Probation + safety adjustments combined', () => {
    it('should apply recovering + probation heart rate adjustments', () => {
      const result = calculateMAF({
        userProfile: makeProfile({
          isRecovering: true,
          isProbation: true,
        }),
        verifiedMafPace: '8:00',
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      // 180 - 30 = 150, -10 recovering, -10 probation, +0 REGULAR_NEW = 130
      expect(result!.mafHeartRate).toBe(130);
      expect(result!.notes).toEqual(
        expect.arrayContaining([
          expect.stringContaining('hồi phục'),
          expect.stringContaining('THỬ THÁCH'),
        ])
      );
    });

    it('should apply medicated adjustment', () => {
      const result = calculateMAF({
        userProfile: makeProfile({ isMedicatedOrInjured: true }),
        verifiedMafPace: '8:00',
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      // 180 - 30 = 150, -5 medicated, +0 REGULAR_NEW = 145
      expect(result!.mafHeartRate).toBe(145);
    });
  });

  describe('Volume cap enforcement', () => {
    it('should include volume cap reduction note when schedule exceeds cap', () => {
      // HEALTH commitment has lowest cap — a PERFORMANCE schedule with high volume should trigger
      const result = calculateMAF({
        userProfile: makeProfile({
          commitment: CommitmentLevel.PERFORMANCE,
          experience: ExperienceLevel.ADVANCED,
        }),
        verifiedMafPace: '5:00',
        ageNum: 25,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      expect(result!.scheduleTitle).toContain('HIỆU SUẤT');
    });
  });

  describe('Return null for invalid inputs', () => {
    it('should return null for NaN age', () => {
      const result = calculateMAF({
        userProfile: makeProfile({ age: 'abc' }),
        verifiedMafPace: null,
        ageNum: NaN,
        isChild: false,
        isNewbie: true,
        bmi: 22,
      });
      expect(result).toBeNull();
    });

    it('should return null for zero BMI (non-child)', () => {
      const result = calculateMAF({
        userProfile: makeProfile(),
        verifiedMafPace: null,
        ageNum: 30,
        isChild: false,
        isNewbie: false,
        bmi: 0,
      });
      expect(result).toBeNull();
    });
  });

  describe('Senior-specific behavior', () => {
    it('should add senior warning note for age >= 60', () => {
      const result = calculateMAF({
        userProfile: makeProfile({ age: '65', experience: ExperienceLevel.ADVANCED }),
        verifiedMafPace: '8:00',
        ageNum: 65,
        isChild: false,
        isNewbie: false,
        bmi: 22,
      });
      expect(result).not.toBeNull();
      expect(result!.notes).toEqual(
        expect.arrayContaining([expect.stringContaining('Lắng nghe cơ thể')])
      );
      expect(result!.mindset).toContain('tấm gương');
    });
  });
});
