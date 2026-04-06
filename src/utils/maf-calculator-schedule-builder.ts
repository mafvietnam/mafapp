import { UserProfile, ExperienceLevel, ScheduleItem } from '../types';
import {
  getWeeklySchedule,
  adjustScheduleForSafety,
  adjustForProbation,
  calculateSmartLongRun,
  enforceWeeklyVolumeCap,
} from './maf-logic';
import { parsePaceToSeconds } from './maf-calculator-orchestrator';

/**
 * Build the weekly schedule and apply all adjustments:
 * pace comparison, BMI replacement, probation, smart long run, volume cap.
 */
export function buildAndAdjustSchedule(
  userProfile: UserProfile,
  bmi: number,
  maf: number,
  ageNum: number,
  isNewbie: boolean,
  verifiedMafPace: string | null,
  notes: string[]
): ScheduleItem[] {
  const hasVerifiedPace = verifiedMafPace && verifiedMafPace.trim() !== '';
  let finalSchedule = getWeeklySchedule(userProfile.commitment);
  finalSchedule = adjustScheduleForSafety(finalSchedule, userProfile, bmi);

  // Pace comparison & volume adjustment
  const hasPreviousPace = userProfile.previousMonthPace && userProfile.previousMonthPace.trim() !== '';
  if (hasVerifiedPace && hasPreviousPace) {
    const currentPaceSeconds = parsePaceToSeconds(verifiedMafPace!);
    const previousPaceSeconds = parsePaceToSeconds(userProfile.previousMonthPace!);
    if (currentPaceSeconds > 0 && previousPaceSeconds > 0) {
      const delta = currentPaceSeconds - previousPaceSeconds;
      if (delta < -10) {
        const longRunIndex = finalSchedule.findIndex((s) => s.type === 'LONG_RUN');
        if (longRunIndex !== -1) {
          const newDuration = Math.round(finalSchedule[longRunIndex].duration * 1.1);
          let cappedDuration = newDuration;
          if (ageNum >= 60 && cappedDuration > 90) cappedDuration = 90;
          if (isNewbie && cappedDuration > 60) cappedDuration = 60;
          finalSchedule[longRunIndex] = { ...finalSchedule[longRunIndex], duration: cappedDuration };
        }
      } else if (delta > 10) {
        finalSchedule = finalSchedule.map((item) => {
          if (item.duration > 0) {
            const newDuration = Math.round(item.duration * 0.7);
            const minDuration = item.type === 'REST' ? 0 : Math.max(newDuration, 15);
            return { ...item, duration: minDuration };
          }
          return item;
        });
      }
    }
  }

  // BMI-based activity replacement
  if (bmi >= 30) {
    finalSchedule = finalSchedule.map((item) => ({
      ...item,
      activity: item.activity.replace(/Chạy/g, 'Đi bộ'),
      type: 'WALK' as const,
    }));
  } else if (bmi >= 25 && !hasVerifiedPace) {
    finalSchedule = finalSchedule.map((item) => ({
      ...item,
      activity: item.activity.replace(/Chạy/g, 'Đi bộ nhanh / Jogging'),
    }));
  }

  // Probation mode: 70% volume reduction
  if (userProfile.isProbation) {
    finalSchedule = adjustForProbation(finalSchedule);
  }

  // Smart long run calculation
  const longRunIndex = finalSchedule.findIndex((s) => s.type === 'LONG_RUN');
  const hasExperience =
    userProfile.experience === ExperienceLevel.REGULAR_NEW ||
    userProfile.experience === ExperienceLevel.ADVANCED;

  if (longRunIndex !== -1 && hasExperience && !userProfile.isProbation) {
    const smartResult = calculateSmartLongRun(
      userProfile.lastLongRunDuration,
      userProfile.lastLongRunHeartRate,
      maf,
      userProfile.commitment,
      ageNum,
      userProfile.experience,
      userProfile.lastLongRunFeeling
    );
    finalSchedule[longRunIndex] = { ...finalSchedule[longRunIndex], duration: smartResult.duration };
  }

  // Enforce weekly volume cap
  if (!userProfile.isProbation) {
    const volumeCapResult = enforceWeeklyVolumeCap(finalSchedule, userProfile.commitment);
    finalSchedule = volumeCapResult.adjustedSchedule;
    if (volumeCapResult.wasReduced && volumeCapResult.reductionMessage) {
      notes.push(volumeCapResult.reductionMessage);
    }
  }

  return finalSchedule;
}

/**
 * Compute volume and long-run adjustment messages for display.
 */
