/**
 * MAF Safety Adjustments — Chapter 6, 24 & 29
 * Probation period (post-injury) and safety rule adjustments by BMI/age/experience
 */

import { ExperienceLevel, ScheduleItem, UserProfile } from '../types';

// Chapter 24: Probation Period — reduce volume 30% after injury/illness (14-day protocol)
export const adjustForProbation = (schedule: ScheduleItem[]): ScheduleItem[] => {
  return schedule.map(item => {
    if (item.duration > 0) {
      const reducedDuration = Math.round(item.duration * 0.7); // Reduce 30%
      const minDuration = Math.max(reducedDuration, 15);       // Floor at 15 mins

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

// Chapter 6 & 29: Apply safety rules based on BMI, age, experience and recovery status
export const adjustScheduleForSafety = (
  schedule: ScheduleItem[],
  userProfile: UserProfile,
  bmi: number
): ScheduleItem[] => {
  let adjustedSchedule = [...schedule];
  const ageNum = parseInt(userProfile.age);

  // RULE 1: JOINT SAFETY (BMI >= 30) -> Low-impact only (walk/bike/swim)
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

  // RULE 2: NEWBIE SAFETY (Experience = None/Inconsistent) -> Max 60 min per session
  const isBeginner = userProfile.experience === ExperienceLevel.NONE ||
                     userProfile.experience === ExperienceLevel.INCONSISTENT;

  if (isBeginner) {
    const MAX_DURATION_NEWBIE = 60;
    adjustedSchedule = adjustedSchedule.map(item => {
      if (item.duration > MAX_DURATION_NEWBIE) {
        return { ...item, duration: MAX_DURATION_NEWBIE };
      }
      return item;
    });
  }

  // RULE 3: SENIOR RECOVERY (Age >= 60) -> Cap at 90 mins max per session
  if (ageNum >= 60) {
    const MAX_DURATION_SENIOR = 90;
    adjustedSchedule = adjustedSchedule.map(item => {
      if (item.duration > MAX_DURATION_SENIOR) {
        return { ...item, duration: MAX_DURATION_SENIOR };
      }
      return item;
    });
  }

  // RULE 4: RECOVERING -> Cap at 45 mins, convert runs to walk/easy run
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
