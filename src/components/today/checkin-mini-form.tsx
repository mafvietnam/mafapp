import { useState } from 'react';
import type { UpsertCheckinPayload } from '../../services/checkin-service';
import type { DailyCheckin } from '../../types';

const SORENESS_CHIPS = ['none', 'bắp chân', 'đầu gối', 'hông', 'lưng', 'bàn chân'];
const SORENESS_LABEL: Record<string, string> = {
  none: 'Không đau',
  'bắp chân': 'Bắp chân',
  'đầu gối': 'Đầu gối',
  hông: 'Hông',
  lưng: 'Lưng',
  'bàn chân': 'Bàn chân',
};

interface CheckinMiniFormProps {
  existing: DailyCheckin | null;
  submitting: boolean;
  onSubmit: (payload: UpsertCheckinPayload) => void;
}

/** Optional ≤20s morning check-in: sleep quality (1-5), fatigue (1-5), soreness chips. */
export default function CheckinMiniForm({ existing, submitting, onSubmit }: CheckinMiniFormProps) {
  const [sleepQuality, setSleepQuality] = useState(existing?.sleepQuality ?? 3);
  const [fatigue, setFatigue] = useState(existing?.fatigue ?? 3);
  const [soreness, setSoreness] = useState(existing?.soreness ?? 'none');

  const handleSubmit = () => {
    onSubmit({ sleepQuality, fatigue, soreness: soreness === 'none' ? undefined : soreness });
  };

  return (
    <div className="space-y-3 bg-black/20 rounded-xl p-3 border border-white/10">
      <p className="text-[12px] font-bold text-white">Sáng nay bạn thấy thế nào? (20 giây)</p>

      <div>
        <label className="text-[11px] text-slate-400 mb-1 block">Chất lượng giấc ngủ</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSleepQuality(v)}
              className={`w-7 h-7 rounded-full text-[11px] font-bold border transition-colors ${
                sleepQuality === v
                  ? 'bg-maf-violet text-white border-maf-violet'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-400 mb-1 block">Mức độ mệt</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFatigue(v)}
              className={`w-7 h-7 rounded-full text-[11px] font-bold border transition-colors ${
                fatigue === v
                  ? 'bg-maf-red text-white border-maf-red'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-400 mb-1 block">Đau nhức?</label>
        <div className="flex flex-wrap gap-1.5">
          {SORENESS_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setSoreness(chip)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                soreness === chip
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {SORENESS_LABEL[chip]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-maf-violet/10 hover:bg-maf-violet/20 text-maf-violet border border-maf-violet/30 rounded-lg py-2 text-[12px] font-bold transition-all disabled:opacity-50"
      >
        {submitting ? 'Đang lưu...' : 'Lưu check-in'}
      </button>
    </div>
  );
}
