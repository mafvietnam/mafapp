export enum ExperienceLevel {
  NONE = 'NONE',
  INCONSISTENT = 'INCONSISTENT',
  REGULAR_NEW = 'REGULAR_NEW',
  ADVANCED = 'ADVANCED',
}

export enum CommitmentLevel {
  HEALTH = 'HEALTH',
  BASE = 'BASE',
  PERFORMANCE = 'PERFORMANCE',
}

export interface UserProfile {
  age: string;
  height: string;
  weight: string;
  experience: ExperienceLevel;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
  isMedicalClearanceConfirmed: boolean;
  commitment: CommitmentLevel;
  previousMonthPace?: string; // Optional: Pace from last month for volume adjustment
  isProbation?: boolean; // Đang trong giai đoạn thử thách sau chấn thương
  probationStartDate?: string; // Ngày bắt đầu giai đoạn thử thách (ISO date string)
  // Long Run History (Optional - for smart calculation)
  lastLongRunDuration?: number; // Thời gian Long Run gần nhất (phút)
  lastLongRunHeartRate?: number; // Nhịp tim trung bình của Long Run gần nhất (bpm)
  lastLongRunFeeling?: 'GOOD' | 'TIRED' | 'VERY_TIRED'; // Cảm nhận sau Long Run
}

export interface MafResult {
  mafHeartRate: number;
  lowerZone: number;
  upperZone: number;
  notes: string[];
  explanation?: string; // New field for transparency message
  volumeAdjustmentMessage?: string; // Message about schedule adjustment based on pace comparison
  volumeAdjustmentType?: 'PROGRESS' | 'REGRESSION' | 'STABLE'; // Type of adjustment for UI styling
  scheduleTitle: string;
  schedule: ScheduleItem[];
  mindset: string;
  bmi: number;
  bmiCategory: string;
  // Smart Long Run calculation result
  longRunAdjustmentMessage?: string; // Message explaining Long Run adjustment
  longRunAdjustmentType?: 'INCREASE' | 'MAINTAIN' | 'DECREASE' | 'CAP'; // Type for UI styling
}

export interface ScheduleItem {
  day: string;
  activity: string;
  duration: number;
  type: 'RUN' | 'LONG_RUN' | 'REST' | 'WALK' | 'CROSS_TRAIN' | 'RECOVERY';
}
