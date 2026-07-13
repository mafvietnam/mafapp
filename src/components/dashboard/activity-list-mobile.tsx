import { Link } from 'react-router-dom';
import { Footprints, Flame, AlertCircle } from 'lucide-react';
import type { StravaActivity } from '../../services/strava-service';
import { formatActivityDate, formatPace, hrZone } from '../../utils/format-strava-activity';

interface ActivityListMobileProps {
  activities: StravaActivity[];
  mafHr: number;
}

/** Presentational mobile card list — preserves the glass-card design from the original ActivitySection. */
export default function ActivityListMobile({ activities, mafHr }: ActivityListMobileProps) {
  return (
    <div className="space-y-2.5">
      {activities.map((a) => {
        const zone = hrZone(a.avgHeartRate, mafHr);
        const minutes = a.movingTime > 0 ? Math.round(a.movingTime / 60) : 0;

        return (
          <Link key={a.id} to={`/activities/${a.id}`} className="block">
            <div className="flex items-center justify-between p-3 glass-card rounded-[16px] transition-colors hover:bg-white/[0.08]">
              <div className="flex items-center gap-3">
                <div
                  className={
                    zone.warn
                      ? 'w-10 h-10 rounded-full bg-maf-red/30 text-white flex items-center justify-center shrink-0 border border-maf-red/40 shadow-[0_0_10px_rgba(244,42,104,0.3)]'
                      : 'w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center shrink-0 border border-white/10'
                  }
                >
                  {zone.warn ? (
                    <Flame className="w-4 h-4 text-maf-red" />
                  ) : (
                    <Footprints className="w-4 h-4 text-maf-violet" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-white text-[14px]">{a.name}</p>
                  <p className="text-[11px] font-medium text-white/60 mt-0.5">
                    {formatActivityDate(a.startDate)} &bull; {minutes} phút
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-white text-base tracking-tight">{formatPace(a)}</p>
                <p className={`text-[10px] font-bold mt-0.5 flex items-center justify-end gap-1 ${zone.colorClass}`}>
                  {zone.warn && <AlertCircle className="w-2.5 h-2.5" />} {zone.label}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
