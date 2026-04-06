import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const ok = await login(username, password);
    setSubmitting(false);
    if (!ok) setError('Sai tên đăng nhập hoặc mật khẩu');
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1121] px-6">
      {/* Brand logo */}
      <h1 className="text-4xl font-black italic mb-2">
        <span className="bg-gradient-to-r from-[#F42A68] to-[#9130F8] bg-clip-text text-transparent">
          MAF RUNNING
        </span>
      </h1>
      <p className="text-white/60 text-sm mb-10">Huấn luyện chạy bộ thông minh</p>

      {/* Google login button */}
      <div className="w-full max-w-sm mb-6">
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-3 px-6 rounded-xl font-semibold text-white text-base
            bg-white/10 border border-white/20
            hover:bg-white/15 transition-colors
            flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Đăng nhập bằng Google
        </button>
      </div>

      {/* Divider */}
      <div className="w-full max-w-sm flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-white/20" />
        <span className="text-white/40 text-sm">hoặc</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      {/* Login form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <input
            type="text"
            placeholder="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/50"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-6 rounded-xl font-bold text-white text-lg
            bg-gradient-to-r from-[#F42A68] to-[#9130F8]
            hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
