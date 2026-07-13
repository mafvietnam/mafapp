import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { StravaSplitMetric } from '../../services/strava-service';
import type { MafZone } from '../../utils/maf-activity-analysis';
import { formatDuration } from '../../utils/format-strava-activity';

interface SplitsTableProps {
  splits: StravaSplitMetric[];
  zone: MafZone;
}

/** Collapse long split lists (marathons etc.) behind a toggle. */
const VISIBLE_ROWS = 10;

/** m/s average split speed -> "m:ss /km" (mirrors formatPace's mm:ss/km convention, see format-strava-activity.ts). */
function formatSplitPace(averageSpeed: number): string {
  if (!averageSpeed || averageSpeed <= 0) return '—';
  const secPerKm = 1000 / averageSpeed;
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const totalSec = Math.round(secPerKm);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

function hrColorClass(hr: number | undefined, zone: MafZone): string {
  if (hr == null) return 'text-white/40';
  if (hr > zone.upper) return 'text-maf-red';
  if (hr < zone.lower) return 'text-maf-violet';
  return 'text-emerald-400';
}

/** Per-km auto-lap splits (Strava splits_metric) with pace + MAF-flagged avg HR. */
export default function SplitsTable({ splits, zone }: SplitsTableProps) {
  const [expanded, setExpanded] = useState(false);
  if (!splits.length) return null;

  const visible = expanded ? splits : splits.slice(0, VISIBLE_ROWS);
  const hasMore = splits.length > VISIBLE_ROWS;

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
      <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide mb-4">Phân đoạn theo km</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500 border-b border-white/5">
            <tr>
              <th className="py-2 pr-4 font-bold">Km</th>
              <th className="py-2 pr-4 font-bold">Pace</th>
              <th className="py-2 pr-4 font-bold">Thời gian</th>
              <th className="py-2 pr-4 font-bold">Nhịp tim TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.map((s) => {
              const overMaf = s.average_heartrate != null && s.average_heartrate > zone.upper;
              return (
                <tr key={s.split}>
                  <td className="py-2 pr-4 font-bold text-white">{s.split}</td>
                  <td className="py-2 pr-4 text-white">{formatSplitPace(s.average_speed)}</td>
                  <td className="py-2 pr-4 text-white/70">{formatDuration(s.moving_time)}</td>
                  <td className={`py-2 pr-4 font-bold ${hrColorClass(s.average_heartrate, zone)}`}>
                    <span className="inline-flex items-center gap-1.5">
                      {overMaf && <AlertTriangle className="w-3.5 h-3.5 text-maf-red" />}
                      {s.average_heartrate != null ? `${Math.round(s.average_heartrate)} bpm` : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm font-medium text-maf-red hover:text-white transition-colors"
        >
          {expanded ? 'Thu gọn' : `Xem tất cả ${splits.length} phân đoạn`}
        </button>
      )}
    </div>
  );
}
