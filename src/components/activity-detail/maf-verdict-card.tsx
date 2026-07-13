import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { verdict, type MafZone, type VerdictStatus } from '../../utils/maf-activity-analysis';

interface MafVerdictCardProps {
  avgHr: number | null;
  zone: MafZone;
}

interface StatusConfig {
  label: string;
  badgeClass: string;
  icon: typeof Check;
}

/**
 * "below" is neutral/informational (running easy under MAF is perfectly
 * fine), NOT a warning — only "above" gets the maf-red warning treatment.
 */
const STATUS_CONFIG: Record<VerdictStatus, StatusConfig> = {
  below: { label: 'Dưới vùng MAF', badgeClass: 'bg-maf-violet/10 text-maf-violet border-maf-violet/30', icon: ArrowDown },
  in: { label: 'Trong vùng MAF', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: Check },
  above: { label: 'Trên vùng MAF', badgeClass: 'bg-maf-red/10 text-maf-red border-maf-red/30', icon: ArrowUp },
};

const DELTA_COPY: Record<Exclude<VerdictStatus, 'in'>, (delta: number) => string> = {
  below: (delta) => `Nhịp tim TB thấp hơn ngưỡng dưới của vùng MAF ${delta} bpm.`,
  above: (delta) => `Nhịp tim TB vượt trần vùng MAF ${delta} bpm.`,
};

/** MAF verdict badge for the activity's average heart rate — hidden when avgHr or MAF zone is unavailable. */
export default function MafVerdictCard({ avgHr, zone }: MafVerdictCardProps) {
  const result = verdict(avgHr, zone);
  if (!result) return null;

  const cfg = STATUS_CONFIG[result.status];
  const Icon = cfg.icon;

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide mb-2">Đánh giá MAF</p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${cfg.badgeClass}`}>
            <Icon className="w-4 h-4" /> {cfg.label}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-white">
            {avgHr} <span className="text-sm font-medium text-white/50">bpm</span>
          </p>
          <p className="text-xs text-white/50 font-medium">
            Vùng MAF {zone.lower}-{zone.upper} bpm
          </p>
        </div>
      </div>
      {result.status !== 'in' && (
        <p className="mt-3 text-sm text-white/70">{DELTA_COPY[result.status](result.deltaBpm)}</p>
      )}
    </div>
  );
}
