/**
 * SOURCE OF TRUTH: src/utils/health-condition-rules.ts — server-local port (DRY debt,
 * reconcile if logic changes). Reuses the ALREADY-server-side `HealthCondition` enum from
 * api/src/profile/profile.dto.ts (not a port — that enum lives in this codebase already).
 */

import { HealthCondition } from '../../profile/profile.dto.js';
import type {
  CommitmentLevel,
  ReadinessResult,
  ReasonCode,
} from './recompute-types.js';

export interface HealthRuleInput {
  healthConditions: HealthCondition[];
  /** Derived from `clearedAt != null` — server-audited, not a bare self-attested bool. */
  hasClearance: boolean;
  commitment: CommitmentLevel;
}

export interface HealthAdjustment {
  forceHealthCommitment: boolean;
  requiresClearanceGate: boolean;
  tierFloor: 'AMBER' | null;
  mafDelta: number;
  durationCapMin: number | null;
  walkFirst: boolean;
  extendWarmCool: boolean;
  reasons: ReasonCode[];
  needsSafetyCard: boolean;
}

const JOINT_DURATION_CAP_MIN = 60;
const CARDIAC_MAF_DELTA = -5;

const CLEARANCE_GATE_TEXT =
  'Bạn có tình trạng sức khỏe cần lưu ý. Hãy tham khảo bác sĩ trước khi tăng khối lượng tập vượt mức Sức khỏe (HEALTH). (Chương 6)';
const JOINT_WALK_FIRST_TEXT =
  'Ưu tiên đi bộ trước, khởi động & thả lỏng dài hơn để bảo vệ khớp. (Chương 29)';
const CARDIAC_CAUTION_TEXT =
  'Tình trạng tim mạch/huyết áp — nếu đang dùng thuốc hoặc mới hồi phục, hãy đánh dấu mục "Dùng thuốc / Chấn thương" trong hồ sơ để hệ thống áp dụng mức điều chỉnh nhịp tim thận trọng hơn.';

/**
 * Derives the conservative rule effects for today's flagged conditions. Safe to call
 * unconditionally (empty `healthConditions` -> an all-inert result: no floor, no gate).
 */
export function deriveHealthAdjustment(
  input: HealthRuleInput,
): HealthAdjustment {
  const { healthConditions, hasClearance, commitment } = input;
  const hasAny = healthConditions.length > 0;
  const hasCardiac =
    healthConditions.includes(HealthCondition.CARDIOVASCULAR) ||
    healthConditions.includes(HealthCondition.HYPERTENSION);
  const hasJoint = healthConditions.includes(HealthCondition.JOINT_ISSUES);

  const wantsElevatedCommitment = commitment !== 'HEALTH';
  const gate = hasAny && !hasClearance && wantsElevatedCommitment;

  const reasons: ReasonCode[] = [];

  if (hasCardiac) {
    reasons.push({
      code: 'health_cardiac_caution',
      severity: 'warn',
      bookRef: 'CH6',
      text: CARDIAC_CAUTION_TEXT,
    });
  }
  if (hasJoint) {
    reasons.push({
      code: 'health_joint_walk_first',
      severity: 'warn',
      text: JOINT_WALK_FIRST_TEXT,
    });
  }
  if (gate) {
    reasons.push({
      code: 'health_clearance_gate',
      severity: 'warn',
      bookRef: 'CH6',
      text: CLEARANCE_GATE_TEXT,
    });
  }

  return {
    forceHealthCommitment: gate,
    requiresClearanceGate: gate,
    tierFloor: hasAny ? 'AMBER' : null,
    mafDelta: hasCardiac ? CARDIAC_MAF_DELTA : 0,
    durationCapMin: hasJoint ? JOINT_DURATION_CAP_MIN : null,
    walkFirst: hasJoint,
    extendWarmCool: hasJoint,
    reasons,
    needsSafetyCard: hasAny,
  };
}

/** Merges this module's advisory reason codes into a readiness result. */
export function mergeHealthReasons(
  readiness: ReadinessResult,
  health: HealthAdjustment,
): ReadinessResult {
  if (health.reasons.length === 0) return readiness;
  return { ...readiness, reasons: [...readiness.reasons, ...health.reasons] };
}
