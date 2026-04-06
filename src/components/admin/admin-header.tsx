import { Search, Bell, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';

export default function AdminHeader() {
  const { user } = useAuth();

  return (
    <header className="h-[72px] w-full flex items-center justify-between px-8 z-10 sticky top-0 bg-[#0B1121]/80 backdrop-blur-xl border-b border-white/5">
      {/* Search */}
      <div className="flex-1 flex items-center max-w-md relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4" />
        <input
          type="text"
          placeholder="Tìm kiếm user, HLV hoặc mã giao dịch..."
          className="w-full bg-white/5 border border-white/5 rounded-full pl-11 pr-4 py-2 text-sm text-white outline-none focus:border-[#F42A68]/50 focus:bg-[#111827] transition-all placeholder-slate-500"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer hover:bg-white/5 p-2 rounded-full transition-colors">
          <Bell className="w-5 h-5 text-slate-300" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F42A68] rounded-full border border-[#0B1121]" />
        </div>
        <div className="cursor-pointer hover:bg-white/5 p-2 rounded-full transition-colors hidden sm:block">
          <LifeBuoy className="w-5 h-5 text-slate-300" />
        </div>
        <div className="flex items-center gap-3 pl-6 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white">{user?.name ?? 'Admin'}</p>
            <p className="text-[11px] text-[#F42A68]">Quản trị viên</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/20 overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
                {user?.name?.charAt(0) ?? 'A'}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
