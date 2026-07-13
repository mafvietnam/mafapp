import { useParams } from 'react-router-dom';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import { useStravaActivityDetail } from '../hooks/use-strava-activity-detail';
import ActivityDetailHeader from '../components/activity-detail/activity-detail-header';
import ActivityStatsGrid from '../components/activity-detail/activity-stats-grid';
import ActivityDetailSections from '../components/activity-detail/activity-detail-sections';
import { DetailSkeleton, DetailErrorState } from '../components/activity-detail/detail-states';

/**
 * Single-activity detail page — header + full stats grid render from the summary
 * `activity` alone, so the page works even when `hydrated:false` (detail fetch
 * from Strava failed/pending). MAF analysis, charts and degradation states are
 * composed in <ActivityDetailSections/> to keep this page a thin router.
 */
export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useStravaActivityDetail(id);

  const { userProfile } = useUserProfile();
  const { calculateRawMaf } = useMafCalculator();
  const mafHr = calculateRawMaf(userProfile) ?? 0;
  const zone = { lower: mafHr - 10, upper: mafHr };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
      {loading && <DetailSkeleton />}

      {!loading && (error || !data) && <DetailErrorState onRetry={refetch} />}

      {!loading && !error && data && (
        <>
          <ActivityDetailHeader activity={data.activity} />
          <ActivityStatsGrid activity={data.activity} detailCalories={data.detail?.calories} />
          <ActivityDetailSections data={data} mafHr={mafHr} zone={zone} refetch={refetch} />
        </>
      )}
    </div>
  );
}
