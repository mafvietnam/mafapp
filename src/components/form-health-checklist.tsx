import React from 'react';
import { UserProfile } from '../types';
import { ShieldCheck } from 'lucide-react';

interface FormHealthChecklistProps {
  userProfile: UserProfile;
  isSenior: boolean;
  onCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShowRecoveryModal: () => void;
}

const FormHealthChecklist: React.FC<FormHealthChecklistProps> = ({
  userProfile,
  isSenior,
  onCheckboxChange,
  onShowRecoveryModal,
}) => (
  <>
    <h2 className="text-xl font-bold text-white flex items-center">
      <span className="w-8 h-8 rounded-full bg-maf-violet/20 text-maf-violet flex items-center justify-center mr-3 text-base font-bold">
        2
      </span>
      Sức khỏe
    </h2>

    <div className="space-y-3">
      <label className="flex items-center space-x-3 cursor-pointer p-3 min-h-[44px] bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
        <input
          type="checkbox"
          name="isRecovering"
          checked={userProfile.isRecovering}
          onChange={onCheckboxChange}
          className="w-6 h-6 min-w-[24px] rounded accent-maf-red bg-[#1F2937] border-white/20"
        />
        <span className="text-base text-white">Đang hồi phục bệnh nặng (-10 nhịp)</span>
      </label>
      <label className="flex items-center space-x-3 cursor-pointer p-3 min-h-[44px] bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
        <input
          type="checkbox"
          name="isMedicatedOrInjured"
          checked={userProfile.isMedicatedOrInjured}
          onChange={onCheckboxChange}
          className="w-6 h-6 min-w-[24px] rounded accent-maf-red bg-[#1F2937] border-white/20"
        />
        <span className="text-base text-white">Dùng thuốc / Chấn thương (-5 nhịp)</span>
      </label>
      {isSenior && (
        <label className="flex items-center space-x-3 cursor-pointer p-3 min-h-[44px] bg-amber-500/10 rounded-lg border border-amber-500/30">
          <input
            type="checkbox"
            name="isMedicalClearanceConfirmed"
            checked={userProfile.isMedicalClearanceConfirmed}
            onChange={onCheckboxChange}
            className="w-6 h-6 min-w-[24px] rounded accent-amber-500 bg-[#1F2937] border-white/20"
          />
          <span className="text-base text-amber-400 font-bold">
            Xác nhận Y tế (trên 60 tuổi)
          </span>
        </label>
      )}
    </div>

    {(userProfile.isRecovering || userProfile.isMedicatedOrInjured) &&
      !userProfile.isProbation && (
        <div className="pt-4">
          <button
            onClick={onShowRecoveryModal}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Cập nhật Sức khỏe</span>
          </button>
        </div>
      )}
  </>
);

export default FormHealthChecklist;
