import { LayoutDashboard, BarChart2, Users, User, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function MobileBottomTabs() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 w-full glass-card border-x-0 border-b-0 border-t border-white/20 pb-safe z-50 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] lg:hidden">
      <div className="flex justify-between items-center h-[72px] px-6 relative">
        <Link
          to="/dashboard"
          className={`flex flex-col items-center gap-1.5 w-12 transition-transform active:scale-95 ${
            location.pathname === '/dashboard' ? 'text-white' : 'text-white/50'
          }`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold">Trang chủ</span>
        </Link>

        <Link
          to="#"
          className="flex flex-col items-center gap-1.5 w-12 text-white/50 hover:text-white active:scale-95 transition-all"
        >
          <BarChart2 className="w-6 h-6" />
          <span className="text-[10px] font-medium">Lịch sử</span>
        </Link>

        {/* Center gradient button */}
        <div className="relative -top-6">
          <button className="w-[60px] h-[60px] bg-gradient-to-tr from-maf-red to-maf-violet text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(244,42,104,0.4)] hover:-translate-y-1 transition-all active:scale-95 border-[4px] border-maf-dark">
            <Plus className="w-8 h-8" />
          </button>
        </div>

        <Link
          to="#"
          className="flex flex-col items-center gap-1.5 w-12 text-white/50 hover:text-white active:scale-95 transition-all"
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium">Cộng đồng</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center gap-1.5 w-12 transition-transform active:scale-95 ${
            location.pathname === '/profile' ? 'text-white' : 'text-white/50'
          }`}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Hồ sơ</span>
        </Link>
      </div>
    </nav>
  );
}
