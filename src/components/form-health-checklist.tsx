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
    <h2 className="text-xl font-bold text-gray-900 flex items-center">
      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-base">
        2
      </span>
      Sức khỏe
    </h2>

    <div className="space-y-3">
      <label className="flex items-center space-x-3 cursor-pointer p-3 min-h-[44px] bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition">
        <input
          type="checkbox"
          name="isRecovering"
          checked={userProfile.isRecovering}
          onChange={onCheckboxChange}
          className="w-6 h-6 min-w-[24px] text-purple-600 rounded focus:ring-purple-500"
        />
        <span className="text-base text-gray-800">Đang hồi phục bệnh nặng (-10 nhịp)</span>
      </label>
      <label className="flex items-center space-x-3 cursor-pointer p-3 min-h-[44px] bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition">
        <input
          type="checkbox"
          name="isMedicatedOrInjured"
          checked={userProfile.isMedicatedOrInjured}
          onChange={onCheckboxChange}
          className="w-6 h-6 min-w-[24px] text-purple-600 rounded focus:ring-purple-500"
        />
        <span className="text-base text-gray-800">Dùng thuốc / Chấn thương (-5 nhịp)</span>
      </label>
      {isSenior && (
        <label className="flex items-center space-x-3 cursor-pointer p-3 min-h-[44px] bg-amber-50 rounded-lg border border-amber-200">
          <input
            type="checkbox"
            name="isMedicalClearanceConfirmed"
            checked={userProfile.isMedicalClearanceConfirmed}
            onChange={onCheckboxChange}
            className="w-6 h-6 min-w-[24px] text-amber-600 rounded focus:ring-amber-500"
          />
          <span className="text-base text-amber-900 font-bold">
            Xác nhận Y tế (trên 60 tuổi)
          </span>
        </label>
      )}
    </div>

    {/* Health Re-evaluation Button */}
    {(userProfile.isRecovering || userProfile.isMedicatedOrInjured) &&
      !userProfile.isProbation && (
        <div className="pt-4">
          <button
            onClick={onShowRecoveryModal}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>🔄 Cập nhật Sức khỏe</span>
          </button>
        </div>
      )}
  </>
);

export default FormHealthChecklist;
