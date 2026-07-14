/**
 * Health-condition screening rule effects (Phase 3 — Ch6 medical-clearance +
 * Ch29 special-populations model). Pure, deterministic — DECIDES which
 * existing, already-sanctioned safety levers apply for a flagged user; it does
 * NOT invent new medical intensity limits (research is emphatic: no published
 * cardiac/hypertension HR ceilings exist — "medical clearance required"
 * language only, RED TEAM FIX #9's spirit).
 *
 * The server is authoritative for the commitment gate (api/src/profile/
 * profile.service.ts, RED TEAM FIX #10) — `requiresClearanceGate`/
 * `forceHealthCommitment` here are ADVISORY only, for client-side messaging;
 * they mirror the server's exact rule (any flag + !hasClearance + commitment
 * beyond HEALTH) so the UI never contradicts what the server will accept.
 *
 * No React, no I/O — mirrors daily-readiness-score.ts / daily-recommendation-
 * engine.ts so it stays unit-testable.
 */

import { CommitmentLevel, HealthCondition, type ReasonCode, type ReadinessResult } from '../types';

export interface HealthRuleInput {
  healthConditions: HealthCondition[];
  /** Derived from `clearedAt != null` — server-audited (FIX #10), not a bare self-attested bool. */
  hasClearance: boolean;
  /** Reserved for future senior+health-specific tuning; not used by v1 rules (YAGNI) — the
   *  existing senior 60+ gate (maf-safety-adjustments.ts) already applies independently. */
  age: number;
  commitment: CommitmentLevel;
}

export interface HealthAdjustment {
  forceHealthCommitment: boolean;
  requiresClearanceGate: boolean;
  /** RED TEAM FIX #3: a FLOOR (minimum caution), never a ceiling — composed via
   *  most-cautious(computedTier, tierFloor) in daily-readiness-score.ts, so RED
   *  stays reachable even for a flagged user with a bad readiness signal. */
  tierFloor: 'AMBER' | null;
  /**
   * Informational annotation only (NOT independently applied to mafHr): flags
   * that the EXISTING medicated/chronic-condition -5 caution (maf-safety-
   * adjustments.ts / calculateMAF orchestrator, driven by isMedicatedOrInjured/
   * isRecovering) is the sanctioned lever for a cardiac/hypertension user — see
   * the phase-03 impl report "mafDelta design note" for why this module never
   * wires a second, independent subtraction into mafHr (would double-count
   * when isMedicatedOrInjured is already set, and would invent a new number
   * when it isn't — both against RED TEAM FIX #9's "no invented ceiling").
   */
  mafDelta: number;
  durationCapMin: number | null;
  walkFirst: boolean;
  extendWarmCool: boolean;
  reasons: ReasonCode[];
  needsSafetyCard: boolean;
}

const JOINT_DURATION_CAP_MIN = 60; // mirrors maf-safety-adjustments.ts MAX_DURATION_NEWBIE (beginner cap)
const CARDIAC_MAF_DELTA = -5; // mirrors MAF_RULES_SUMMARY §1 "medication for chronic conditions" (-5), informational only — see mafDelta doc

const CONDITION_LABEL_VN: Record<HealthCondition, string> = {
  [HealthCondition.CARDIOVASCULAR]: 'tim mạch',
  [HealthCondition.HYPERTENSION]: 'huyết áp',
  [HealthCondition.JOINT_ISSUES]: 'xương khớp',
};

/** VN copy samples verbatim from the phase-03 spec (owner-review baseline) — screening → adjustment → gate → warn ONLY, no diagnosis/treatment content. */
const CLEARANCE_GATE_TEXT =
  'Bạn có tình trạng sức khỏe cần lưu ý. Hãy tham khảo bác sĩ trước khi tăng khối lượng tập vượt mức Sức khỏe (HEALTH). (Chương 6)';
const JOINT_WALK_FIRST_TEXT =
  'Ưu tiên đi bộ trước, khởi động & thả lỏng dài hơn để bảo vệ khớp. (Chương 29)';
const CARDIAC_CAUTION_TEXT =
  'Tình trạng tim mạch/huyết áp — nếu đang dùng thuốc hoặc mới hồi phục, hãy đánh dấu mục "Dùng thuốc / Chấn thương" trong hồ sơ để hệ thống áp dụng mức điều chỉnh nhịp tim thận trọng hơn.';

/**
 * Derives the conservative rule effects for today's flagged conditions. Safe
 * to call unconditionally (empty `healthConditions` -> an all-inert result:
 * no floor, no gate, no safety card).
 */
export function deriveHealthAdjustment(input: HealthRuleInput): HealthAdjustment {
  const { healthConditions, hasClearance, commitment } = input;
  const hasAny = healthConditions.length > 0;
  const hasCardiac =
    healthConditions.includes(HealthCondition.CARDIOVASCULAR) ||
    healthConditions.includes(HealthCondition.HYPERTENSION);
  const hasJoint = healthConditions.includes(HealthCondition.JOINT_ISSUES);

  // Gate only blocks ELEVATED commitment (beyond HEALTH) — mirrors profile.service.ts exactly
  // so the UI never contradicts what the server will accept.
  const wantsElevatedCommitment = commitment !== CommitmentLevel.HEALTH;
  const gate = hasAny && !hasClearance && wantsElevatedCommitment;

  const reasons: ReasonCode[] = [];

  if (hasCardiac) {
    reasons.push({ code: 'health_cardiac_caution', severity: 'warn', bookRef: 'CH6', text: CARDIAC_CAUTION_TEXT });
  }
  if (hasJoint) {
    reasons.push({ code: 'health_joint_walk_first', severity: 'warn', text: JOINT_WALK_FIRST_TEXT });
  }
  if (gate) {
    reasons.push({ code: 'health_clearance_gate', severity: 'warn', bookRef: 'CH6', text: CLEARANCE_GATE_TEXT });
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

/** VN labels for declared conditions, e.g. for a screening-summary UI. Exported for reuse (DRY). */
export function conditionLabelsVn(conditions: HealthCondition[]): string[] {
  return conditions.map((c) => CONDITION_LABEL_VN[c]);
}

/**
 * Merges this module's advisory reason codes into a readiness result.
 * `computeReadiness` (daily-readiness-score.ts) only receives `tierFloor` —
 * the reason TEXT is merged here by the caller (use-today-recommendation.ts)
 * so TodayCardReasons displays cardiac/joint/gate copy via the existing
 * readiness.reasons pipeline, with no UI-layer changes needed.
 */
export function mergeHealthReasons(readiness: ReadinessResult, health: HealthAdjustment): ReadinessResult {
  if (health.reasons.length === 0) return readiness;
  return { ...readiness, reasons: [...readiness.reasons, ...health.reasons] };
}
