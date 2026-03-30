/**
 * MAF Schedule Generator — Chapter 9: Personalize Your Training
 * Generates weekly schedule template based on commitment level
 */

import { CommitmentLevel, ScheduleItem } from '../types';

// Returns the default weekly schedule for a given commitment level
export const getWeeklySchedule = (level: CommitmentLevel): ScheduleItem[] => {
  switch (level) {
    case CommitmentLevel.HEALTH:
      // Goal: Maintenance, low stress.
      // Frequency: 3 days/week. Duration: 45 mins (15+15+15).
      return [
        { day: 'Thứ 2', activity: 'Nghỉ ngơi (Rest)', duration: 0, type: 'REST' },
        { day: 'Thứ 3', activity: 'Chạy nhẹ nhàng', duration: 45, type: 'RUN' },
        { day: 'Thứ 4', activity: 'Nghỉ ngơi hoặc Đi dạo', duration: 0, type: 'REST' },
        { day: 'Thứ 5', activity: 'Chạy nhẹ nhàng', duration: 45, type: 'RUN' },
        { day: 'Thứ 6', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
        { day: 'Thứ 7', activity: 'Vận động hiếu khí', duration: 45, type: 'RUN' },
        { day: 'Chủ Nhật', activity: 'Đi bộ / Yoga (Tùy chọn)', duration: 30, type: 'WALK' },
      ];

    case CommitmentLevel.BASE:
      // Goal: Aerobic Foundation.
      // Frequency: 4-5 days. Normal: 60m. Long Run: 90m.
      return [
        { day: 'Thứ 2', activity: 'Nghỉ ngơi (Hồi phục)', duration: 0, type: 'REST' },
        { day: 'Thứ 3', activity: 'Xây dựng nền tảng', duration: 60, type: 'RUN' },
        { day: 'Thứ 4', activity: 'Hồi phục chủ động', duration: 45, type: 'RUN' },
        { day: 'Thứ 5', activity: 'Xây dựng nền tảng', duration: 60, type: 'RUN' },
        { day: 'Thứ 6', activity: 'Nghỉ ngơi', duration: 0, type: 'REST' },
        { day: 'Thứ 7', activity: 'Chạy dài (Long Run)', duration: 90, type: 'LONG_RUN' },
        { day: 'Chủ Nhật', activity: 'Đi bộ đường dài', duration: 45, type: 'WALK' },
      ];

    case CommitmentLevel.PERFORMANCE:
      // Goal: Performance. Higher volume.
      // Normal: 60-75m. Long Run: 120-180m. 6 sessions/week.
      return [
        { day: 'Thứ 2', activity: 'Active Recovery Run', duration: 45, type: 'RECOVERY' },
        { day: 'Thứ 3', activity: 'Aerobic Capacity', duration: 75, type: 'RUN' },
        { day: 'Thứ 4', activity: 'Hồi phục (MAF - 10)', duration: 60, type: 'RUN' },
        { day: 'Thứ 5', activity: 'Aerobic Strength', duration: 75, type: 'RUN' },
        { day: 'Thứ 6', activity: 'Chạy nhẹ (Easy)', duration: 45, type: 'RUN' },
        { day: 'Thứ 7', activity: 'Endurance Long Run', duration: 120, type: 'LONG_RUN' },
        { day: 'Chủ Nhật', activity: 'Nghỉ hoàn toàn', duration: 0, type: 'REST' },
      ];

    default:
      return [];
  }
};
