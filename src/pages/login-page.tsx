import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1121] px-6">
      {/* Brand logo */}
      <h1 className="text-4xl font-black italic mb-2">
        <span className="bg-gradient-to-r from-[#F42A68] to-[#9130F8] bg-clip-text text-transparent">
          MAF RUNNING
        </span>
      </h1>
      <p className="text-white/60 text-sm mb-10">Huấn luyện chạy bộ thông minh</p>

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
