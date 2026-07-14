/**
 * SOURCE OF TRUTH: src/utils/daily-recommendation-copy.ts — server-local port (DRY debt,
 * reconcile if logic changes). Verbatim port of the static VN copy used by
 * daily-recommendation-engine.ts.
 */
import type { DailyRecommendation } from './recompute-types.js';

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

/** Short VN phrases for the AMBER adjustmentNote. */
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
  health_cardiac_caution: 'có tình trạng tim mạch/huyết áp cần lưu ý',
  health_joint_walk_first: 'cần bảo vệ khớp',
};

export const JOINT_ADJUSTMENT_NOTE =
  'Ưu tiên đi bộ trước, khởi động & thả lỏng dài hơn để bảo vệ khớp. (Chương 29)';

export const JOINT_EXTENDED_WARM_COOL_SUFFIX =
  ' Khởi động & thả lỏng kéo dài hơn để bảo vệ khớp (Chương 29).';
