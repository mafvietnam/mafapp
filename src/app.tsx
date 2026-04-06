import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useUserProfile } from './hooks/use-user-profile';
import { useMafCalculator } from './hooks/use-maf-calculator';
import { useProbationAutoUnlock } from './hooks/use-probation';
import AppHeader from './components/app-header';
import AppFooter from './components/app-footer';
import TabNavigation from './components/tab-navigation';
import UserInputForm from './components/user-input-form';
import ResultDisplay from './components/result-display';
import { MafLab } from './components/maf-lab';
import WelcomeModal from './components/welcome-modal';
import RecoveryModal from './components/recovery-modal';
import GuidePage from './pages/guide-page';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PLAN' | 'LAB'>('PLAN');
  const [verifiedMafPace, setVerifiedMafPace] = useState<string | null>(null);

  const {
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
  } = useUserProfile();

  const { result, resultRef, calculateRawMaf, calculateMAF, getVolumeCapText } =
    useMafCalculator();

  // Auto-unlock probation after 14 days
  useProbationAutoUnlock(userProfile, setUserProfile);

  const handleLabComplete = (pace: string) => {
    setVerifiedMafPace(pace);
    setActiveTab('PLAN');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCalculate = () => {
    calculateMAF(userProfile, verifiedMafPace, ageNum, isChild, isNewbie, getBMI);
  };

  const mainApp = (
    <>
      <WelcomeModal />
      <RecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        onConfirm={handleRecoveryConfirm}
      />

      <div className="min-h-screen pb-20 bg-gray-50 font-sans">
        <AppHeader />

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="max-w-7xl mx-auto px-4 mt-8">
          {activeTab === 'LAB' && (
            <MafLab onComplete={handleLabComplete} targetMafHr={calculateRawMaf(userProfile)} />
          )}

          {activeTab === 'PLAN' && (
            <div className="space-y-10">
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

        <AppFooter />
      </div>
    </>
  );

  return (
    <Routes>
      <Route path="/" element={mainApp} />
      <Route path="/guide" element={<GuidePage />} />
    </Routes>
  );
};

export default App;
