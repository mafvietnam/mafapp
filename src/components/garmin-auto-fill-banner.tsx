import { Watch, X } from 'lucide-react';

interface GarminAutoFillBannerProps {
  activityDate: string;
  avgHr: string;
  onDismiss: () => void;
}

/** Small banner showing Garmin auto-fill source above MAF Lab HR input */
export default function GarminAutoFillBanner({
  activityDate,
  avgHr,
  onDismiss,
}: GarminAutoFillBannerProps) {
  return (
    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 mb-3">
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <Watch className="w-4 h-4 shrink-0" />
        <span>
          Từ Garmin: Chạy ngày {activityDate}, avg HR {avgHr} BPM
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="text-white/40 hover:text-white/70 transition-colors p-1"
        aria-label="Bỏ qua dữ liệu Garmin"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
