import React from 'react';
import { UserProfile, ExperienceLevel } from '../types';
import { Leaf, Timer } from 'lucide-react';

interface FormPaceAndLongRunProps {
  userProfile: UserProfile;
  isNewbie: boolean;
  verifiedMafPace: string | null;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onGoToLab: () => void;
  onLongRunDurationChange: (val: number | undefined) => void;
  onLongRunHeartRateChange: (val: number | undefined) => void;
  onLongRunFeelingChange: (val: 'GOOD' | 'TIRED' | 'VERY_TIRED' | undefined) => void;
}

const FormPaceAndLongRun: React.FC<FormPaceAndLongRunProps> = ({
  userProfile,
  isNewbie,
  verifiedMafPace,
  onInputChange,
  onGoToLab,
  onLongRunDurationChange,
  onLongRunHeartRateChange,
  onLongRunFeelingChange,
}) => {
  const showLongRunHistory =
    userProfile.experience === ExperienceLevel.REGULAR_NEW ||
    userProfile.experience === ExperienceLevel.ADVANCED;

  if (isNewbie) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3">
        <Leaf className="w-5 h-5 text-emerald-600 mt-1 flex-shrink-0" />
        <p className="text-base text-emerald-800">
          Giai đoạn này chỉ cần quan tâm đến <strong>Thời gian</strong> và{' '}
          <strong>Nhịp tim</strong>. Chạy thật chậm!
        </p>
      </div>
    );
  }

  return (
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
  );
};

export default FormPaceAndLongRun;
