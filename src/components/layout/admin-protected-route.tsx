import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';

export default function AdminProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1121]">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
