import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import { useJournalActivities } from '../hooks/use-journal-activities';
import { groupByWeek, monthlySummary, mafTrendSeries } from '../utils/journal-analytics';
import TodayCard from '../components/today/today-card';
import JournalStatsHeader from '../components/journal/journal-stats-header';
import MafTrendChart from '../components/journal/maf-trend-chart';
import WeekGroup from '../components/journal/week-group';
import {
  JournalLoading,
  JournalEmptyState,
  JournalError,
  LoadMoreError,
  NoMafBanner,
} from '../components/journal/journal-states';

function monthLabel(now: Date): string {
  return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
}

/** Running journal: current-month stats, long-term MAF trend, weekly-grouped history. */
export default function JournalPage() {
  const { userProfile, profileLoading } = useUserProfile();
  const { calculateRawMaf } = useMafCalculator();
  const mafHr = calculateRawMaf(userProfile) ?? 0; // null (incomplete profile) → 0 → analytics hidden
  const showMaf = mafHr > 0;

  const { activities, loading, loadingMore, error, loadMoreError, hasMore, loadMore } =
    useJournalActivities();

  // Recompute analytics only when the inputs change (RT: avoid per-render recompute).
  const { weeks, summary, trend } = useMemo(
    () => ({
      weeks: groupByWeek(activities, mafHr),
      summary: monthlySummary(activities, mafHr),
      trend: mafTrendSeries(activities, mafHr),
    }),
    [activities, mafHr],
  );

  const heading = (
    <div className="mb-6">
      <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">Nhật ký chạy</h1>
      <p className="text-slate-400 text-sm">Toàn bộ lịch sử chạy & tiến bộ MAF của bạn.</p>
    </div>
  );

  const wrap = (children: React.ReactNode) => (
    <div className="max-w-[1024px] mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-32 lg:pb-8">
      {heading}
      <div className="mb-6">
        <TodayCard variant="compact" />
      </div>
      {children}
    </div>
  );

  if (profileLoading || loading) return wrap(<JournalLoading />);
  if (error) return wrap(<JournalError />);
  if (activities.length === 0) return wrap(<JournalEmptyState />);

  return wrap(
    <div className="space-y-6">
      {!showMaf && <NoMafBanner />}
      <JournalStatsHeader summary={summary} monthLabel={monthLabel(new Date())} showMaf={showMaf} />
      {showMaf && <MafTrendChart points={trend} />}

      <div className="space-y-6">
        {weeks.map((group) => (
          <WeekGroup key={group.weekStart} group={group} mafHr={mafHr} showVerdict={showMaf} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        {loadMoreError && <LoadMoreError onRetry={loadMore} />}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-lg font-bold text-sm text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? 'Đang tải...' : 'Tải thêm'}
          </button>
        )}
      </div>
    </div>,
  );
}
