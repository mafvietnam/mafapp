import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/auth-context';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import { getProfile, updateProfile } from '../services/profile-service';
import type { ExperienceLevel, CommitmentLevel } from '../types';
import FormPersonalInfo from '../components/form-personal-info';
import FormHealthChecklist from '../components/form-health-checklist';
import { CommitmentSelector } from '../components/commitment-selector';

export default function ProfilePage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const {
    userProfile,
    setUserProfile,
    setShowRecoveryModal,
    isSenior,
    handleInputChange,
    handleBlur,
    handleCheckboxChange,
    handleCommitmentSelect,
  } = useUserProfile();

  // Fetch saved profile from server on mount
  useEffect(() => {
    getProfile().then((saved) => {
      if (saved) {
        setUserProfile((prev) => ({
          ...prev,
          age: String(saved.age),
          height: String(saved.height),
          weight: String(saved.weight),
          experience: saved.experience as ExperienceLevel,
          commitment: saved.commitment as CommitmentLevel,
          isRecovering: saved.isRecovering,
          isMedicatedOrInjured: saved.isMedicatedOrInjured,
          isMedicalClearanceConfirmed: saved.isMedicalClearanceConfirmed,
          previousMonthPace: saved.previousMonthPace ?? '',
          isProbation: saved.isProbation,
          probationStartDate: saved.probationStartDate ?? undefined,
          lastLongRunDuration: saved.lastLongRunDuration ?? undefined,
          lastLongRunHeartRate: saved.lastLongRunHeartRate ?? undefined,
          lastLongRunFeeling: (saved.lastLongRunFeeling as 'GOOD' | 'TIRED' | 'VERY_TIRED') ?? undefined,
        }));
      }
      setLoading(false);
    });
  }, [setUserProfile]);

  const { calculateRawMaf } = useMafCalculator();
  const mafHr = calculateRawMaf(userProfile);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    const ok = await updateProfile(userProfile);
    setSaving(false);
    setSaveMessage(ok ? 'Đã lưu thành công!' : 'Lưu thất bại, vui lòng thử lại.');
    if (ok) setTimeout(() => setSaveMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* User info header */}
      {user && (
        <div className="flex items-center gap-4 mb-8">
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full border-2 border-white/20"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
            <p className="text-white/60 text-sm">{user.email}</p>
          </div>
        </div>
      )}

      {/* MAF zone display */}
      {mafHr > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-white/60 text-xs uppercase tracking-wider font-bold mb-1">
            Vùng nhịp tim MAF
          </p>
          <p className="text-2xl font-black text-white">
            {mafHr - 10} – {mafHr}{' '}
            <span className="text-sm font-normal text-white/60">BPM</span>
          </p>
        </div>
      )}

      {/* Profile form */}
      <div className="space-y-6">
        <FormPersonalInfo
          userProfile={userProfile}
          onInputChange={handleInputChange}
          onBlur={handleBlur}
        />

        <FormHealthChecklist
          userProfile={userProfile}
          isSenior={isSenior}
          onCheckboxChange={handleCheckboxChange}
          onShowRecoveryModal={() => setShowRecoveryModal(true)}
        />

        <CommitmentSelector
          selected={userProfile.commitment}
          onSelect={handleCommitmentSelect}
          age={userProfile.age}
          height={userProfile.height}
          weight={userProfile.weight}
          experience={userProfile.experience}
          isRecovering={userProfile.isRecovering}
          isMedicatedOrInjured={userProfile.isMedicatedOrInjured}
          isMedicalClearanceConfirmed={userProfile.isMedicalClearanceConfirmed}
        />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-bold text-white
            bg-gradient-to-r from-[#F42A68] to-[#9130F8]
            hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>

        {saveMessage && (
          <p
            className={`text-center text-sm ${
              saveMessage.includes('thành công') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {saveMessage}
          </p>
        )}
      </div>
    </div>
  );
}
