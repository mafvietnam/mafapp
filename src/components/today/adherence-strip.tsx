import type { AdherenceDay, AdherenceStatus } from '../../utils/adherence-analysis';

interface DotStyle {
  className: string;
  label: string;
}

const STATUS_STYLE: Record<AdherenceStatus, DotStyle> = {
  done: { className: 'bg-emerald-400 border-emerald-400', label: 'Đã tập' },
  missed: { className: 'bg-maf-red/80 border-maf-red', label: 'Đã lỡ' },
  rest: { className: 'bg-transparent border-white/20', label: 'Nghỉ' },
  upcoming: { className: 'bg-transparent border-white/30 border-dashed', label: 'Sắp tới' },
  extra: { className: 'bg-maf-violet border-maf-violet', label: 'Tập thêm' },
};

/** Short single-char weekday initial for the dot label — VN labels are multi-word ("Thứ 2", "Chủ Nhật"). */
function shortLabel(vnDay: string): string {
  if (vnDay === 'Chủ Nhật') return 'CN';
  return vnDay.replace('Thứ ', 'T');
}

interface AdherenceStripProps {
  days: AdherenceDay[];
}

/** 7-dot week strip: done/missed/rest/upcoming/extra vs the orchestrator-adjusted week template. */
export default function AdherenceStrip({ days }: AdherenceStripProps) {
  if (days.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10">
      {days.map((day) => {
        const style = STATUS_STYLE[day.status];
        return (
          <div key={day.weekday} className="flex flex-col items-center gap-1" title={`${day.weekday}: ${style.label}`}>
            <span className="text-[9px] font-bold text-slate-500 uppercase">{shortLabel(day.weekday)}</span>
            <span className={`w-3 h-3 rounded-full border-2 ${style.className}`} />
          </div>
        );
      })}
    </div>
  );
}
