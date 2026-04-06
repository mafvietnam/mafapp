import { Outlet } from 'react-router-dom';
import AdminSidebar from './admin-sidebar';
import AdminHeader from './admin-header';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#0B1121] text-white font-sans flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 flex flex-col h-screen ml-[260px] relative">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#9130F8]/10 rounded-full blur-[100px] pointer-events-none" />
        <AdminHeader />
        <div className="flex-1 overflow-y-auto p-8 relative z-0">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>

          {/* Footer */}
          <footer className="mt-8 border-t border-white/5 pt-6 pb-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 max-w-[1600px] mx-auto">
            <p>&copy; 2026 MAF Running. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Quy định hệ thống</a>
              <a href="#" className="hover:text-white transition-colors">Server Logs</a>
              <a href="#" className="hover:text-white transition-colors">Hỗ trợ Admin</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
