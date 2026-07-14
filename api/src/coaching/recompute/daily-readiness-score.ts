/**
 * SOURCE OF TRUTH: src/utils/daily-readiness-score.ts — server-local port (DRY debt,
 * reconcile if logic changes). See daily-readiness-signals.ts header for the two
 * deliberate scope reductions (no trendSignal, no Garmin) carried into this composition.
 */

import type {
  ReadinessResult,
  ReadinessTier,
  ReasonCode,
  RecomputeActivity,
  RecomputeCheckin,
} from './recompute-types.js';
import {
  rhrSignal,
  sleepSignal,
  fatigueSorenessSignal,
  loadSignal,
  type SignalContext,
} from './daily-readiness-signals.js';

export interface ReadinessProfile {
  isProbation: boolean;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
}

export interface ReadinessInput {
  recentActivities: RecomputeActivity[];
  checkin: RecomputeCheckin | null;
  /** Check-in restingHr values from the prior N days (today excluded) — RHR baseline. */
  rhrHistory: number[];
  profile: ReadinessProfile;
  today: Date;
}

const RANK: Record<ReadinessTier, number> = { GREEN: 0, AMBER: 1, RED: 2 };
const mostCautious = (a: ReadinessTier, b: ReadinessTier): ReadinessTier =>
  RANK[b] > RANK[a] ? b : a;

/**
 * @param tierFloor Optional EXTERNAL floor (health-condition clamp) — composed with the
 *   internal profile floor via most-cautious, never a ceiling.
 */
export function computeReadiness(
  input: ReadinessInput,
  tierFloor?: 'AMBER',
): ReadinessResult {
  const ctx: SignalContext = {
    recentActivities: input.recentActivities,
    checkin: input.checkin,
    today: input.today,
  };

  // Every signal below independently returns [] when its data is missing/insufficient —
  // never a penalty, never a fabricated bonus (zero check-in + zero activity => GREEN).
  const reasons: ReasonCode[] = [
    ...rhrSignal(ctx, input.rhrHistory),
    ...sleepSignal(ctx),
    ...fatigueSorenessSignal(ctx),
    ...loadSignal(ctx),
  ];

  if (input.profile.isMedicatedOrInjured) {
    reasons.push({
      code: 'medicated_or_injured',
      severity: 'warn',
      bookRef: 'CH7',
      text: 'Đang dùng thuốc hoặc hồi phục chấn thương — tập nhẹ nhàng hơn bình thường.',
    });
  }

  const badCount = reasons.filter((r) => r.severity === 'bad').length;
  const warnCount = reasons.filter((r) => r.severity === 'warn').length;

  let tier: ReadinessTier = 'GREEN';
  if (badCount >= 1 || warnCount >= 2) tier = 'RED';
  else if (warnCount >= 1) tier = 'AMBER';

  // AMBER floor, not a ceiling: raises the MINIMUM tier but never blocks RED when a
  // bad/multi-warn signal already pushed tier higher. `tierFloor` also carries the
  // health-condition floor — composed via most-cautious, never a ceiling.
  const profileFloor: ReadinessTier | undefined =
    input.profile.isProbation || input.profile.isRecovering
      ? 'AMBER'
      : undefined;
  let floor: ReadinessTier = 'GREEN';
  if (profileFloor) floor = mostCautious(floor, profileFloor);
  if (tierFloor) floor = mostCautious(floor, tierFloor);

  if (RANK[floor] > RANK[tier]) {
    const fromHealth = tierFloor === floor;
    const fromProfile = profileFloor === floor;
    const text =
      fromHealth && fromProfile
        ? 'Đang trong giai đoạn thử thách/hồi phục và có tình trạng sức khỏe cần lưu ý — hệ thống giữ mức thận trọng tối thiểu AMBER.'
        : fromHealth
          ? 'Có tình trạng sức khỏe cần lưu ý — hệ thống giữ mức thận trọng tối thiểu AMBER. (Chương 6)'
          : 'Đang trong giai đoạn thử thách/hồi phục — hệ thống giữ mức thận trọng tối thiểu AMBER.';
    reasons.push({
      code: 'profile_floor',
      severity: 'warn',
      bookRef: 'CH7',
      text,
    });
    tier = floor;
  }

  return { tier, score: badCount * 2 + warnCount, reasons };
}
