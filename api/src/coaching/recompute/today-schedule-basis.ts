/**
 * NOT a 1:1 port — a DISCLOSED, SAFETY-PRESERVING SIMPLIFICATION of the frontend's
 * schedule/MAF-HR pipeline, scoped to what the AI narrative needs (today's dayType +
 * duration + MAF HR). Data (SCHEDULES template, EXPERIENCE_OPTIONS scores) mirrors
 * SOURCE OF TRUTH: src/constants.ts. Safety-rule logic mirrors SOURCE OF TRUTH:
 * src/utils/maf-safety-adjustments.ts (`adjustScheduleForSafety`, `adjustForProbation`),
 * src/utils/maf-calculator-orchestrator.ts (`applyHeartRateAdjustments`).
 *
 * DELIBERATELY OMITTED (does not affect safety, only cosmetic/volume tuning): pace-test
 * driven smart-long-run scaling, weekly-volume-cap enforcement, and pace-based warnings/
 * Thursday cross-train swap (src/utils/maf-calculator-schedule-builder.ts). Those need a
 * "verified MAF pace" derived from Strava-activity pace-test matching — well outside the
 * "readiness + daily recommendation from profile/activities/checkin" recompute scope
 * authorized for this phase. Net effect: on a minority of days the AI-narrated total
 * minutes may differ slightly from what TodayCard renders (frontend applies those extra
 * volume tweaks); the safety-critical tier gating (RED/AMBER, health-condition caps,
 * "RED = REST-or-walk-only") is unaffected and always faithfully applied via
 * daily-recommendation-engine.ts. See phase-04 impl report "Unresolved Questions".
 */

import type {
  CommitmentLevel,
  ExperienceLevel,
  ScheduleItem,
} from './recompute-types.js';

