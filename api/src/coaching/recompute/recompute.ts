/**
 * Top-level composition — mirrors the useMemo chain in src/hooks/use-today-recommendation.ts
 * (orchestrator -> readiness -> health-adjustment -> recommendation), rebuilt from
 * SERVER-OWNED data only (UserProfile + recent StravaActivity + today's DailyCheckin).
 * This is the ONLY entry point coaching.service.ts should call — it never trusts a
 * client-sent recommendation (RED TEAM FIX #1).
 */

import type { HealthCondition } from '../../profile/profile.dto.js';
import {
  computeReadiness,
  type ReadinessProfile,
} from './daily-readiness-score.js';
import {
  deriveHealthAdjustment,
  mergeHealthReasons,
  type HealthAdjustment,
} from './health-condition-rules.js';
import { buildDailyRecommendation } from './daily-recommendation-engine.js';
import {
  computeMafHr,
  computeTodayScheduleItem,
  weekdayLabel,
} from './today-schedule-basis.js';
import type {
  CommitmentLevel,
  DailyRecommendation,
  ExperienceLevel,
  ReadinessResult,
  RecomputeActivity,
  RecomputeCheckin,
} from './recompute-types.js';

export interface RecomputeUserProfile {
  age: number;
  height: number;
  weight: number;
  experience: ExperienceLevel;
  commitment: CommitmentLevel;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
  isProbation: boolean;
  healthConditions: HealthCondition[];
  /** Derived by the caller from `clearedAt != null` (server-audited). */
  hasClearance: boolean;
}

export interface RecomputeParams {
  profile: RecomputeUserProfile;
  recentActivities: RecomputeActivity[];
  checkin: RecomputeCheckin | null;
  /** Check-in restingHr values from prior days (today excluded) — RHR baseline. */
  rhrHistory: number[];
  /** Server-derived ICT "today" (checkin.service.ts `deriveIctDate()` — UTC-midnight of the ICT calendar date). */
  serverToday: Date;
}

export interface RecomputeResult {
  recommendation: DailyRecommendation;
  readiness: ReadinessResult;
  healthAdjustment: HealthAdjustment;
}

function computeBmi(heightCm: number, weightKg: number): number {
  if (!(heightCm > 0) || !(weightKg > 0)) return 0;
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  return bmi > 100 ? 0 : Math.round(bmi * 10) / 10;
}

/** Pure, deterministic — same server-owned inputs always produce the same recommendation. */
export function recomputeDailyRecommendation(
  params: RecomputeParams,
): RecomputeResult {
  const { profile, recentActivities, checkin, rhrHistory, serverToday } =
    params;
  const bmi = computeBmi(profile.height, profile.weight);

  const readinessProfile: ReadinessProfile = {
    isProbation: profile.isProbation,
    isRecovering: profile.isRecovering,
    isMedicatedOrInjured: profile.isMedicatedOrInjured,
  };

  const healthAdjustment = deriveHealthAdjustment({
    healthConditions: profile.healthConditions,
    hasClearance: profile.hasClearance,
    commitment: profile.commitment,
  });

  const baseReadiness = computeReadiness(
    {
      recentActivities,
      checkin,
      rhrHistory,
      profile: readinessProfile,
      today: serverToday,
    },
    healthAdjustment.tierFloor ?? undefined,
  );
  const readiness = mergeHealthReasons(baseReadiness, healthAdjustment);

  const mafHr = computeMafHr({
    age: profile.age,
    isRecovering: profile.isRecovering,
    isMedicatedOrInjured: profile.isMedicatedOrInjured,
    isProbation: profile.isProbation,
    experience: profile.experience,
  });

  const scheduleItem = computeTodayScheduleItem(
    profile.commitment,
    weekdayLabel(serverToday),
    {
      age: profile.age,
      bmi,
      experience: profile.experience,
      isRecovering: profile.isRecovering,
      isProbation: profile.isProbation,
    },
  );

  const recommendation = buildDailyRecommendation({
    adjustedScheduleItem: scheduleItem,
    mafHr,
    readiness,
    profile: { age: profile.age },
    healthAdjustment,
  });

  return { recommendation, readiness, healthAdjustment };
}
