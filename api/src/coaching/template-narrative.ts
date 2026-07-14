/**
 * Deterministic VN narrative — the PERMANENT fallback (AI-off, AI-error, budget breach,
 * lock contention). Composed entirely from the server-recomputed `DailyRecommendation`
 * (already-fixed VN copy + numbers) — no LLM call, no free text, always available.
 * Mirrors the VN copy tone already shown by src/utils/daily-recommendation-copy.ts /
 * today-card-workout-summary.tsx.
 */

import type { DailyRecommendation } from './recompute/recompute-types.js';

const DAY_TYPE_VERB: Record<
  Exclude<DailyRecommendation['dayType'], 'REST'>,
  string
> = {
  RUN: 'chạy nhẹ nhàng',
  LONG_RUN: 'chạy dài',
  WALK: 'đi bộ',
  RECOVERY: 'vận động hồi phục nhẹ',
};

export function buildTemplateNarrative(rec: DailyRecommendation): string {
  if (rec.dayType === 'REST') {
    return (
      rec.restCopy ??
      'Hôm nay nên nghỉ ngơi để cơ thể hồi phục tốt hơn (Chương 7).'
    );
  }

  const verb = DAY_TYPE_VERB[rec.dayType];
  const zoneText = rec.hrZone
    ? ` trong vùng nhịp tim MAF ${rec.hrZone.lower}–${rec.hrZone.upper} bpm`
    : '';
  let sentence = `Hôm nay là ngày phù hợp để ${verb} ${rec.totalMinutes} phút${zoneText}.`;

  if (rec.allEasy) {
    sentence += ' Giữ nhịp độ nhẹ nhàng, thoải mái suốt buổi tập.';
  } else {
    sentence += ` Khởi động ${rec.warmupMin} phút, giữ nhịp thở thoải mái trong ${rec.mainMinutes} phút phần chính, rồi thả lỏng ${rec.cooldownMin} phút.`;
  }

  if (rec.adjustmentNote) {
    sentence += ` ${rec.adjustmentNote}`;
  }

  sentence += ' Cứ chậm mà chắc!';
  return sentence;
}
