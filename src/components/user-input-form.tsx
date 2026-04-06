import React from 'react';
import { UserProfile, CommitmentLevel } from '../types';
import { CommitmentSelector } from './commitment-selector';
import FormPersonalInfo from './form-personal-info';
import FormHealthChecklist from './form-health-checklist';
import FormPaceAndLongRun from './form-pace-and-long-run';

interface UserInputFormProps {
  userProfile: UserProfile;
  isSenior: boolean;
  isNewbie: boolean;
  verifiedMafPace: string | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCommitmentSelect: (level: CommitmentLevel) => void;
  onCalculate: () => void;
  onShowRecoveryModal: () => void;
  onGoToLab: () => void;
  onLongRunDurationChange: (val: number | undefined) => void;
  onLongRunHeartRateChange: (val: number | undefined) => void;
  onLongRunFeelingChange: (val: 'GOOD' | 'TIRED' | 'VERY_TIRED' | undefined) => void;
}

const UserInputForm: React.FC<UserInputFormProps> = ({
  userProfile,
  isSenior,
  isNewbie,
  verifiedMafPace,
  onInputChange,
  onBlur,
  onCheckboxChange,
  onCommitmentSelect,
  onCalculate,
  onShowRecoveryModal,
  onGoToLab,
  onLongRunDurationChange,
  onLongRunHeartRateChange,
  onLongRunFeelingChange,
}) => (
  <section className="bg-white rounded-2xl shadow-lg p-8 md:p-10 animate-fade-in border border-gray-100">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* LEFT: Personal Info */}
      <FormPersonalInfo
        userProfile={userProfile}
        onInputChange={onInputChange}
        onBlur={onBlur}
      />

      {/* RIGHT: Health + Pace */}
      <div className="space-y-8">
        <FormHealthChecklist
          userProfile={userProfile}
          isSenior={isSenior}
          onCheckboxChange={onCheckboxChange}
          onShowRecoveryModal={onShowRecoveryModal}
        />

        <FormPaceAndLongRun
          userProfile={userProfile}
          isNewbie={isNewbie}
          verifiedMafPace={verifiedMafPace}
          onInputChange={onInputChange}
          onGoToLab={onGoToLab}
          onLongRunDurationChange={onLongRunDurationChange}
          onLongRunHeartRateChange={onLongRunHeartRateChange}
          onLongRunFeelingChange={onLongRunFeelingChange}
        />
      </div>
    </div>

    {/* Commitment Selector - Full Width */}
    <div className="w-full pt-8 mt-8 border-t border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 flex items-center mb-6">
        <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-base">
          3
        </span>
        Mức độ Cam kết
      </h2>
      <CommitmentSelector
        selected={userProfile.commitment}
        onSelect={onCommitmentSelect}
        age={userProfile.age}
        height={userProfile.height}
        weight={userProfile.weight}
        experience={userProfile.experience}
        isRecovering={userProfile.isRecovering}
        isMedicatedOrInjured={userProfile.isMedicatedOrInjured}
        isMedicalClearanceConfirmed={userProfile.isMedicalClearanceConfirmed}
      />
    </div>

    <div className="flex justify-center mt-8">
      <button
        onClick={onCalculate}
        className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-purple-700 to-pink-600 text-white font-bold text-xl rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
      >
        PHÂN TÍCH & LẬP KẾ HOẠCH
      </button>
    </div>
  </section>
);

export default UserInputForm;
