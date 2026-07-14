/**
 * Pre-run guidance cards. Sourced from research/researcher-01-maffetone-content-report.md
 * §1-3 (all high/medium confidence, philmaffetone.com articles). `avoid_static_stretching`
 * covers BOTH pre- and post-run (contrarian vs mainstream VN advice — flagged for owner
 * review per phase-02 spec's Content Review Gate).
 */

import type { GuidanceCard } from './guidance-types';

const ACTIVE_DAY_TYPES: GuidanceCard['appliesTo']['dayTypes'] = ['RUN', 'LONG_RUN', 'WALK', 'RECOVERY'];

export const PRE_RUN_CARDS: GuidanceCard[] = [
  {
    id: 'pre_warm_up_aerobic',
    category: 'pre-run',
    title: 'Khởi động 12–15 phút trước khi chạy',
    body: 'Khởi động bằng vận động hiếu khí nhẹ (đi bộ nhanh hoặc chạy rất chậm), để nhịp tim tăng dần trước khi vào bài chính. Cách này giúp lưu thông máu, cải thiện hô hấp và tăng độ dẻo dai an toàn hơn giãn cơ tĩnh.',
    citation: { label: 'Aerobic Training Guidelines', url: 'https://philmaffetone.com/aerobic-training-guidelines/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    // REVIEW: contrarian vs mainstream VN running advice — flag for owner sign-off
    // (phase-02 Content Review Gate). Covers pre- AND post-run per spec §"Anti-static-
    // stretching guidance surfaced as pre/post-run 'what to do instead' card".
    id: 'avoid_static_stretching',
    category: 'pre-run',
    title: 'Đừng giãn cơ tĩnh — hãy làm điều này thay thế',
    body: 'Giãn cơ tĩnh trước và sau khi chạy KHÔNG giảm nguy cơ chấn thương, có thể làm giảm hiệu suất và thậm chí gây hại. Thay vào đó: khởi động hiếu khí nhẹ trước khi chạy, thả lỏng giảm dần cường độ sau khi chạy, và tăng cường sức mạnh để cải thiện độ dẻo dai một cách bền vững.',
    citation: {
      label: 'The Growing Case Against Stretching',
      url: 'https://philmaffetone.com/the-growing-case-against-stretching/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    id: 'pre_meal_timing',
    category: 'pre-run',
    title: 'Ăn gì trước khi chạy',
    body: 'Ưu tiên bữa ăn nhiều chất béo, ít tinh bột trước khi chạy để cơ thể duy trì chế độ đốt mỡ. Tránh tinh bột tinh chế và đường ngay trước buổi chạy — chúng tắt cơ chế đốt mỡ tạm thời.',
    citation: {
      label: 'Five Ways to Run Faster on Fat',
      url: 'https://philmaffetone.com/five-ways-to-run-faster-on-fat/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    id: 'pre_caffeine',
    category: 'pre-run',
    title: 'Cà phê trước khi chạy',
    body: 'Cà phê đen (hoặc kèm chất béo lành mạnh, không đường) trước khi chạy có thể hỗ trợ đốt mỡ. Tránh cho đường vào cà phê và tránh dùng quá nhiều caffeine — có thể gây kích thích quá mức và phản tác dụng.',
    citation: { label: 'Coffee and Fat-Burning', url: 'https://philmaffetone.com/coffee-and-fat-burning/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    id: 'pre_hydration_check',
    category: 'pre-run',
    title: 'Kiểm tra nước trước khi chạy',
    body: 'Đảm bảo cơ thể đủ nước trước khi bắt đầu buổi chạy — mất nước từ trước sẽ ảnh hưởng đến hiệu suất và độ chính xác của nhịp tim trong suốt buổi tập.',
    citation: { label: 'Aerobic Training Guidelines', url: 'https://philmaffetone.com/aerobic-training-guidelines/' },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
  {
    id: 'avoid_pre_run_refined_carbs',
    category: 'pre-run',
    title: 'Tránh tinh bột tinh chế & đường trước khi chạy',
    body: 'Ăn tinh bột tinh chế hoặc đường ngay trước buổi chạy sẽ tắt cơ chế đốt mỡ, khiến cơ thể phụ thuộc vào đường thay vì mỡ để tạo năng lượng — đi ngược lại mục tiêu xây nền hiếu khí.',
    citation: {
      label: 'Five Ways to Run Faster on Fat',
      url: 'https://philmaffetone.com/five-ways-to-run-faster-on-fat/',
    },
    appliesTo: { dayTypes: ACTIVE_DAY_TYPES },
  },
];
