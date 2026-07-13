import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

/** Spinner shown while the activity detail is loading — matches the dashboard's loader style. */
export function DetailSkeleton() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-maf-violet border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

interface DetailErrorStateProps {
  /** Optional retry handler — omitted for a hard 404 (invalid/other-user id), shown for transient failures. */
  onRetry?: () => void;
}

/** Shown when the activity can't be loaded (unknown/other-user id, network error). */
export function DetailErrorState({ onRetry }: DetailErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-maf-red/10 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-maf-red" />
      </div>
      <div>
        <p className="text-white font-bold text-lg mb-1">Không tìm thấy hoạt động</p>
        <p className="text-white/50 text-sm max-w-xs">
          Hoạt động không tồn tại, đã bị xóa, hoặc bạn không có quyền xem.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
          >
            Thử lại
          </button>
        )}
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity"
        >
          Về Trang chủ
        </Link>
      </div>
    </div>
  );
}
