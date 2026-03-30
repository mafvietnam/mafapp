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
    <div className={`bg-white rounded-xl shadow-lg border-t-4 ${ok ? 'border-green-500' : 'border-amber-500'} overflow-hidden text-center animate-bounce-in`}>
      <div className={`p-8 ${ok ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'} border-b`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${ok ? 'bg-green-100' : 'bg-amber-100'}`}>
          {ok ? <CheckCircle2 className="w-10 h-10 text-green-600" /> : <AlertTriangle className="w-10 h-10 text-amber-600" />}
        </div>
        <h3 className={`text-3xl font-black uppercase ${ok ? 'text-green-800' : 'text-amber-800'}`}>
          {ok ? 'Dữ Liệu Hợp Lệ' : 'Cảnh Báo Nhịp Tim Cao'}
        </h3>
      </div>

      <div className="p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <p className="text-gray-500 text-base font-bold uppercase tracking-wider mb-2">Pace Thực Tế</p>
            <p className="text-4xl font-mono font-black text-gray-900">{calculatedPace}<span className="text-lg font-medium text-gray-500 ml-1">/km</span></p>
          </div>
          <div className={`p-6 rounded-xl border ${ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-gray-500 text-base font-bold uppercase tracking-wider mb-2">Avg HR vs Target</p>
            <div className="flex items-center justify-center space-x-3">
              <span className={`text-3xl font-black ${ok ? 'text-green-700' : 'text-red-700'}`}>{avgHr}</span>
              <span className="text-gray-400 text-lg font-bold">vs</span>
              <span className="text-2xl font-bold text-gray-600">{targetMafHr}</span>
            </div>
            {!ok && (
              <p className="text-base text-red-600 mt-2 font-bold">Vượt quá ngưỡng (+{parseInt(avgHr) - (targetMafHr || 180)} bpm)</p>
            )}
          </div>
        </div>

        {!ok ? (
          <div className="text-left bg-amber-50 p-6 rounded-xl border border-amber-200">
            <p className="text-amber-900 text-lg leading-relaxed mb-3">
              <strong>Phân tích:</strong> Bài chạy này có nhịp tim trung bình cao hơn ngưỡng MAF. Điều này có nghĩa là bạn đã sử dụng hệ thống kỵ khí (Anaerobic) nhiều hơn dự kiến.
            </p>
            <p className="text-amber-900 text-lg leading-relaxed">
              <strong>Hành động:</strong> Để đảm bảo an toàn cho Lịch tập, hệ thống sẽ tự động <strong>cộng thêm 1 phút 30 giây</strong> vào Pace thực tế để đưa ra giáo án phù hợp với nền tảng hiếu khí hiện tại của bạn.
            </p>
            <div className="mt-4 pt-4 border-t border-amber-200 flex items-center justify-between">
              <span className="text-base font-bold text-amber-700 uppercase">Pace Điều Chỉnh:</span>
              <span className="text-2xl font-mono font-black text-amber-800">{finalPace}/km</span>
            </div>
          </div>
        ) : (
          <p className="text-green-800 bg-green-50 p-6 rounded-xl border border-green-200 text-lg leading-relaxed font-medium">
            Tuyệt vời! Bạn đã tuân thủ đúng kỷ luật nhịp tim. Hệ thống sẽ sử dụng Pace <strong>{finalPace}</strong> để xây dựng giáo án tối ưu hóa hiệu suất cho bạn.
          </p>
        )}

        <button
          onClick={() => onComplete(finalPace)}
          className={`w-full md:w-auto px-12 py-5 rounded-full font-bold text-2xl text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center mx-auto uppercase tracking-wide ${ok ? 'bg-gradient-to-r from-green-600 to-emerald-700' : 'bg-gradient-to-r from-amber-500 to-orange-600'}`}
        >
          <Save className="w-7 h-7 mr-3" />{ok ? 'SỬ DỤNG PACE NÀY' : 'CHẤP NHẬN PACE ĐIỀU CHỈNH'}
        </button>
        <button onClick={onBack} className="block mx-auto px-8 py-3 rounded-full font-bold text-lg text-gray-600 hover:bg-gray-200 transition-colors">
          Quay lại
        </button>
      </div>
    </div>
  );
};
