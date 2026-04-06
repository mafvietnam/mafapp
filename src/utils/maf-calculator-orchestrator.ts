import { UserProfile, MafResult, ExperienceLevel, CommitmentLevel } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';
import { formatSessionDetails } from './maf-logic';
import {
  buildAndAdjustSchedule,
  computeAdjustmentMessages,
  addPaceWarnings,
} from './maf-calculator-schedule-builder';

interface CalculateMAFParams {
  userProfile: UserProfile;
  verifiedMafPace: string | null;
  ageNum: number;
  isChild: boolean;
  isNewbie: boolean;
  bmi: number;
}

/**
 * Parse pace string (e.g. "6:30" or "6.5") to total seconds.
 */
export function parsePaceToSeconds(paceStr: string): number {
  if (!paceStr) return 0;
  if (!paceStr.includes(':')) {
    const val = parseFloat(paceStr);
    return isNaN(val) ? 0 : val * 60;
  }
  const parts = paceStr.split(':');
  const min = parseInt(parts[0]) || 0;
  const sec = parseInt(parts[1]) || 0;
  return min * 60 + sec;
}

/**
 * Pure function that computes the full MAF result.
 * No React state — returns a MafResult or null if inputs are invalid.
 */
export function calculateMAF(params: CalculateMAFParams): MafResult | null {
  const { userProfile, verifiedMafPace, ageNum, isChild, isNewbie, bmi } = params;

  if (isNaN(ageNum)) return null;

  // Children < 16 — simple short-circuit
  if (isChild) {
    return buildChildResult();
  }

  if (bmi === 0) return null;

  let maf = 180 - ageNum;
  const notes: string[] = [];
  const isObese = bmi >= 30;

  // Determine effective pace and explanation
  const { effectivePace, explanation, bmiCategory } = determinePaceAndBmi(verifiedMafPace, bmi);

  // Heart rate adjustments
  maf = applyHeartRateAdjustments(maf, userProfile, notes);

  const lowerZone = maf - 10;
  const mindset = buildMindset(userProfile, ageNum);

  // Generate and adjust schedule
  let finalSchedule = buildAndAdjustSchedule(
    userProfile, bmi, maf, ageNum, isNewbie, verifiedMafPace, notes
  );

  // Apply 15/15 rule — format session details
  finalSchedule = finalSchedule.map((item) => {
    if (['RUN', 'LONG_RUN', 'CROSS_TRAIN', 'WALK', 'RECOVERY'].includes(item.type)) {
      const details = formatSessionDetails(item.duration, maf, item.type);
      return { ...item, activity: `${item.activity}\n${details}` };
    }
    return item;
  });

  // Pace-based warnings
  const paceSeconds = parsePaceToSeconds(effectivePace);
  addPaceWarnings(notes, finalSchedule, paceSeconds, ageNum, isNewbie, userProfile, isObese);

  // Volume/long-run adjustment messages
  const { volumeMsg, volumeType, longRunMsg, longRunType } = computeAdjustmentMessages(
    userProfile, verifiedMafPace, finalSchedule, maf, ageNum
  );

  const hasVerifiedPace = verifiedMafPace && verifiedMafPace.trim() !== '';

  return {
    mafHeartRate: maf,
    upperZone: maf,
    lowerZone,
    notes,
    explanation: !hasVerifiedPace ? explanation : undefined,
    volumeAdjustmentMessage: volumeMsg,
    volumeAdjustmentType: volumeType,
    longRunAdjustmentMessage: longRunMsg,
    longRunAdjustmentType: longRunType,
    scheduleTitle: buildScheduleTitle(userProfile.commitment),
    schedule: finalSchedule,
    mindset,
    bmi,
    bmiCategory,
  };
}

function buildChildResult(): MafResult {
  return {
    mafHeartRate: 0, upperZone: 0, lowerZone: 0, notes: [],
    explanation: undefined,
    scheduleTitle: 'HƯỚNG DẪN CHO TRẺ EM',
    schedule: [{ day: 'Hằng ngày', activity: 'VUI CHƠI TỰ NHIÊN - Không theo lịch trình cố định', duration: 0, type: 'REST' }],
    mindset: 'Trẻ em dưới 16 tuổi KHÔNG NÊN tập luyện theo kế hoạch tập luyện có cấu trúc. Thay vào đó, hãy khuyến khích trẻ VUI CHƠI tự nhiên: chạy nhảy, bơi lội, đạp xe, chơi thể thao với bạn bè. Để cơ thể phát triển tự nhiên qua vận động vui vẻ!',
    bmi: 0, bmiCategory: 'Trẻ em',
  };
}

function determinePaceAndBmi(verifiedMafPace: string | null, bmi: number) {
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

  return { effectivePace, explanation, bmiCategory };
}

function applyHeartRateAdjustments(maf: number, userProfile: UserProfile, notes: string[]): number {
  if (userProfile.isRecovering) {
    maf -= 10;
    notes.push('Đã trừ 10 nhịp (Đang hồi phục bệnh/phẫu thuật)');
  }
  if (userProfile.isMedicatedOrInjured) {
    maf -= 5;
    notes.push('Đã trừ 5 nhịp (Dùng thuốc/Chấn thương)');
  }
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
      notes.push('CẢNH BÁO: Đã điều chỉnh giảm 5 nhịp để xây lại nền tảng hiếu khí do tim cao/ngắt quãng.');
    }
  }
  return maf;
}

function buildMindset(userProfile: UserProfile, ageNum: number): string {
  let mindset: string;
  if (
    userProfile.experience === ExperienceLevel.NONE ||
    userProfile.experience === ExperienceLevel.REGULAR_NEW
  ) {
    mindset = 'Hãy bắt đầu thật chậm. Nếu nhịp tim vượt quá MAF, hãy đi bộ ngay lập tức. Đừng lo lắng về tốc độ (Pace), hãy tập trung vào nhịp tim.';
  } else {
    mindset = 'Bỏ lại cái tôi ở nhà. Chạy chậm để chạy nhanh hơn. Bạn sẽ cảm thấy như đang chạy quá chậm, nhưng hãy tin tưởng vào quá trình sinh lý học.';
  }
  if (ageNum > 60 && userProfile.experience === ExperienceLevel.ADVANCED) {
    mindset = `Tuyệt vời! Bác là tấm gương cho thế hệ trẻ. Hãy tận hưởng kế hoạch tập luyện an toàn này. ${mindset}`;
  }
  return mindset;
}

function buildScheduleTitle(commitment: CommitmentLevel): string {
  return `LỊCH TẬP ${
    commitment === CommitmentLevel.HEALTH
      ? 'DUY TRÌ'
      : commitment === CommitmentLevel.BASE
      ? 'NỀN TẢNG'
      : 'HIỆU SUẤT'
  }`;
}
