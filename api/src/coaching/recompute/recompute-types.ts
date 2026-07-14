/**
 * SOURCE OF TRUTH: src/types.ts (ReasonCode/ReadinessResult/ReadinessTier/ScheduleItem/
 * DailyRecommendation), src/utils/maf-activity-analysis.ts (MafZone), src/utils/
 * maf-coaching-insights.ts (BookRef) — server-local port (DRY debt, reconcile if logic
 * changes). See api/src/coaching/coaching.service.ts header for why this port exists
 * instead of a shared `packages/maf-core` workspace (Docker build-context constraint).
 *
 * Kept as plain type/interface declarations only — no logic here.
 */

/** Inclusive MAF heart-rate band: [lower, upper]. Mirrors maf-activity-analysis.ts MafZone. */
export interface MafZone {
  lower: number;
  upper: number;
}

/** Book citation ids the recompute pipeline is allowed to emit. Mirrors maf-coaching-insights.ts BookRef. */
export type BookRef = 'CH3' | 'CH4' | 'CH5' | 'CH6' | 'CH7' | 'CH8' | 'CH9';

export type ReasonSeverity = 'good' | 'warn' | 'bad';

/** One book-grounded finding that fed a readiness tier or a recommendation adjustment. */
export interface ReasonCode {
  code: string;
  severity: ReasonSeverity;
  text: string; // VN — NEVER forwarded to the LLM (see coaching-prompt.ts serializer); codes only.
  bookRef?: BookRef;
}

export type ReadinessTier = 'GREEN' | 'AMBER' | 'RED';

export interface ReadinessResult {
  tier: ReadinessTier;
  score: number;
  reasons: ReasonCode[];
}

export interface ScheduleItem {
  day: string;
  activity: string;
  duration: number;
  type: 'RUN' | 'LONG_RUN' | 'REST' | 'WALK' | 'CROSS_TRAIN' | 'RECOVERY';
}

export interface DailyRecommendation {
  dayType: 'RUN' | 'LONG_RUN' | 'WALK' | 'RECOVERY' | 'REST';
  title: string;
  totalMinutes: number;
  warmupMin: number;
  cooldownMin: number;
  mainMinutes: number;
  allEasy?: boolean;
  hrZone: MafZone | null;
  tier: ReadinessTier;
  reasons: ReasonCode[];
  citations: BookRef[];
  restCopy?: string;
  adjustmentNote?: string;
}

export type CommitmentLevel = 'HEALTH' | 'BASE' | 'PERFORMANCE';
export type ExperienceLevel =
  | 'NONE'
  | 'INCONSISTENT'
  | 'REGULAR_NEW'
  | 'ADVANCED';

/** Minimal recent-activity shape actually consumed by the readiness signals (loadSignal). */
export interface RecomputeActivity {
  startDate: Date;
  distanceMeters: number;
}

/** Minimal check-in shape actually consumed by the readiness signals + recommendation copy. */
export interface RecomputeCheckin {
  sleepQuality: number | null;
  fatigue: number | null;
  soreness: string | null;
  restingHr: number | null;
}
