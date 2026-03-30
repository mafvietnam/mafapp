
import { CommitmentLevel, ExperienceLevel, ScheduleItem, UserProfile } from '../types';

/**
 * MAF LOGIC ENGINE - UPDATED
 * Reference: "The Big Book of Endurance Training and Racing" - Dr. Phil Maffetone
 */

// --- VOLUME CAPS CONSTANTS (CHAPTER 9 - COMMITMENT LEVELS) ---
// Purpose: Prevent training volume from exceeding user's time commitment
export interface VolumeCap {
  maxWeeklyMinutes: number;
  maxLongRunMinutes: number;
  description: string;
}

export const VOLUME_CAPS: Record<CommitmentLevel, VolumeCap> = {
  [CommitmentLevel.HEALTH]: {
    maxWeeklyMinutes: 240,    // 4h/tuần - Gói Sức Khỏe
    maxLongRunMinutes: 60,    // 1h bài chạy dài tối đa
    description: "Gói Sức Khỏe (4h/tuần)"
  },
  [CommitmentLevel.BASE]: {
    maxWeeklyMinutes: 420,    // 7h/tuần - Gói Nền Tảng
    maxLongRunMinutes: 120,   // 2h bài chạy dài tối đa
    description: "Gói Nền Tảng (7h/tuần)"
  },
  [CommitmentLevel.PERFORMANCE]: {
    maxWeeklyMinutes: 720,    // 12h/tuần - Gói Hiệu Suất
    maxLongRunMinutes: 180,   // 3h bài chạy dài tối đa
    description: "Gói Hiệu Suất (12h/tuần)"
  }
};

// --- SMART LONG RUN RESULT INTERFACE ---
export interface SmartLongRunResult {
  duration: number;           // Thời gian Long Run mới (phút)
  message: string;            // Explanation cho user
  adjustmentType: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP';
  isCapped?: boolean;         // Flag: đã chạm trần giới hạn gói
}

// --- WEEKLY VOLUME CAP RESULT INTERFACE ---
export interface WeeklyVolumeCapResult {
  adjustedSchedule: ScheduleItem[];
  wasReduced: boolean;
  originalTotal: number;
  adjustedTotal: number;
  reductionMessage?: string;
}

// --- CHƯƠNG 5: WARMING UP AND COOLING DOWN ---
// Rule: 15 minutes Warm-up + Main Set + 15 minutes Cool-down.
// Warm-up HR: Must be very low, gradually increasing. (< MAF - 20)
// Cool-down HR: Gradually decreasing.

export const formatSessionDetails = (totalDuration: number, mafHr: number, type?: ScheduleItem['type']): string => {
  // Nếu là bài nghỉ
  if (totalDuration === 0) return "";

  // Special handling for Active Recovery
  if (type === 'RECOVERY') {
    const recoveryHr = mafHr - 15; // HR < MAF - 15
    return [
      `• Chạy phục hồi chủ động`,
      `• Tốc độ RẤT THƯ GIÃN (hơi nhanh hơn đi bộ)`,
      `• Giữ tim DƯỚI ${recoveryHr} bpm (MAF - 15)`,
      `• Mục đích: Thúc đẩy tuần hoàn máu, không gây mệt`
    ].join('\n');
  }

  // Nếu bài tập quá ngắn (<= 30 phút), không thể áp dụng 15/15
  if (totalDuration <= 30) {
    return `Đi bộ / Chạy rất nhẹ nhàng thư giãn (Giữ tim < ${mafHr - 20} bpm)`;
  }

  const warmUp = 15;
  const coolDown = 15;
  const mainSet = totalDuration - (warmUp + coolDown);
  const lowerZone = mafHr - 10;
  const warmUpHr = mafHr - 20;

  return [
    `• ${warmUp}p Khởi động: Đi bộ -> Chạy chậm (HR < ${warmUpHr})`,
    `• ${mainSet}p Chạy MAF: Duy trì nhịp tim ${lowerZone} - ${mafHr} bpm`,
    `• ${coolDown}p Thả lỏng: Chạy chậm dần -> Đi bộ để hồi phục`
  ].join('\n');
};

// --- CHƯƠNG 9: PERSONALIZE YOUR TRAINING ---
// Definitions for Weekly Volume based on Commitment Levels

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

