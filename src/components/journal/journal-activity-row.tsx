import { Link } from 'react-router-dom';
import { Footprints, Flame } from 'lucide-react';
import type { StravaActivity } from '../../services/strava-service';
import { formatActivityDate, formatDistanceKm, formatPace } from '../../utils/format-strava-activity';
import { verdict } from '../../utils/maf-activity-analysis';

interface JournalActivityRowProps {
  activity: StravaActivity;
  mafHr: number;
  showVerdict: boolean; // false when MAF unconfigured → hide the badge
}

interface Badge {
  label: string;
  className: string;
  warn: boolean;
}

/** Map the 3-state MAF verdict to a colored badge. Null when no HR / MAF hidden. */
function verdictBadge(avgHr: number | null, mafHr: number, showVerdict: boolean): Badge | null {
  if (!showVerdict || avgHr == null) return null;
  const v = verdict(avgHr, { lower: mafHr - 10, upper: mafHr });
  if (!v) return null;
  switch (v.status) {
    case 'in':
      return { label: 'Đúng vùng', className: 'text-emerald-400 bg-emerald-400/10', warn: false };
    case 'above':
      return { label: `Vượt +${v.deltaBpm}`, className: 'text-maf-red bg-maf-red/10', warn: true };
    case 'below':
      return { label: `Dưới -${v.deltaBpm}`, className: 'text-slate-300 bg-white/5', warn: false };
  }
}

/** One run in the journal — click opens the detail page. Mirrors the dashboard mobile card. */
export default function JournalActivityRow({ activity, mafHr, showVerdict }: JournalActivityRowProps) {
  const badge = verdictBadge(activity.avgHeartRate, mafHr, showVerdict);
  const hrText = activity.avgHeartRate != null ? `${activity.avgHeartRate} bpm` : '—';

  return (
    <Link to={`/activities/${activity.id}`} className="block">
      <div className="flex items-center justify-between p-3 glass-card rounded-[16px] transition-colors hover:bg-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={
              badge?.warn
                ? 'w-10 h-10 rounded-full bg-maf-red/30 flex items-center justify-center shrink-0 border border-maf-red/40'
                : 'w-10 h-10 rounded-full bg-black/40 flex items-center justify-center shrink-0 border border-white/10'
            }
          >
            {badge?.warn ? (
              <Flame className="w-4 h-4 text-maf-red" />
            ) : (
              <Footprints className="w-4 h-4 text-maf-violet" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-[14px] truncate">{activity.name}</p>
            <p className="text-[11px] font-medium text-white/60 mt-0.5">
              {formatActivityDate(activity.startDate)} &bull; {formatDistanceKm(activity.distance)} &bull; {hrText}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="font-bold text-white text-base tracking-tight">{formatPace(activity)}</p>
          {badge && (
            <span className={`inline-block text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
