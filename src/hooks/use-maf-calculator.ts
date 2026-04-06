import { useState, useRef } from 'react';
import { UserProfile, MafResult, CommitmentLevel } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';
import { VOLUME_CAPS } from '../utils/maf-logic';
import {
  calculateMAF as calculateMAFPure,
  parsePaceToSeconds,
} from '../utils/maf-calculator-orchestrator';

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

    // Children short-circuit — no BMI needed
    if (isChild) {
      const childResult = calculateMAFPure({ userProfile, verifiedMafPace, ageNum, isChild, isNewbie, bmi: 0 });
      if (childResult) {
        setResult(childResult);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      return;
    }

    const bmi = getBMI();
    if (bmi === 0) {
      alert('Vui lòng kiểm tra lại Chiều cao và Cân nặng!');
      return;
    }

    const mafResult = calculateMAFPure({ userProfile, verifiedMafPace, ageNum, isChild, isNewbie, bmi });
    if (mafResult) {
      setResult(mafResult);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
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
