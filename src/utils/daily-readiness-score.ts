/**
 * Pure readiness scoring engine — CHECK-IN-FIRST, Garmin bonus-only
 * (RED TEAM FIX #5). Additive-penalty model over independent signals
 * (daily-readiness-signals.ts). Profile flags (isProbation/isRecovering)
 * apply an AMBER FLOOR, never a ceiling (RED TEAM FIX #3) — RED stays
 * reachable even for a probation/recovering user when a bad signal fires.
 * No React, no I/O.
 */

import type { StravaActivity } from '../services/strava-service';
import type { GarminDailySummary } from '../services/garmin-service';
import type { DailyCheckin, ReasonCode, ReadinessResult, ReadinessTier } from '../types';
import {
  rhrSignal,
  sleepSignal,
  stressSignal,
  fatigueSorenessSignal,
  loadSignal,
  trendSignal,
  type SignalContext,
} from './daily-readiness-signals';

export interface ReadinessProfile {
  age: number;
  bmi: number;
  isProbation: boolean;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
}

export interface ReadinessInput {
  recentActivities: StravaActivity[];
  dailySummaries: GarminDailySummary[];
  checkin: DailyCheckin | null;
  profile: ReadinessProfile;
  today: Date; // local midnight
  /** Optional — enables the efficiency-trend signal; not part of the documented minimal input shape. */
  mafHr?: number;
}

export type { ReadinessResult, ReadinessTier };

const RANK: Record<ReadinessTier, number> = { GREEN: 0, AMBER: 1, RED: 2 };
const mostCautious = (a: ReadinessTier, b: ReadinessTier): ReadinessTier => (RANK[b] > RANK[a] ? b : a);

/**
 * @param tierFloor Optional EXTERNAL floor (Phase 3 health-condition clamps feed
 *   this too — composed with the internal profile floor via most-cautious, never
 *   a ceiling). Only 'AMBER' today; kept as a union for forward compat.
 */
export function computeReadiness(input: ReadinessInput, tierFloor?: 'AMBER'): ReadinessResult {
  const ctx: SignalContext = {
    recentActivities: input.recentActivities,
    dailySummaries: input.dailySummaries,
    checkin: input.checkin,
    today: input.today,
    mafHr: input.mafHr,
  };

  // Graceful degradation: every signal below independently returns [] when its
  // data is missing/insufficient — never a penalty, never a fabricated bonus
  // (RED TEAM FIX #5: zero check-in + zero Garmin => zero reasons => GREEN).
  const reasons: ReasonCode[] = [
    ...rhrSignal(ctx),
    ...sleepSignal(ctx),
    ...stressSignal(ctx),
    ...fatigueSorenessSignal(ctx),
    ...loadSignal(ctx),
    ...trendSignal(ctx),
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

  // RED TEAM FIX #3 — AMBER floor, not a ceiling: raises the MINIMUM tier but
  // never blocks RED when a bad/multi-warn signal already pushed tier higher.
  const profileFloor: ReadinessTier | undefined =
    input.profile.isProbation || input.profile.isRecovering ? 'AMBER' : undefined;
  let floor: ReadinessTier = 'GREEN';
  if (profileFloor) floor = mostCautious(floor, profileFloor);
  if (tierFloor) floor = mostCautious(floor, tierFloor);

  if (RANK[floor] > RANK[tier]) {
    reasons.push({
      code: 'profile_floor',
      severity: 'warn',
      bookRef: 'CH7',
      text: 'Đang trong giai đoạn thử thách/hồi phục — hệ thống giữ mức thận trọng tối thiểu AMBER.',
    });
    tier = floor;
  }

  return { tier, score: badCount * 2 + warnCount, reasons };
}
