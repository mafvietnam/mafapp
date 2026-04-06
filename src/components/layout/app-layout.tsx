import { Outlet, useLocation } from 'react-router-dom';
import DesktopTopNav from './desktop-top-nav';
import MobileBottomTabs from './mobile-bottom-tabs';

/** Dark theme shell for authenticated pages with responsive navigation */
export default function AppLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-maf-dark text-white relative">
      {/* Desktop top nav (always shown) */}
      <DesktopTopNav />

      {/* Page content — dashboard handles its own mobile header */}
      <main className={isDashboard ? '' : 'pb-32 lg:pb-8'}>
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <MobileBottomTabs />
    </div>
  );
}
