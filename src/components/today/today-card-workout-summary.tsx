import { HeartPulse, Flame } from 'lucide-react';
import type { DailyRecommendation, ReadinessTier } from '../../types';

interface TierStyle {
  label: string;
  text: string;
  bg: string;
  border: string;
}

const TIER_STYLES: Record<ReadinessTier, TierStyle> = {
  GREEN: { label: 'Ổn định', text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  AMBER: { label: 'Thận trọng', text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  RED: { label: 'Cần nghỉ', text: 'text-maf-red', bg: 'bg-maf-red/10', border: 'border-maf-red/30' },
};

export function TierBadge({ tier }: { tier: ReadinessTier }) {
  const style = TIER_STYLES[tier];
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${style.text} ${style.bg} ${style.border}`}
    >
      {style.label}
    </span>
  );
}

interface TodayCardWorkoutSummaryProps {
  rec: DailyRecommendation;
  compact?: boolean;
}

/** Renders the "what to do today" body: title, duration breakdown, MAF HR zone, rest/adjustment copy, RED gentle-walk option. */
export default function TodayCardWorkoutSummary({ rec, compact = false }: TodayCardWorkoutSummaryProps) {
  const isRest = rec.dayType === 'REST';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-bold text-white ${compact ? 'text-[15px]' : 'text-lg'}`}>
          Hôm nay: {isRest ? 'Ngày nghỉ' : rec.title}
        </h3>
        <TierBadge tier={rec.tier} />
      </div>

      {!isRest && rec.hrZone && (
        <p className="text-[12px] text-slate-300 flex items-center gap-1.5">
          <HeartPulse className="w-3.5 h-3.5 text-maf-red shrink-0" />
          Giữ nhịp tim trong vùng MAF: {rec.hrZone.lower}–{rec.hrZone.upper} bpm (Chương 6)
        </p>
      )}

      {!isRest &&
        (rec.allEasy ? (
          <p className="text-[12px] text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-maf-violet shrink-0" />
            Toàn bộ {rec.mainMinutes} phút nhẹ nhàng (không tách khởi động/thả lỏng)
          </p>
        ) : (
          <p className="text-[12px] text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-maf-violet shrink-0" />
            Khởi động {rec.warmupMin} phút + thả lỏng {rec.cooldownMin} phút (Chương 5) · Chính {rec.mainMinutes} phút
          </p>
        ))}

      {rec.adjustmentNote && (
        <p className="text-[12px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          {rec.adjustmentNote}
        </p>
      )}

      {rec.restCopy && (
        <p
          className={`text-[12px] font-medium rounded-lg px-3 py-2 border ${
            rec.tier === 'RED'
              ? 'text-maf-red bg-maf-red/10 border-maf-red/20'
              : 'text-slate-300 bg-white/5 border-white/10'
          }`}
        >
          {rec.restCopy}
        </p>
      )}

      {rec.tier === 'RED' && isRest && rec.hrZone && (
        <p className="text-[11px] text-slate-400 italic">
          Nếu muốn vận động nhẹ: đi bộ thư giãn tối đa 30 phút, giữ nhịp tim dưới {rec.hrZone.lower} bpm — KHÔNG chạy.
        </p>
      )}
    </div>
  );
}
