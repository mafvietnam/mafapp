/**
 * Readiness-education cards — explain the AMBER/RED signal driving today's plan
 * (research §4 overtraining warning signs + §6 RHR monitoring). RED TEAM FIX #13:
 * every body here phrases rest/gentle-movement, NEVER "chạy nhẹ" (light run) — the
 * Phase 1 engine already guarantees RED == REST/walk-only; this card must not
 * contradict that by suggesting a run.
 */

import type { GuidanceCard } from './guidance-types';

const CAUTION_TIERS: GuidanceCard['appliesTo']['tiers'] = ['AMBER', 'RED'];

export const READINESS_CARDS: GuidanceCard[] = [
  {
    id: 'readiness_rhr_baseline',
    category: 'readiness-edu',
    title: 'Vì sao cần đo nhịp tim nghỉ mỗi sáng',
    body: 'Đo nhịp tim nghỉ (RHR) mỗi sáng ngay khi thức dậy: nằm/ngồi yên khoảng 30 giây, dùng cùng thiết bị và tư thế mỗi lần. Đây là chỉ số sớm nhất cho biết cơ thể đã hồi phục hay còn đang chịu áp lực.',
    citation: { label: 'Resting Heart Rate', url: 'https://philmaffetone.com/resting-heart-rate/' },
    appliesTo: { tiers: CAUTION_TIERS },
  },
  {
    id: 'readiness_rhr_red',
    category: 'readiness-edu',
    title: 'Nhịp tim nghỉ tăng — dấu hiệu cần thận trọng',
    body: 'Nhịp tim nghỉ tăng 1–5 nhịp/phút so với ngày thường là tín hiệu cơ thể đang stress, chớm ốm hoặc chưa hồi phục đủ. Đây là lúc nên ưu tiên nghỉ ngơi thay vì cố gắng hoàn thành lịch tập như bình thường.',
    citation: { label: 'Resting Heart Rate', url: 'https://philmaffetone.com/resting-heart-rate/' },
    appliesTo: { tiers: CAUTION_TIERS },
  },
  {
    id: 'readiness_sleep_quality',
    category: 'readiness-edu',
    title: 'Giấc ngủ kém ảnh hưởng đến hồi phục',
    body: 'Giấc ngủ kém hoặc chưa đủ làm giảm khả năng hồi phục của cơ thể. Nếu bạn ngủ không ngon liên tục, hãy giảm cường độ tập và ưu tiên cải thiện giấc ngủ trước khi tăng khối lượng trở lại.',
    citation: { label: 'Recovery: The Secret Weapon', bookRef: 'CH7', url: 'https://philmaffetone.com/recovery-the-secret-weapon/' },
    appliesTo: { tiers: CAUTION_TIERS },
  },
  {
    id: 'readiness_mood_fatigue',
    category: 'readiness-edu',
    title: 'Tâm trạng & mệt mỏi cũng là tín hiệu',
    body: 'Chán nản, lo âu, mất động lực hoặc mệt mỏi ban ngày kéo dài có thể là dấu hiệu quá tải (overtraining) — đừng bỏ qua những tín hiệu tinh thần này, chúng cũng quan trọng như nhịp tim.',
    citation: { label: 'The Overtraining Syndrome', url: 'https://philmaffetone.com/the-overtraining-syndrome/' },
    appliesTo: { tiers: CAUTION_TIERS },
  },
];
