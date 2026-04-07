import React, { useState, useEffect, useRef } from 'react';
import { MafLabStepChecklist } from './maf-lab-step-checklist';
import { MafLabStepDataEntry } from './maf-lab-step-data-entry';
import { MafLabStepResults } from './maf-lab-step-results';
import { useGarminAutoFill } from '../hooks/use-garmin-auto-fill';
import { useStravaAutoFill } from '../hooks/use-strava-auto-fill';

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
    warmup: false,
  });

  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [calculatedPace, setCalculatedPace] = useState('');
  const [finalPace, setFinalPace] = useState('');
  const [isMafCompliant, setIsMafCompliant] = useState(true);

  // Auto-fill from device data: Strava wins over Garmin when both have recent runs.
  // Waits for both hooks to finish loading before applying to avoid race conditions.
  const { autoFill: garminAutoFill, loading: garminLoading } = useGarminAutoFill();
  const { autoFill: stravaAutoFill, loading: stravaLoading } = useStravaAutoFill();
  const [garminSource, setGarminSource] = useState<{ activityDate: string; avgHr: string } | null>(null);
  const [stravaSource, setStravaSource] = useState<{ activityDate: string; avgHr: string } | null>(null);
  const autoFillApplied = useRef(false);

  useEffect(() => {
    if (garminLoading || stravaLoading) return;
    if (autoFillApplied.current || avgHr || distance) return;

    // Strava wins if available, otherwise fall back to Garmin
    const source = stravaAutoFill ?? garminAutoFill;
    if (!source) return;

    autoFillApplied.current = true;
    setDistance(source.distance);
    setHours(source.hours);
    setMinutes(source.minutes);
    setSeconds(source.seconds);
    setAvgHr(source.avgHr);

    if (stravaAutoFill) {
      setStravaSource({ activityDate: stravaAutoFill.activityDate, avgHr: stravaAutoFill.avgHr });
    } else if (garminAutoFill) {
      setGarminSource({ activityDate: garminAutoFill.activityDate, avgHr: garminAutoFill.avgHr });
    }
  }, [garminLoading, stravaLoading, stravaAutoFill, garminAutoFill, avgHr, distance]);

  const handleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const allChecked = Object.values(checklist).every(Boolean);

  const handleProcessData = () => {
    const dist = parseFloat(distance);
    const hr = parseInt(avgHr);
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;

    if (!dist || dist <= 0) { alert('Vui lòng nhập Tổng cự ly hợp lệ.'); return; }
    if (h === 0 && m === 0 && s === 0) { alert('Vui lòng nhập Tổng thời gian hoàn thành.'); return; }
    if (!hr || hr <= 0) { alert('Vui lòng nhập Nhịp tim trung bình.'); return; }

    const totalMinutes = h * 60 + m + s / 60;
    const paceDecimal = totalMinutes / dist;
    const paceMin = Math.floor(paceDecimal);
    const paceSec = Math.round((paceDecimal - paceMin) * 60);
    const paceString = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;

    setCalculatedPace(paceString);

    const threshold = (targetMafHr || 180) + 2;
    if (hr > threshold) {
      setIsMafCompliant(false);
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
      {/* Stepper Header — dark theme */}
      <div className="flex items-center justify-between relative mb-10 px-4">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-white/10 -z-10 rounded-full" />
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center bg-maf-dark px-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border-4 transition-colors duration-300
              ${step >= s
                ? 'bg-gradient-to-tr from-maf-red to-maf-violet text-white border-maf-violet/50 shadow-[0_0_15px_rgba(145,48,248,0.3)]'
                : 'bg-white/5 text-white/30 border-white/10'
              }`}>
              {s}
            </div>
            <span className={`text-sm font-bold mt-3 uppercase tracking-wider ${step >= s ? 'text-maf-violet' : 'text-white/30'}`}>
              {s === 1 ? 'Quy Chuẩn' : s === 2 ? 'Nhập Liệu' : 'Thẩm Định'}
            </span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <MafLabStepChecklist checklist={checklist} onCheck={handleCheck} allChecked={allChecked} onProceed={() => setStep(2)} targetMafHr={targetMafHr} />
      )}
      {step === 2 && (
        <MafLabStepDataEntry distance={distance} hours={hours} minutes={minutes} seconds={seconds} avgHr={avgHr} setDistance={setDistance} setHours={setHours} setMinutes={setMinutes} setSeconds={setSeconds} setAvgHr={setAvgHr} onProcess={handleProcessData} onBack={() => setStep(1)} targetMafHr={targetMafHr} garminSource={garminSource} onDismissGarmin={() => setGarminSource(null)} stravaSource={stravaSource} onDismissStrava={() => setStravaSource(null)} />
      )}
      {step === 3 && (
        <MafLabStepResults calculatedPace={calculatedPace} finalPace={finalPace} isMafCompliant={isMafCompliant} avgHr={avgHr} targetMafHr={targetMafHr} onComplete={onComplete} onBack={() => setStep(2)} />
      )}
    </div>
  );
};
