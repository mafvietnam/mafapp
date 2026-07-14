/**
 * R.E.S.T (Recovery-Eat-Sleep-Time) card set — shown in full on REST days
 * (supersedes Phase 1's minimal `restCopy` line, see select-guidance-cards.ts).
 * Core equation per research §4: "Training = Workout + Rest" (CH7).
 */

import type { GuidanceCard } from './guidance-types';

const REST_ONLY: GuidanceCard['appliesTo']['dayTypes'] = ['REST'];

export const REST_CARDS: GuidanceCard[] = [
  // Recovery
  {
    id: 'rest_active_recovery',
    category: 'recovery',
    title: 'Hồi phục chủ động',
    body: 'Vận động nhẹ nhàng (đi bộ thư giãn, di chuyển nhẹ) với nhịp tim tăng rất ít vẫn giữ được sự năng động mà không gây mệt sâu — phù hợp cho ngày nghỉ.',
    citation: { label: 'Recovery: The Secret Weapon', bookRef: 'CH7', url: 'https://philmaffetone.com/recovery-the-secret-weapon/' },
    appliesTo: { dayTypes: REST_ONLY },
  },
  {
    id: 'rest_hard_run_recovery',
    category: 'recovery',
    title: 'Hồi phục sau buổi chạy nặng',
    body: 'Sau một buổi chạy nặng (vượt vùng MAF, tempo, hoặc chạy dài), cơ thể cần 24–48 giờ để hồi phục trước khi tập nặng trở lại. "Tập luyện = Vận động + Nghỉ ngơi".',
    citation: { label: 'Recovery: The Secret Weapon', bookRef: 'CH7', url: 'https://philmaffetone.com/recovery-the-secret-weapon/' },
    appliesTo: { dayTypes: REST_ONLY },
  },
  {
    id: 'rest_strength_recovery',
    category: 'recovery',
    title: 'Hồi phục sau buổi tập tạ',
    body: 'Sau buổi tập sức mạnh (tạ), cơ thể cần tối thiểu 72 giờ hồi phục trước khi tập tạ nhóm cơ đó trở lại — tránh tập tạ liên tục nhiều ngày.',
    citation: { label: 'Recovery: The Secret Weapon', bookRef: 'CH7', url: 'https://philmaffetone.com/recovery-the-secret-weapon/' },
    appliesTo: { dayTypes: REST_ONLY },
  },
  // Eat
  {
    id: 'eat_fat_adaptation',
    category: 'eat',
    title: 'Thích nghi đốt mỡ (3–6 tháng)',
    body: 'Thích nghi đốt mỡ cần 3–6 tháng tập luyện đều đặn trong vùng MAF kết hợp giảm tinh bột tinh chế — ngày nghỉ là thời điểm tốt để duy trì thói quen ăn uống hỗ trợ mục tiêu này.',
    citation: {
      label: 'Five Ways to Run Faster on Fat',
      url: 'https://philmaffetone.com/five-ways-to-run-faster-on-fat/',
    },
    appliesTo: { dayTypes: REST_ONLY },
  },
  {
    id: 'eat_real_foods',
    category: 'eat',
    title: 'Nguyên tắc thực phẩm thật',
    body: 'Ưu tiên thực phẩm thật: protein chất lượng, chất béo lành mạnh, tinh bột tự nhiên nếu cơ thể dung nạp tốt — loại bỏ đồ ăn chế biến sẵn và đồ ăn vặt.',
    citation: {
      label: 'Six Tips for Improving Strength',
      url: 'https://philmaffetone.com/six-tips-for-improving-strength/',
    },
    appliesTo: { dayTypes: REST_ONLY },
  },
  // Sleep
  {
    id: 'sleep_target',
    category: 'sleep',
    title: 'Ngủ đủ 7–9 tiếng',
    body: 'Ngủ 7–9 tiếng liền mạch mỗi đêm là phần cốt lõi của quá trình hồi phục. Giấc ngủ kém sẽ cản trở lợi ích hồi phục dù bạn nghỉ ngơi đủ ngày.',
    citation: { label: 'Recovery: The Secret Weapon', bookRef: 'CH7', url: 'https://philmaffetone.com/recovery-the-secret-weapon/' },
    appliesTo: { dayTypes: REST_ONLY },
  },
  // Time
  {
    id: 'time_detraining',
    category: 'time',
    title: 'Giai đoạn nghỉ có chủ đích',
    body: 'Những giai đoạn nghỉ tập có chủ đích (detraining) giúp cơ thể hồi phục sâu hơn. Thể lực mất tạm thời trong giai đoạn này sẽ nhanh chóng trở lại khi bạn tập luyện lành mạnh trở lại.',
    citation: { label: 'Recovery: The Secret Weapon', url: 'https://philmaffetone.com/recovery-the-secret-weapon/' },
    appliesTo: { dayTypes: REST_ONLY },
  },
];
