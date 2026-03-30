/**
 * MAF Volume Cap — Chapter 9: Commitment Level volume limits
 * Enforces weekly training time caps per commitment package
 */

import { CommitmentLevel, ScheduleItem } from '../types';
import { VolumeCap, WeeklyVolumeCapResult } from './maf-types';

// Max weekly and long-run minutes per commitment level
export const VOLUME_CAPS: Record<CommitmentLevel, VolumeCap> = {
  [CommitmentLevel.HEALTH]: {
    maxWeeklyMinutes: 240,   // 4h/week
    maxLongRunMinutes: 60,   // 1h max long run
    description: "Gói Sức Khỏe (4h/tuần)"
  },
  [CommitmentLevel.BASE]: {
    maxWeeklyMinutes: 420,   // 7h/week
    maxLongRunMinutes: 120,  // 2h max long run
    description: "Gói Nền Tảng (7h/tuần)"
  },
  [CommitmentLevel.PERFORMANCE]: {
    maxWeeklyMinutes: 720,   // 12h/week
    maxLongRunMinutes: 180,  // 3h max long run
    description: "Gói Hiệu Suất (12h/tuần)"
  }
};

// Reduction priority: reduce WALK first, preserve LONG_RUN last
const REDUCTION_PRIORITY: Record<ScheduleItem['type'], number> = {
  'WALK': 1,
  'CROSS_TRAIN': 2,
  'RUN': 3,
  'RECOVERY': 4,
  'LONG_RUN': 99,  // Never reduce Long Run
  'REST': 99       // Already 0 — nothing to reduce
};

// Enforce weekly volume cap: reduce recovery/easy runs if total exceeds package limit
export const enforceWeeklyVolumeCap = (
  schedule: ScheduleItem[],
  commitmentLevel: CommitmentLevel
): WeeklyVolumeCapResult => {
  const maxWeekly = VOLUME_CAPS[commitmentLevel].maxWeeklyMinutes;
  const packageDescription = VOLUME_CAPS[commitmentLevel].description;

  const totalMinutes = schedule.reduce((sum, item) => sum + item.duration, 0);

  // Under cap — no changes needed
  if (totalMinutes <= maxWeekly) {
    return {
      adjustedSchedule: schedule,
      wasReduced: false,
      originalTotal: totalMinutes,
      adjustedTotal: totalMinutes
    };
  }

  const excess = totalMinutes - maxWeekly;

  // Find adjustable sessions (exclude Long Run and Rest)
  const sortedByPriority = schedule
    .map((item, index) => ({ ...item, originalIndex: index }))
    .filter(item => item.duration > 0 && item.type !== 'LONG_RUN' && item.type !== 'REST')
    .sort((a, b) => REDUCTION_PRIORITY[a.type] - REDUCTION_PRIORITY[b.type]);

  const adjustableTotal = sortedByPriority.reduce((sum, item) => sum + item.duration, 0);

  if (adjustableTotal <= 0) {
    return {
      adjustedSchedule: schedule,
      wasReduced: false,
      originalTotal: totalMinutes,
      adjustedTotal: totalMinutes,
      reductionMessage: `⚠️ Không thể giảm thêm - chỉ còn Long Run và ngày nghỉ.`
    };
  }

  const adjustedSchedule = [...schedule];
  let remainingExcess = excess;

  for (const item of sortedByPriority) {
    if (remainingExcess <= 0) break;

    const currentDuration = adjustedSchedule[item.originalIndex].duration;
    const minDuration = 15; // Minimum session (15/15 warm-up/cool-down rule)
    const maxReduction = currentDuration - minDuration;

    if (maxReduction <= 0) continue;

    const actualReduction = Math.min(remainingExcess, maxReduction);
    adjustedSchedule[item.originalIndex] = {
      ...adjustedSchedule[item.originalIndex],
      duration: currentDuration - actualReduction
    };

    remainingExcess -= actualReduction;
  }

  const newTotal = adjustedSchedule.reduce((sum, item) => sum + item.duration, 0);

  return {
    adjustedSchedule,
    wasReduced: true,
    originalTotal: totalMinutes,
    adjustedTotal: newTotal,
    reductionMessage: `⚠️ ĐIỀU CHỈNH KHỐI LƯỢNG: Tổng thời gian tuần (${totalMinutes} phút) vượt quá giới hạn ${packageDescription} (${maxWeekly} phút). Đã tự động giảm các bài hồi phục/nhẹ xuống ${newTotal} phút để phù hợp cam kết thời gian của bạn.`
  };
};

// Sum all session durations in a weekly schedule
export const calculateTotalWeeklyMinutes = (schedule: ScheduleItem[]): number => {
  return schedule.reduce((sum, item) => sum + item.duration, 0);
};

// Human-readable weekly volume summary with percentage of cap
export const formatWeeklyVolumeSummary = (
  schedule: ScheduleItem[],
  commitmentLevel: CommitmentLevel
): string => {
  const total = calculateTotalWeeklyMinutes(schedule);
  const maxWeekly = VOLUME_CAPS[commitmentLevel].maxWeeklyMinutes;
  const percentage = Math.round((total / maxWeekly) * 100);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return `📊 Tổng tuần: ${hours}h${minutes > 0 ? minutes + 'p' : ''} / ${Math.floor(maxWeekly / 60)}h (${percentage}% giới hạn gói)`;
};
