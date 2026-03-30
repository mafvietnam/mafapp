import { useState, useEffect } from 'react';
import { UserProfile, ExperienceLevel, CommitmentLevel } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';

export interface UseUserProfileReturn {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  showRecoveryModal: boolean;
  setShowRecoveryModal: (v: boolean) => void;
  ageNum: number;
  isSenior: boolean;
  isChild: boolean;
  isNewbie: boolean;
  getBMI: () => number;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCommitmentSelect: (level: CommitmentLevel) => void;
  handleRecoveryConfirm: () => void;
}

export function useUserProfile(): UseUserProfileReturn {
  const [userProfile, setUserProfile] = useState<UserProfile>({
    age: '',
    height: '',
    weight: '',
    experience: ExperienceLevel.NONE,
    isRecovering: false,
    isMedicatedOrInjured: false,
    isMedicalClearanceConfirmed: false,
    commitment: CommitmentLevel.BASE,
    previousMonthPace: '',
  });

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const ageNum = parseInt(userProfile.age);
  const isSenior = !isNaN(ageNum) && ageNum >= 60;
  const isChild = !isNaN(ageNum) && ageNum > 0 && ageNum < 16;
  const isNewbie = userProfile.experience === ExperienceLevel.NONE;

  const getBMI = (): number => {
    const h = parseFloat(userProfile.height);
    const w = parseFloat(userProfile.weight);
    if (!isNaN(h) && !isNaN(w) && h > 0) {
      const bmiValue = w / Math.pow(h / 100, 2);
      if (bmiValue > 100) return 0;
      return parseFloat(bmiValue.toFixed(1));
    }
    return 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserProfile((prev) => {
      let newCommitment = prev.commitment;
      if (name === 'experience') {
        if (
          (value === ExperienceLevel.NONE || value === ExperienceLevel.INCONSISTENT) &&
          prev.commitment === CommitmentLevel.PERFORMANCE
        ) {
          newCommitment = CommitmentLevel.BASE;
        }
      }
      return { ...prev, [name]: value, commitment: newCommitment };
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return;
    let newVal = numVal;
    if (name === 'age') {
      if (numVal > 120) newVal = 120;
      if (numVal < 1) newVal = 1;
    }
    if (name === 'height') {
      if (numVal < 100) newVal = 100;
      if (numVal > 250) newVal = 250;
    }
    if (name === 'weight') {
      if (numVal < 30) newVal = 30;
      if (numVal > 200) newVal = 200;
    }
    if (newVal !== numVal) {
      setUserProfile((prev) => ({ ...prev, [name]: newVal.toString() }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setUserProfile((prev) => {
      let newCommitment = prev.commitment;
      const nextState = { ...prev, [name]: checked };
      if (name === 'isRecovering' && checked) newCommitment = CommitmentLevel.HEALTH;
      if (name === 'isMedicatedOrInjured' && checked && !prev.isRecovering) {
        if (prev.commitment === CommitmentLevel.PERFORMANCE) newCommitment = CommitmentLevel.HEALTH;
      }
      return { ...nextState, commitment: newCommitment };
    });
  };

  const handleCommitmentSelect = (level: CommitmentLevel) => {
    if (
      userProfile.isRecovering &&
      (level === CommitmentLevel.BASE || level === CommitmentLevel.PERFORMANCE)
    )
      return;
    const bmi = getBMI();
    const isObese = bmi >= 30;
    if ((userProfile.isMedicatedOrInjured || isObese) && level === CommitmentLevel.PERFORMANCE)
      return;
    if (!isNaN(ageNum) && ageNum >= 60) {
      if (level === CommitmentLevel.PERFORMANCE) return;
      if (level === CommitmentLevel.BASE && !userProfile.isMedicalClearanceConfirmed) return;
    }
    if (
      (userProfile.experience === ExperienceLevel.NONE ||
        userProfile.experience === ExperienceLevel.INCONSISTENT) &&
      level === CommitmentLevel.PERFORMANCE
    )
      return;
    setUserProfile((prev) => ({ ...prev, commitment: level }));
  };

  const handleRecoveryConfirm = () => {
    setUserProfile((prev) => ({
      ...prev,
      isProbation: true,
      probationStartDate: new Date().toISOString(),
      isRecovering: false,
      isMedicatedOrInjured: false,
    }));
    setShowRecoveryModal(false);
  };

  // --- SAFETY EFFECT: auto-adjust commitment for seniors ---
  useEffect(() => {
    if (isNaN(ageNum)) return;
    if (userProfile.isRecovering || userProfile.isMedicatedOrInjured) return;
    if (ageNum >= 60) {
      if (!userProfile.isMedicalClearanceConfirmed) {
        if (
          userProfile.commitment === CommitmentLevel.BASE ||
          userProfile.commitment === CommitmentLevel.PERFORMANCE
        ) {
          setUserProfile((prev) => ({ ...prev, commitment: CommitmentLevel.HEALTH }));
        }
      } else if (userProfile.isMedicalClearanceConfirmed) {
        if (userProfile.commitment === CommitmentLevel.PERFORMANCE) {
          setUserProfile((prev) => ({ ...prev, commitment: CommitmentLevel.BASE }));
        }
      }
    }
  }, [
    userProfile.age,
    userProfile.isMedicalClearanceConfirmed,
    userProfile.isRecovering,
    userProfile.isMedicatedOrInjured,
    userProfile.commitment,
    ageNum,
  ]);

  return {
    userProfile,
    setUserProfile,
    showRecoveryModal,
    setShowRecoveryModal,
    ageNum,
    isSenior,
    isChild,
    isNewbie,
    getBMI,
    handleInputChange,
    handleBlur,
    handleCheckboxChange,
    handleCommitmentSelect,
    handleRecoveryConfirm,
  };
}
