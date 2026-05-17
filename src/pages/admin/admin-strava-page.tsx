import { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, Loader2, Clock } from 'lucide-react';
import {
  getAdminStravaOverview,
  triggerAdminStravaSync,
  type AdminStravaConnection,
} from '../../services/admin-service';
import {
  connectionStatusConfig,
  timeAgo,
  truncate,
} from '../../components/admin/connection-status-utils';

export default function AdminStravaPage() {
  const [connections, setConnections] = useState<AdminStravaConnection[]>([]);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [totalConnections, setTotalConnections] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  useEffect(() => {
    getAdminStravaOverview().then((data) => {
      if (data) {
        setConnections(data.connections);
        setFeatureEnabled(data.featureEnabled);
        setTotalConnections(data.totalConnections);
      }
      setLoading(false);
    });
  }, []);

  const handleSync = async (userId: string) => {
    setSyncingUserId(userId);
    await triggerAdminStravaSync(userId);
    setTimeout(async () => {
      const data = await getAdminStravaOverview();
      if (data) setConnections(data.connections);
      setSyncingUserId(null);
    }, 2000);
  };

  const connectedCount = connections.filter((c) => c.status === 'CONNECTED').length;
  const errorCount = connections.filter(
    (c) => c.status === 'ERROR' || c.status === 'TOKEN_EXPIRED',
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <Activity className="w-6 h-6 text-orange-400" />
          Strava
        </h2>
        <p className="text-sm text-slate-400">Quản lý kết nối Strava của người dùng.</p>
      </div>

      {/* Feature status + stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Tính năng</p>
          {featureEnabled ? (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-bold text-lg">Đang bật</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-red-400 font-bold text-lg">Đang tắt</span>
            </div>
          )}
        </div>
        <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Đang kết nối</p>
          <p className="text-white font-bold text-lg">
            {connectedCount} <span className="text-sm font-normal text-slate-400">/ {totalConnections}</span>
          </p>
        </div>
        <div className="bg-[#111827] border border-white/5 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Lỗi</p>
          <p className={`font-bold text-lg ${errorCount > 0 ? 'text-red-400' : 'text-white'}`}>{errorCount}</p>
        </div>
      </div>

      {/* Connections table */}
      <div className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Activity className="w-10 h-10 mb-3 text-slate-600" />
            <p className="font-bold text-white mb-1">Chưa có kết nối</p>
            <p className="text-sm">Chưa có người dùng nào kết nối Strava.</p>
          </div>
        ) : (
          <ConnectionsTable
            connections={connections}
            syncingUserId={syncingUserId}
            onSync={handleSync}
          />
        )}
      </div>
    </div>
  );
}

interface ConnectionsTableProps {
  connections: AdminStravaConnection[];
  syncingUserId: string | null;
  onSync: (userId: string) => void;
}
function ConnectionsTable({ connections, syncingUserId, onSync }: ConnectionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="text-xs uppercase text-slate-500 bg-[#0B1121]/50 border-b border-white/5">
          <tr>
            <th className="px-6 py-4 font-bold">Người dùng</th>
            <th className="px-6 py-4 font-bold">Strava Athlete ID</th>
            <th className="px-6 py-4 font-bold">Trạng thái</th>
            <th className="px-6 py-4 font-bold">Đồng bộ cuối</th>
            <th className="px-6 py-4 font-bold">Last Error</th>
            <th className="px-6 py-4 font-bold">Hoạt động</th>
            <th className="px-6 py-4 font-bold text-right">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {connections.map((c) => {
            const cfg = connectionStatusConfig[c.status] ?? connectionStatusConfig.ERROR;
            const StatusIcon = cfg.icon;
            return (
              <tr key={c.userId} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {c.userAvatar ? (
                      <img src={c.userAvatar} className="w-8 h-8 rounded bg-slate-800" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">
                        {c.userName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-white">{c.userName}</p>
                      <p className="text-[11px] text-slate-400">{c.userEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300 text-xs font-mono">
                  {c.stravaAthleteId ?? '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded ${cfg.bg} ${cfg.text} text-[11px] font-bold border`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                  {c.lastSyncAt ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(c.lastSyncAt)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-6 py-4 text-xs">
                  {c.lastSyncError ? (
                    <span className="text-red-400 cursor-default" title={c.lastSyncError}>
                      {truncate(c.lastSyncError, 60)}
                    </span>
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  )}
                </td>
                <td className="px-6 py-4 text-slate-300 font-bold">{c.activityCount}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onSync(c.userId)}
                    disabled={syncingUserId === c.userId || c.status !== 'CONNECTED'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Đồng bộ thủ công"
                  >
                    {syncingUserId === c.userId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Sync
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
