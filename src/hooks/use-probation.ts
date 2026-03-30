import { useEffect } from 'react';
import { UserProfile } from '../types';

// Calculate how many days have passed since probation started (1-indexed)
export function calculateDaysSinceStart(probationStartDate: string | undefined): number {
  if (!probationStartDate) return 0;
  const start = new Date(probationStartDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Hook that auto-unlocks probation after 14 days
export function useProbationAutoUnlock(
  userProfile: UserProfile,
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>
): void {
  useEffect(() => {
    if (userProfile.isProbation && userProfile.probationStartDate) {
      const startDate = new Date(userProfile.probationStartDate);
      const now = new Date();
      const daysPassed = Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysPassed >= 14) {
        setUserProfile((prev) => ({
          ...prev,
          isProbation: false,
          probationStartDate: undefined,
        }));
        alert(
          '🎉 Chúc mừng! Bạn đã tốt nghiệp giai đoạn hồi phục!\n\nHãy bắt đầu xây dựng nền tảng thực sự.'
        );
      }
    }
  }, [userProfile.isProbation, userProfile.probationStartDate, setUserProfile]);
}