// --- CHƯƠNG 24: PROBATION PERIOD (GIAI ĐOẠN THỬ THÁCH) ---
// Sau chấn thương/bệnh tật, cần giai đoạn thử thách 14 ngày với khối lượng giảm

export const adjustForProbation = (schedule: ScheduleItem[]): ScheduleItem[] => {
  return schedule.map(item => {
    if (item.duration > 0) {
      const reducedDuration = Math.round(item.duration * 0.7); // Giảm 30%
      const minDuration = Math.max(reducedDuration, 15); // Tối thiểu 15 phút
      
      return {
        ...item,
        duration: minDuration,
        activity: item.type === 'LONG_RUN' 
          ? item.activity.replace('Chạy dài (Long Run)', 'Chạy dài (Long Run - Giới hạn Hồi phục)')
          : item.activity
      };
    }
    return item;
  });
};

// --- CHƯƠNG 6 & 29: SAFETY RULES ---

export const adjustScheduleForSafety = (
  schedule: ScheduleItem[], 
  userProfile: UserProfile, 
  bmi: number
): ScheduleItem[] => {
  let adjustedSchedule = [...schedule];
  const ageNum = parseInt(userProfile.age);

  // RULE 1: JOINT SAFETY (BMI >= 30) -> Walk/Bike only
  if (bmi >= 30) {
    adjustedSchedule = adjustedSchedule.map(item => {
      if (item.type === 'RUN' || item.type === 'LONG_RUN') {
        return {
          ...item,
          activity: 'Đi bộ nhanh / Đạp xe / Bơi lội (Low Impact)',
          type: 'CROSS_TRAIN'
        };
      }
      return item;
    });
  }

  // RULE 2: NEWBIE SAFETY (Experience = None/Inconsistent)
  // Max Long Run = 60 mins.
  const isBeginner = userProfile.experience === ExperienceLevel.NONE || 
                     userProfile.experience === ExperienceLevel.INCONSISTENT;
  
  if (isBeginner) {
    const MAX_DURATION_NEWBIE = 60;
    adjustedSchedule = adjustedSchedule.map(item => {
      if (item.duration > MAX_DURATION_NEWBIE) {
        return {
          ...item,
          duration: MAX_DURATION_NEWBIE,
          activity: item.activity // Structure will be formatted later based on new duration
        };
      }
      return item;
    });
  }

  // RULE 3: SENIOR RECOVERY (Age >= 60) -> Cap at 90 mins max
  if (ageNum >= 60) {
     const MAX_DURATION_SENIOR = 90;
     adjustedSchedule = adjustedSchedule.map(item => {
        if (item.duration > MAX_DURATION_SENIOR) {
           return {
              ...item,
              duration: MAX_DURATION_SENIOR,
           };
        }
        return item;
     });
  }
  
  // RULE 4: RECOVERING -> Cap at 45 mins, Walk/Easy Run
  if (userProfile.isRecovering) {
     adjustedSchedule = adjustedSchedule.map(item => {
        if (item.type === 'RUN' || item.type === 'LONG_RUN') {
           return {
              ...item,
              duration: Math.min(item.duration, 45),
              activity: 'Đi bộ / Chạy rất nhẹ (Hồi phục)',
              type: 'WALK'
           };
        }
        return item;
     });
  }

  return adjustedSchedule;
};


// --- SMART LONG RUN CALCULATION (History-based) ---
// Logic dựa trên dữ liệu lịch sử để tính toán Long Run phù hợp với năng lực thực tế

