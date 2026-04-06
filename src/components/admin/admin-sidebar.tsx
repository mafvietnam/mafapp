import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart2,
  Users,
  Medal,
  Dumbbell,
  Target,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';

const sections = [
  {
    title: 'Tổng quan',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/stats', icon: BarChart2, label: 'Thống kê' },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { to: '/admin/users', icon: Users, label: 'Người dùng' },
      { to: '/admin/coaches', icon: Medal, label: 'Huấn luyện viên' },
      { to: '/admin/library', icon: Dumbbell, label: 'Thư viện Giáo án' },
      { to: '/admin/challenges', icon: Target, label: 'Thử thách & Sự kiện' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { to: '/admin/settings', icon: Settings, label: 'Cài đặt chung' },
      { to: '/admin/permissions', icon: ShieldAlert, label: 'Phân quyền' },
    ],
  },
];

export default function AdminSidebar() {
  const { user } = useAuth();

  return (
    <aside className="w-[260px] bg-[#111827] border-r border-white/5 flex flex-col h-screen fixed z-20">
      {/* Brand */}
      <div className="h-[72px] flex items-center px-6 border-b border-white/5">
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-black italic tracking-tighter leading-none bg-gradient-to-r from-[#F42A68] to-[#9130F8] bg-clip-text text-transparent">
            MAF ADMIN
          </h1>
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-slate-400 mt-0.5">
            Control Panel
          </p>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 mt-4 first:mt-0">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/5 border-l-[3px] border-[#F42A68] text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-[#F42A68]' : ''}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* System Status */}
      <div className="p-4 border-t border-white/5">
        <div className="bg-[#0B1121] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-bold text-slate-300">Hệ thống ổn định</p>
          </div>
          <p className="text-[10px] text-slate-500">
            {user?.name ?? 'Admin'} &middot; Quản trị viên
          </p>
        </div>
      </div>
    </aside>
  );
}
