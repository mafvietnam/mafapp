import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Activity as ActivityIcon, Info } from 'lucide-react';

/** Spinner shown during the initial journal load. */
export function JournalLoading() {
  return (
    <div className="flex items-center justify-center gap-3 py-20">
      <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      <span className="text-white/40 text-sm">Đang tải nhật ký...</span>
    </div>
  );
}

/**
 * Shown only after ALL windows are exhausted with zero runs. Copy is neutral:
 * a connected user may simply have no runs in range, so we must not assert "not
 * connected" — just point them to the profile where they can connect/sync.
 */
export function JournalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
        <ActivityIcon className="w-6 h-6 text-white/30" />
      </div>
      <p className="text-white/50 text-sm max-w-xs">
        Chưa có buổi chạy nào trong nhật ký. Kết nối Strava hoặc đồng bộ để bắt đầu.
      </p>
      <Link
        to="/profile"
        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity"
      >
        Đến trang Hồ sơ
      </Link>
    </div>
  );
}

/** Full-page error — only used when the INITIAL load failed (nothing rendered yet). */
export function JournalError() {
  return (
    <div className="flex items-center gap-2 py-16 justify-center text-white/50 text-sm">
      <AlertCircle className="w-4 h-4 text-maf-red shrink-0" />
      <span>Không tải được nhật ký.</span>
      <button
        onClick={() => window.location.reload()}
        className="text-maf-red hover:text-white transition-colors font-medium"
      >
        Thử lại
      </button>
    </div>
  );
}

/** Inline, non-clobbering "Tải thêm" failure — loaded weeks stay on screen. */
export function LoadMoreError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-maf-red">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="text-white/60">Tải thêm thất bại.</span>
      <button onClick={onRetry} className="font-bold text-maf-red hover:text-white transition-colors">
        Thử lại
      </button>
    </div>
  );
}

/** Amber prompt when MAF is not configured (profile incomplete) — analytics hidden. */
export function NoMafBanner() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
      <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-100/90">
        Cập nhật hồ sơ (tuổi, sức khỏe) để xem phân tích MAF cho từng buổi chạy.{' '}
        <Link to="/profile" className="font-bold underline hover:text-white transition-colors">
          Cập nhật hồ sơ
        </Link>
      </p>
    </div>
  );
}
