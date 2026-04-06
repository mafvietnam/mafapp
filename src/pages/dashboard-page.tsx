import { LinkIcon } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useUserProfile } from '../hooks/use-user-profile';
import { useMafCalculator } from '../hooks/use-maf-calculator';
import MafZoneCard from '../components/dashboard/maf-zone-card';
import DashboardCard from '../components/ui/dashboard-card';

export default function DashboardPage() {
  useAuth(); // Ensure authenticated
  const { userProfile, ageNum } = useUserProfile();
  const { calculateRawMaf } = useMafCalculator();
  const mafHr = calculateRawMaf(userProfile);

  return (
    <>
      {/* Desktop welcome banner */}
      <div className="hidden lg:flex max-w-[1440px] mx-auto px-8 py-8 justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Tổng quan hiệu suất</h2>
          <p className="text-slate-400">
            Theo dõi tiến độ phương pháp MAF của bạn.
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
          {/* Left column (mobile: full, desktop: 8/12) */}
          <div className="lg:col-span-8 space-y-5">
            {/* MAF Zone — functional widget */}
            {mafHr > 0 && ageNum > 0 && (
              <MafZoneCard mafHr={mafHr} age={ageNum} />
            )}

            {/* Activity chart — empty state */}
            <DashboardCard className="p-6">
              <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">
                Xu hướng nhịp tim
              </h3>
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <LinkIcon className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">Kết nối Strava để xem biểu đồ</p>
                </div>
              </div>
            </DashboardCard>

            {/* Activity list — empty state */}
            <DashboardCard className="p-6">
              <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">
                Hoạt động gần đây
              </h3>
              <div className="h-32 flex items-center justify-center">
                <p className="text-white/40 text-sm">
                  Chưa có hoạt động nào. Kết nối Strava để đồng bộ.
                </p>
              </div>
            </DashboardCard>
          </div>

          {/* Right column (desktop sidebar: 4/12, hidden on mobile) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Assistant placeholder */}
            <DashboardCard className="p-4">
              <h3 className="text-white font-bold text-[15px] mb-2">
                Trợ lý MAF
              </h3>
              <p className="text-white/40 text-sm">Sắp ra mắt...</p>
            </DashboardCard>

            {/* Ecosystem links placeholder */}
            <DashboardCard className="p-4">
              <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">
                Hệ sinh thái
              </h3>
              <p className="text-white/40 text-sm">Sắp ra mắt...</p>
            </DashboardCard>
          </div>
        </div>
      </div>
    </>
  );
}
