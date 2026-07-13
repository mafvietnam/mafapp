import { timeInZone, type MafZone } from '../../utils/maf-activity-analysis';
import { formatDuration } from '../../utils/format-strava-activity';

interface TimeInZoneBarProps {
  heartrate: number[] | undefined;
  time: number[] | undefined;
  zone: MafZone;
}

const SEGMENTS = [
  { key: 'belowPct' as const, secKey: 'belowSec' as const, label: 'Dưới vùng', barClass: 'bg-maf-violet/70', dotClass: 'bg-maf-violet' },
  { key: 'inPct' as const, secKey: 'inSec' as const, label: 'Trong vùng', barClass: 'bg-emerald-400', dotClass: 'bg-emerald-400' },
  { key: 'abovePct' as const, secKey: 'aboveSec' as const, label: 'Trên vùng', barClass: 'bg-maf-red', dotClass: 'bg-maf-red' },
];

/** Stacked % bar of time spent below/in/above the MAF heart-rate band, time-weighted (see maf-activity-analysis.timeInZone). */
export default function TimeInZoneBar({ heartrate, time, zone }: TimeInZoneBarProps) {
  const result = timeInZone(heartrate, time, zone);
  if (!result) return null;

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
      <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide mb-3">Thời gian trong vùng MAF</p>

      <div className="flex h-3 rounded-full overflow-hidden bg-black/40">
        {SEGMENTS.map((seg) => (
          <div
            key={seg.key}
            className={seg.barClass}
            style={{ width: `${result[seg.key]}%` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${seg.dotClass}`} />
            <span className="text-white/70">{seg.label}</span>
            <span className="font-bold text-white">{result[seg.key]}%</span>
            <span className="text-white/40 text-xs">({formatDuration(result[seg.secKey])})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
