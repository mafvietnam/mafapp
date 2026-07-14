/**
 * Individual readiness signal calculators, split out of daily-readiness-score.ts
 * to keep each file <200 LOC (CLAUDE.md modularization rule). Every signal
 * degrades gracefully: missing/insufficient data returns [] (no reason, no
 * penalty) — see daily-readiness-score.ts for the tier composition + the
 * graceful-degradation contract (RED TEAM FIX #5).
 *
 * All numeric thresholds are TUNABLE PLACEHOLDERS pending domain sign-off
 * (see phase-01 plan "open-Q" notes) — kept as named constants for easy tuning.
 */

import type { StravaActivity } from '../services/strava-service';
import type { GarminDailySummary } from '../services/garmin-service';
import type { DailyCheckin, ReasonCode } from '../types';
import { mafTrendSeries } from './journal-analytics';
import { isSameLocalDate } from './local-today';

const RHR_BASELINE_MIN_DAYS = 7; // RED TEAM FIX #5 — below this, the RHR signal is IGNORED entirely
const RHR_BASELINE_MAX_DAYS = 14;
const RHR_WARN_DELTA_BPM = 5;
const RHR_BAD_DELTA_BPM = 7;
const SLEEP_QUALITY_WARN_MAX = 2; // check-in scale 1-5, <=2 = warn
const SLEEP_DURATION_WARN_MIN_MINUTES = 6 * 60;
const STRESS_WARN_MIN = 60; // Garmin stressAvg 0-100 scale, bonus-only
const FATIGUE_WARN_MIN = 4; // check-in scale 1-5
const FATIGUE_BAD_MIN = 5;
const LOAD_SPIKE_RATIO = 1.5;
const LOAD_SPIKE_MIN_KM_DELTA = 5; // absolute floor so tiny bases don't trip the ratio check
const TREND_MIN_WEEKS = 3;

export interface SignalContext {
  recentActivities: StravaActivity[];
  dailySummaries: GarminDailySummary[];
  checkin: DailyCheckin | null;
  today: Date; // local midnight
  mafHr?: number;
}

const mean = (nums: number[]): number => nums.reduce((sum, n) => sum + n, 0) / nums.length;

function todaySummary(ctx: SignalContext): GarminDailySummary | undefined {
  return ctx.dailySummaries.find((s) => isSameLocalDate(new Date(s.date), ctx.today));
}

/**
 * RED TEAM FIX #5: baseline needs n>=7 available days (excluding today) or RHR is IGNORED.
 * Check-in restingHr is PRIMARY for today's value; Garmin is bonus-only for TODAY's reading —
 * but the n>=7 BASELINE itself only ever comes from `dailySummaries` (Garmin), so whenever a
 * reason fires here the baseline it's compared against is Garmin-sourced. This is also the
 * built-in hide-when-absent guard: FEATURE_GARMIN off (prod default) => dailySummaries stays
 * empty => history.length < 7 forever => this signal never fires and RHR reasons never render.
 * Both fired-reason texts below therefore attribute the data source explicitly ("thiết bị
 * Garmin") so the UI never implies a phone/manual reading drove the readiness tier.
 */
export function rhrSignal(ctx: SignalContext): ReasonCode[] {
  const history = ctx.dailySummaries
    .filter((s) => s.restingHeartRate != null && !isSameLocalDate(new Date(s.date), ctx.today))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, RHR_BASELINE_MAX_DAYS);
  if (history.length < RHR_BASELINE_MIN_DAYS) return [];

  const baseline = mean(history.map((s) => s.restingHeartRate as number));
  const todayRhr = ctx.checkin?.restingHr ?? todaySummary(ctx)?.restingHeartRate ?? null;
  if (todayRhr == null) return [];

  const delta = Math.round(todayRhr - baseline);
  if (delta >= RHR_BAD_DELTA_BPM) {
    return [{ code: 'rhr_bad', severity: 'bad', bookRef: 'CH7', text: `Nhịp tim nghỉ tăng +${delta} bpm — dấu hiệu cơ thể cần hồi phục (Chương 7). (dữ liệu nhịp tim nghỉ từ thiết bị Garmin)` }];
  }
  if (delta >= RHR_WARN_DELTA_BPM) {
    return [{ code: 'rhr_warn', severity: 'warn', bookRef: 'CH7', text: `Nhịp tim nghỉ tăng +${delta} bpm so với trung bình 14 ngày — theo dõi thêm. (dữ liệu nhịp tim nghỉ từ thiết bị Garmin)` }];
  }
  return [];
}

