/**
 * SOURCE OF TRUTH: src/utils/daily-readiness-signals.ts — server-local port (DRY debt,
 * reconcile if logic changes).
 *
 * Deliberate scope reduction vs the frontend file: `trendSignal` (aerobic-efficiency
 * drift) is OMITTED — it needs `mafTrendSeries` (src/utils/journal-analytics.ts), which
 * walks weeks of Strava activity-detail splits and is well outside the "readiness tier +
 * daily recommendation from profile + activities + checkin" recompute scope authorized
 * for this phase. Omitting a warn-only signal only makes the composed tier MORE lenient,
 * never less safe (see daily-readiness-score.ts composition). Similarly, Garmin daily
 * summaries are not recomputed server-side here (bonus-only signals; every signal below
 * already degrades gracefully to `[]` when its data is absent).
 */

import type {
  ReasonCode,
  RecomputeActivity,
  RecomputeCheckin,
} from './recompute-types.js';

const RHR_BASELINE_MIN_DAYS = 7;
const RHR_WARN_DELTA_BPM = 5;
const RHR_BAD_DELTA_BPM = 7;
const SLEEP_QUALITY_WARN_MAX = 2; // check-in scale 1-5, <=2 = warn
const FATIGUE_WARN_MIN = 4; // check-in scale 1-5
const FATIGUE_BAD_MIN = 5;
const LOAD_SPIKE_RATIO = 1.5;
const LOAD_SPIKE_MIN_KM_DELTA = 5;

export interface SignalContext {
  recentActivities: RecomputeActivity[];
  checkin: RecomputeCheckin | null;
  today: Date; // server ICT-derived local midnight
}

/**
 * RHR baseline signal — needs check-in-reported resting HR history to establish a
 * baseline. The frontend also blends in Garmin daily-summary history (out of scope here,
 * see file header); with check-in-only history this signal is realistically rare to fire
 * (needs >=7 days of check-ins with restingHr filled) — degrades gracefully to `[]`
 * otherwise, same contract as the frontend.
 */
export function rhrSignal(
  ctx: SignalContext,
  rhrHistory: number[],
): ReasonCode[] {
  if (rhrHistory.length < RHR_BASELINE_MIN_DAYS) return [];
  const baseline =
    rhrHistory.reduce((sum, n) => sum + n, 0) / rhrHistory.length;
  const todayRhr = ctx.checkin?.restingHr ?? null;
  if (todayRhr == null) return [];

  const delta = Math.round(todayRhr - baseline);
  if (delta >= RHR_BAD_DELTA_BPM) {
    return [
      {
        code: 'rhr_bad',
        severity: 'bad',
        bookRef: 'CH7',
        text: `Nhịp tim nghỉ tăng +${delta} bpm — dấu hiệu cơ thể cần hồi phục (Chương 7).`,
      },
    ];
  }
  if (delta >= RHR_WARN_DELTA_BPM) {
    return [
      {
        code: 'rhr_warn',
        severity: 'warn',
        bookRef: 'CH7',
        text: `Nhịp tim nghỉ tăng +${delta} bpm so với trung bình gần đây — theo dõi thêm.`,
      },
    ];
  }
  return [];
}

export function sleepSignal(ctx: SignalContext): ReasonCode[] {
  if (
    ctx.checkin?.sleepQuality != null &&
    ctx.checkin.sleepQuality <= SLEEP_QUALITY_WARN_MAX
  ) {
    return [
      {
        code: 'sleep_warn',
        severity: 'warn',
        bookRef: 'CH7',
        text: 'Chất lượng giấc ngủ thấp — cơ thể cần thêm thời gian hồi phục.',
      },
    ];
  }
  return [];
}

export function fatigueSorenessSignal(ctx: SignalContext): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  const c = ctx.checkin;
  if (c?.fatigue != null) {
    if (c.fatigue >= FATIGUE_BAD_MIN) {
      reasons.push({
        code: 'fatigue_bad',
        severity: 'bad',
        bookRef: 'CH7',
        text: 'Mức độ mệt rất cao — cơ thể cần nghỉ ngơi.',
      });
    } else if (c.fatigue >= FATIGUE_WARN_MIN) {
      reasons.push({
        code: 'fatigue_warn',
        severity: 'warn',
        bookRef: 'CH7',
        text: 'Mức độ mệt khá cao — nên tập nhẹ hơn hôm nay.',
      });
    }
  }
  if (
    c?.soreness &&
    c.soreness.trim() !== '' &&
    c.soreness.trim().toLowerCase() !== 'none'
  ) {
    reasons.push({
      code: 'soreness_warn',
      severity: 'warn',
      bookRef: 'CH7',
      text: `Bạn báo đau nhức (${c.soreness.trim()}) — chuyển sang vận động nhẹ nhàng hơn.`,
    });
  }
  return reasons;
}

/** 7-day load vs the PRIOR 7-day window; only fires with an established (>0) baseline. */
export function loadSignal(ctx: SignalContext): ReasonCode[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayMs = ctx.today.getTime();
  const kmInWindow = (fromMs: number, toMs: number): number =>
    ctx.recentActivities
      .filter((a) => {
        const t = a.startDate.getTime();
        return t >= fromMs && t < toMs;
      })
      .reduce((sum, a) => sum + a.distanceMeters / 1000, 0);

  const last7Km = kmInWindow(todayMs - 6 * DAY_MS, todayMs + DAY_MS);
  const priorKm = kmInWindow(todayMs - 13 * DAY_MS, todayMs - 6 * DAY_MS);

  if (priorKm <= 0) return [];
  if (
    last7Km > priorKm * LOAD_SPIKE_RATIO &&
    last7Km - priorKm >= LOAD_SPIKE_MIN_KM_DELTA
  ) {
    return [
      {
        code: 'load_spike',
        severity: 'warn',
        bookRef: 'CH7',
        text: 'Khối lượng chạy 7 ngày qua tăng đột ngột so với tuần trước — nguy cơ quá tải.',
      },
    ];
  }
  return [];
}
