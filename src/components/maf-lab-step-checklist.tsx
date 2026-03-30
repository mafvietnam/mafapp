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
    {
      key: 'monitor',
      label: 'Tôi đã đeo thiết bị đo nhịp tim (Heart Rate Monitor/Chest Strap).',
    },
    {
      key: 'track',
      label: 'Tôi đã thực hiện bài test trên đường phẳng hoặc Sân vận động.',
    },
    {
      key: 'hrCommitment',
      label: (
        <>
          Tôi đã cố gắng giữ nhịp tim{' '}
          <span className="text-red-600 font-bold uppercase">
            DƯỚI {targetMafHr ? `${targetMafHr} bpm` : 'ngưỡng MAF'}
          </span>
          .
        </>
      ),
    },
    {
      key: 'warmup',
      label: 'Tôi đã hoàn thành 15 phút khởi động (Warm-up) trước khi bấm giờ.',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-xl border-t-4 border-blue-500 overflow-hidden">
      <div className="bg-blue-50 p-8 border-b border-blue-100 text-center">
        <ClipboardList className="w-14 h-14 text-blue-600 mx-auto mb-4" />
        <h3 className="text-3xl font-bold text-gray-900 uppercase">Quy Chuẩn MAF Test</h3>
        <p className="text-gray-700 mt-2 text-lg font-medium">
          Để kết quả chính xác, bạn vui lòng xác nhận các điều kiện sau:
        </p>
      </div>

      <div className="p-8 space-y-6">
        {items.map(({ key, label }) => (
          <label
            key={key}
            className={`flex items-start p-5 rounded-xl border-2 cursor-pointer transition-all ${
              checklist[key] ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist[key]}
              onChange={() => onCheck(key)}
              className="w-6 h-6 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="ml-4 text-gray-800 font-medium text-lg leading-relaxed">{label}</span>
          </label>
        ))}
      </div>

      <div className="p-8 bg-gray-50 border-t border-gray-200 text-center">
        <button
          onClick={() => allChecked && onProceed()}
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
  );
};
