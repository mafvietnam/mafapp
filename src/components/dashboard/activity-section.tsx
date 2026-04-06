import { LinkIcon } from 'lucide-react';

/** Activity history — empty state for both mobile and desktop (no Strava yet) */
export default function ActivitySection() {
  return (
    <>
      {/* Mobile: empty state */}
      <div className="lg:hidden">
        <h3 className="text-base font-bold text-white mb-3 px-1">Lịch Sử Hoạt Động</h3>
        <div className="glass-card rounded-[20px] p-6 flex flex-col items-center justify-center">
          <LinkIcon className="w-8 h-8 text-white/20 mb-3" />
          <p className="text-white/50 text-sm text-center">
            Kết nối Strava để đồng bộ hoạt động chạy bộ
          </p>
          <button className="mt-4 bg-[#FC4C02]/20 text-[#FC4C02] border border-[#FC4C02]/30 rounded-full px-4 py-2 text-xs font-bold">
            Kết nối Strava
          </button>
        </div>
      </div>

      {/* Desktop: empty table */}
      <div className="hidden lg:block desktop-card overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Lịch sử hoạt động gần đây</h3>
        </div>
        <div className="p-8 flex flex-col items-center justify-center">
          <LinkIcon className="w-10 h-10 text-white/15 mb-3" />
          <p className="text-slate-500 text-sm mb-4">
            Chưa có hoạt động nào. Kết nối Strava để đồng bộ dữ liệu chạy bộ.
          </p>
          <button className="bg-[#FC4C02]/10 text-[#FC4C02] border border-[#FC4C02]/30 rounded-lg px-6 py-2.5 text-sm font-bold hover:bg-[#FC4C02]/20 transition-all">
            Kết nối Strava
          </button>
        </div>
      </div>
    </>
  );
}
