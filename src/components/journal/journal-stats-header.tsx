import { Map, Activity, Target } from 'lucide-react';
import type { MonthlySummary } from '../../utils/journal-analytics';

interface JournalStatsHeaderProps {
  summary: MonthlySummary;
  monthLabel: string; // e.g. "Tháng 7/2026"
  showMaf: boolean; // hide %MAF tile content when MAF unconfigured
}

interface TileProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  accent: string;
}

function Tile({ label, value, unit, icon, accent }: TileProps) {
  return (
    <div className="glass-card lg:desktop-card rounded-2xl p-4 lg:p-5 flex items-center justify-between">
      <div>
        <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl lg:text-3xl font-black text-white">{value}</span>
          {unit && <span className="text-xs text-slate-400 font-semibold">{unit}</span>}
        </div>
      </div>
      <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
    </div>
  );
}

/** Current-month roll-up: distance, sessions, % of sessions in the MAF zone. */
export default function JournalStatsHeader({ summary, monthLabel, showMaf }: JournalStatsHeaderProps) {
  const pct = !showMaf || summary.inZonePct == null ? '—' : String(summary.inZonePct);

  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">{monthLabel}</p>
      <div className="grid grid-cols-3 gap-3 lg:gap-6">
        <Tile
          label="Quãng đường"
          value={summary.totalKm.toFixed(1)}
          unit="km"
          icon={<Map className="w-5 h-5 lg:w-6 lg:h-6" />}
          accent="bg-maf-violet/10 text-maf-violet"
        />
        <Tile
          label="Số buổi"
          value={String(summary.sessionCount)}
          unit="buổi"
          icon={<Activity className="w-5 h-5 lg:w-6 lg:h-6" />}
          accent="bg-maf-red/10 text-maf-red"
        />
        <Tile
          label="Đúng vùng MAF"
          value={pct}
          unit={pct === '—' ? undefined : '%'}
          icon={<Target className="w-5 h-5 lg:w-6 lg:h-6" />}
          accent="bg-emerald-500/10 text-emerald-400"
        />
      </div>
    </div>
  );
}
