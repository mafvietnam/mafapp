/**
 * Static VN copy for daily-recommendation-engine.ts — separated from the
 * decision logic (mirrors src/content/safety.ts's data/logic split) and keeps
 * the engine module under the 200-LOC modularization guideline.
 */
import type { DailyRecommendation } from '../types';

type DayType = DailyRecommendation['dayType'];

export const CHILD_COPY =
  'Trẻ dưới 16 tuổi: hãy VUI CHƠI tự nhiên (chạy nhảy, bơi, đạp xe) — không theo lịch tập có cấu trúc.';

export const REST_MINIMAL_COPY =
  'Ngày nghỉ giúp cơ thể tái tạo mạnh hơn — "Tập luyện = Vận động + Nghỉ ngơi" (Chương 7).';

export const TITLE_LABEL: Record<Exclude<DayType, 'REST'>, string> = {
  RUN: 'Chạy nhẹ nhàng',
  LONG_RUN: 'Chạy dài',
  WALK: 'Đi bộ',
  RECOVERY: 'Hồi phục nhẹ',
};

/** Short VN phrases for the AMBER adjustmentNote — mirrors "vì bạn báo đau bắp chân & ngủ chưa đủ." sample. */
export const REASON_SHORT_VN: Record<string, string> = {
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
  // Phase 3 — health-condition-rules.ts reason codes (merged into readiness.reasons upstream
  // by use-today-recommendation.ts). health_clearance_gate is intentionally excluded — it's a
  // standalone gate banner, not a duration-reduction reason for this sentence.
  health_cardiac_caution: 'có tình trạng tim mạch/huyết áp cần lưu ý',
  health_joint_walk_first: 'cần bảo vệ khớp',
};

/** JOINT_ISSUES adjustment note — VN copy sample verbatim from the phase-03 spec. */
export const JOINT_ADJUSTMENT_NOTE =
  'Ưu tiên đi bộ trước, khởi động & thả lỏng dài hơn để bảo vệ khớp. (Chương 29)';

/** JOINT_ISSUES extended warm/cool suffix appended to the AMBER adjustmentNote sentence. */
export const JOINT_EXTENDED_WARM_COOL_SUFFIX =
  ' Khởi động & thả lỏng kéo dài hơn để bảo vệ khớp (Chương 29).';
