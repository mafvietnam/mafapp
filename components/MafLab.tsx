
import React, { useState, useEffect } from 'react';
import { CheckCircle2, ClipboardList, Timer, ArrowRight, Save, Activity, AlertTriangle, HeartPulse, Gauge } from 'lucide-react';

interface MafLabProps {
  onComplete: (pace: string) => void;
  targetMafHr: number | null;
}

export const MafLab: React.FC<MafLabProps> = ({ onComplete, targetMafHr }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checklist, setChecklist] = useState({
    monitor: false,
    track: false,
    hrCommitment: false,
    warmup: false
  });
  
  // Raw Data Inputs
  const [distance, setDistance] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [minutes, setMinutes] = useState<string>('');
  const [seconds, setSeconds] = useState<string>('');
  const [avgHr, setAvgHr] = useState<string>('');

  // Calculated Results
  const [calculatedPace, setCalculatedPace] = useState<string>('');
  const [finalPace, setFinalPace] = useState<string>('');
  const [isMafCompliant, setIsMafCompliant] = useState<boolean>(true);

  const handleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);

  const handleProcessData = () => {
    // 1. Validate Inputs
    const dist = parseFloat(distance);
    const hr = parseInt(avgHr);
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;

    if (!dist || dist <= 0) {
      alert("Vui lòng nhập Tổng cự ly hợp lệ.");
      return;
    }
    if (h === 0 && m === 0 && s === 0) {
      alert("Vui lòng nhập Tổng thời gian hoàn thành.");
      return;
    }
    if (!hr || hr <= 0) {
      alert("Vui lòng nhập Nhịp tim trung bình.");
      return;
    }

    // 2. Calculate Actual Pace
    const totalMinutes = (h * 60) + m + (s / 60);
    const paceDecimal = totalMinutes / dist;
    const paceMin = Math.floor(paceDecimal);
    const paceSec = Math.round((paceDecimal - paceMin) * 60);
    const paceString = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
    
    setCalculatedPace(paceString);

    // 3. Validate MAF Compliance (HR Check)
    // Allow a tiny buffer of +2 bpm as acceptable margin of error
    const threshold = (targetMafHr || 180) + 2; 
    
    if (hr > threshold) {
      setIsMafCompliant(false);
      // Penalty Logic: Add 90 seconds to pace to estimate true aerobic pace
      const penalizedPaceDecimal = paceDecimal + 1.5; 
      const pMin = Math.floor(penalizedPaceDecimal);
      const pSec = Math.round((penalizedPaceDecimal - pMin) * 60);
      setFinalPace(`${pMin}:${pSec.toString().padStart(2, '0')}`);
    } else {
      setIsMafCompliant(true);
      setFinalPace(paceString);
    }

    setStep(3);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in pb-12">
      {/* Stepper Header */}
      <div className="flex items-center justify-between relative mb-10 px-4">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1.5 bg-gray-200 -z-10 rounded-full"></div>
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex flex-col items-center bg-gray-50 px-4`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border-4 transition-colors duration-300 shadow-sm
              ${step >= s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-300'}
            `}>
              {s}
            </div>
            <span className={`text-sm font-bold mt-3 uppercase tracking-wider ${step >= s ? 'text-blue-700' : 'text-gray-500'}`}>
              {s === 1 ? 'Quy Chuẩn' : s === 2 ? 'Nhập Liệu' : 'Thẩm Định'}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: PROTOCOL CHECKLIST */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-xl border-t-4 border-blue-500 overflow-hidden">
          <div className="bg-blue-50 p-8 border-b border-blue-100 text-center">
            <ClipboardList className="w-14 h-14 text-blue-600 mx-auto mb-4" />
            <h3 className="text-3xl font-bold text-gray-900 uppercase">Quy Chuẩn MAF Test</h3>
            <p className="text-gray-700 mt-2 text-lg font-medium">Để kết quả chính xác, bạn vui lòng xác nhận các điều kiện sau:</p>
          </div>
          
          <div className="p-8 space-y-6">
            <label className={`flex items-start p-5 rounded-xl border-2 cursor-pointer transition-all ${checklist.monitor ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <input type="checkbox" checked={checklist.monitor} onChange={() => handleCheck('monitor')} className="w-6 h-6 mt-0.5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="ml-4 text-gray-800 font-medium text-lg leading-relaxed">Tôi đã đeo thiết bị đo nhịp tim (Heart Rate Monitor/Chest Strap).</span>
            </label>

            <label className={`flex items-start p-5 rounded-xl border-2 cursor-pointer transition-all ${checklist.track ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <input type="checkbox" checked={checklist.track} onChange={() => handleCheck('track')} className="w-6 h-6 mt-0.5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="ml-4 text-gray-800 font-medium text-lg leading-relaxed">Tôi đã thực hiện bài test trên đường phẳng hoặc Sân vận động.</span>
            </label>

            <label className={`flex items-start p-5 rounded-xl border-2 cursor-pointer transition-all ${checklist.hrCommitment ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <input type="checkbox" checked={checklist.hrCommitment} onChange={() => handleCheck('hrCommitment')} className="w-6 h-6 mt-0.5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="ml-4 text-gray-800 font-medium text-lg leading-relaxed">
                Tôi đã cố gắng giữ nhịp tim <span className="text-red-600 font-bold uppercase">DƯỚI {targetMafHr ? `${targetMafHr} bpm` : 'ngưỡng MAF'}</span>.
              </span>
            </label>

            <label className={`flex items-start p-5 rounded-xl border-2 cursor-pointer transition-all ${checklist.warmup ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <input type="checkbox" checked={checklist.warmup} onChange={() => handleCheck('warmup')} className="w-6 h-6 mt-0.5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="ml-4 text-gray-800 font-medium text-lg leading-relaxed">Tôi đã hoàn thành 15 phút khởi động (Warm-up) trước khi bấm giờ.</span>
            </label>
          </div>

          <div className="p-8 bg-gray-50 border-t border-gray-200 text-center">
            <button
              onClick={() => allChecked && setStep(2)}
              disabled={!allChecked}
              className={`px-10 py-4 rounded-full font-bold text-xl shadow-lg transition-all transform hover:-translate-y-1 ${
                allChecked 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              BẮT ĐẦU GHI NHẬN <ArrowRight className="inline-block ml-2 w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: RAW DATA ENTRY */}
      {step === 2 && (
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
            {/* INPUT 1: DISTANCE */}
            <div>
              <label className="block text-lg font-bold text-gray-800 uppercase mb-3">1. Tổng Cự ly đã chạy (Km)</label>
              <div className="relative">
                 <input 
                    type="number" 
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="VD: 5"
                    className="w-full p-4 text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium"
                 />
                 <div className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-lg">KM</div>
              </div>
            </div>

            {/* INPUT 2: TIME */}
            <div>
              <label className="block text-lg font-bold text-gray-800 uppercase mb-3">2. Tổng Thời gian hoàn thành</label>
              <div className="flex space-x-6">
                 <div className="flex-1">
                    <input 
                      type="number" placeholder="00" value={hours} onChange={e => setHours(e.target.value)}
                      className="w-full p-4 text-center text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" 
                    />
                    <span className="block text-center text-base font-medium text-gray-500 mt-2">Giờ</span>
                 </div>
                 <div className="flex-1">
                    <input 
                      type="number" placeholder="30" value={minutes} onChange={e => setMinutes(e.target.value)}
                      className="w-full p-4 text-center text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" 
                    />
                    <span className="block text-center text-base font-medium text-gray-500 mt-2">Phút</span>
                 </div>
                 <div className="flex-1">
                    <input 
                      type="number" placeholder="00" value={seconds} onChange={e => setSeconds(e.target.value)}
                      className="w-full p-4 text-center text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium" 
                    />
                    <span className="block text-center text-base font-medium text-gray-500 mt-2">Giây</span>
                 </div>
              </div>
            </div>

            {/* INPUT 3: HEART RATE */}
            <div>
              <label className="block text-lg font-bold text-gray-800 uppercase mb-3">3. Nhịp tim trung bình (Avg HR)</label>
              <div className="relative">
                 <input 
                    type="number" 
                    value={avgHr}
                    onChange={(e) => setAvgHr(e.target.value)}
                    placeholder="VD: 142"
                    className="w-full p-4 text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-red-600 font-bold"
                 />
                 <HeartPulse className="absolute right-5 top-1/2 transform -translate-y-1/2 text-red-400 w-8 h-8" />
              </div>
              <p className="text-base text-gray-500 mt-2 font-medium italic">*Lấy số liệu từ đồng hồ hoặc app chạy bộ của bạn.</p>
            </div>
          </div>

          <div className="p-8 bg-gray-50 border-t border-gray-200 text-center flex justify-between items-center">
            <button 
              onClick={() => setStep(1)}
              className="px-8 py-3 rounded-full font-bold text-lg text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={handleProcessData}
              className="px-10 py-4 rounded-full font-bold text-xl bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all transform hover:-translate-y-1"
            >
              TÍNH TOÁN & THẨM ĐỊNH <Gauge className="inline-block ml-2 w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULT & VALIDATION */}
      {step === 3 && (
        <div className={`bg-white rounded-xl shadow-lg border-t-4 ${isMafCompliant ? 'border-green-500' : 'border-amber-500'} overflow-hidden text-center animate-bounce-in`}>
           
           {/* Header Status */}
           <div className={`p-8 ${isMafCompliant ? 'bg-green-50' : 'bg-amber-50'} border-b ${isMafCompliant ? 'border-green-100' : 'border-amber-100'}`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isMafCompliant ? 'bg-green-100' : 'bg-amber-100'}`}>
                 {isMafCompliant ? <CheckCircle2 className="w-10 h-10 text-green-600" /> : <AlertTriangle className="w-10 h-10 text-amber-600" />}
              </div>
              <h3 className={`text-3xl font-black uppercase ${isMafCompliant ? 'text-green-800' : 'text-amber-800'}`}>
                {isMafCompliant ? 'Dữ Liệu Hợp Lệ' : 'Cảnh Báo Nhịp Tim Cao'}
              </h3>
           </div>

           <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Card 1: Actual Pace */}
                 <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-base font-bold uppercase tracking-wider mb-2">Pace Thực Tế</p>
                    <p className="text-4xl font-mono font-black text-gray-900">{calculatedPace}<span className="text-lg font-medium text-gray-500 ml-1">/km</span></p>
                 </div>
                 
                 {/* Card 2: HR Check */}
                 <div className={`p-6 rounded-xl border ${isMafCompliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-gray-500 text-base font-bold uppercase tracking-wider mb-2">Avg HR vs Target</p>
                    <div className="flex items-center justify-center space-x-3">
                       <span className={`text-3xl font-black ${isMafCompliant ? 'text-green-700' : 'text-red-700'}`}>{avgHr}</span>
                       <span className="text-gray-400 text-lg font-bold">vs</span>
                       <span className="text-2xl font-bold text-gray-600">{targetMafHr}</span>
                    </div>
                    {!isMafCompliant && (
                       <p className="text-base text-red-600 mt-2 font-bold">Vượt quá ngưỡng (+{(parseInt(avgHr) - (targetMafHr || 180))} bpm)</p>
                    )}
                 </div>
              </div>

              {/* Explanation Area */}
              {!isMafCompliant ? (
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
                className={`w-full md:w-auto px-12 py-5 rounded-full font-bold text-2xl text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center mx-auto uppercase tracking-wide
                  ${isMafCompliant ? 'bg-gradient-to-r from-green-600 to-emerald-700' : 'bg-gradient-to-r from-amber-500 to-orange-600'}
                `}
              >
                <Save className="w-7 h-7 mr-3" /> {isMafCompliant ? 'SỬ DỤNG PACE NÀY' : 'CHẤP NHẬN PACE ĐIỀU CHỈNH'}
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