export function computeAdjustmentMessages(
  userProfile: UserProfile,
  verifiedMafPace: string | null,
  finalSchedule: ScheduleItem[],
  maf: number,
  ageNum: number
) {
  let volumeMsg: string | undefined;
  let volumeType: 'PROGRESS' | 'REGRESSION' | 'STABLE' | undefined;
  let longRunMsg: string | undefined;
  let longRunType: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP' | undefined;

  const hasCurrentPace = verifiedMafPace && verifiedMafPace.trim() !== '';
  const hasPreviousPace = userProfile.previousMonthPace && userProfile.previousMonthPace.trim() !== '';

  if (hasCurrentPace && hasPreviousPace) {
    const currentPaceSeconds = parsePaceToSeconds(verifiedMafPace!);
    const previousPaceSeconds = parsePaceToSeconds(userProfile.previousMonthPace!);
    if (currentPaceSeconds > 0 && previousPaceSeconds > 0) {
      const delta = currentPaceSeconds - previousPaceSeconds;
      if (delta < -10) {
        volumeType = 'PROGRESS';
        volumeMsg = `📈 PHÁT HIỆN TIẾN BỘ: Pace của bạn nhanh hơn ${Math.abs(delta)}s/km so với tháng trước! Hệ thống đã tăng thời gian bài chạy dài (Long Run) thêm 10% để tối ưu hóa nền tảng hiếu khí.`;
      } else if (delta > 10) {
        volumeType = 'REGRESSION';
        volumeMsg = `📉 CẢNH BÁO SỨC KHỎE: Pace của bạn chậm hơn ${Math.abs(delta)}s/km so với tháng trước. Hệ thống đã kích hoạt CHẾ ĐỘ HỒI PHỤC - Giảm 30% khối lượng tập toàn bộ tuần để ngăn ngừa quá tải và phục hồi sức khỏe.`;
      } else {
        volumeType = 'STABLE';
        volumeMsg = `✅ ỔN ĐỊNH: Pace của bạn duy trì ổn định so với tháng trước (chênh lệch ${Math.abs(delta)}s). Hệ thống giữ nguyên lịch tập chuẩn.`;
      }
    }
  }

  // Smart long run message
  const longRunIndex = finalSchedule.findIndex((s) => s.type === 'LONG_RUN');
  const hasExperience =
    userProfile.experience === ExperienceLevel.REGULAR_NEW ||
    userProfile.experience === ExperienceLevel.ADVANCED;

  if (longRunIndex !== -1 && hasExperience && !userProfile.isProbation) {
    const smartResult = calculateSmartLongRun(
      userProfile.lastLongRunDuration,
      userProfile.lastLongRunHeartRate,
      maf,
      userProfile.commitment,
      ageNum,
      userProfile.experience,
      userProfile.lastLongRunFeeling
    );
    longRunMsg = smartResult.message;
    longRunType = smartResult.adjustmentType;
  }

  return { volumeMsg, volumeType, longRunMsg, longRunType };
}

/**
 * Add pace-based warning notes and cross-train swaps.
 */
export function addPaceWarnings(
  notes: string[],
  finalSchedule: ScheduleItem[],
  paceSeconds: number,
  ageNum: number,
  isNewbie: boolean,
  userProfile: UserProfile,
  isObese: boolean
) {
  if (!isNewbie && paceSeconds > 0 && paceSeconds <= 300) {
    if (ageNum > 35 || userProfile.experience === ExperienceLevel.REGULAR_NEW) {
      notes.push('⚡ CẢNH BÁO CƠ HỌC: Tốc độ Aerobic đang khá cao. Chú trọng giày chạy và khởi động kỹ.');
    }
  }
  if (!isNewbie && paceSeconds > 0 && paceSeconds < 270) {
    const swapIndex = finalSchedule.findIndex((s) => s.day === 'Thứ 5' && s.type === 'RUN');
    if (swapIndex !== -1) {
      finalSchedule[swapIndex] = {
        ...finalSchedule[swapIndex],
        activity: 'Strength / Cross-training (Gym/Yoga)\n(Thay thế chạy để bảo vệ khớp)',
        type: 'CROSS_TRAIN',
      };
      notes.push('Đã chuyển buổi chạy Thứ 5 sang Strength để bảo vệ khớp do Pace nhanh.');
    }
  }
  if (isObese) {
    notes.push('⚠️ JOINT SAFETY: Vì BMI > 30, ưu tiên các bài tập ít tác động mạnh (Low Impact).');
  }
  if (ageNum >= 60) notes.push('LƯU Ý QUAN TRỌNG: Lắng nghe cơ thể. Đi bộ bất cứ khi nào thấy mệt.');
}
