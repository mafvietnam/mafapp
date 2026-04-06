import { Home, History, Users, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/dashboard', icon: Home, label: 'Trang chủ' },
  { to: '#', icon: History, label: 'Lịch sử' },
  { to: '#', icon: Users, label: 'Cộng đồng' },
  { to: '/profile', icon: User, label: 'Hồ sơ' },
];

export default function MobileBottomTabs() {
  const location = useLocation();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '32px 32px 0 0',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="flex items-center justify-around px-4 pt-3 pb-safe">
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.to;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={`flex flex-col items-center gap-1 py-1 px-3 ${
                isActive ? 'text-white' : 'text-white/40'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
