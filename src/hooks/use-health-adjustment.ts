import { useMemo } from 'react';
import type { UserProfile } from '../types';
import { deriveHealthAdjustment, type HealthAdjustment } from '../utils/health-condition-rules';

/**
 * Phase 3 — derives today's advisory health-condition adjustment from the
 * profile's declared conditions + clearance audit (`clearedAt`). The server
 * is authoritative for the commitment gate (api/src/profile/profile.service.ts,
 * RED TEAM FIX #10); this hook is client-side ADVISORY only (AMBER floor —
 * FIX #3, JOINT_ISSUES levers, safety-card/gate visibility). Split out of
 * use-today-recommendation.ts to keep that hook under the 200-LOC
 * modularization guideline.
 */
export function useHealthAdjustment(userProfile: UserProfile, ageNum: number): HealthAdjustment {
  return useMemo(
    () =>
      deriveHealthAdjustment({
        healthConditions: userProfile.healthConditions ?? [],
        hasClearance: !!userProfile.clearedAt,
        age: ageNum,
        commitment: userProfile.commitment,
      }),
    [userProfile.healthConditions, userProfile.clearedAt, ageNum, userProfile.commitment],
  );
}
