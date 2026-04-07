import { Bell, Shield } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Bảng điều khiển' },
  { to: '#', label: 'Nhật ký chạy' },
  { to: '/plan', label: 'Giáo án' },
  { to: '#', label: 'Cộng đồng' },
  { to: '/profile', label: 'Hồ sơ' },
];

export default function DesktopTopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav
      className="sticky top-0 z-50 w-full h-[72px] hidden lg:block"
      style={{
        background: 'rgba(11, 17, 33, 0.7)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link to="/dashboard" className="flex flex-col justify-center">
            <h1 className="text-[22px] font-black italic tracking-tighter leading-none bg-gradient-to-r from-maf-red to-maf-violet bg-clip-text text-transparent">
              MAF RUNNING
            </h1>
            <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/60 ml-0.5 mt-0.5">
              run slow race fast
            </p>
          </Link>

          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  location.pathname === link.to
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm font-medium"
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>
          )}
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-300 cursor-pointer hover:text-white transition-colors" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-maf-red rounded-full" />
          </div>
          <div className="flex items-center gap-3 pl-6 border-l border-white/10">
            <div className="text-right">
              <p className="text-sm font-bold text-white">{user?.name}</p>
              <button
                onClick={logout}
                className="text-[11px] text-slate-400 hover:text-maf-red transition-colors"
              >
                Đăng xuất
              </button>
            </div>
            <Link to="/profile" className="block">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-slate-800 border border-white/20 hover:border-white/40 transition-colors cursor-pointer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/20 hover:border-white/40 transition-colors flex items-center justify-center text-white font-bold cursor-pointer">
                  {user?.name?.charAt(0) || '?'}
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
