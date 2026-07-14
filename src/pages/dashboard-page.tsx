import { Plus } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import { useStravaActivities } from '../hooks/use-strava-activities';
import MafZoneCard from '../components/dashboard/maf-zone-card';
import TodayCard from '../components/today/today-card';
import EcosystemSection from '../components/dashboard/ecosystem-section';
import DesktopStatsRow from '../components/dashboard/desktop-stats-row';
import ChartPlaceholder from '../components/dashboard/chart-placeholder';
import MafFormulaWidget from '../components/dashboard/maf-formula-widget';
import ActivitySection from '../components/dashboard/activity-section';
import TracklogUploadCard from '../components/tracklog-upload-card';

export default function DashboardPage() {
  const { user } = useAuth();
  const { userProfile, ageNum } = useUserProfile();
  const { calculateRawMaf } = useMafCalculator();
  const mafHr = calculateRawMaf(userProfile);
  // Fetched ONCE here — both ActivitySection mounts below (mobile + desktop) share
  // this single result via props (CSS-only visibility toggle, both are always mounted).
  const { activities, loading: activitiesLoading, error: activitiesError, refetch: refetchActivities } = useStravaActivities();

  return (
    <>
      {/* ===== MOBILE LAYOUT (< lg) ===== */}
      <div className="lg:hidden relative">
        {/* Banner background image with gradient overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url('https://maf.run/wp-content/uploads/2026/03/banner.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-maf-dark/40 via-maf-dark/80 to-maf-dark z-0" />

        {/* Mobile header */}
        <header className="pt-12 pb-4 px-6 flex justify-between items-start shrink-0 z-10 relative">
          <div>
            <h1 className="text-[28px] font-black italic tracking-tighter leading-tight mb-1 bg-gradient-to-r from-maf-red to-maf-violet bg-clip-text text-transparent">
              MAF RUNNING
            </h1>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white ml-0.5">
              run slow race fast
            </p>
          </div>
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-11 h-11 rounded-full bg-slate-800/80 border border-white/20 shadow-lg shrink-0 ml-2"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-slate-800/80 border border-white/20 shadow-lg shrink-0 ml-2 flex items-center justify-center text-white/60 text-sm font-bold">
              {user?.name?.charAt(0) || '?'}
            </div>
          )}
        </header>

        {/* Mobile content */}
        <main className="relative z-10 px-6 pt-2 space-y-5 pb-32">
          <TodayCard variant="prominent" />
          {mafHr > 0 && ageNum > 0 && <MafZoneCard mafHr={mafHr} age={ageNum} />}
          <EcosystemSection />
          <TracklogUploadCard onImported={refetchActivities} />
          <ActivitySection
            activities={activities}
            loading={activitiesLoading}
            error={activitiesError}
            mafHr={mafHr}
          />
        </main>
      </div>

      {/* ===== DESKTOP LAYOUT (>= lg) ===== */}
      <div className="hidden lg:block">
        {/* Banner bg image overlay (desktop) */}
        <div
          className="absolute top-0 left-0 w-full h-[400px] bg-cover bg-center z-0 opacity-30"
          style={{ backgroundImage: "url('https://maf.run/wp-content/uploads/2026/03/banner.webp')" }}
        />
        <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-maf-dark/50 to-maf-dark z-0" />

        <div className="max-w-[1440px] mx-auto px-8 py-8 relative z-10">
          {/* Welcome banner */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Tổng quan hiệu suất</h2>
              <p className="text-slate-400">
                Theo dõi tiến độ phương pháp MAF của bạn trong 30 ngày qua.
              </p>
            </div>
            <button className="bg-gradient-to-r from-maf-red to-maf-violet text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-[0_4px_15px_rgba(244,42,104,0.3)] hover:shadow-[0_6px_20px_rgba(244,42,104,0.5)] hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" /> Ghi hoạt động mới
            </button>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Left column 8/12 */}
            <div className="col-span-8 flex flex-col gap-8">
              <DesktopStatsRow mafHr={mafHr} />
              <ChartPlaceholder />
              <TracklogUploadCard onImported={refetchActivities} />
              <ActivitySection
                activities={activities}
                loading={activitiesLoading}
                error={activitiesError}
                mafHr={mafHr}
              />
            </div>

            {/* Right column 4/12 */}
            <div className="col-span-4 flex flex-col gap-8">
              <TodayCard variant="prominent" />
              <MafFormulaWidget />
              <EcosystemSection />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
