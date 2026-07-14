import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface TodayCardSyncBannerProps {
  lastSyncAt: string | null;
  staleSync: boolean;
  todayAck: boolean;
  onAck: () => void;
}

function formatLastSync(iso: string | null): string {
  if (!iso) return 'chưa từng';
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${min} ${dd}/${mm}`;
}

/**
 * RED TEAM FIX #12: a missing/stale Strava sync must never silently imply
 * rest/GREEN. Surfaces the last-sync timestamp + a manual "đã chạy hôm nay"
 * ack that suppresses a false "missed" on the adherence strip.
 */
export default function TodayCardSyncBanner({ lastSyncAt, staleSync, todayAck, onAck }: TodayCardSyncBannerProps) {
  if (todayAck) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Đã ghi nhận bạn chạy hôm nay
      </div>
    );
  }

  if (!staleSync) {
    return (
      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3 shrink-0" />
        Lần đồng bộ gần nhất: {formatLastSync(lastSyncAt)}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <p className="text-[11px] text-slate-400">
        Chưa đồng bộ hoạt động hôm nay? Lần đồng bộ gần nhất: {formatLastSync(lastSyncAt)}.
      </p>
      <button
        onClick={onAck}
        className="shrink-0 text-[11px] font-bold text-maf-violet bg-maf-violet/10 hover:bg-maf-violet/20 border border-maf-violet/30 rounded-full px-3 py-1.5 transition-colors"
      >
        Tôi đã chạy hôm nay
      </button>
    </div>
  );
}
