import { HealthCondition } from '../../profile/profile.dto.js';
import {
  deriveHealthAdjustment,
  mergeHealthReasons,
  type HealthRuleInput,
} from './health-condition-rules.js';

function input(overrides: Partial<HealthRuleInput> = {}): HealthRuleInput {
  return {
    healthConditions: [],
    hasClearance: false,
    commitment: 'BASE',
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

describe('any flag sets an AMBER floor', () => {
  it.each([
    HealthCondition.CARDIOVASCULAR,
    HealthCondition.HYPERTENSION,
    HealthCondition.JOINT_ISSUES,
  ])('%s alone => tierFloor AMBER + needsSafetyCard', (condition) => {
    const result = deriveHealthAdjustment(
      input({ healthConditions: [condition] }),
    );
    expect(result.tierFloor).toBe('AMBER');
    expect(result.needsSafetyCard).toBe(true);
  });
});

describe('cardiac/hypertension levers', () => {
  it('sets mafDelta=-5 and the cardiac caution reason (HEALTH commitment => no clearance gate noise)', () => {
    const result = deriveHealthAdjustment(
      input({
        healthConditions: [HealthCondition.CARDIOVASCULAR],
        commitment: 'HEALTH',
      }),
    );
    expect(result.mafDelta).toBe(-5);
    expect(result.reasons).toEqual([
      expect.objectContaining({ code: 'health_cardiac_caution' }),
    ]);
  });
});

describe('JOINT_ISSUES levers', () => {
  it('sets durationCapMin=60, walkFirst, extendWarmCool, and the joint reason (HEALTH commitment => no clearance gate noise)', () => {
    const result = deriveHealthAdjustment(
      input({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        commitment: 'HEALTH',
      }),
    );
    expect(result.durationCapMin).toBe(60);
    expect(result.walkFirst).toBe(true);
    expect(result.extendWarmCool).toBe(true);
    expect(result.reasons).toEqual([
      expect.objectContaining({ code: 'health_joint_walk_first' }),
    ]);
  });
});

describe('clearance gate — only blocks ELEVATED commitment, mirrors profile.service.ts', () => {
  it('flagged + no clearance + HEALTH commitment => no gate', () => {
    const result = deriveHealthAdjustment(
      input({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        hasClearance: false,
        commitment: 'HEALTH',
      }),
    );
    expect(result.requiresClearanceGate).toBe(false);
  });

  it('flagged + no clearance + BASE commitment => gate fires', () => {
    const result = deriveHealthAdjustment(
      input({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        hasClearance: false,
        commitment: 'BASE',
      }),
    );
    expect(result.requiresClearanceGate).toBe(true);
    expect(result.forceHealthCommitment).toBe(true);
    expect(result.reasons.some((r) => r.code === 'health_clearance_gate')).toBe(
      true,
    );
  });

  it('flagged + cleared + PERFORMANCE commitment => no gate', () => {
    const result = deriveHealthAdjustment(
      input({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        hasClearance: true,
        commitment: 'PERFORMANCE',
      }),
    );
    expect(result.requiresClearanceGate).toBe(false);
  });
});

describe('mergeHealthReasons', () => {
  it('returns the SAME readiness object reference when there are no health reasons (no-op)', () => {
    const readiness = { tier: 'GREEN' as const, score: 0, reasons: [] };
    const adjustment = deriveHealthAdjustment(input());
    expect(mergeHealthReasons(readiness, adjustment)).toBe(readiness);
  });

  it('appends health reasons to readiness.reasons without mutating the original', () => {
    const readiness = {
      tier: 'GREEN' as const,
      score: 0,
      reasons: [{ code: 'sleep_warn', severity: 'warn' as const, text: 'x' }],
    };
    const adjustment = deriveHealthAdjustment(
      input({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        commitment: 'HEALTH',
      }),
    );
    const merged = mergeHealthReasons(readiness, adjustment);
    expect(merged.reasons).toHaveLength(2);
    expect(readiness.reasons).toHaveLength(1); // original untouched
  });
});
