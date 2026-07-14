/**
 * Post-run guidance cards. `post_cool_down` is well-sourced (philmaffetone.com).
 * `post_meal_guidance` / `post_hydration` WERE research gaps (researcher-01 report,
 * Unresolved Questions #1 — web sources didn't cover post-run timing/hydration
 * protocol). Filled 260714 by extracting the actual PDF (docs/the-big-book-of-
 * endurance-training-and-racing.pdf) via local pypdf (free, no paid API) — see
 * CH18 "Eating and Drinking Your Way to Better Endurance" ("After Competition",
 * p.457) for meal timing, CH17 "Water and Electrolytes" ("Rehydrating", p.433-434)
 * for hydration. Both chapters fall outside the CH3-CH9 `BookRef` union (see
 * maf-coaching-insights.ts) so citations name the chapter in `label` text instead
 * of widening that shared type for two one-off references (YAGNI). Book caveat
 * carried into the copy: Maffetone's explicit protocol numbers (15-30min window,
 * carb+protein+fat) are written for LONG/hard sessions and competition recovery —
 * the book itself notes fat-adapted athletes on ordinary 2-3h aerobic sessions
 * typically need nothing but water, so the body text doesn't overclaim the
 * protocol onto every easy MAF run.
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
    id: 'post_meal_guidance',
    category: 'post-run',
    title: 'Ăn sau khi chạy: cửa sổ 15–30 phút cho buổi dài/nặng',
    body: 'Với buổi chạy dài hoặc nặng, ăn trong vòng 15–30 phút sau khi kết thúc — kết hợp cả tinh bột, protein và chất béo — giúp hồi phục glycogen và cơ tốt hơn. Với buổi chạy nhẹ trong vùng hiếu khí (dưới 2–3 giờ), Maffetone ghi nhận nhiều vận động viên đã thích nghi đốt mỡ không cần nạp gấp gì ngoài nước — cứ ăn bữa thật khi đói như bình thường. Sau cửa sổ 15–30 phút (buổi nặng), tiếp tục ăn uống bình thường và tránh rượu bia/caffeine vài giờ để không cản trở hồi phục.',
    citation: {
      label: 'The Big Book of Endurance Training and Racing — Chương 18 "Eating and Drinking Your Way to Better Endurance" (mục "After Competition")',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    id: 'post_hydration',
    category: 'post-run',
    title: 'Bù nước sau khi chạy: từng ít một, đều đặn',
    body: 'Sau buổi chạy dài hoặc nặng, uống khoảng 500ml nước mỗi 30 phút hiệu quả hơn uống dồn một lượng lớn ngay một lần — uống dồn dập dễ gây phản xạ lợi tiểu, khiến mất nước nhiều hơn. Tạo thói quen uống nước ngay trước và sau buổi tập. Theo dõi màu nước tiểu để đánh giá: vàng nhạt/trong là đủ nước, vàng đậm là dấu hiệu cần uống thêm (trừ nước tiểu đầu buổi sáng luôn đậm màu hơn bình thường). Buổi tập dài hoặc trời nóng có thể cần bổ sung thêm chút muối để giữ nước tốt hơn.',
    citation: {
      label: 'The Big Book of Endurance Training and Racing — Chương 17 "Water and Electrolytes" (mục "Rehydrating")',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
];
