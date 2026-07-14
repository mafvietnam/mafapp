/**
 * Tests for health-condition-rules.ts. Covers the decision table per
 * flag x clearance x commitment, plus RED TEAM FIX #3 (AMBER floor emitted
 * here, composed downstream in daily-readiness-score.ts) and FIX #10 (gate
 * mirrors the server's "only blocks ELEVATED commitment" rule exactly).
 */
import { describe, it, expect } from 'vitest';
import { CommitmentLevel, HealthCondition } from '../../types';
import { deriveHealthAdjustment, conditionLabelsVn, type HealthRuleInput } from '../health-condition-rules';

function input(overrides: Partial<HealthRuleInput> = {}): HealthRuleInput {
  return {
    healthConditions: [],
    hasClearance: false,
    age: 35,
    commitment: CommitmentLevel.BASE,
    ...overrides,
  };
}

describe('no conditions => fully inert result', () => {
  it('all levers off, no reasons, no safety card', () => {
    const result = deriveHealthAdjustment(input());
    expect(result).toEqual({
      forceHealthCommitment: false,
      requiresClearanceGate: false,
      tierFloor: null,
      mafDelta: 0,
      durationCapMin: null,
      walkFirst: false,
      extendWarmCool: false,
      reasons: [],
      needsSafetyCard: false,
    });
  });
});

describe('RED TEAM FIX #3 — any flag sets an AMBER floor', () => {
  it('CARDIOVASCULAR alone => tierFloor AMBER', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.CARDIOVASCULAR] }));
    expect(result.tierFloor).toBe('AMBER');
  });

  it('HYPERTENSION alone => tierFloor AMBER', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.HYPERTENSION] }));
    expect(result.tierFloor).toBe('AMBER');
  });

  it('JOINT_ISSUES alone => tierFloor AMBER', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.JOINT_ISSUES] }));
    expect(result.tierFloor).toBe('AMBER');
  });

  it('multiple flags => still just AMBER (floor, not additive severity)', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [HealthCondition.CARDIOVASCULAR, HealthCondition.JOINT_ISSUES] }),
    );
    expect(result.tierFloor).toBe('AMBER');
  });
});

describe('CARDIOVASCULAR / HYPERTENSION — cardiac caution', () => {
  it('CARDIOVASCULAR => mafDelta -5, needsSafetyCard, cardiac reason with CH6', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.CARDIOVASCULAR] }));
    expect(result.mafDelta).toBe(-5);
    expect(result.needsSafetyCard).toBe(true);
    const reason = result.reasons.find((r) => r.code === 'health_cardiac_caution');
    expect(reason).toBeDefined();
    expect(reason?.bookRef).toBe('CH6');
  });

  it('HYPERTENSION alone also triggers cardiac caution (either condition qualifies)', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.HYPERTENSION] }));
    expect(result.mafDelta).toBe(-5);
    expect(result.reasons.some((r) => r.code === 'health_cardiac_caution')).toBe(true);
  });

  it('does NOT set walkFirst/extendWarmCool/durationCapMin (JOINT_ISSUES-only levers)', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.CARDIOVASCULAR] }));
    expect(result.walkFirst).toBe(false);
    expect(result.extendWarmCool).toBe(false);
    expect(result.durationCapMin).toBeNull();
  });
});

describe('JOINT_ISSUES — walk-first + extended warm/cool + duration cap', () => {
  it('sets walkFirst, extendWarmCool, durationCapMin=60 (mirrors beginner cap)', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.JOINT_ISSUES] }));
    expect(result.walkFirst).toBe(true);
    expect(result.extendWarmCool).toBe(true);
    expect(result.durationCapMin).toBe(60);
  });

  it('emits the exact VN copy sample with Chương 29 citation embedded in text (bookRef union has no CH29)', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.JOINT_ISSUES] }));
    const reason = result.reasons.find((r) => r.code === 'health_joint_walk_first');
    expect(reason?.text).toBe(
      'Ưu tiên đi bộ trước, khởi động & thả lỏng dài hơn để bảo vệ khớp. (Chương 29)',
    );
    expect(reason?.bookRef).toBeUndefined();
  });

  it('does NOT set mafDelta (cardiac-only lever)', () => {
    const result = deriveHealthAdjustment(input({ healthConditions: [HealthCondition.JOINT_ISSUES] }));
    expect(result.mafDelta).toBe(0);
  });
});

describe('RED TEAM FIX #10 — clearance/commitment gate mirrors the server exactly', () => {
  it('flagged + !hasClearance + commitment=BASE (elevated) => gate active', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [HealthCondition.CARDIOVASCULAR], hasClearance: false, commitment: CommitmentLevel.BASE }),
    );
    expect(result.requiresClearanceGate).toBe(true);
    expect(result.forceHealthCommitment).toBe(true);
    expect(result.reasons.some((r) => r.code === 'health_clearance_gate')).toBe(true);
  });

  it('flagged + !hasClearance + commitment=PERFORMANCE (elevated) => gate active', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [HealthCondition.HYPERTENSION], hasClearance: false, commitment: CommitmentLevel.PERFORMANCE }),
    );
    expect(result.requiresClearanceGate).toBe(true);
  });

  it('flagged + !hasClearance + commitment=HEALTH => gate NOT active (HEALTH always allowed)', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [HealthCondition.CARDIOVASCULAR], hasClearance: false, commitment: CommitmentLevel.HEALTH }),
    );
    expect(result.requiresClearanceGate).toBe(false);
    expect(result.forceHealthCommitment).toBe(false);
    expect(result.reasons.some((r) => r.code === 'health_clearance_gate')).toBe(false);
  });

  it('flagged + hasClearance=true + commitment=BASE => gate NOT active (cleared)', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [HealthCondition.CARDIOVASCULAR], hasClearance: true, commitment: CommitmentLevel.BASE }),
    );
    expect(result.requiresClearanceGate).toBe(false);
    expect(result.forceHealthCommitment).toBe(false);
  });

  it('no conditions + !hasClearance + commitment=PERFORMANCE => gate never blocks an unflagged user', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [], hasClearance: false, commitment: CommitmentLevel.PERFORMANCE }),
    );
    expect(result.requiresClearanceGate).toBe(false);
  });

  it('a cleared cardiac user still gets the AMBER floor + safety card (clearance does not remove caution levers, FIX #3)', () => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [HealthCondition.CARDIOVASCULAR], hasClearance: true, commitment: CommitmentLevel.PERFORMANCE }),
    );
    expect(result.tierFloor).toBe('AMBER');
    expect(result.needsSafetyCard).toBe(true);
    expect(result.requiresClearanceGate).toBe(false);
  });
});

describe('conditionLabelsVn', () => {
  it('maps each whitelisted code to its VN label', () => {
    expect(conditionLabelsVn([HealthCondition.CARDIOVASCULAR, HealthCondition.JOINT_ISSUES])).toEqual([
      'tim mạch',
      'xương khớp',
    ]);
  });

  it('empty input => empty output', () => {
    expect(conditionLabelsVn([])).toEqual([]);
  });
});
