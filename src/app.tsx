import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/auth-context';
import { useUserProfile } from './hooks/use-user-profile';
import { useMafCalculator } from './hooks/use-maf-calculator';
import { useProbationAutoUnlock } from './hooks/use-probation';
import { updateProfile } from './services/profile-service';
import TabNavigation from './components/tab-navigation';
import UserInputForm from './components/user-input-form';
import ResultDisplay from './components/result-display';
import { MafLab } from './components/maf-lab';
import WelcomeModal from './components/welcome-modal';
import RecoveryModal from './components/recovery-modal';
import GuidePage from './pages/guide-page';
import LoginPage from './pages/login-page';
import ProfilePage from './pages/profile-page';
import DashboardPage from './pages/dashboard-page';
import ProtectedRoute from './components/layout/protected-route';
import AppLayout from './components/layout/app-layout';

const CalculatorApp: React.FC = () => {
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

        <main className="max-w-7xl mx-auto px-4 mt-8">
          {profileLoading && (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-maf-violet border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!profileLoading && activeTab === 'LAB' && (
            <MafLab onComplete={handleLabComplete} targetMafHr={calculateRawMaf(userProfile)} />
          )}

          {!profileLoading && activeTab === 'PLAN' && (
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

      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Login page (public) */}
        <Route path="/login" element={<LoginPage />} />

        {/* All routes require authentication */}
        <Route element={<ProtectedRoute />}>
          {/* Root redirects to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* All pages inside dark theme layout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/plan" element={<CalculatorApp />} />
            <Route path="/guide" element={<GuidePage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
};

export default App;
