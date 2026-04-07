import React from 'react';
import { Activity, HeartPulse, Gauge } from 'lucide-react';
import GarminAutoFillBanner from './garmin-auto-fill-banner';

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
  garminSource?: { activityDate: string; avgHr: string } | null;
  onDismissGarmin?: () => void;
  stravaSource?: { activityDate: string; avgHr: string } | null;
  onDismissStrava?: () => void;
}

const inputBase = 'w-full p-4 text-xl bg-[#1F2937] border border-white/10 rounded-xl focus:border-maf-violet outline-none text-white font-medium placeholder-white/30';

export const MafLabStepDataEntry: React.FC<MafLabStepDataEntryProps> = ({
  distance, hours, minutes, seconds, avgHr,
  setDistance, setHours, setMinutes, setSeconds, setAvgHr,
  onProcess, onBack, targetMafHr,
  garminSource, onDismissGarmin,
  stravaSource, onDismissStrava,
}) => {
  const timeFields = [
    { value: hours, setter: setHours, placeholder: '00', label: 'Giờ' },
    { value: minutes, setter: setMinutes, placeholder: '30', label: 'Phút' },
    { value: seconds, setter: setSeconds, placeholder: '00', label: 'Giây' },
  ];

  return (
    <div className="desktop-card overflow-hidden border-t-2 border-maf-violet">
      <div className="p-8 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center">
          <Activity className="w-10 h-10 text-maf-violet mr-4" />
          <h3 className="text-2xl font-bold text-white uppercase">Nhập Dữ Liệu Thô</h3>
        </div>
        <div className="text-sm font-bold text-maf-violet bg-maf-violet/10 px-4 py-2 rounded-full border border-maf-violet/30">
          MAF Target: {targetMafHr ? `${targetMafHr} BPM` : 'N/A'}
        </div>
      </div>

      <div className="p-10 space-y-8">
        <div>
          <label className="block text-sm font-bold text-slate-500 uppercase mb-3">1. Tổng Cự ly đã chạy (Km)</label>
          <div className="relative">
            <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="VD: 5" className={inputBase} />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">KM</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-500 uppercase mb-3">2. Tổng Thời gian hoàn thành</label>
          <div className="flex space-x-4">
            {timeFields.map(({ value, setter, placeholder, label }) => (
              <div key={label} className="flex-1">
                <input type="number" placeholder={placeholder} value={value} onChange={(e) => setter(e.target.value)} className={`${inputBase} text-center`} />
                <span className="block text-center text-sm font-medium text-white/40 mt-2">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {stravaSource && onDismissStrava && (
            <GarminAutoFillBanner
              activityDate={stravaSource.activityDate}
              avgHr={stravaSource.avgHr}
              onDismiss={onDismissStrava}
              source="strava"
            />
          )}
          {garminSource && onDismissGarmin && (
            <GarminAutoFillBanner
              activityDate={garminSource.activityDate}
              avgHr={garminSource.avgHr}
              onDismiss={onDismissGarmin}
            />
          )}
          <label className="block text-sm font-bold text-slate-500 uppercase mb-3">3. Nhịp tim trung bình (Avg HR)</label>
          <div className="relative">
            <input type="number" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="VD: 142" className={`${inputBase} text-maf-red font-bold`} />
            <HeartPulse className="absolute right-5 top-1/2 -translate-y-1/2 text-maf-red/50 w-8 h-8" />
          </div>
          <p className="text-sm text-white/40 mt-2 italic">*Lấy số liệu từ đồng hồ hoặc app chạy bộ của bạn.</p>
        </div>
      </div>

      <div className="p-8 border-t border-white/10 flex justify-between items-center">
        <button onClick={onBack} className="px-8 py-3 rounded-full font-bold text-base text-white/60 hover:bg-white/10 transition-colors">
          Quay lại
        </button>
        <button onClick={onProcess} className="px-10 py-4 rounded-full font-bold text-lg bg-gradient-to-r from-maf-red to-maf-violet text-white shadow-[0_4px_15px_rgba(244,42,104,0.3)] hover:-translate-y-1 transition-all">
          TÍNH TOÁN &amp; THẨM ĐỊNH <Gauge className="inline-block ml-2 w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
