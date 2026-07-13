import { Link } from 'react-router-dom';
import { AlertCircle, HeartOff, UserCog } from 'lucide-react';
import type { StravaActivityDetailResponse } from '../../services/strava-service';

type HydrationReason = StravaActivityDetailResponse['reason'];

interface HydrationCopy {
  message: string;
  /** Retry button omitted entirely (deleted — nothing a retry can fix). */
  hideRetry?: boolean;
  /** Retry button shown but disabled (rate_limited — don't hammer the shared Strava quota). */
  disableRetry?: boolean;
}

const REASON_COPY: Record<NonNullable<HydrationReason>, HydrationCopy> = {
  deleted: { message: 'Hoạt động đã bị xoá trên Strava.', hideRetry: true },
  unauthorized: { message: 'Kết nối Strava cần được cấp lại quyền.' },
  rate_limited: {
    message: 'Strava đang giới hạn truy cập, thử lại sau ~15 phút.',
    disableRetry: true,
  },
  error: { message: 'Không tải được chi tiết.' },
};

interface HydrationNoticeProps {
  reason: HydrationReason;
  onRetry: () => void;
}

/**
 * Shown when `hydrated:false` — the detail/streams fetch from Strava failed
 * or hasn't landed yet. The summary stats grid still renders alongside this
 * (see activity-detail-sections.tsx), only the MAF analysis is unavailable.
 */
export function HydrationNotice({ reason, onRetry }: HydrationNoticeProps) {
  const copy = REASON_COPY[reason ?? 'error'];

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-5 flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-maf-red/10 flex items-center justify-center shrink-0">
        <AlertCircle className="w-5 h-5 text-maf-red" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white mb-0.5">Chưa có phân tích MAF chi tiết</p>
        <p className="text-sm text-white/60">{copy.message}</p>
        {!copy.hideRetry && (
          <button
            onClick={onRetry}
            disabled={copy.disableRetry}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-bold text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/10"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}

/** Hydrated activity with no heartrate stream (manual entry, no HR strap, etc.) — MAF-by-second sections are hidden. */
export function NoHrNotice() {
  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
        <HeartOff className="w-5 h-5 text-white/40" />
      </div>
      <p className="text-sm text-white/60">
        Hoạt động này không có dữ liệu nhịp tim — các phân tích MAF theo nhịp tim bị ẩn.
      </p>
    </div>
  );
}

/** No MAF HR configured (age missing from profile) — all MAF sections hidden, guide user to /plan. */
export function ProfileNoticeCard() {
  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-maf-violet/10 flex items-center justify-center shrink-0">
        <UserCog className="w-5 h-5 text-maf-violet" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70">Hoàn tất hồ sơ (tuổi) để xem phân tích vùng MAF.</p>
      </div>
      <Link
        to="/plan"
        className="shrink-0 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity"
      >
        Hoàn tất hồ sơ
      </Link>
    </div>
  );
}