export const calculateSmartLongRun = (
  lastDuration: number | undefined,
  lastHR: number | undefined,
  mafTargetHR: number,
  commitmentLevel: CommitmentLevel,
  userAge: number,
  experience: ExperienceLevel,
  feeling?: 'GOOD' | 'TIRED' | 'VERY_TIRED'
): SmartLongRunResult => {
  
  // 1. DETERMINE COMMITMENT CAP from VOLUME_CAPS (Package-based limit)
  const packageCap = VOLUME_CAPS[commitmentLevel].maxLongRunMinutes;
  const packageDescription = VOLUME_CAPS[commitmentLevel].description;
  
  // 2. AGE ADJUSTMENT (Chapter 29: Senior Safety)
  let ageCap = packageCap;
  if (userAge >= 60) ageCap = Math.min(ageCap, 90);   // Max 1.5h for seniors (60+)
  if (userAge >= 50 && userAge < 60) ageCap = Math.min(ageCap, 150); // Max 2.5h for 50+
  
  const finalCap = ageCap;
  
  // Check if age limit is more restrictive than package limit
  const isAgeLimited = ageCap < packageCap;
  
  // 3. IF NO HISTORY DATA -> USE DEFAULT SAFE START
  if (!lastDuration || !lastHR) {
    // Conservative beginner defaults based on experience level
    const beginnerDefaults: Record<ExperienceLevel, number> = {
      [ExperienceLevel.NONE]: 45,
      [ExperienceLevel.INCONSISTENT]: 45,
      [ExperienceLevel.REGULAR_NEW]: 60,
      [ExperienceLevel.ADVANCED]: 75
    };
    const defaultDuration = beginnerDefaults[experience] || 60;
    
    return {
      duration: Math.min(defaultDuration, finalCap),
      message: `🌱 KHỞI ĐIỂM AN TOÀN: Bắt đầu với ${Math.min(defaultDuration, finalCap)} phút. Hãy nhập dữ liệu sau bài Long Run tiếp theo để hệ thống điều chỉnh thông minh!`,
      adjustmentType: 'MAINTAIN'
    };
  }
  
  // 4. VALIDATE DATA (Detect anomalies - protect against bad input)
  if (lastDuration > 300) { // More than 5 hours - unrealistic
    return {
      duration: 90,
      message: `⚠️ DỮ LIỆU BẤT THƯỜNG: Thời gian ${lastDuration} phút quá cao, có thể nhập sai. Reset về 90 phút an toàn. Vui lòng kiểm tra lại!`,
      adjustmentType: 'MAINTAIN'
    };
  }
  
  if (lastDuration < 20) { // Less than 20 mins - too short for Long Run
    return {
      duration: 45,
      message: `⚠️ DỮ LIỆU KHÔNG HỢP LỆ: ${lastDuration} phút quá ngắn cho Long Run. Bắt đầu lại với 45 phút cơ bản.`,
      adjustmentType: 'MAINTAIN'
    };
  }
  
  if (lastHR > 220 || lastHR < 80) { // Invalid HR range
    return {
      duration: lastDuration,
      message: `⚠️ NHỊP TIM BẤT THƯỜNG: ${lastHR} bpm không hợp lý. Giữ nguyên ${lastDuration} phút. Vui lòng kiểm tra thiết bị đo nhịp tim!`,
      adjustmentType: 'MAINTAIN'
    };
  }
  
  // 5. HEART RATE ANALYSIS (Core MAF Logic)
  const hrBuffer = 5; // Tolerance zone (MAF ± 5 bpm)
  const hrDifference = lastHR - mafTargetHR;
  
  // CASE A: HR TOO HIGH (Over MAF + 5) -> UNSAFE - Need to reduce/maintain
  if (hrDifference > hrBuffer) {
    const excessBpm = Math.round(hrDifference);
    
    // Check feeling to determine severity
    if (feeling === 'VERY_TIRED') {
      // Severe overload -> reduce 20%
      const newDuration = Math.round(lastDuration * 0.8);
      const safeDuration = Math.max(newDuration, 30); // Min 30 mins
      return {
        duration: safeDuration,
        message: `🔴 QUÁ TẢI NGHIÊM TRỌNG: Tim bạn cao hơn MAF ${excessBpm} bpm và cảm thấy rất mệt. Giảm 20% xuống ${safeDuration} phút để bảo vệ tim mạch.`,
        adjustmentType: 'DECREASE'
      };
    } else if (feeling === 'TIRED') {
      // Moderate overload with fatigue -> reduce 10%
      const newDuration = Math.round(lastDuration * 0.9);
      return {
        duration: newDuration,
        message: `⚠️ TIM QUÁ CAO: Lần trước tim bạn cao hơn MAF ${excessBpm} bpm và hơi mệt. Giảm 10% xuống ${newDuration} phút để tối ưu hiếu khí.`,
        adjustmentType: 'DECREASE'
      };
    } else {
      // HR high but feeling OK -> maintain (body is adapting)
      return {
        duration: lastDuration,
        message: `⚠️ TIM HƠI CAO: Lần trước tim bạn cao hơn MAF ${excessBpm} bpm. Giữ nguyên ${lastDuration} phút tuần này để cơ thể thích nghi.`,
        adjustmentType: 'MAINTAIN'
      };
    }
  }
  
  // CASE B: HR IN ZONE (Within MAF ± 5) -> GOOD PROGRESS - Apply 10% rule
  if (Math.abs(hrDifference) <= hrBuffer) {
    // Perfect zone -> apply Maffetone's 10% rule
    const newDuration = Math.round(lastDuration * 1.1);
    
  // Check if hitting cap
    if (newDuration > finalCap) {
      const capMessage = isAgeLimited 
        ? `🔒 ĐẠT TRẦN TUỔI: Long Run tối đa ${finalCap} phút cho độ tuổi ${userAge}+. Duy trì mức này để đảm bảo an toàn.`
        : `🔒 ĐẠT TRẦN ${packageDescription.toUpperCase()}: Long Run tối đa ${finalCap} phút. Duy trì mức này để phù hợp lịch sinh hoạt. Muốn chạy dài hơn? Cân nhắc nâng cấp gói!`;
      
      return {
        duration: finalCap,
        message: capMessage,
        adjustmentType: 'CAP',
        isCapped: true
      };
    }
    
    // Check feeling modifier
    if (feeling === 'VERY_TIRED') {
      return {
        duration: lastDuration,
        message: `⏸️ DUY TRÌ: Tim bạn tốt (${lastHR} bpm) nhưng cơ thể rất mệt. Giữ nguyên ${lastDuration} phút để hồi phục hoàn toàn.`,
        adjustmentType: 'MAINTAIN'
      };
    }
    
    if (feeling === 'TIRED') {
      // Good HR but tired -> smaller increase (5%)
      const conservativeIncrease = Math.round(lastDuration * 1.05);
      const cappedDuration = Math.min(conservativeIncrease, finalCap);
      return {
        duration: cappedDuration,
        message: `📈 TIẾN BỘ CẨN TRỌNG: Tim tốt (${lastHR} bpm) nhưng hơi mệt. Tăng 5% lên ${cappedDuration} phút để cân bằng.`,
        adjustmentType: 'INCREASE'
      };
    }
    
    // Perfect condition -> full 10% increase
    return {
      duration: newDuration,
      message: `📈 TIẾN BỘ TỐT: Lần trước tim ${lastHR} bpm (trong vùng MAF). Tăng 10% lên ${newDuration} phút theo Quy tắc 10% của Maffetone!`,
      adjustmentType: 'INCREASE'
    };
  }
  
  // CASE C: HR TOO LOW (Under MAF - 5) -> More capacity - Can push harder
  if (hrDifference < -hrBuffer) {
    const underBpm = Math.abs(Math.round(hrDifference));
    
    // More aggressive increase (15%) since they have spare capacity
    const newDuration = Math.round(lastDuration * 1.15);
    
    // Check cap
    if (newDuration > finalCap) {
      const capMessage = isAgeLimited
        ? `🚀 TIỀM NĂNG CAO: Tim chỉ ${lastHR} bpm, bạn còn dư sức! Tuy nhiên đã đạt giới hạn ${finalCap} phút cho độ tuổi ${userAge}+.`
        : `🚀 TIỀM NĂNG CAO: Tim chỉ ${lastHR} bpm, bạn còn dư sức! Đã đạt trần ${packageDescription} (${finalCap} phút). Nâng cấp gói để tăng thêm!`;
      
      return {
        duration: finalCap,
        message: capMessage,
        adjustmentType: 'CAP',
        isCapped: true
      };
    }
    
    // Check feeling
    if (feeling === 'VERY_TIRED') {
      // Low HR but very tired -> possible overtraining symptoms
      return {
        duration: lastDuration,
        message: `⚠️ DẤU HIỆU OVERTRAINING: Tim thấp (${lastHR} bpm) nhưng rất mệt - có thể đang quá tải. Giữ nguyên ${lastDuration} phút và theo dõi.`,
        adjustmentType: 'MAINTAIN'
      };
    }
    
    return {
      duration: newDuration,
      message: `💪 CÒN DƯ SỨC: Tim chỉ ${lastHR} bpm, thấp hơn MAF ${underBpm} bpm. Tăng 15% lên ${newDuration} phút để tối ưu hóa nền tảng!`,
      adjustmentType: 'INCREASE'
    };
  }
  
  // Fallback (should not reach here)
  return {
    duration: lastDuration,
    message: `✅ Giữ nguyên ${lastDuration} phút.`,
    adjustmentType: 'MAINTAIN'
  };
};


