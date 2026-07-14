/**
 * Post-run guidance cards. `post_cool_down` is well-sourced (philmaffetone.com).
 * `post_meal_guidance` / `post_hydration` are RESEARCH GAPS (researcher-01 report,
 * Unresolved Questions #1) — PDF extraction was attempted (ai-multimodal/Gemini)
 * but blocked: no GEMINI_API_KEY reachable without an interactive privacy-approval
 * prompt this autonomous run couldn't issue (no AskUserQuestion tool available to
 * this subagent). Per phase-02 spec §4 fallback: bodies stay generic/non-specific
 * (restate an ALREADY-sourced principle only) and are marked `// REVIEW:` TODO —
 * no invented timing windows or macro ratios. Flagged for human review + a future
 * PDF pass.
 */

import type { GuidanceCard } from './guidance-types';

const ACTIVE_DAY_TYPES: GuidanceCard['appliesTo']['dayTypes'] = ['RUN', 'LONG_RUN', 'WALK', 'RECOVERY'];

export const POST_RUN_CARDS: GuidanceCard[] = [
  {
    id: 'post_cool_down',
    category: 'post-run',
    title: 'Thả lỏng 12+ phút sau khi chạy',
    body: 'Giảm dần cường độ về mức nghỉ trong ít nhất 12 phút sau buổi chạy thay vì dừng đột ngột. Đây là bước bắt đầu quá trình hồi phục — không cần giãn cơ tĩnh, chỉ cần đi bộ chậm dần.',
    citation: { label: 'Aerobic Training Guidelines', bookRef: 'CH5', url: 'https://philmaffetone.com/aerobic-training-guidelines/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    // REVIEW: pending owner sign-off / PDF confirmation — researcher-01 report flags
    // this as a gap: "Post-run meal timing (e.g. eat within 30 min?) not found in
    // published web sources; may be in The Big Book...". Body intentionally restates
    // only the ALREADY-sourced real-food principle (see rest.ts eat_real_foods) and
    // explicitly avoids inventing a timing window or macro ratio.
    id: 'post_meal_guidance',
    category: 'post-run',
    title: 'Ăn gì sau khi chạy (TODO: cần xác nhận thêm)',
    body: 'Ưu tiên thực phẩm thật — protein chất lượng, chất béo lành mạnh, rau củ — sau buổi chạy. Thời điểm ăn cụ thể và tỉ lệ dinh dưỡng chính xác chưa được xác nhận từ nguồn Maffetone đã khảo sát; hãy ăn theo cảm giác đói, tránh đồ ăn chế biến sẵn.',
    citation: {
      label: 'Cần xác nhận thêm (TODO — chưa có nguồn chính thức cho thời điểm ăn sau chạy)',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    // REVIEW: pending owner sign-off / PDF confirmation — researcher-01 report:
    // "proper hydration needed" is sourced pre-workout, but no specific POST-run
    // protocol (volume, electrolytes, timing) was found in web sources.
    id: 'post_hydration',
    category: 'post-run',
    title: 'Bổ sung nước sau khi chạy (TODO: cần xác nhận thêm)',
    body: 'Bổ sung nước sau khi chạy, đặc biệt nếu ra nhiều mồ hôi. Lượng nước và điện giải cụ thể cần bổ sung chưa được Maffetone công bố chi tiết trong nguồn đã khảo sát; ưu tiên uống theo cảm giác khát và quan sát màu nước tiểu.',
    citation: {
      label: 'Cần xác nhận thêm (TODO — chưa có nguồn chính thức cho protocol bù nước sau chạy)',
      url: 'https://philmaffetone.com/aerobic-training-guidelines/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
];
