import React from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';

interface ChecklistState {
  monitor: boolean;
  track: boolean;
  hrCommitment: boolean;
  warmup: boolean;
}

interface MafLabStepChecklistProps {
  checklist: ChecklistState;
  onCheck: (key: keyof ChecklistState) => void;
  allChecked: boolean;
  onProceed: () => void;
  targetMafHr: number | null;
}

export const MafLabStepChecklist: React.FC<MafLabStepChecklistProps> = ({
  checklist,
  onCheck,
  allChecked,
  onProceed,
  targetMafHr,
}) => {
  const items: { key: keyof ChecklistState; label: React.ReactNode }[] = [
    { key: 'monitor', label: 'Tôi đã đeo thiết bị đo nhịp tim (Heart Rate Monitor/Chest Strap).' },
    { key: 'track', label: 'Tôi đã thực hiện bài test trên đường phẳng hoặc Sân vận động.' },
    {
      key: 'hrCommitment',
      label: (
        <>
          Tôi đã cố gắng giữ nhịp tim{' '}
          <span className="text-maf-red font-bold uppercase">
            DƯỚI {targetMafHr ? `${targetMafHr} bpm` : 'ngưỡng MAF'}
          </span>
          .
        </>
      ),
    },
    { key: 'warmup', label: 'Tôi đã hoàn thành 15 phút khởi động (Warm-up) trước khi bấm giờ.' },
  ];

  return (
    <div className="desktop-card overflow-hidden border-t-2 border-maf-violet">
      <div className="p-8 border-b border-white/10 text-center">
        <ClipboardList className="w-14 h-14 text-maf-violet mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white uppercase">Quy Chuẩn MAF Test</h3>
        <p className="text-white/60 mt-2 text-base">
          Để kết quả chính xác, bạn vui lòng xác nhận các điều kiện sau:
        </p>
      </div>

      <div className="p-8 space-y-4">
        {items.map(({ key, label }) => (
          <label
            key={key}
            className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${
              checklist[key]
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist[key]}
              onChange={() => onCheck(key)}
              className="w-6 h-6 min-w-[24px] mt-0.5 rounded accent-emerald-500 bg-[#1F2937] border-white/20"
            />
            <span className="ml-4 text-white font-medium text-base leading-relaxed">{label}</span>
          </label>
        ))}
      </div>

      <div className="p-8 border-t border-white/10 text-center">
        <button
          onClick={() => allChecked && onProceed()}
          disabled={!allChecked}
          className={`px-10 py-4 rounded-full font-bold text-lg shadow-lg transition-all transform hover:-translate-y-1 ${
            allChecked
              ? 'bg-gradient-to-r from-maf-red to-maf-violet text-white shadow-[0_4px_15px_rgba(244,42,104,0.3)]'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          BẮT ĐẦU GHI NHẬN <ArrowRight className="inline-block ml-2 w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
