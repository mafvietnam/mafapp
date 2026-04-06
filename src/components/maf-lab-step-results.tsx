import React from 'react';
import { CheckCircle2, AlertTriangle, Save } from 'lucide-react';

interface MafLabStepResultsProps {
  calculatedPace: string;
  finalPace: string;
  isMafCompliant: boolean;
  avgHr: string;
  targetMafHr: number | null;
  onComplete: (pace: string) => void;
  onBack: () => void;
}

export const MafLabStepResults: React.FC<MafLabStepResultsProps> = ({
  calculatedPace, finalPace, isMafCompliant, avgHr, targetMafHr, onComplete, onBack,
}) => {
  const ok = isMafCompliant;
  return (
    <div className={`desktop-card overflow-hidden border-t-2 ${ok ? 'border-emerald-500' : 'border-amber-500'} text-center`}>
      <div className={`p-8 border-b border-white/10 ${ok ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${ok ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
          {ok ? <CheckCircle2 className="w-10 h-10 text-emerald-400" /> : <AlertTriangle className="w-10 h-10 text-amber-400" />}
        </div>
        <h3 className={`text-2xl font-black uppercase ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>
          {ok ? 'Dữ Liệu Hợp Lệ' : 'Cảnh Báo Nhịp Tim Cao'}
        </h3>
      </div>

      <div className="p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 p-6 rounded-xl border border-white/10">
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Pace Thực Tế</p>
            <p className="text-4xl font-mono font-black text-white">{calculatedPace}<span className="text-lg font-medium text-white/40 ml-1">/km</span></p>
          </div>
          <div className={`p-6 rounded-xl border ${ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-maf-red/10 border-maf-red/30'}`}>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Avg HR vs Target</p>
            <div className="flex items-center justify-center space-x-3">
              <span className={`text-3xl font-black ${ok ? 'text-emerald-400' : 'text-maf-red'}`}>{avgHr}</span>
              <span className="text-white/30 text-lg font-bold">vs</span>
              <span className="text-2xl font-bold text-white/60">{targetMafHr}</span>
            </div>
            {!ok && (
              <p className="text-sm text-maf-red mt-2 font-bold">Vượt quá ngưỡng (+{parseInt(avgHr) - (targetMafHr || 180)} bpm)</p>
            )}
          </div>
        </div>

        {!ok ? (
          <div className="text-left bg-amber-500/10 p-6 rounded-xl border border-amber-500/30">
            <p className="text-white/80 text-base leading-relaxed mb-3">
              <strong className="text-amber-400">Phân tích:</strong> Nhịp tim trung bình cao hơn ngưỡng MAF — bạn đã sử dụng hệ thống kỵ khí nhiều hơn dự kiến.
            </p>
            <p className="text-white/80 text-base leading-relaxed">
              <strong className="text-amber-400">Hành động:</strong> Hệ thống sẽ <strong className="text-white">cộng thêm 1:30</strong> vào Pace để đưa ra giáo án phù hợp.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-500/30 flex items-center justify-between">
              <span className="text-sm font-bold text-amber-400 uppercase">Pace Điều Chỉnh:</span>
              <span className="text-2xl font-mono font-black text-white">{finalPace}/km</span>
            </div>
          </div>
        ) : (
          <p className="text-white/80 bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/30 text-base leading-relaxed">
            Tuyệt vời! Bạn đã tuân thủ đúng kỷ luật nhịp tim. Hệ thống sẽ sử dụng Pace <strong className="text-white">{finalPace}</strong> để xây dựng giáo án tối ưu.
          </p>
        )}

        <button
          onClick={() => onComplete(finalPace)}
          className={`w-full md:w-auto px-12 py-4 rounded-full font-bold text-lg text-white shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center mx-auto uppercase tracking-wide ${
            ok
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 shadow-[0_4px_15px_rgba(16,185,129,0.3)]'
              : 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_4px_15px_rgba(245,158,11,0.3)]'
          }`}
        >
          <Save className="w-6 h-6 mr-3" />{ok ? 'SỬ DỤNG PACE NÀY' : 'CHẤP NHẬN PACE ĐIỀU CHỈNH'}
        </button>
        <button onClick={onBack} className="block mx-auto px-8 py-3 rounded-full font-bold text-base text-white/50 hover:bg-white/10 transition-colors">
          Quay lại
        </button>
      </div>
    </div>
  );
};
