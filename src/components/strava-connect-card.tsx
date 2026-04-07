import { useState, useEffect } from 'react';
import { Activity, CheckCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  getStravaStatus,
  connectStrava,
  disconnectStrava,
  triggerStravaSync,
  type StravaStatus,
} from '../services/strava-service';

/** Relative time in Vietnamese */
function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

/** Read and clear a URL query param without page reload */
function consumeQueryParam(key: string): string | null {
  const url = new URL(window.location.href);
  const val = url.searchParams.get(key);
  if (val) {
    url.searchParams.delete(key);
    window.history.replaceState({}, '', url.toString());
  }
  return val;
}

export default function StravaConnectCard() {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Handle redirect-back params from OAuth callback
    const connected = consumeQueryParam('strava_connected');
    const errParam = consumeQueryParam('strava_error');
    if (connected) setNotice('Strava đã kết nối thành công!');
    if (errParam === 'denied') setError('Bạn đã từ chối kết nối Strava.');
    else if (errParam) setError('Kết nối Strava thất bại. Vui lòng thử lại.');

    getStravaStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });
  }, []);

  const handleConnect = async () => {
    setError('');
    setBusy(true);
    await connectStrava(); // redirects browser to Strava — may not return
    setBusy(false);
  };

  const handleDisconnect = async () => {
    setBusy(true);
    await disconnectStrava();
    setStatus(null);
    setNotice('');
    setBusy(false);
  };

  const handleSync = async () => {
    setBusy(true);
    setNotice('');
    const ok = await triggerStravaSync();
    setNotice(ok ? 'Đồng bộ đã bắt đầu...' : 'Không thể đồng bộ. Vui lòng thử lại.');
    setBusy(false);
  };

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

  return (
    <div className="desktop-card p-6">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-orange-400" />
        Strava
      </h2>

      {notice && (
        <p className="text-emerald-400 text-xs mb-3 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> {notice}
        </p>
      )}

      {error && (
        <p className="text-red-400 text-xs mb-3 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">Đã kết nối Strava</span>
          </div>

          {status?.stravaAthleteId && (
            <p className="text-white/60 text-sm">
              Athlete ID: {status.stravaAthleteId}
            </p>
          )}

          {status?.lastSyncAt && (
            <p className="text-white/40 text-xs">
              Đồng bộ lần cuối: {timeAgo(status.lastSyncAt)}
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSync}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Đồng bộ
            </button>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {busy ? 'Đang xử lý...' : 'Ngắt kết nối'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-white/50 text-sm">
            Kết nối Strava để đồng bộ dữ liệu chạy bộ tự động.
          </p>

          <button
            onClick={handleConnect}
            disabled={busy}
            className="w-full py-2.5 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            ) : null}
            {busy ? 'Đang chuyển hướng...' : 'Kết nối Strava'}
          </button>

          <p className="text-white/30 text-xs">
            Yêu cầu quyền đọc hoạt động. Không lưu mật khẩu Strava.
          </p>
        </div>
      )}
    </div>
  );
}
