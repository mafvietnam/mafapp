import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import DashboardCard from '../ui/dashboard-card';
import { useTodayRecommendation } from '../../hooks/use-today-recommendation';
import TodayCardWorkoutSummary from './today-card-workout-summary';
import TodayCardReasons from './today-card-reasons';
import TodayCardSyncBanner from './today-card-sync-banner';
import CheckinMiniForm from './checkin-mini-form';
import AdherenceStrip from './adherence-strip';
import GuidanceCardList from './guidance-card-list';

interface TodayCardProps {
  variant: 'prominent' | 'compact';
}

const CHILD_TITLE = 'Hôm nay: Vui chơi tự nhiên';

/**
 * Shared "Today" recommendation card — prominent on Dashboard, compact on
 * Journal. Self-contained: runs its own data hook, no props besides `variant`.
 * RED TEAM FIX #6: child (age<16) gets a play-only render, no HR zone, no
 * workout breakdown, no check-in form, no adherence strip.
 */
export default function TodayCard({ variant }: TodayCardProps) {
  const {
    loading,
    isChild,
    hasProfile,
    recommendation,
    guidanceCards,
    adherence,
    lastSyncAt,
    staleSync,
    todayAck,
    ackRanToday,
    checkin,
    checkinSubmitting,
    submitCheckin,
  } = useTodayRecommendation();

  const compact = variant === 'compact';
  const padding = compact ? 'p-4' : 'p-4 lg:p-5';

  if (loading) {
    return (
      <DashboardCard className={`${padding} flex items-center justify-center min-h-[120px]`}>
        <Loader2 className="w-6 h-6 text-maf-violet animate-spin" />
      </DashboardCard>
    );
  }

  if (!hasProfile) {
    return (
      <DashboardCard className={`${padding} space-y-2`}>
        <h3 className="font-bold text-white text-[15px] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-maf-violet" /> Hôm nay tập gì?
        </h3>
        <p className="text-[12px] text-slate-400">
          Hoàn thiện hồ sơ MAF để nhận gợi ý tập luyện hôm nay dựa trên lịch tập cá nhân của bạn.
        </p>
        <Link
          to="/plan"
          className="inline-block text-[12px] font-bold text-maf-violet bg-maf-violet/10 hover:bg-maf-violet/20 border border-maf-violet/30 rounded-full px-3 py-1.5 transition-colors"
        >
          Thiết lập hồ sơ MAF
        </Link>
      </DashboardCard>
    );
  }

  if (isChild || !recommendation) {
    // RED TEAM FIX #6: age<16 short-circuit — no structured workout, no HR zone.
    return (
      <DashboardCard className={`${padding} space-y-2`}>
        <h3 className="font-bold text-white text-[15px]">{isChild ? CHILD_TITLE : 'Hôm nay tập gì?'}</h3>
        <p className="text-[12px] text-slate-400">
          {isChild
            ? recommendation?.restCopy ??
              'Trẻ dưới 16 tuổi: hãy VUI CHƠI tự nhiên (chạy nhảy, bơi, đạp xe) — không theo lịch tập có cấu trúc.'
            : 'Chưa thể tính gợi ý hôm nay — vui lòng kiểm tra lại hồ sơ MAF.'}
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard className={`${padding} space-y-3`}>
      <TodayCardWorkoutSummary rec={recommendation} compact={compact} />
      <TodayCardSyncBanner lastSyncAt={lastSyncAt} staleSync={staleSync} todayAck={todayAck} onAck={ackRanToday} />
      {!compact && <TodayCardReasons reasons={recommendation.reasons} />}
      <GuidanceCardList cards={guidanceCards} compact={compact} />
      {!compact && (
        <CheckinMiniForm existing={checkin} submitting={checkinSubmitting} onSubmit={submitCheckin} />
      )}
      {!compact && <AdherenceStrip days={adherence} />}
    </DashboardCard>
  );
}
