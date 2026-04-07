import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { getWpLoginUrl } from '../utils/wp-login-url';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Redirect unauthenticated users to WordPress login
    if (!isLoading && !isAuthenticated) {
      window.location.href = getWpLoginUrl();
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1121]">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show brief loading state while redirecting to WordPress
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1121] px-6">
      <h1 className="text-4xl font-black italic mb-2">
        <span className="bg-gradient-to-r from-[#F42A68] to-[#9130F8] bg-clip-text text-transparent">
          MAF RUNNING
        </span>
      </h1>
      <p className="text-white/60 text-sm mb-6">Đang chuyển hướng đến trang đăng nhập...</p>
      <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
    </div>
  );
}
