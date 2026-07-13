import { Gauge } from 'lucide-react';
import type { StravaActivityDetailResponse } from '../../services/strava-service';
import { aerobicEfficiency, type MafZone } from '../../utils/maf-activity-analysis';
import { HydrationNotice, NoHrNotice, ProfileNoticeCard } from './degradation-notices';
import MafVerdictCard from './maf-verdict-card';
import TimeInZoneBar from './time-in-zone-bar';
import HrChart from './hr-chart';
import SplitsTable from './splits-table';
import CardiacDriftCard from './cardiac-drift-card';

interface ActivityDetailSectionsProps {
  data: StravaActivityDetailResponse;
  mafHr: number;
  zone: MafZone;
  refetch: () => void;
}

interface AerobicEfficiencyTileProps {
  avgSpeed: number | null;
  avgHr: number | null;
}

/** Trivial derived stat tile — inlined here per phase-04 scope, not worth a dedicated file. */
function AerobicEfficiencyTile({ avgSpeed, avgHr }: AerobicEfficiencyTileProps) {
  const efficiency = aerobicEfficiency(avgSpeed, avgHr);
  if (efficiency == null) return null;

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
        <Gauge className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide truncate">Hiệu suất hiếu khí</p>
        <p className="text-base font-black text-white truncate">{efficiency} m/nhịp</p>
      </div>
    </div>
  );
}

/**
 * Composes the MAF analysis section tree + degradation branching so
 * activity-detail-page.tsx stays a thin router. Rendered by the page below
 * the header + stats grid, which always render regardless of tier below.
 */
export default function ActivityDetailSections({ data, mafHr, zone, refetch }: ActivityDetailSectionsProps) {
  const { activity, detail, streams, hydrated, reason } = data;

  return (
    <div className="mt-6 space-y-4 lg:space-y-6">
      {/* Strava-sourced free text — plain text only, never dangerouslySetInnerHTML (XSS). */}
      {hydrated && detail?.description && (
        <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide mb-2">Mô tả</p>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{detail.description}</p>
        </div>
      )}

      {!hydrated ? (
        <HydrationNotice reason={reason} onRetry={refetch} />
      ) : mafHr <= 0 ? (
        <ProfileNoticeCard />
      ) : (
        <>
          <MafVerdictCard avgHr={activity.avgHeartRate} zone={zone} />

          {streams ? (
            <>
              <TimeInZoneBar heartrate={streams.heartrate} time={streams.time} zone={zone} />
              <HrChart streams={streams} zone={zone} avgHr={activity.avgHeartRate} />
            </>
          ) : (
            <NoHrNotice />
          )}

          {detail?.splitsMetric && detail.splitsMetric.length > 0 && (
            <SplitsTable splits={detail.splitsMetric} zone={zone} />
          )}

          {streams?.velocitySmooth && <CardiacDriftCard streams={streams} />}

          <AerobicEfficiencyTile avgSpeed={activity.avgSpeed} avgHr={activity.avgHeartRate} />
        </>
      )}
    </div>
  );
}
