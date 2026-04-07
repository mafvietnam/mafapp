import { useState, useEffect } from 'react';
import { Watch, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  getGarminStatus,
  connectGarmin,
  disconnectGarmin,
  type GarminStatus,
} from '../services/garmin-service';

/** Relative time display in Vietnamese */
function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

export default function GarminConnectCard() {
  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getGarminStatus().then((s) => {
      if (s === null) setAvailable(false); // Feature disabled or API unavailable
      setStatus(s);
      setLoading(false);
    });
  }, []);

  const handleConnect = async () => {
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    setError('');
    setConnecting(true);
    const result = await connectGarmin(email, password);
    setConnecting(false);

    if (result.ok) {
      setPassword('');
      const updated = await getGarminStatus();
      setStatus(updated);
    } else {
      setError(result.error || 'Kết nối thất bại');
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    await disconnectGarmin();
    setStatus(null);
    setEmail('');
    setConnecting(false);
  };

  // Hide card entirely when Garmin feature is disabled
  if (!loading && !available) return null;

  if (loading) {
    return (
      <div className="desktop-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          <span className="text-white/40 text-sm">Đang tải...</span>
        </div>
      </div>
    );
  }

  const isConnected = status?.connected;
  const isBackfilling =
    status?.backfillStatus === 'PENDING' ||
    status?.backfillStatus === 'IN_PROGRESS';

  return (
    <div className="desktop-card p-6">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <Watch className="w-5 h-5 text-blue-400" />
        Thiết bị kết nối
      </h2>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">
              Đã kết nối Garmin
            </span>
          </div>

          {status?.garminUserId && (
            <p className="text-white/60 text-sm">
              Tài khoản: {status.garminUserId}
            </p>
          )}

          {isBackfilling && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang đồng bộ dữ liệu...
            </div>
          )}

          {status?.backfillStatus === 'FAILED' && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              Đồng bộ thất bại
            </div>
          )}

          {status?.lastSyncAt && (
            <p className="text-white/40 text-xs">
              Đồng bộ lần cuối: {timeAgo(status.lastSyncAt)}
            </p>
          )}

          <button
            onClick={handleDisconnect}
            disabled={connecting}
            className="mt-2 px-4 py-2 rounded-lg text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {connecting ? 'Đang xử lý...' : 'Ngắt kết nối'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Garmin"
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-maf-violet placeholder-white/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu Garmin"
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-maf-violet placeholder-white/30"
          />

          {error && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-2.5 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            ) : null}
            {connecting ? 'Đang kết nối...' : 'Kết nối Garmin'}
          </button>

          <p className="text-white/30 text-xs">
            Thông tin được mã hóa AES-256. Không chia sẻ với bên thứ 3.
          </p>
        </div>
      )}
    </div>
  );
}
