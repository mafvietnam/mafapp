/**
 * MAF Smart Long Run Calculator — History-based long run duration adjustment
 * Applies Maffetone's 10% rule, HR zone analysis, and commitment-level caps
 */

import { CommitmentLevel, ExperienceLevel } from '../types';
import { SmartLongRunResult } from './maf-types';
import { VOLUME_CAPS } from './maf-volume-cap';

// Compute recommended Long Run duration based on last session's HR and feeling
export const calculateSmartLongRun = (
  lastDuration: number | undefined,
  lastHR: number | undefined,
  mafTargetHR: number,
  commitmentLevel: CommitmentLevel,
  userAge: number,
  experience: ExperienceLevel,
  feeling?: 'GOOD' | 'TIRED' | 'VERY_TIRED'
): SmartLongRunResult => {

  // 1. COMMITMENT CAP — package-based ceiling
  const packageCap = VOLUME_CAPS[commitmentLevel].maxLongRunMinutes;
  const packageDescription = VOLUME_CAPS[commitmentLevel].description;

  // 2. AGE ADJUSTMENT (Chapter 29: Senior Safety)
  let ageCap = packageCap;
  if (userAge >= 60) ageCap = Math.min(ageCap, 90);             // Max 1.5h for 60+
  if (userAge >= 50 && userAge < 60) ageCap = Math.min(ageCap, 150); // Max 2.5h for 50+

  const finalCap = ageCap;
  const isAgeLimited = ageCap < packageCap;

  // 3. NO HISTORY — safe conservative start based on experience level
  if (!lastDuration || !lastHR) {
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

  // 4. INPUT VALIDATION — guard against bad/unrealistic data
  if (lastDuration > 300) {
    return {
      duration: 90,
      message: `⚠️ DỮ LIỆU BẤT THƯỜNG: Thời gian ${lastDuration} phút quá cao, có thể nhập sai. Reset về 90 phút an toàn. Vui lòng kiểm tra lại!`,
      adjustmentType: 'MAINTAIN'
    };
  }

  if (lastDuration < 20) {
    return {
      duration: 45,
      message: `⚠️ DỮ LIỆU KHÔNG HỢP LỆ: ${lastDuration} phút quá ngắn cho Long Run. Bắt đầu lại với 45 phút cơ bản.`,
      adjustmentType: 'MAINTAIN'
    };
  }

  if (lastHR > 220 || lastHR < 80) {
    return {
      duration: lastDuration,
      message: `⚠️ NHỊP TIM BẤT THƯỜNG: ${lastHR} bpm không hợp lý. Giữ nguyên ${lastDuration} phút. Vui lòng kiểm tra thiết bị đo nhịp tim!`,
      adjustmentType: 'MAINTAIN'
    };
  }

  // 5. HEART RATE ZONE ANALYSIS (Core MAF logic)
  const hrBuffer = 5; // Tolerance zone: MAF ± 5 bpm
  const hrDifference = lastHR - mafTargetHR;

  // CASE A: HR TOO HIGH (> MAF + 5) — reduce or maintain
  if (hrDifference > hrBuffer) {
    const excessBpm = Math.round(hrDifference);

    if (feeling === 'VERY_TIRED') {
      const safeDuration = Math.max(Math.round(lastDuration * 0.8), 30);
      return {
        duration: safeDuration,
        message: `🔴 QUÁ TẢI NGHIÊM TRỌNG: Tim bạn cao hơn MAF ${excessBpm} bpm và cảm thấy rất mệt. Giảm 20% xuống ${safeDuration} phút để bảo vệ tim mạch.`,
        adjustmentType: 'DECREASE'
      };
    }

    if (feeling === 'TIRED') {
      const newDuration = Math.round(lastDuration * 0.9);
      return {
        duration: newDuration,
        message: `⚠️ TIM QUÁ CAO: Lần trước tim bạn cao hơn MAF ${excessBpm} bpm và hơi mệt. Giảm 10% xuống ${newDuration} phút để tối ưu hiếu khí.`,
        adjustmentType: 'DECREASE'
      };
    }

    // HR high but feeling OK — body adapting, hold duration
    return {
      duration: lastDuration,
      message: `⚠️ TIM HƠI CAO: Lần trước tim bạn cao hơn MAF ${excessBpm} bpm. Giữ nguyên ${lastDuration} phút tuần này để cơ thể thích nghi.`,
      adjustmentType: 'MAINTAIN'
    };
  }

  // CASE B: HR IN ZONE (MAF ± 5) — apply Maffetone's 10% rule
  if (Math.abs(hrDifference) <= hrBuffer) {
    const newDuration = Math.round(lastDuration * 1.1);

    if (newDuration > finalCap) {
      const capMessage = isAgeLimited
        ? `🔒 ĐẠT TRẦN TUỔI: Long Run tối đa ${finalCap} phút cho độ tuổi ${userAge}+. Duy trì mức này để đảm bảo an toàn.`
        : `🔒 ĐẠT TRẦN ${packageDescription.toUpperCase()}: Long Run tối đa ${finalCap} phút. Duy trì mức này để phù hợp lịch sinh hoạt. Muốn chạy dài hơn? Cân nhắc nâng cấp gói!`;
      return { duration: finalCap, message: capMessage, adjustmentType: 'CAP', isCapped: true };
    }

    if (feeling === 'VERY_TIRED') {
      return {
        duration: lastDuration,
        message: `⏸️ DUY TRÌ: Tim bạn tốt (${lastHR} bpm) nhưng cơ thể rất mệt. Giữ nguyên ${lastDuration} phút để hồi phục hoàn toàn.`,
        adjustmentType: 'MAINTAIN'
      };
    }

    if (feeling === 'TIRED') {
      const cappedDuration = Math.min(Math.round(lastDuration * 1.05), finalCap);
      return {
        duration: cappedDuration,
        message: `📈 TIẾN BỘ CẨN TRỌNG: Tim tốt (${lastHR} bpm) nhưng hơi mệt. Tăng 5% lên ${cappedDuration} phút để cân bằng.`,
        adjustmentType: 'INCREASE'
      };
    }

    return {
      duration: newDuration,
      message: `📈 TIẾN BỘ TỐT: Lần trước tim ${lastHR} bpm (trong vùng MAF). Tăng 10% lên ${newDuration} phút theo Quy tắc 10% của Maffetone!`,
      adjustmentType: 'INCREASE'
    };
  }

  // CASE C: HR TOO LOW (< MAF - 5) — spare capacity, increase 15%
  if (hrDifference < -hrBuffer) {
    const underBpm = Math.abs(Math.round(hrDifference));
    const newDuration = Math.round(lastDuration * 1.15);

    if (newDuration > finalCap) {
      const capMessage = isAgeLimited
        ? `🚀 TIỀM NĂNG CAO: Tim chỉ ${lastHR} bpm, bạn còn dư sức! Tuy nhiên đã đạt giới hạn ${finalCap} phút cho độ tuổi ${userAge}+.`
        : `🚀 TIỀM NĂNG CAO: Tim chỉ ${lastHR} bpm, bạn còn dư sức! Đã đạt trần ${packageDescription} (${finalCap} phút). Nâng cấp gói để tăng thêm!`;
      return { duration: finalCap, message: capMessage, adjustmentType: 'CAP', isCapped: true };
    }

    if (feeling === 'VERY_TIRED') {
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

  // Fallback — should never reach here
  return {
    duration: lastDuration,
    message: `✅ Giữ nguyên ${lastDuration} phút.`,
    adjustmentType: 'MAINTAIN'
  };
};
