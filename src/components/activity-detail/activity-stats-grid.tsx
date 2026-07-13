import type { ReactNode } from 'react';
import { Map, Timer, Clock, Gauge, HeartPulse, Mountain, Flame, Wind } from 'lucide-react';
import type { StravaActivity } from '../../services/strava-service';
import { formatDistanceKm, formatDuration, formatPace, formatSpeedKmh } from '../../utils/format-strava-activity';

interface ActivityStatsGridProps {
  activity: StravaActivity;
  /** Real kcal from the detail endpoint (hydrated later, phase-04). `activity.calories` is kJ — do not use it here. */
  detailCalories?: number | null;
}

interface StatTileData {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
}

function StatTile({ icon, label, value, accent }: StatTileData) {
  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide truncate">{label}</p>
        <p className="text-base font-black text-white truncate">{value}</p>
      </div>
    </div>
  );
}

/** Full stats grid derived from the summary `activity` alone — renders regardless of hydrated. */
export default function ActivityStatsGrid({ activity, detailCalories }: ActivityStatsGridProps) {
  const iconClass = 'w-5 h-5';

  const tiles: StatTileData[] = [
    {
      icon: <Map className={iconClass} />,
      label: 'Khoảng cách',
      value: formatDistanceKm(activity.distance),
      accent: 'bg-maf-violet/10 text-maf-violet',
    },
    {
      icon: <Timer className={iconClass} />,
      label: 'Thời gian chạy',
      value: formatDuration(activity.movingTime),
      accent: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      icon: <Clock className={iconClass} />,
      label: 'Tổng thời gian',
      value: formatDuration(activity.elapsedTime),
      accent: 'bg-slate-500/10 text-slate-300',
    },
    {
      icon: <Gauge className={iconClass} />,
      label: 'Pace TB',
      value: formatPace(activity),
      accent: 'bg-maf-red/10 text-maf-red',
    },
    {
      icon: <HeartPulse className={iconClass} />,
      label: 'Nhịp tim TB',
      value: activity.avgHeartRate != null ? `${activity.avgHeartRate} bpm` : '—',
      accent: 'bg-maf-red/10 text-maf-red',
    },
    {
      icon: <HeartPulse className={iconClass} />,
      label: 'Nhịp tim Max',
      value: activity.maxHeartRate != null ? `${activity.maxHeartRate} bpm` : '—',
      accent: 'bg-maf-red/10 text-maf-red',
    },
    {
      icon: <Mountain className={iconClass} />,
      label: 'Độ cao',
      value: activity.totalElevationGain != null ? `${Math.round(activity.totalElevationGain)} m` : '—',
      accent: 'bg-orange-500/10 text-orange-400',
    },
    {
      icon: <Flame className={iconClass} />,
      label: 'Calo',
      value: detailCalories != null ? `${Math.round(detailCalories)} kcal` : '—',
      accent: 'bg-orange-500/10 text-orange-400',
    },
    {
      icon: <Wind className={iconClass} />,
      label: 'Tốc độ TB',
      value: formatSpeedKmh(activity.avgSpeed),
      accent: 'bg-maf-violet/10 text-maf-violet',
    },
    {
      icon: <Wind className={iconClass} />,
      label: 'Tốc độ Max',
      value: formatSpeedKmh(activity.maxSpeed),
      accent: 'bg-maf-violet/10 text-maf-violet',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
