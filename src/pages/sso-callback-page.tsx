import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { getWpLoginUrl } from '../utils/wp-login-url';

export default function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('Không tìm thấy mã xác thực');
      return;
    }

    loginWithCode(code).then((ok) => {
      if (ok) {
        navigate('/dashboard', { replace: true });
      } else {
        setError('Mã xác thực không hợp lệ hoặc đã hết hạn');
      }
    });
  }, [searchParams, loginWithCode, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1121] px-6">
        <h1 className="text-2xl font-bold text-white mb-4">Đăng nhập thất bại</h1>
        <p className="text-white/60 mb-6">{error}</p>
        <a
          href={getWpLoginUrl()}
          className="px-6 py-3 rounded-xl font-semibold text-white
            bg-gradient-to-r from-[#F42A68] to-[#9130F8]
            hover:opacity-90 transition-opacity"
        >
          Thử lại
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1121]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-4" />
        <p className="text-white/60">Đang xác thực...</p>
      </div>
    </div>
  );
}
