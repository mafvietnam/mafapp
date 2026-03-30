import { CommitmentLevel, ExperienceLevel, ScheduleItem } from './types';
import { Heart, Flame, Zap } from 'lucide-react';

export const EXPERIENCE_OPTIONS = [
  { value: ExperienceLevel.NONE, label: 'Chưa từng chạy', score: 0 },
  { value: ExperienceLevel.INCONSISTENT, label: 'Chạy lâu nhưng ngắt quãng / Tim cao', score: -5 },
  { value: ExperienceLevel.REGULAR_NEW, label: 'Đang tập đều < 2 năm', score: 0 },
  { value: ExperienceLevel.ADVANCED, label: 'Tập liên tục > 2 năm, thành tích tốt', score: 5 },
];

export const COMMITMENT_CARDS = [
  {
    id: CommitmentLevel.HEALTH,
    title: 'SỨC KHỎE & ĐỐT MỠ',
    icon: Heart,
    hours: '3-4 giờ/tuần',
    benefit: 'Tập trung xây dựng Sức khỏe (Health) trước khi nghĩ đến Thể lực (Fitness). Đốt mỡ hiệu quả và duy trì sự nhất quán (Chương 1).',
    color: 'text-green-500',
    borderColor: 'border-green-500',
  },
  {
    id: CommitmentLevel.BASE,
    title: 'XÂY DỰNG NỀN TẢNG',
    icon: Flame,
    hours: '5-6 giờ/tuần',
    benefit: 'Phát triển tối đa chức năng hiếu khí (Maximum Aerobic Function). Xây dựng bộ máy năng lượng khổng lồ không gây chấn thương (Chương 3).',
    recommended: true,
    color: 'text-orange-500',
    borderColor: 'border-orange-500',
  },
  {
    id: CommitmentLevel.PERFORMANCE,
    title: 'THI ĐẤU & CẠNH TRANH',
    icon: Zap,
    hours: '7-12 giờ/tuần',
    benefit: 'Chuyển hóa nền tảng thành thành tích (Chương 10). Cảnh báo: Phải tuân thủ tuyệt đối quy tắc "Training = Work + Rest" (Chương 7).',
    color: 'text-purple-600',
    borderColor: 'border-purple-600',
  },
];

export const SCHEDULES: Record<CommitmentLevel, ScheduleItem[]> = {
  [CommitmentLevel.HEALTH]: [
    { day: 'Thứ 2', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
    { day: 'Thứ 3', activity: 'Chạy nhẹ MAF', duration: 30, type: 'RUN' },
    { day: 'Thứ 4', activity: 'Đi bộ nhanh', duration: 30, type: 'WALK' },
    { day: 'Thứ 5', activity: 'Chạy nhẹ MAF', duration: 30, type: 'RUN' },
    { day: 'Thứ 6', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
    { day: 'Thứ 7', activity: 'Chạy dài chậm', duration: 60, type: 'LONG_RUN' },
    { day: 'Chủ Nhật', activity: 'Nghỉ hoặc Yoga', duration: 30, type: 'REST' },
  ],
  [CommitmentLevel.BASE]: [
    { day: 'Thứ 2', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
    { day: 'Thứ 3', activity: 'Chạy MAF', duration: 60, type: 'RUN' },
    { day: 'Thứ 4', activity: 'Chạy MAF', duration: 45, type: 'RUN' },
    { day: 'Thứ 5', activity: 'Chạy MAF', duration: 60, type: 'RUN' },
    { day: 'Thứ 6', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
    { day: 'Thứ 7', activity: 'Chạy dài (Long Run)', duration: 90, type: 'LONG_RUN' },
    { day: 'Chủ Nhật', activity: 'Chạy thả lỏng / Đi bộ', duration: 45, type: 'WALK' },
  ],
  [CommitmentLevel.PERFORMANCE]: [
    { day: 'Thứ 2', activity: 'Nghỉ hoàn toàn', duration: 0, type: 'REST' },
    { day: 'Thứ 3', activity: 'Chạy MAF', duration: 75, type: 'RUN' },
    { day: 'Thứ 4', activity: 'Chạy MAF', duration: 60, type: 'RUN' },
    { day: 'Thứ 5', activity: 'Chạy MAF', duration: 75, type: 'RUN' },
    { day: 'Thứ 6', activity: 'Chạy nhẹ hồi phục', duration: 45, type: 'RUN' },
    { day: 'Thứ 7', activity: 'Chạy dài (Long Run)', duration: 120, type: 'LONG_RUN' },
    { day: 'Chủ Nhật', activity: 'Chạy MAF', duration: 60, type: 'RUN' },
  ],
};
