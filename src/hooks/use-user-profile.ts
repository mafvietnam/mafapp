import { useState, useEffect } from 'react';
import { UserProfile, ExperienceLevel, CommitmentLevel, HealthCondition } from '../types';
import { getProfile, type ServerProfile } from '../services/profile-service';

export interface UseUserProfileReturn {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  profileLoading: boolean;
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

/** Map server profile (numbers) to client profile (strings for form inputs) */
function mapServerToClient(s: ServerProfile): UserProfile {
  return {
    age: s.age ? String(s.age) : '',
    height: s.height ? String(s.height) : '',
    weight: s.weight ? String(s.weight) : '',
    experience: (s.experience as ExperienceLevel) || ExperienceLevel.NONE,
    isRecovering: s.isRecovering ?? false,
    isMedicatedOrInjured: s.isMedicatedOrInjured ?? false,
    isMedicalClearanceConfirmed: s.isMedicalClearanceConfirmed ?? false,
    commitment: (s.commitment as CommitmentLevel) || CommitmentLevel.BASE,
    previousMonthPace: s.previousMonthPace ?? '',
    isProbation: s.isProbation ?? false,
    probationStartDate: s.probationStartDate ?? undefined,
    lastLongRunDuration: s.lastLongRunDuration ?? undefined,
    lastLongRunHeartRate: s.lastLongRunHeartRate ?? undefined,
    lastLongRunFeeling: (s.lastLongRunFeeling as UserProfile['lastLongRunFeeling']) ?? undefined,
    // Phase 3 — health-condition screening. Booleans mirror the persisted audit
    // timestamps (!!x) so a subsequent save naturally re-sends "still consented/
    // cleared" without the user re-ticking anything — profile.service.ts
    // preserves (never re-stamps) an already-set healthConsentAt/clearedAt.
    healthConditions: (s.healthConditions ?? []) as HealthCondition[],
    healthScreenedAt: s.healthScreenedAt ?? undefined,
    healthConsentGiven: !!s.healthConsentAt,
    healthConsentAt: s.healthConsentAt ?? undefined,
    healthClearanceConfirmed: !!s.clearedAt,
    clearedAt: s.clearedAt ?? undefined,
    clearedBy: s.clearedBy ?? undefined,
  };
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
  const [profileLoading, setProfileLoading] = useState(true);

  // Load saved profile from server on mount
  useEffect(() => {
    getProfile()
      .then((server) => {
        if (server) {
          setUserProfile(mapServerToClient(server));
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

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

  // Adjust commitment level for seniors (>= 60) based on health state
  const adjustCommitmentForSenior = (profile: UserProfile): CommitmentLevel => {
    const age = parseInt(profile.age);
    if (isNaN(age) || age < 60) return profile.commitment;
    if (profile.isRecovering || profile.isMedicatedOrInjured) return profile.commitment;
    if (!profile.isMedicalClearanceConfirmed) {
      if (profile.commitment === CommitmentLevel.BASE || profile.commitment === CommitmentLevel.PERFORMANCE) {
        return CommitmentLevel.HEALTH;
      }
    } else if (profile.commitment === CommitmentLevel.PERFORMANCE) {
      return CommitmentLevel.BASE;
    }
    return profile.commitment;
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
      const updated = { ...prev, [name]: value, commitment: newCommitment };
      // Auto-adjust commitment when age changes to/from senior range
      if (name === 'age') {
        updated.commitment = adjustCommitmentForSenior(updated);
      }
      return updated;
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
      setUserProfile((prev) => {
        const updated = { ...prev, [name]: newVal.toString() };
        if (name === 'age') updated.commitment = adjustCommitmentForSenior(updated);
        return updated;
      });
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
      const updated = { ...nextState, commitment: newCommitment };
      // Auto-adjust commitment for senior health checkbox changes
      if (name === 'isMedicalClearanceConfirmed' || name === 'isRecovering' || name === 'isMedicatedOrInjured') {
        updated.commitment = adjustCommitmentForSenior(updated);
      }
      return updated;
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
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        isProbation: true,
        probationStartDate: new Date().toISOString(),
        isRecovering: false,
        isMedicatedOrInjured: false,
      };
      updated.commitment = adjustCommitmentForSenior(updated);
      return updated;
    });
    setShowRecoveryModal(false);
  };

  return {
    userProfile,
    setUserProfile,
    profileLoading,
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
