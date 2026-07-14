/**
 * Pure daily-workout recommendation engine. Consumes the ORCHESTRATOR's
 * adjusted schedule item + adjusted mafHr (RED TEAM FIX #4 — never the raw
 * SCHEDULES template or `calculateRawMaf`, which omits the probation -10) and
 * layers today's readiness tier on top. No React, no I/O.
 */

import type { ScheduleItem, DailyRecommendation, ReadinessResult, ReasonCode, ReadinessTier } from '../types';
import type { MafZone } from './maf-activity-analysis';
import type { BookRef } from './maf-coaching-insights';
import { computeDurationBreakdown, roundToNearest5 } from './daily-recommendation-math';

export interface RecommendationInput {
  adjustedScheduleItem: ScheduleItem;
  mafHr: number;
  readiness: ReadinessResult;
  profile: { age: number; bmi: number };
}

const CHILD_COPY =
  'Trẻ dưới 16 tuổi: hãy VUI CHƠI tự nhiên (chạy nhảy, bơi, đạp xe) — không theo lịch tập có cấu trúc.';
const REST_MINIMAL_COPY =
  'Ngày nghỉ giúp cơ thể tái tạo mạnh hơn — "Tập luyện = Vận động + Nghỉ ngơi" (Chương 7).';
const AMBER_REDUCTION_FACTOR = 0.65; // -35% (placeholder, see phase-01 plan)

type DayType = DailyRecommendation['dayType'];

const TITLE_LABEL: Record<Exclude<DayType, 'REST'>, string> = {
  RUN: 'Chạy nhẹ nhàng',
  LONG_RUN: 'Chạy dài',
  WALK: 'Đi bộ',
  RECOVERY: 'Hồi phục nhẹ',
};

/** Short VN phrases for the AMBER adjustmentNote — mirrors "vì bạn báo đau bắp chân & ngủ chưa đủ." sample. */
const REASON_SHORT_VN: Record<string, string> = {
  rhr_bad: 'nhịp tim nghỉ tăng cao',
  rhr_warn: 'nhịp tim nghỉ tăng nhẹ',
  sleep_warn: 'ngủ chưa đủ',
  stress_warn: 'mức stress cao',
  fatigue_warn: 'khá mệt',
  fatigue_bad: 'rất mệt',
  soreness_warn: 'báo đau nhức',
  load_spike: 'khối lượng tập tăng đột ngột',
  efficiency_falling: 'hiệu suất hiếu khí giảm',
  medicated_or_injured: 'đang dùng thuốc/chấn thương',
  profile_floor: 'đang trong giai đoạn thận trọng',
};

function buildTitle(dayType: DayType, totalMinutes: number): string {
  return dayType === 'REST' ? 'Ngày nghỉ' : `${TITLE_LABEL[dayType]} ${totalMinutes} phút`;
}

/**
 * DailyRecommendation.dayType has no CROSS_TRAIN bucket — RECOVERY is the
 * closest low-impact semantic (documented P1 simplification; CROSS_TRAIN only
 * appears for fast-pace non-obese users' Thursday swap — see maf-calculator-
 * schedule-builder.ts addPaceWarnings).
 */
function mapDayType(type: ScheduleItem['type']): DayType {
  if (type === 'RUN' || type === 'LONG_RUN' || type === 'WALK' || type === 'RECOVERY' || type === 'REST') {
    return type;
  }
  return 'RECOVERY';
}

function zoneOf(mafHr: number): MafZone | null {
  return mafHr > 0 ? { lower: mafHr - 10, upper: mafHr } : null;
}

function restRecommendation(
  tier: ReadinessTier,
  zone: MafZone | null,
  reasons: ReasonCode[],
  restCopy: string,
  citations: BookRef[],
): DailyRecommendation {
  return {
    dayType: 'REST',
    title: 'Ngày nghỉ',
    totalMinutes: 0,
    warmupMin: 0,
    cooldownMin: 0,
    mainMinutes: 0,
    hrZone: zone,
    tier,
    reasons,
    citations,
    restCopy,
  };
}

