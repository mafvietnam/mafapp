/**
 * SOURCE OF TRUTH: src/utils/daily-recommendation-engine.ts (small shared helpers factored
 * out) — server-local port (DRY debt, reconcile if logic changes). Split out of
 * daily-recommendation-engine.ts / daily-recommendation-tier-builders.ts to keep both
 * under the 200-LOC modularization guideline and avoid a circular import between them.
 */
import type {
  DailyRecommendation,
  MafZone,
  ReadinessTier,
  ReasonCode,
  BookRef,
  ScheduleItem,
} from './recompute-types.js';
import { TITLE_LABEL } from './daily-recommendation-copy.js';

type DayType = DailyRecommendation['dayType'];

export function buildTitle(dayType: DayType, totalMinutes: number): string {
  return dayType === 'REST'
    ? 'Ngày nghỉ'
    : `${TITLE_LABEL[dayType]} ${totalMinutes} phút`;
}

export function mapDayType(type: ScheduleItem['type']): DayType {
  if (
    type === 'RUN' ||
    type === 'LONG_RUN' ||
    type === 'WALK' ||
    type === 'RECOVERY' ||
    type === 'REST'
  ) {
    return type;
  }
  return 'RECOVERY';
}

export function zoneOf(mafHr: number): MafZone | null {
  return mafHr > 0 ? { lower: mafHr - 10, upper: mafHr } : null;
}

export function restRecommendation(
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