/** VN weekday labels, indexed by JS `Date#getUTCDay()` (0=Sun..6=Sat). Mirrors src/utils/local-today.ts. */
const VN_WEEKDAY_LABELS = [
  'Chủ Nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

/** Mirrors src/constants.ts EXPERIENCE_OPTIONS score table (labels omitted — not needed server-side). */
const EXPERIENCE_SCORE: Record<ExperienceLevel, number> = {
  NONE: 0,
  INCONSISTENT: -5,
  REGULAR_NEW: 0,
  ADVANCED: 5,
};

/** Mirrors src/constants.ts SCHEDULES (duration/type only — `activity` text is unused by the recommendation engine). */
const SCHEDULES: Record<CommitmentLevel, ScheduleItem[]> = {
  HEALTH: [
    { day: 'Thứ 2', activity: '', duration: 0, type: 'REST' },
    { day: 'Thứ 3', activity: '', duration: 30, type: 'RUN' },
    { day: 'Thứ 4', activity: '', duration: 30, type: 'WALK' },
    { day: 'Thứ 5', activity: '', duration: 30, type: 'RUN' },
    { day: 'Thứ 6', activity: '', duration: 0, type: 'REST' },
    { day: 'Thứ 7', activity: '', duration: 60, type: 'LONG_RUN' },
    { day: 'Chủ Nhật', activity: '', duration: 30, type: 'REST' },
  ],
  BASE: [
    { day: 'Thứ 2', activity: '', duration: 0, type: 'REST' },
    { day: 'Thứ 3', activity: '', duration: 60, type: 'RUN' },
    { day: 'Thứ 4', activity: '', duration: 45, type: 'RUN' },
    { day: 'Thứ 5', activity: '', duration: 60, type: 'RUN' },
    { day: 'Thứ 6', activity: '', duration: 0, type: 'REST' },
    { day: 'Thứ 7', activity: '', duration: 90, type: 'LONG_RUN' },
    { day: 'Chủ Nhật', activity: '', duration: 45, type: 'WALK' },
  ],
  PERFORMANCE: [
    { day: 'Thứ 2', activity: '', duration: 0, type: 'REST' },
    { day: 'Thứ 3', activity: '', duration: 75, type: 'RUN' },
    { day: 'Thứ 4', activity: '', duration: 60, type: 'RUN' },
    { day: 'Thứ 5', activity: '', duration: 75, type: 'RUN' },
    { day: 'Thứ 6', activity: '', duration: 45, type: 'RUN' },
    { day: 'Thứ 7', activity: '', duration: 120, type: 'LONG_RUN' },
    { day: 'Chủ Nhật', activity: '', duration: 60, type: 'RUN' },
  ],
};

export function weekdayLabel(serverToday: Date): string {
  return VN_WEEKDAY_LABELS[serverToday.getUTCDay()];
}

export interface MafHrProfile {
  age: number;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
  isProbation: boolean;
  experience: ExperienceLevel;
}

/** Mirrors maf-calculator-orchestrator.ts `applyHeartRateAdjustments` (180-formula + adjustments). */
export function computeMafHr(profile: MafHrProfile): number {
  let maf = 180 - profile.age;
  if (profile.isRecovering) maf -= 10;
  if (profile.isMedicatedOrInjured) maf -= 5;
  if (profile.isProbation) maf -= 10;
  maf += EXPERIENCE_SCORE[profile.experience] ?? 0;
  return maf;
}

export interface ScheduleSafetyProfile {
  age: number;
  bmi: number;
  experience: ExperienceLevel;
  isRecovering: boolean;
  isProbation: boolean;
}

const NEWBIE_MAX_DURATION_MIN = 60;
const SENIOR_MAX_DURATION_MIN = 90;
const RECOVERING_MAX_DURATION_MIN = 45;
const SENIOR_AGE_THRESHOLD = 60;
const OBESE_BMI_THRESHOLD = 30;
const PROBATION_REDUCTION_FACTOR = 0.7; // -30%
const PROBATION_MIN_DURATION_MIN = 15;

/**
 * Selects today's ScheduleItem from the static weekly template for `commitment`, then
 * applies the core SAFETY rules (BMI joint-safety, newbie/senior duration caps, recovering
 * walk-conversion, probation volume cut) — see file header for what's intentionally
 * excluded. Falls back to the template's first entry if today's weekday label doesn't
 * match (defensive; VN_WEEKDAY_LABELS always covers all 7 days in practice).
 */
export function computeTodayScheduleItem(
  commitment: CommitmentLevel,
  today: string,
  profile: ScheduleSafetyProfile,
): ScheduleItem {
  const week = SCHEDULES[commitment];
  let item = week.find((s) => s.day === today) ?? week[0];

  // RULE 1 — JOINT SAFETY (BMI >= 30): low-impact only, runs become walks.
  if (
    profile.bmi >= OBESE_BMI_THRESHOLD &&
    (item.type === 'RUN' || item.type === 'LONG_RUN')
  ) {
    item = { ...item, type: 'WALK' };
  }

  // RULE 2 — NEWBIE SAFETY: max 60min/session.
  const isBeginner =
    profile.experience === 'NONE' || profile.experience === 'INCONSISTENT';
  if (isBeginner && item.duration > NEWBIE_MAX_DURATION_MIN) {
    item = { ...item, duration: NEWBIE_MAX_DURATION_MIN };
  }

  // RULE 3 — SENIOR: cap at 90min/session.
  if (
    profile.age >= SENIOR_AGE_THRESHOLD &&
    item.duration > SENIOR_MAX_DURATION_MIN
  ) {
    item = { ...item, duration: SENIOR_MAX_DURATION_MIN };
  }

  // RULE 4 — RECOVERING: cap at 45min, runs become walk/easy.
  if (
    profile.isRecovering &&
    (item.type === 'RUN' || item.type === 'LONG_RUN')
  ) {
    item = {
      ...item,
      type: 'WALK',
      duration: Math.min(item.duration, RECOVERING_MAX_DURATION_MIN),
    };
  }

  // Probation: -30% volume, floor 15min (only for non-zero-duration items).
  if (profile.isProbation && item.duration > 0) {
    const reduced = Math.round(item.duration * PROBATION_REDUCTION_FACTOR);
    item = { ...item, duration: Math.max(reduced, PROBATION_MIN_DURATION_MIN) };
  }

  return item;
}
