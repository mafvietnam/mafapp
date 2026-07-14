import type { MafZone } from './utils/maf-activity-analysis';
import type { BookRef } from './utils/maf-coaching-insights';

export enum ExperienceLevel {
  NONE = 'NONE',
  INCONSISTENT = 'INCONSISTENT',
  REGULAR_NEW = 'REGULAR_NEW',
  ADVANCED = 'ADVANCED',
}

export enum CommitmentLevel {
  HEALTH = 'HEALTH',
  BASE = 'BASE',
  PERFORMANCE = 'PERFORMANCE',
}

/**
 * Phase 3 — server-side WHITELIST for health-condition screening codes
 * (RED TEAM FIX #9). Mirrors api/src/profile/profile.dto.ts's `HealthCondition`
 * enum (frontend/backend are separate TS projects — no shared package, same
 * duplication pattern as ExperienceLevel/CommitmentLevel's string values in
 * profile.dto.ts's `@IsIn([...])`). The whitelist IS the enum — no "extensible
 * unknown codes"; extending it requires updating BOTH copies + the API's
 * `@ArrayMaxSize`.
 */
export enum HealthCondition {
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  HYPERTENSION = 'HYPERTENSION',
  JOINT_ISSUES = 'JOINT_ISSUES',
}

export interface UserProfile {
  age: string;
  height: string;
  weight: string;
  experience: ExperienceLevel;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
  isMedicalClearanceConfirmed: boolean;
  commitment: CommitmentLevel;
  previousMonthPace?: string; // Optional: Pace from last month for volume adjustment
  isProbation?: boolean; // Đang trong giai đoạn thử thách sau chấn thương
  probationStartDate?: string; // Ngày bắt đầu giai đoạn thử thách (ISO date string)
  // Long Run History (Optional - for smart calculation)
  lastLongRunDuration?: number; // Thời gian Long Run gần nhất (phút)
  lastLongRunHeartRate?: number; // Nhịp tim trung bình của Long Run gần nhất (bpm)
  lastLongRunFeeling?: 'GOOD' | 'TIRED' | 'VERY_TIRED'; // Cảm nhận sau Long Run
  // --- Phase 3: health-condition screening (sensitive PII — see profile-service.ts) ---
  healthConditions?: HealthCondition[]; // whitelisted codes only (server rejects unknown at write)
  healthScreenedAt?: string; // ISO — when the screening questionnaire was last submitted
  healthConsentGiven?: boolean; // consent INTENT for the next write; server stamps healthConsentAt
  healthConsentAt?: string; // ISO — server-set consent audit timestamp (read-only, FIX #11)
  healthClearanceConfirmed?: boolean; // clearance INTENT for the next write; server stamps clearedAt/clearedBy
  clearedAt?: string; // ISO — server-set clearance audit timestamp (read-only, FIX #10)
  clearedBy?: string; // server-set clearance audit method (read-only, e.g. "self-attested")
}

export interface MafResult {
  mafHeartRate: number;
  lowerZone: number;
  upperZone: number;
  notes: string[];
  explanation?: string; // New field for transparency message
  volumeAdjustmentMessage?: string; // Message about schedule adjustment based on pace comparison
  volumeAdjustmentType?: 'PROGRESS' | 'REGRESSION' | 'STABLE'; // Type of adjustment for UI styling
  scheduleTitle: string;
  schedule: ScheduleItem[];
  mindset: string;
  bmi: number;
  bmiCategory: string;
  // Smart Long Run calculation result
  longRunAdjustmentMessage?: string; // Message explaining Long Run adjustment
  longRunAdjustmentType?: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP'; // Type for UI styling
}

export interface ScheduleItem {
  day: string;
  activity: string;
  duration: number;
  type: 'RUN' | 'LONG_RUN' | 'REST' | 'WALK' | 'CROSS_TRAIN' | 'RECOVERY';
}

// ---------------------------------------------------------------------------
// Daily Run Recommendation (phase-01) — shared cross-cutting types. Reused by
// daily-readiness-score.ts, daily-recommendation-engine.ts, checkin-service.ts,
// and the today/* UI components. Domain-specific types (ReadinessInput,
// RecommendationInput, etc.) stay local to the util that owns them.
// ---------------------------------------------------------------------------

/** One user-submitted morning check-in (server-derived ICT `date` — see RED TEAM FIX #7). */
export interface DailyCheckin {
  id: string;
  date: string; // YYYY-MM-DD, server-derived ICT date
  sleepQuality: number; // 1-5
  fatigue: number; // 1-5
  soreness: string | null;
  note: string | null;
  restingHr: number | null;
}

export type ReasonSeverity = 'good' | 'warn' | 'bad';

/** One book-grounded finding that fed a readiness tier or a recommendation adjustment. */
export interface ReasonCode {
  code: string;
  severity: ReasonSeverity;
  text: string; // VN
  bookRef?: BookRef;
}

export type ReadinessTier = 'GREEN' | 'AMBER' | 'RED';

export interface ReadinessResult {
  tier: ReadinessTier;
  score: number;
  reasons: ReasonCode[];
}

export interface DailyRecommendation {
  dayType: 'RUN' | 'LONG_RUN' | 'WALK' | 'RECOVERY' | 'REST';
  title: string; // VN, e.g. "Chạy nhẹ nhàng 45 phút"
  totalMinutes: number; // after tier adjustment (orchestrator-adjusted then readiness delta)
  warmupMin: number; // proportional clamp(round(total*0.20),5,15); 0 when allEasy (RED TEAM FIX #13)
  cooldownMin: number; // same as warmupMin
  mainMinutes: number; // total - warmup - cooldown, floored >=5 (or =total when allEasy)
  allEasy?: boolean; // true when total<35 -> whole session easy, warm/cool folded
  hrZone: MafZone | null; // { lower: mafHr-10, upper: mafHr }; null if mafHr<=0 or isChild
  tier: ReadinessTier;
  reasons: ReasonCode[]; // from readiness, filtered to what changed the plan
  citations: BookRef[]; // e.g. ['CH5','CH6','CH7']
  restCopy?: string; // set only when dayType==='REST' (minimal VN in P1)
  adjustmentNote?: string; // VN, e.g. "Đã giảm 40% thời lượng do tín hiệu hồi phục thấp"
}
