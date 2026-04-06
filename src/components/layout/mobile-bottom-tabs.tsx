import { LayoutDashboard, BarChart2, BookOpen, Users, User, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Trang chủ' },
  { to: '#', icon: BarChart2, label: 'Nhật ký' },
  // Center "+" button is rendered separately
  { to: '#', icon: Users, label: 'Cộng đồng' },
  { to: '/profile', icon: User, label: 'Hồ sơ' },
];

export default function MobileBottomTabs() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 w-full glass-card border-x-0 border-b-0 border-t border-white/20 pb-safe z-50 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] lg:hidden">
      <div className="flex justify-between items-center h-[72px] px-6 relative">
        {/* First 2 tabs */}
        {TABS.slice(0, 2).map((tab) => {
          const isActive = location.pathname === tab.to;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex flex-col items-center gap-1.5 w-12 active:scale-95 transition-transform ${
                isActive ? 'text-white' : 'text-white/50'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </Link>
          );
        })}

        {/* Center gradient "Giáo án" button */}
        <div className="relative -top-6">
          <Link
            to="/plan"
            className="w-[60px] h-[60px] bg-gradient-to-tr from-maf-red to-maf-violet text-white rounded-full flex flex-col items-center justify-center shadow-[0_8px_20px_rgba(244,42,104,0.4)] hover:-translate-y-1 transition-all active:scale-95 border-[4px] border-maf-dark"
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-[8px] font-bold mt-0.5">Giáo án</span>
          </Link>
        </div>

        {/* Last 2 tabs */}
        {TABS.slice(2).map((tab) => {
          const isActive = location.pathname === tab.to;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex flex-col items-center gap-1.5 w-12 active:scale-95 transition-transform ${
                isActive ? 'text-white' : 'text-white/50'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