/** RED TEAM FIX #13: RED is REST or a gentle recovery WALK only — NEVER a run. */
function buildRed(zone: MafZone | null, readiness: ReadinessResult): DailyRecommendation {
  const badReason = readiness.reasons.find((r) => r.severity === 'bad');
  const restCopy = badReason
    ? `Hôm nay nên NGHỈ. ${badReason.text}`
    : 'Hôm nay nên NGHỈ để cơ thể hồi phục tốt hơn (Chương 7).';
  return restRecommendation('RED', zone, readiness.reasons, restCopy, ['CH7']);
}

function buildAmber(item: ScheduleItem, zone: MafZone | null, readiness: ReadinessResult): DailyRecommendation {
  if (item.type === 'REST') {
    return restRecommendation('AMBER', zone, readiness.reasons, REST_MINIMAL_COPY, ['CH7']);
  }

  const reducedTotal = roundToNearest5(item.duration * AMBER_REDUCTION_FACTOR);
  const breakdown = computeDurationBreakdown(reducedTotal);
  const hasSoreness = readiness.reasons.some((r) => r.code === 'soreness_warn');
  let dayType = mapDayType(item.type);
  const swapped = hasSoreness && dayType !== 'WALK';
  if (swapped) dayType = 'WALK';

  const shortPhrases = readiness.reasons.map((r) => REASON_SHORT_VN[r.code]).filter((p): p is string => Boolean(p));
  const reasonText = shortPhrases.length > 0 ? shortPhrases.join(' & ') : 'tín hiệu hồi phục thấp';
  const adjustmentNote =
    `Đã giảm còn ${breakdown.totalMinutes} phút${swapped ? ' và chuyển sang đi bộ' : ''} vì bạn ${reasonText}.`;

  return {
    dayType,
    title: buildTitle(dayType, breakdown.totalMinutes),
    ...breakdown,
    hrZone: zone,
    tier: 'AMBER',
    reasons: readiness.reasons,
    citations: ['CH5', 'CH6', 'CH7'],
    adjustmentNote,
  };
}

function buildGreen(item: ScheduleItem, zone: MafZone | null, readiness: ReadinessResult): DailyRecommendation {
  if (item.type === 'REST') {
    return restRecommendation('GREEN', zone, readiness.reasons, REST_MINIMAL_COPY, ['CH7']);
  }
  const breakdown = computeDurationBreakdown(item.duration);
  const dayType = mapDayType(item.type);
  return {
    dayType,
    title: buildTitle(dayType, breakdown.totalMinutes),
    ...breakdown,
    hrZone: zone,
    tier: 'GREEN',
    reasons: readiness.reasons,
    citations: ['CH5', 'CH6'],
  };
}

export function buildDailyRecommendation(input: RecommendationInput): DailyRecommendation {
  const { adjustedScheduleItem, mafHr, readiness, profile } = input;

  // RED TEAM FIX #6 — child short-circuit: mirrors buildChildResult(); no
  // structured workout, no HR zone, ever. Skips all tier/adjustment logic.
  if (profile.age < 16) {
    return {
      dayType: 'REST',
      title: 'Vui chơi tự nhiên',
      totalMinutes: 0,
      warmupMin: 0,
      cooldownMin: 0,
      mainMinutes: 0,
      hrZone: null,
      tier: 'GREEN',
      reasons: [],
      citations: [],
      restCopy: CHILD_COPY,
    };
  }

  const zone = zoneOf(mafHr);
  if (readiness.tier === 'RED') return buildRed(zone, readiness);
  if (readiness.tier === 'AMBER') return buildAmber(adjustedScheduleItem, zone, readiness);
  return buildGreen(adjustedScheduleItem, zone, readiness);
}
