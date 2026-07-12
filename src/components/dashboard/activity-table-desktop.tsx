import { LinkIcon, AlertTriangle } from 'lucide-react';
import type { StravaActivity } from '../../services/strava-service';
import {
  formatActivityDate,
  formatDistanceKm,
  formatPace,
  hrZone,
} from '../../utils/format-strava-activity';

interface ActivityTableDesktopProps {
  activities: StravaActivity[];
  mafHr: number;
}

/** Presentational desktop table — preserves the desktop-card design from the original ActivitySection. */
export default function ActivityTableDesktop({ activities, mafHr }: ActivityTableDesktopProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500 bg-white/5 border-b border-white/5">
          <tr>
            <th className="px-6 py-4 font-bold">Ngày</th>
            <th className="px-6 py-4 font-bold">Bài tập</th>
            <th className="px-6 py-4 font-bold">Khoảng cách</th>
            <th className="px-6 py-4 font-bold">Pace (Avg)</th>
            <th className="px-6 py-4 font-bold">Nhịp tim (Avg)</th>
            <th className="px-6 py-4 font-bold text-right">Nguồn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {activities.map((a) => {
            const zone = hrZone(a.avgHeartRate, mafHr);
            return (
              <tr key={a.id} className="hover:bg-white/5 transition-colors group">
                <td className="px-6 py-4 text-slate-300">{formatActivityDate(a.startDate)}</td>
                <td className="px-6 py-4 font-bold text-white group-hover:text-maf-red transition-colors cursor-pointer flex items-center gap-2">
                  {zone.warn && <AlertTriangle className="w-3.5 h-3.5 text-maf-red" />}
                  {a.name}
                </td>
                <td className="px-6 py-4">{formatDistanceKm(a.distance)}</td>
                <td className="px-6 py-4 font-bold text-white">{formatPace(a)}</td>
                <td className={`px-6 py-4 font-bold ${zone.colorClass}`}>{zone.label}</td>
                <td className="px-6 py-4 text-right">
                  <LinkIcon className="w-4 h-4 text-slate-500 inline" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
