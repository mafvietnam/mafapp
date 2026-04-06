import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import LoginButton from '../components/auth/login-button';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1121] px-6">
      {/* Brand logo */}
      <h1 className="text-4xl font-black italic mb-2">
        <span className="bg-gradient-to-r from-[#F42A68] to-[#9130F8] bg-clip-text text-transparent">
          MAF RUNNING
        </span>
      </h1>
      <p className="text-white/60 text-sm mb-10">Huấn luyện chạy bộ thông minh</p>

      {/* Login card */}
      <div className="w-full max-w-sm space-y-4">
        <LoginButton />

        <Link
          to="/"
          className="block text-center text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          Tiếp tục không đăng nhập
        </Link>
      </div>
    </div>
  );
}
