import React from 'react';
import { UserProfile } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';

interface FormPersonalInfoProps {
  userProfile: UserProfile;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const inputClass = 'w-full p-3 text-lg bg-[#1F2937] border border-white/10 rounded-lg focus:border-maf-violet outline-none text-white placeholder-white/30';

const FormPersonalInfo: React.FC<FormPersonalInfoProps> = ({
  userProfile,
  onInputChange,
  onBlur,
}) => (
  <div className="space-y-6">
    <h2 className="text-xl font-bold text-white flex items-center">
      <span className="w-8 h-8 rounded-full bg-maf-violet/20 text-maf-violet flex items-center justify-center mr-3 text-base font-bold">
        1
      </span>
      Thông tin Cá nhân
    </h2>

    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tuổi</label>
        <input type="number" name="age" value={userProfile.age} onChange={onInputChange} onBlur={onBlur} className={inputClass} placeholder="30" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cao (cm)</label>
        <input type="number" name="height" value={userProfile.height} onChange={onInputChange} onBlur={onBlur} className={inputClass} placeholder="170" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nặng (kg)</label>
        <input type="number" name="weight" value={userProfile.weight} onChange={onInputChange} onBlur={onBlur} className={inputClass} placeholder="65" />
      </div>
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kinh nghiệm</label>
      <select name="experience" value={userProfile.experience} onChange={onInputChange} className={`${inputClass} appearance-none cursor-pointer`}>
        {EXPERIENCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  </div>
);

export default FormPersonalInfo;
