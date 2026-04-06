import React from 'react';
import { UserProfile } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';

interface FormPersonalInfoProps {
  userProfile: UserProfile;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const FormPersonalInfo: React.FC<FormPersonalInfoProps> = ({
  userProfile,
  onInputChange,
  onBlur,
}) => (
  <div className="space-y-8">
    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3 text-base">
        1
      </span>
      Thông tin Cá nhân
    </h2>

    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-1">
        <label className="block text-base font-medium text-gray-900 mb-2">Tuổi</label>
        <input
          type="number"
          name="age"
          value={userProfile.age}
          onChange={onInputChange}
          onBlur={onBlur}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="30"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-base font-medium text-gray-900 mb-2">Cao (cm)</label>
        <input
          type="number"
          name="height"
          value={userProfile.height}
          onChange={onInputChange}
          onBlur={onBlur}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="170"
        />
      </div>
      <div className="col-span-1">
        <label className="block text-base font-medium text-gray-900 mb-2">Nặng (kg)</label>
        <input
          type="number"
          name="weight"
          value={userProfile.weight}
          onChange={onInputChange}
          onBlur={onBlur}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="65"
        />
      </div>
    </div>

    <div>
      <label className="block text-base font-medium text-gray-900 mb-2">Kinh nghiệm</label>
      <select
        name="experience"
        value={userProfile.experience}
        onChange={onInputChange}
        className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
      >
        {EXPERIENCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export default FormPersonalInfo;
