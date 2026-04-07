import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { getWpLoginUrl } from '../../utils/wp-login-url';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = getWpLoginUrl();
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1121]">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  return <Outlet />;
}
