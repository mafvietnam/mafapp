/**
 * Bài bổ trợ (supplementary strength/stability) cards — Maffetone frames this as
 * slow/heavy LOW-REP neural strength + bodyweight + stability, explicitly NOT
 * hypertrophy circuits (research §1). Only offered on GREEN-tier active-training
 * days (select-guidance-cards.ts) — AMBER stays recovery-leaning, no strength ask.
 *
 * Simplification (YAGNI): the phase-02 spec mentions a "72h rule" (non-consecutive
 * strength days), but `selectGuidanceCards` only receives today's `DailyRecommendation`
 * + profile flags — no strength-session history is available as input yet. Rather
 * than fabricate untracked state, the selector shows at most ONE card (first array
 * match) as a standing suggestion; day-to-day spacing enforcement is a follow-up if
 * a future phase adds strength-session tracking.
 */

import type { GuidanceCard } from './guidance-types';

const ACTIVE_DAY_TYPES: GuidanceCard['appliesTo']['dayTypes'] = ['RUN', 'LONG_RUN', 'WALK', 'RECOVERY'];

export const SUPPLEMENTARY_CARDS: GuidanceCard[] = [
  {
    id: 'strength_bodyweight',
    category: 'supplementary',
    title: 'Chống đẩy & kéo xà — bài bổ trợ nhẹ nhàng',
    body: 'Chống đẩy, kéo xà với tải trọng nhẹ, kiểm soát tốt là bài bổ trợ tương thích với nền hiếu khí — không cần phòng gym, tập vài hiệp chất lượng thay vì nhiều hiệp mệt mỏi.',
    citation: { label: 'Method — Dr. Phil Maffetone', url: 'https://philmaffetone.com/method/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'stability_training',
    category: 'supplementary',
    title: 'Bài tập thăng bằng & ổn định',
    body: 'Bài tập thăng bằng, ổn định khớp là phần bổ trợ tốt cho nền hiếu khí — tăng cường cảm nhận cơ thể (proprioception) và giảm nguy cơ chấn thương khi chạy.',
    citation: { label: 'Method — Dr. Phil Maffetone', url: 'https://philmaffetone.com/method/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'strength_deadlift',
    category: 'supplementary',
    title: 'Deadlift — bài tập sức mạnh nền tảng',
    body: 'Deadlift là một trong những bài tập toàn thân hiệu quả nhất: tải ~80% 1RM, 1–6 lần lặp, nghỉ tối thiểu 3 phút giữa các hiệp — tập trung vào sức mạnh thần kinh-cơ chứ không phải phì đại cơ. Cần học đúng kỹ thuật hoặc nhờ huấn luyện viên hướng dẫn nếu chưa quen.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'strength_nutrition',
    category: 'supplementary',
    title: 'Dinh dưỡng quanh buổi tập sức mạnh',
    body: 'Ăn thực phẩm thật quanh buổi tập tạ: protein chất lượng, chất béo lành mạnh, tinh bột tự nhiên nếu cơ thể dung nạp tốt — nền tảng dinh dưỡng cho sức mạnh bền vững.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
  {
    id: 'avoid_junk_food_strength_training',
    category: 'supplementary',
    title: 'Tránh đồ ăn vặt quanh buổi tập tạ',
    body: 'Đồ ăn vặt/chế biến sẵn quanh buổi tập sức mạnh sẽ làm giảm hiệu quả tập luyện — ưu tiên thực phẩm thật để cơ thể phục hồi và thích nghi tốt hơn.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES, tiers: ['GREEN'] },
  },
];