/** Check-in sleepQuality is PRIMARY; Garmin sleepDuration is bonus-only fallback. */
export function sleepSignal(ctx: SignalContext): ReasonCode[] {
  if (ctx.checkin?.sleepQuality != null) {
    if (ctx.checkin.sleepQuality <= SLEEP_QUALITY_WARN_MAX) {
      return [{ code: 'sleep_warn', severity: 'warn', bookRef: 'CH7', text: 'Chất lượng giấc ngủ thấp — cơ thể cần thêm thời gian hồi phục.' }];
    }
    return [];
  }
  const summary = todaySummary(ctx);
  if (summary?.sleepDuration != null && summary.sleepDuration < SLEEP_DURATION_WARN_MIN_MINUTES) {
    return [{ code: 'sleep_warn', severity: 'warn', bookRef: 'CH7', text: 'Ngủ chưa đủ 6 tiếng đêm qua — cơ thể cần thêm thời gian hồi phục.' }];
  }
  return [];
}

/** BONUS-ONLY: Garmin stressAvg is zero data whenever FEATURE_GARMIN is off (prod default). */
export function stressSignal(ctx: SignalContext): ReasonCode[] {
  const summary = todaySummary(ctx);
  if (summary?.stressAvg != null && summary.stressAvg >= STRESS_WARN_MIN) {
    return [{ code: 'stress_warn', severity: 'warn', bookRef: 'CH7', text: 'Mức stress (Garmin) đang cao — cân nhắc giảm cường độ hôm nay.' }];
  }
  return [];
}

/** Check-in only — fatigue 1-5 scale, soreness free-tag (feeds RUN->WALK swap via 'soreness_warn' code). */
export function fatigueSorenessSignal(ctx: SignalContext): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  const c = ctx.checkin;
  if (c?.fatigue != null) {
    if (c.fatigue >= FATIGUE_BAD_MIN) {
      reasons.push({ code: 'fatigue_bad', severity: 'bad', bookRef: 'CH7', text: 'Mức độ mệt rất cao — cơ thể cần nghỉ ngơi.' });
    } else if (c.fatigue >= FATIGUE_WARN_MIN) {
      reasons.push({ code: 'fatigue_warn', severity: 'warn', bookRef: 'CH7', text: 'Mức độ mệt khá cao — nên tập nhẹ hơn hôm nay.' });
    }
  }
  if (c?.soreness && c.soreness.trim() !== '' && c.soreness.trim().toLowerCase() !== 'none') {
    reasons.push({
      code: 'soreness_warn',
      severity: 'warn',
      bookRef: 'CH7',
      text: `Bạn báo đau nhức (${c.soreness.trim()}) — chuyển sang vận động nhẹ nhàng hơn.`,
    });
  }
  return reasons;
}

/** 7-day load vs the PRIOR 7-day window; only fires with an established (>0) baseline (no fabricated spike from zero history). */
export function loadSignal(ctx: SignalContext): ReasonCode[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayMs = ctx.today.getTime();
  const kmInWindow = (fromMs: number, toMs: number): number =>
    ctx.recentActivities
      .filter((a) => {
        const t = new Date(a.startDate).getTime();
        return t >= fromMs && t < toMs;
      })
      .reduce((sum, a) => sum + (a.distance || 0) / 1000, 0);

  const last7Km = kmInWindow(todayMs - 6 * DAY_MS, todayMs + DAY_MS);
  const priorKm = kmInWindow(todayMs - 13 * DAY_MS, todayMs - 6 * DAY_MS);

  if (priorKm <= 0) return [];
  if (last7Km > priorKm * LOAD_SPIKE_RATIO && last7Km - priorKm >= LOAD_SPIKE_MIN_KM_DELTA) {
    return [{ code: 'load_spike', severity: 'warn', bookRef: 'CH7', text: 'Khối lượng chạy 7 ngày qua tăng đột ngột so với tuần trước — nguy cơ quá tải.' }];
  }
  return [];
}

/**
 * Cardiac-drift PROXY (aerobic-efficiency trend) — optional, needs `mafHr` (not
 * part of ReadinessInput's documented minimal shape) and >=3 weeks of data.
 * True per-activity drift needs StravaActivityDetail hydration — OUT OF SCOPE P1.
 */
export function trendSignal(ctx: SignalContext): ReasonCode[] {
  if (!ctx.mafHr || ctx.mafHr <= 0) return [];
  const trend = mafTrendSeries(ctx.recentActivities, ctx.mafHr); // oldest-first
  const effs = trend.map((t) => t.efficiency).filter((e): e is number => e != null);
  if (effs.length < TREND_MIN_WEEKS) return [];
  const lastThree = effs.slice(-TREND_MIN_WEEKS);
  const falling = lastThree[2] < lastThree[1] && lastThree[1] < lastThree[0];
  if (falling) {
    return [{ code: 'efficiency_falling', severity: 'warn', bookRef: 'CH4', text: 'Hiệu suất hiếu khí giảm dần qua vài tuần gần đây — có thể là dấu hiệu quá tải hoặc thiếu hồi phục.' }];
  }
  return [];
}
