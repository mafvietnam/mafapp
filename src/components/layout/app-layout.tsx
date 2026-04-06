import { Outlet } from 'react-router-dom';
import DesktopTopNav from './desktop-top-nav';
import MobileBottomTabs from './mobile-bottom-tabs';
import { useAuth } from '../../contexts/auth-context';

/** Dark theme shell for authenticated pages with responsive navigation */
export default function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-maf-dark text-white">
      <DesktopTopNav />

      {/* Mobile header */}
      <header className="lg:hidden pt-12 pb-4 px-6 flex justify-between items-start z-10 relative">
        <div>
          <h1 className="text-[28px] font-black italic tracking-tighter leading-tight mb-1 bg-gradient-to-r from-maf-red to-maf-violet bg-clip-text text-transparent">
            MAF RUNNING
          </h1>
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/60 ml-0.5">
            run slow race fast
          </p>
        </div>
        {user?.avatar && (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-11 h-11 rounded-full bg-slate-800/80 border border-white/20 shadow-lg shrink-0 ml-2"
          />
        )}
      </header>

      {/* Page content */}
      <main className="pb-32 lg:pb-8">
        <Outlet />
      </main>

      <MobileBottomTabs />
    </div>
  );
}
