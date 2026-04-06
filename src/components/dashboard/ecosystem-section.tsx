import { Users, Award, ShoppingBag, Shirt, ChevronRight, Dumbbell } from 'lucide-react';

const MOBILE_ICONS = [
  { icon: Users, label: 'Tìm HLV Elite', sub: 'Giáo án cá nhân', color: 'cyan' },
  { icon: Award, label: 'Thử thách', sub: 'Thi đấu theo Tỉnh', color: 'orange' },
  { icon: ShoppingBag, label: 'Dinh dưỡng', sub: 'Sản phẩm MAF', color: 'emerald' },
  { icon: Shirt, label: 'Đặt áo CLB', sub: 'Trang phục team', color: 'violet' },
];

const DESKTOP_LINKS = [
  { icon: Users, label: 'Tìm HLV Elite', sub: 'Kết nối chuyên gia MAF', color: 'cyan' },
  { icon: Dumbbell, label: 'Tập bổ trợ', sub: 'Tăng cường sức mạnh', color: 'orange' },
  { icon: ShoppingBag, label: 'Dinh dưỡng MAF', sub: 'Thực phẩm hỗ trợ chạy', color: 'emerald' },
];

const colorMap: Record<string, string> = {
  cyan: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
  orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
  emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  violet: 'bg-violet-500/20 border-violet-500/30 text-violet-400',
};

const desktopColorMap: Record<string, string> = {
  cyan: 'bg-cyan-500/10 text-cyan-400',
  orange: 'bg-orange-500/10 text-orange-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
};

export default function EcosystemSection() {
  return (
    <>
      {/* Mobile: expandable icons */}
      <div className="lg:hidden">
        <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="text-base font-bold text-white">Khám phá Hệ sinh thái</h3>
          <button className="text-[12px] text-white/80 font-medium hover:text-white transition-colors">
            Xem tất cả
          </button>
        </div>
        <div className="flex justify-between items-center w-full pb-2">
          {MOBILE_ICONS.map(({ icon: Icon, label, sub, color }) => (
            <div
              key={label}
              className="group flex items-center glass-card rounded-full p-1.5 cursor-pointer hover:bg-white/10 transition-all duration-500 ease-out shrink-0"
            >
              <div
                className={`w-12 h-12 rounded-full ${colorMap[color]} flex items-center justify-center border shrink-0 group-hover:scale-105 transition-all duration-300`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-500 ease-out group-hover:max-w-[140px] group-hover:opacity-100">
                <div className="pl-2.5 pr-4">
                  <p className="text-white font-bold text-[13px] mb-0.5">{label}</p>
                  <p className="text-[9px] text-white/70">{sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: list links */}
      <div className="hidden lg:block desktop-card p-6">
        <h3 className="text-base font-bold text-white mb-4">Hệ sinh thái cộng đồng</h3>
        <div className="flex flex-col gap-3">
          {DESKTOP_LINKS.map(({ icon: Icon, label, sub, color }) => (
            <a
              key={label}
              href="#"
              className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${desktopColorMap[color]} flex items-center justify-center group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">{label}</p>
                  <p className="text-[11px] text-slate-400">{sub}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
