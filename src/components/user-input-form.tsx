import React from 'react';
import { UserProfile, ExperienceLevel, CommitmentLevel } from '../types';
import { EXPERIENCE_OPTIONS } from '../constants';
import { CommitmentSelector } from './commitment-selector';
import { ShieldCheck, Leaf, Timer } from 'lucide-react';

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
}) => {
  const showLongRunHistory =
    userProfile.experience === ExperienceLevel.REGULAR_NEW ||
    userProfile.experience === ExperienceLevel.ADVANCED;

  return (
    <section className="bg-white rounded-2xl shadow-lg p-8 md:p-10 animate-fade-in border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* LEFT: Personal Info */}
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

        {/* RIGHT: Health */}
        <div className="space-y-8">
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

          {isNewbie ? (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3">
              <Leaf className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
              <p className="text-base text-emerald-800">
                Giai đoạn này chỉ cần quan tâm đến <strong>Thời gian</strong> và{' '}
                <strong>Nhịp tim</strong>. Chạy thật chậm!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current MAF Pace */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  verifiedMafPace ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
                  Pace MAF Hiện tại
                </label>
                {verifiedMafPace ? (
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-bold text-green-700">
                      {verifiedMafPace} /km
                    </span>
                    <button onClick={onGoToLab} className="text-sm text-gray-500 underline">
                      Test lại
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-400 italic">Chưa có dữ liệu</span>
                    <button
                      onClick={onGoToLab}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Nhập Test
                    </button>
                  </div>
                )}
              </div>

              {/* Previous Month Pace */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">
                  Pace MAF Tháng Trước{' '}
                  <span className="text-gray-400 text-xs normal-case">(Không bắt buộc)</span>
                </label>
                <input
                  type="text"
                  name="previousMonthPace"
                  value={userProfile.previousMonthPace || ''}
                  onChange={onInputChange}
                  className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                  placeholder="VD: 6:30 hoặc 6.5"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Nhập pace tháng trước để hệ thống điều chỉnh khối lượng tập
                </p>
              </div>

              {/* Long Run History */}
              {showLongRunHistory && (
                <div className="p-4 rounded-xl border border-orange-200 bg-orange-50">
                  <div className="flex items-center mb-3">
                    <Timer className="w-5 h-5 text-orange-600 mr-2" />
                    <label className="text-sm font-bold text-orange-800 uppercase">
                      Dữ liệu Long Run gần nhất
                    </label>
                  </div>
                  <p className="text-xs text-orange-700 mb-4">
                    Nhập dữ liệu từ bài Long Run gần nhất để hệ thống tính toán thông minh
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-orange-900 mb-1">
                        Thời gian (phút)
                      </label>
                      <input
                        type="number"
                        name="lastLongRunDuration"
                        value={userProfile.lastLongRunDuration || ''}
                        onChange={(e) =>
                          onLongRunDurationChange(
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                        className="w-full p-2 text-base border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                        placeholder="90"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-900 mb-1">
                        Nhịp tim TB (bpm)
                      </label>
                      <input
                        type="number"
                        name="lastLongRunHeartRate"
                        value={userProfile.lastLongRunHeartRate || ''}
                        onChange={(e) =>
                          onLongRunHeartRateChange(
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                        className="w-full p-2 text-base border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                        placeholder="145"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-orange-900 mb-1">
                        Cảm nhận
                      </label>
                      <select
                        name="lastLongRunFeeling"
                        value={userProfile.lastLongRunFeeling || ''}
                        onChange={(e) =>
                          onLongRunFeelingChange(
                            (e.target.value as 'GOOD' | 'TIRED' | 'VERY_TIRED') || undefined
                          )
                        }
                        className="w-full p-2 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                      >
                        <option value="">-- Chọn --</option>
                        <option value="GOOD">😊 Tốt</option>
                        <option value="TIRED">😰 Hơi mệt</option>
                        <option value="VERY_TIRED">😫 Rất mệt</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
};

export default UserInputForm;
