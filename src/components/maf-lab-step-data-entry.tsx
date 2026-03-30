import React from 'react';
import { Activity, HeartPulse, Gauge } from 'lucide-react';

interface MafLabStepDataEntryProps {
  distance: string;
  hours: string;
  minutes: string;
  seconds: string;
  avgHr: string;
  setDistance: (v: string) => void;
  setHours: (v: string) => void;
  setMinutes: (v: string) => void;
  setSeconds: (v: string) => void;
  setAvgHr: (v: string) => void;
  onProcess: () => void;
  onBack: () => void;
  targetMafHr: number | null;
}

export const MafLabStepDataEntry: React.FC<MafLabStepDataEntryProps> = ({
  distance, hours, minutes, seconds, avgHr,
  setDistance, setHours, setMinutes, setSeconds, setAvgHr,
  onProcess, onBack, targetMafHr,
}) => {
  const timeFields = [
    { value: hours, setter: setHours, placeholder: '00', label: 'Giờ' },
    { value: minutes, setter: setMinutes, placeholder: '30', label: 'Phút' },
    { value: seconds, setter: setSeconds, placeholder: '00', label: 'Giây' },
  ];
  const inputBase = 'w-full p-4 text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium';

  return (
    <div className="bg-white rounded-xl shadow-lg border-t-4 border-blue-500 overflow-hidden">
      <div className="bg-blue-50 p-8 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center">
          <Activity className="w-10 h-10 text-blue-600 mr-4" />
          <h3 className="text-2xl font-bold text-gray-900 uppercase">Nhập Dữ Liệu Thô</h3>
        </div>
        <div className="text-base font-bold text-blue-900 bg-blue-100 px-4 py-2 rounded-full shadow-sm">
          MAF Target: {targetMafHr ? `${targetMafHr} BPM` : 'N/A'}
        </div>
      </div>

      <div className="p-10 space-y-8">
        {/* Distance */}
        <div>
          <label className="block text-lg font-bold text-gray-800 uppercase mb-3">1. Tổng Cự ly đã chạy (Km)</label>
          <div className="relative">
            <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="VD: 5"
              className={`${inputBase} text-gray-900`} />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">KM</div>
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="block text-lg font-bold text-gray-800 uppercase mb-3">2. Tổng Thời gian hoàn thành</label>
          <div className="flex space-x-6">
            {timeFields.map(({ value, setter, placeholder, label }) => (
              <div key={label} className="flex-1">
                <input type="number" placeholder={placeholder} value={value} onChange={(e) => setter(e.target.value)}
                  className={`${inputBase} text-center text-gray-900`} />
                <span className="block text-center text-base font-medium text-gray-500 mt-2">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heart Rate */}
        <div>
          <label className="block text-lg font-bold text-gray-800 uppercase mb-3">3. Nhịp tim trung bình (Avg HR)</label>
          <div className="relative">
            <input type="number" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="VD: 142"
              className={`${inputBase} text-red-600 font-bold`} />
            <HeartPulse className="absolute right-5 top-1/2 -translate-y-1/2 text-red-400 w-8 h-8" />
          </div>
          <p className="text-base text-gray-500 mt-2 font-medium italic">*Lấy số liệu từ đồng hồ hoặc app chạy bộ của bạn.</p>
        </div>
      </div>

      <div className="p-8 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <button onClick={onBack} className="px-8 py-3 rounded-full font-bold text-lg text-gray-600 hover:bg-gray-200 transition-colors">
          Quay lại
        </button>
        <button onClick={onProcess} className="px-10 py-4 rounded-full font-bold text-xl bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all transform hover:-translate-y-1">
          TÍNH TOÁN &amp; THẨM ĐỊNH <Gauge className="inline-block ml-2 w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
