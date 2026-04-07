import { Watch, Activity, X } from 'lucide-react';

interface GarminAutoFillBannerProps {
  activityDate: string;
  avgHr: string;
  onDismiss: () => void;
  source?: 'garmin' | 'strava';
}

/** Small banner showing Garmin or Strava auto-fill source above MAF Lab HR input */
export default function GarminAutoFillBanner({
  activityDate,
  avgHr,
  onDismiss,
  source = 'garmin',
}: GarminAutoFillBannerProps) {
  const isStrava = source === 'strava';
  const colorClass = isStrava ? 'text-orange-400' : 'text-emerald-400';
  const borderClass = isStrava
    ? 'bg-orange-500/10 border-orange-500/30'
    : 'bg-emerald-500/10 border-emerald-500/30';
  const label = isStrava ? 'Strava' : 'Garmin';
  const Icon = isStrava ? Activity : Watch;

  return (
    <div className={`flex items-center justify-between ${borderClass} border rounded-lg px-4 py-2 mb-3`}>
      <div className={`flex items-center gap-2 text-sm ${colorClass}`}>
        <Icon className="w-4 h-4 shrink-0" />
        <span>
          Từ {label}: Chạy ngày {activityDate}, avg HR {avgHr} BPM
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="text-white/40 hover:text-white/70 transition-colors p-1"
        aria-label={`Bỏ qua dữ liệu ${label}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