// --- WEEKLY VOLUME CAP ENFORCEMENT ---
// Purpose: Ensure total weekly training time doesn't exceed user's commitment level
// Logic: Reduce recovery/easy runs (preserve Long Run) if total exceeds cap

export const enforceWeeklyVolumeCap = (
  schedule: ScheduleItem[],
  commitmentLevel: CommitmentLevel
): WeeklyVolumeCapResult => {
  
  const maxWeekly = VOLUME_CAPS[commitmentLevel].maxWeeklyMinutes;
  const packageDescription = VOLUME_CAPS[commitmentLevel].description;
  
  // Calculate current total minutes
  const totalMinutes = schedule.reduce((sum, item) => sum + item.duration, 0);
  
  // If under cap -> OK, no changes needed
  if (totalMinutes <= maxWeekly) {
    return { 
      adjustedSchedule: schedule, 
      wasReduced: false,
      originalTotal: totalMinutes,
      adjustedTotal: totalMinutes
    };
  }
  
  // If exceeds cap -> Need to reduce
  const excess = totalMinutes - maxWeekly;
  
  // Identify adjustable sessions (NOT Long Run, NOT Rest)
  // Priority: Reduce WALK > CROSS_TRAIN > RUN > RECOVERY (preserve structure)
  const reductionPriority: Record<ScheduleItem['type'], number> = {
    'WALK': 1,        // First to reduce
    'CROSS_TRAIN': 2, // Second
    'RUN': 3,         // Third
    'RECOVERY': 4,    // Last resort before Long Run
    'LONG_RUN': 99,   // Never reduce Long Run
    'REST': 99        // Can't reduce rest (already 0)
  };
  
  // Sort sessions by reduction priority (most reducible first)
  const sortedByPriority = schedule
    .map((item, index) => ({ ...item, originalIndex: index }))
    .filter(item => item.duration > 0 && item.type !== 'LONG_RUN' && item.type !== 'REST')
    .sort((a, b) => reductionPriority[a.type] - reductionPriority[b.type]);
  
  // Calculate total adjustable minutes
  const adjustableTotal = sortedByPriority.reduce((sum, item) => sum + item.duration, 0);
  
  if (adjustableTotal <= 0) {
    // Nothing to adjust (only Long Run and Rest in schedule)
    return {
      adjustedSchedule: schedule,
      wasReduced: false,
      originalTotal: totalMinutes,
      adjustedTotal: totalMinutes,
      reductionMessage: `⚠️ Không thể giảm thêm - chỉ còn Long Run và ngày nghỉ.`
    };
  }
  
  // Create a mutable copy of schedule
  const adjustedSchedule = [...schedule];
  let remainingExcess = excess;
  
  // Reduce sessions in priority order
  for (const item of sortedByPriority) {
    if (remainingExcess <= 0) break;
    
    const currentDuration = adjustedSchedule[item.originalIndex].duration;
    const minDuration = 15; // Minimum session duration (15/15 rule)
    const maxReduction = currentDuration - minDuration;
    
    if (maxReduction <= 0) continue; // Already at minimum
    
    const actualReduction = Math.min(remainingExcess, maxReduction);
    adjustedSchedule[item.originalIndex] = {
      ...adjustedSchedule[item.originalIndex],
      duration: currentDuration - actualReduction
    };
    
    remainingExcess -= actualReduction;
  }
  
  // Calculate new total
  const newTotal = adjustedSchedule.reduce((sum, item) => sum + item.duration, 0);
  
  // Generate reduction message
  const reductionMessage = `⚠️ ĐIỀU CHỈNH KHỐI LƯỢNG: Tổng thời gian tuần (${totalMinutes} phút) vượt quá giới hạn ${packageDescription} (${maxWeekly} phút). Đã tự động giảm các bài hồi phục/nhẹ xuống ${newTotal} phút để phù hợp cam kết thời gian của bạn.`;
  
  return {
    adjustedSchedule,
    wasReduced: true,
    originalTotal: totalMinutes,
    adjustedTotal: newTotal,
    reductionMessage
  };
};


// --- HELPER: Calculate total weekly minutes ---
export const calculateTotalWeeklyMinutes = (schedule: ScheduleItem[]): number => {
  return schedule.reduce((sum, item) => sum + item.duration, 0);
};


// --- HELPER: Format weekly volume summary ---
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
