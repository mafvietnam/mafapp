import React, { useState, useEffect, useRef } from 'react';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import { useProbationAutoUnlock } from '../hooks/use-probation';
import { updateProfile } from '../services/profile-service';
import TabNavigation from '../components/tab-navigation';
import UserInputForm from '../components/user-input-form';
import ResultDisplay from '../components/result-display';
import { MafLab } from '../components/maf-lab';
import WelcomeModal from '../components/welcome-modal';
import RecoveryModal from '../components/recovery-modal';

/** "/plan" route — MAF calculator form (PLAN tab) + MAF Lab pace test (LAB tab). */
const CalculatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PLAN' | 'LAB'>('PLAN');
  const [verifiedMafPace, setVerifiedMafPace] = useState<string | null>(null);

  const {
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
  } = useUserProfile();

  const { result, resultRef, calculateRawMaf, calculateMAF, getVolumeCapText } =
    useMafCalculator();

  useProbationAutoUnlock(userProfile, setUserProfile);

  // Auto-calculate on return if profile has valid data (age filled = user saved before)
  const autoCalcDone = useRef(false);
  useEffect(() => {
    if (!profileLoading && !autoCalcDone.current && userProfile.age) {
      autoCalcDone.current = true;
      calculateMAF(userProfile, verifiedMafPace, ageNum, isChild, isNewbie, getBMI);
    }
  }, [profileLoading]);

  const handleLabComplete = (pace: string) => {
    setVerifiedMafPace(pace);
    setActiveTab('PLAN');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCalculate = () => {
    calculateMAF(userProfile, verifiedMafPace, ageNum, isChild, isNewbie, getBMI);
    // Save profile to server in background (fire-and-forget)
    updateProfile(userProfile);
  };

  return (
    <>
      <WelcomeModal />
      <RecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onConfirm={handleRecoveryConfirm}
      />

      <div className="min-h-screen pb-20 font-sans">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="max-w-7xl mx-auto px-4 mt-6 md:mt-8">
          {profileLoading && (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-maf-violet border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!profileLoading && activeTab === 'LAB' && (
            <MafLab onComplete={handleLabComplete} targetMafHr={calculateRawMaf(userProfile)} />
          )}

          {!profileLoading && activeTab === 'PLAN' && (
            <div className="space-y-6 md:space-y-10">
              <UserInputForm
                userProfile={userProfile}
                isSenior={isSenior}
                isNewbie={isNewbie}
                verifiedMafPace={verifiedMafPace}
                onInputChange={handleInputChange}
                onBlur={handleBlur}
                onCheckboxChange={handleCheckboxChange}
                onCommitmentSelect={handleCommitmentSelect}
                onCalculate={handleCalculate}
                onShowRecoveryModal={() => setShowRecoveryModal(true)}
                onGoToLab={() => setActiveTab('LAB')}
                onLongRunDurationChange={(val) =>
                  setUserProfile((prev) => ({ ...prev, lastLongRunDuration: val }))
                }
                onLongRunHeartRateChange={(val) =>
                  setUserProfile((prev) => ({ ...prev, lastLongRunHeartRate: val }))
                }
                onLongRunFeelingChange={(val) =>
                  setUserProfile((prev) => ({ ...prev, lastLongRunFeeling: val }))
                }
              />

              {result && (
                <ResultDisplay
                  result={result}
                  userProfile={userProfile}
                  isChild={isChild}
                  ageNum={ageNum}
                  volumeCapText={getVolumeCapText(userProfile.commitment)}
                  resultRef={resultRef}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default CalculatorPage;
