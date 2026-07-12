import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Activity as ActivityIcon } from 'lucide-react';
import type { StravaActivity } from '../../services/strava-service';
import ActivityListMobile from './activity-list-mobile';
import ActivityTableDesktop from './activity-table-desktop';

interface ActivitySectionProps {
  activities: StravaActivity[];
  loading: boolean;
  error: boolean;
  mafHr: number;
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 p-6">
      <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      <span className="text-white/40 text-sm">Đang tải hoạt động...</span>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex items-center gap-2 p-6 text-white/50 text-sm">
      <AlertCircle className="w-4 h-4 text-maf-red shrink-0" />
      <span>Không tải được hoạt động.</span>
      <button
        onClick={() => window.location.reload()}
        className="text-maf-red hover:text-white transition-colors font-medium"
      >
        Thử lại
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
        <ActivityIcon className="w-6 h-6 text-white/30" />
      </div>
      <p className="text-white/50 text-sm max-w-xs">
        Chưa có hoạt động — kết nối Strava để đồng bộ.
      </p>
      <Link
        to="/profile"
        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-maf-red to-maf-violet hover:opacity-90 transition-opacity"
      >
        Kết nối Strava
      </Link>
    </div>
  );
}

/** Presentational: renders mobile cards + desktop table from props. No fetch here — see use-strava-activities.ts. */
export default function ActivitySection({ activities, loading, error, mafHr }: ActivitySectionProps) {
  const isEmpty = !loading && !error && activities.length === 0;

  const body = (mode: 'mobile' | 'desktop') => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState />;
    if (isEmpty) return <EmptyState />;
    return mode === 'mobile' ? (
      <ActivityListMobile activities={activities} mafHr={mafHr} />
    ) : (
      <ActivityTableDesktop activities={activities} mafHr={mafHr} />
    );
  };

  return (
    <>
      {/* Mobile: activity cards */}
      <div className="lg:hidden">
        <h3 className="text-base font-bold text-white mb-3 px-1">Lịch Sử Hoạt Động</h3>
        {body('mobile')}
      </div>

      {/* Desktop: data table */}
      <div className="hidden lg:block desktop-card overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Lịch sử hoạt động gần đây</h3>
          <a href="#" className="text-sm font-medium text-maf-red hover:text-white transition-colors">
            Xem tất cả
          </a>
        </div>
        {body('desktop')}
      </div>
    </>
  );
}
