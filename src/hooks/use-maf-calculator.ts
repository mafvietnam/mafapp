import { useState, useRef } from 'react';
import { UserProfile, MafResult, ExperienceLevel, CommitmentLevel } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';
import {
  getWeeklySchedule,
  adjustScheduleForSafety,
  adjustForProbation,
  formatSessionDetails,
  calculateSmartLongRun,
  enforceWeeklyVolumeCap,
  VOLUME_CAPS,
} from '../utils/maf-logic';

export interface UseMafCalculatorReturn {
  result: MafResult | null;
  resultRef: React.RefObject<HTMLDivElement>;
  calculateRawMaf: (userProfile: UserProfile) => number | null;
  calculateMAF: (
    userProfile: UserProfile,
    verifiedMafPace: string | null,
    ageNum: number,
    isChild: boolean,
    isNewbie: boolean,
    getBMI: () => number
  ) => void;
  getVolumeCapText: (commitment: CommitmentLevel) => string;
  parsePaceToSeconds: (paceStr: string) => number;
}

export function useMafCalculator(): UseMafCalculatorReturn {
  const [result, setResult] = useState<MafResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const calculateRawMaf = (userProfile: UserProfile): number | null => {
    const ageNum = parseInt(userProfile.age);
    if (isNaN(ageNum) || ageNum < 1) return null;
    let maf = 180 - ageNum;
    if (userProfile.isRecovering) maf -= 10;
    if (userProfile.isMedicatedOrInjured) maf -= 5;
    const expOption = EXPERIENCE_OPTIONS.find((opt) => opt.value === userProfile.experience);
    if (expOption) maf += expOption.score;
    return maf;
  };

  const parsePaceToSeconds = (paceStr: string): number => {
    if (!paceStr) return 0;
    if (!paceStr.includes(':')) {
      const val = parseFloat(paceStr);
      return isNaN(val) ? 0 : val * 60;
    }
    const parts = paceStr.split(':');
    const min = parseInt(parts[0]) || 0;
    const sec = parseInt(parts[1]) || 0;
    return min * 60 + sec;
  };

  const getVolumeCapText = (commitment: CommitmentLevel): string => {
    const cap = VOLUME_CAPS[commitment];
    const hours = Math.floor(cap.maxWeeklyMinutes / 60);
    const minutes = cap.maxWeeklyMinutes % 60;
    const maxLongRunHours = Math.floor(cap.maxLongRunMinutes / 60);
    const maxLongRunMins = cap.maxLongRunMinutes % 60;
    const weeklyText = minutes > 0 ? `${hours}h${minutes}p` : `${hours}h`;
    const longRunText = maxLongRunMins > 0 ? `${maxLongRunHours}h${maxLongRunMins}p` : `${maxLongRunHours}h`;
    return `${weeklyText}/tuần (Long Run max: ${longRunText})`;
  };

  const calculateMAF = (
    userProfile: UserProfile,
    verifiedMafPace: string | null,
    ageNum: number,
    isChild: boolean,
    isNewbie: boolean,
    getBMI: () => number
  ) => {
    if (isNaN(ageNum)) return;

    // SPECIAL RULE: CHILDREN < 16 (Chapter 29)
    if (isChild) {
      setResult({
        mafHeartRate: 0,
        upperZone: 0,
        lowerZone: 0,
        notes: [],
        explanation: undefined,
        scheduleTitle: 'HƯỚNG DẪN CHO TRẺ EM',
        schedule: [
          {
            day: 'Hằng ngày',
            activity: 'VUI CHƠI TỰ NHIÊN - Không theo lịch trình cố định',
            duration: 0,
            type: 'REST',
          },
        ],
        mindset:
          'Trẻ em dưới 16 tuổi KHÔNG NÊN tập luyện theo kế hoạch tập luyện có cấu trúc. Thay vào đó, hãy khuyến khích trẻ VUI CHƠI tự nhiên: chạy nhảy, bơi lội, đạp xe, chơi thể thao với bạn bè. Để cơ thể phát triển tự nhiên qua vận động vui vẻ!',
        bmi: 0,
        bmiCategory: 'Trẻ em',
      });
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    const bmi = getBMI();
    if (bmi === 0) {
      alert('Vui lòng kiểm tra lại Chiều cao và Cân nặng!');
      return;
    }

    let maf = 180 - ageNum;
    const notes: string[] = [];
    const isObese = bmi >= 30;

    // --- DETERMINE EFFECTIVE PACE & EXPLANATION ---
    const hasVerifiedPace = verifiedMafPace && verifiedMafPace.trim() !== '';
    let effectivePace = hasVerifiedPace ? verifiedMafPace! : '10:00';
    let explanation = '';
    let bmiCategory = 'Bình thường';

    if (!hasVerifiedPace) {
      if (bmi >= 30) {
        effectivePace = '18:00';
        bmiCategory = 'Béo phì';
        explanation = `💡 HỆ THỐNG TỰ ĐỘNG TÍNH TOÁN:\nVì bạn chưa có kết quả Test, chúng tôi đã chọn Pace ${effectivePace} min/km (Đi bộ) dựa trên chỉ số BMI ${bmi} của bạn để đảm bảo an toàn xương khớp.`;
      } else if (bmi >= 25) {
        effectivePace = '14:00';
        bmiCategory = 'Thừa cân';
        explanation = `💡 HỆ THỐNG TỰ ĐỘNG TÍNH TOÁN:\nVì bạn chưa có kết quả Test, chúng tôi đã chọn Pace ${effectivePace} min/km (Đi bộ nhanh) dựa trên chỉ số BMI ${bmi} của bạn để giảm tải cho tim.`;
      } else {
        effectivePace = '10:00';
        bmiCategory = bmi < 18.5 ? 'Thiếu cân' : 'Bình thường';
        explanation = `ℹ️ HỆ THỐNG TỰ ĐỘNG:\nSử dụng Pace mặc định an toàn ${effectivePace} min/km cho thể trạng bình thường.`;
      }
    } else {
      if (bmi >= 30) bmiCategory = 'Béo phì';
      else if (bmi >= 25) bmiCategory = 'Thừa cân';
      else if (bmi < 18.5) bmiCategory = 'Thiếu cân';
    }

    // --- MAF HEART RATE CALCULATION ---
    if (userProfile.isRecovering) {
      maf -= 10;
      notes.push('Đã trừ 10 nhịp (Đang hồi phục bệnh/phẫu thuật)');
    }
    if (userProfile.isMedicatedOrInjured) {
      maf -= 5;
      notes.push('Đã trừ 5 nhịp (Dùng thuốc/Chấn thương)');
    }
    // PROBATION MODE: Keep -10 adjustment for heart rate safety
    if (userProfile.isProbation) {
      maf -= 10;
      notes.push('🛡️ CHẾ ĐỘ THỬ THÁCH: Đã trừ 10 nhịp để bảo vệ an toàn tuyệt đối');
    }
    const expOption = EXPERIENCE_OPTIONS.find((opt) => opt.value === userProfile.experience);
    if (expOption) {
      if (expOption.score !== 0) {
        maf += expOption.score;
        const action = expOption.score > 0 ? 'cộng' : 'trừ';
        notes.push(`Đã ${action} ${Math.abs(expOption.score)} nhịp (${expOption.label})`);
      }
      if (userProfile.experience === ExperienceLevel.INCONSISTENT) {
        notes.push(
          'CẢNH BÁO: Đã điều chỉnh giảm 5 nhịp để xây lại nền tảng hiếu khí do tim cao/ngắt quãng.'
        );
      }
    }

    const lowerZone = maf - 10;
    let mindset = '';
    if (
      userProfile.experience === ExperienceLevel.NONE ||
      userProfile.experience === ExperienceLevel.REGULAR_NEW
    ) {
      mindset =
        'Hãy bắt đầu thật chậm. Nếu nhịp tim vượt quá MAF, hãy đi bộ ngay lập tức. Đừng lo lắng về tốc độ (Pace), hãy tập trung vào nhịp tim.';
    } else {
      mindset =
        'Bỏ lại cái tôi ở nhà. Chạy chậm để chạy nhanh hơn. Bạn sẽ cảm thấy như đang chạy quá chậm, nhưng hãy tin tưởng vào quá trình sinh lý học.';
    }
    if (ageNum > 60 && userProfile.experience === ExperienceLevel.ADVANCED) {
      mindset = `Tuyệt vời! Bác là tấm gương cho thế hệ trẻ. Hãy tận hưởng kế hoạch tập luyện an toàn này. ${mindset}`;
    }

    // --- GENERATE SCHEDULE ---
    let finalSchedule = getWeeklySchedule(userProfile.commitment);
    finalSchedule = adjustScheduleForSafety(finalSchedule, userProfile, bmi);

    // --- PACE COMPARISON & VOLUME ADJUSTMENT (MAF Test Logic) ---
    let volumeAdjustmentMessage: string | undefined;
    let volumeAdjustmentType: 'PROGRESS' | 'REGRESSION' | 'STABLE' | undefined;

    const hasPreviousPace = userProfile.previousMonthPace && userProfile.previousMonthPace.trim() !== '';
    const hasCurrentPace = verifiedMafPace && verifiedMafPace.trim() !== '';

    if (hasCurrentPace && hasPreviousPace) {
      const currentPaceSeconds = parsePaceToSeconds(verifiedMafPace!);
      const previousPaceSeconds = parsePaceToSeconds(userProfile.previousMonthPace!);

      if (currentPaceSeconds > 0 && previousPaceSeconds > 0) {
        const delta = currentPaceSeconds - previousPaceSeconds;

        if (delta < -10) {
          volumeAdjustmentType = 'PROGRESS';
          const improvement = Math.abs(delta);
          volumeAdjustmentMessage = `📈 PHÁT HIỆN TIẾN BỘ: Pace của bạn nhanh hơn ${improvement}s/km so với tháng trước! Hệ thống đã tăng thời gian bài chạy dài (Long Run) thêm 10% để tối ưu hóa nền tảng hiếu khí.`;

          const longRunIndex = finalSchedule.findIndex((s) => s.type === 'LONG_RUN');
          if (longRunIndex !== -1) {
            const originalDuration = finalSchedule[longRunIndex].duration;
            const newDuration = Math.round(originalDuration * 1.1);
            let cappedDuration = newDuration;
            if (ageNum >= 60 && cappedDuration > 90) cappedDuration = 90;
            if (isNewbie && cappedDuration > 60) cappedDuration = 60;
            finalSchedule[longRunIndex] = { ...finalSchedule[longRunIndex], duration: cappedDuration };
          }
        } else if (delta > 10) {
          volumeAdjustmentType = 'REGRESSION';
          const decline = Math.abs(delta);
          volumeAdjustmentMessage = `📉 CẢNH BÁO SỨC KHỎE: Pace của bạn chậm hơn ${decline}s/km so với tháng trước. Hệ thống đã kích hoạt CHẾ ĐỘ HỒI PHỤC - Giảm 30% khối lượng tập toàn bộ tuần để ngăn ngừa quá tải và phục hồi sức khỏe.`;

          finalSchedule = finalSchedule.map((item) => {
            if (item.duration > 0) {
              const newDuration = Math.round(item.duration * 0.7);
              const minDuration = item.type === 'REST' ? 0 : Math.max(newDuration, 15);
              return { ...item, duration: minDuration };
            }
            return item;
          });
        } else {
          volumeAdjustmentType = 'STABLE';
          volumeAdjustmentMessage = `✅ ỔN ĐỊNH: Pace của bạn duy trì ổn định so với tháng trước (chênh lệch ${Math.abs(delta)}s). Hệ thống giữ nguyên lịch tập chuẩn.`;
        }
      }
    }

    // SYNC: Global replacement of "Run" with "Walk" if BMI >= 30
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

    // APPLY PROBATION MODE: 70% volume reduction
    if (userProfile.isProbation) {
      finalSchedule = adjustForProbation(finalSchedule);
    }

    // --- SMART LONG RUN CALCULATION (History-based) ---
    let longRunAdjustmentMessage: string | undefined;
    let longRunAdjustmentType: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP' | undefined;

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
      longRunAdjustmentMessage = smartResult.message;
      longRunAdjustmentType = smartResult.adjustmentType;
    }

    // --- ENFORCE WEEKLY VOLUME CAP ---
    if (!userProfile.isProbation) {
      const volumeCapResult = enforceWeeklyVolumeCap(finalSchedule, userProfile.commitment);
      finalSchedule = volumeCapResult.adjustedSchedule;
      if (volumeCapResult.wasReduced && volumeCapResult.reductionMessage) {
        notes.push(volumeCapResult.reductionMessage);
      }
    }

    // Apply The 15/15 Rule
    finalSchedule = finalSchedule.map((item) => {
      if (
        item.type === 'RUN' ||
        item.type === 'LONG_RUN' ||
        item.type === 'CROSS_TRAIN' ||
        item.type === 'WALK' ||
        item.type === 'RECOVERY'
      ) {
        const structuredDetails = formatSessionDetails(item.duration, maf, item.type);
        return { ...item, activity: `${item.activity}\n${structuredDetails}` };
      }
      return item;
    });

    // --- NOTES & WARNINGS ---
    const paceSeconds = parsePaceToSeconds(effectivePace);

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

    setResult({
      mafHeartRate: maf,
      upperZone: maf,
      lowerZone: lowerZone,
      notes,
      explanation: !hasVerifiedPace ? explanation : undefined,
      volumeAdjustmentMessage,
      volumeAdjustmentType,
      longRunAdjustmentMessage,
      longRunAdjustmentType,
      scheduleTitle: `LỊCH TẬP ${
        userProfile.commitment === CommitmentLevel.HEALTH
          ? 'DUY TRÌ'
          : userProfile.commitment === CommitmentLevel.BASE
          ? 'NỀN TẢNG'
          : 'HIỆU SUẤT'
      }`,
      schedule: finalSchedule,
      mindset,
      bmi: bmi,
      bmiCategory,
    });

    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return {
    result,
    resultRef,
    calculateRawMaf,
    calculateMAF,
    getVolumeCapText,
    parsePaceToSeconds,
  };
}
