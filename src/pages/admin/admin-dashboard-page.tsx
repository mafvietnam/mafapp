import { useState, useEffect } from 'react';
import { Users, Zap, Map, Activity, Download, Plus } from 'lucide-react';
import { getAdminStats, type AdminStats } from '../../services/admin-service';
import AdminStatCard from '../../components/admin/admin-stat-card';
import AdminRecentUsersTable from '../../components/admin/admin-recent-users-table';
import AdminAlertsWidget from '../../components/admin/admin-alerts-widget';
import AdminSystemResources from '../../components/admin/admin-system-resources';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page title & actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Tổng quan hệ thống</h2>
          <p className="text-sm text-slate-400">Số liệu được cập nhật theo thời gian thực.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-[#111827] border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Xuất báo cáo
          </button>
          <button className="bg-gradient-to-r from-[#F42A68] to-[#9130F8] text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-[0_4px_15px_rgba(244,42,104,0.3)] hover:shadow-[0_6px_20px_rgba(244,42,104,0.5)] transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tạo giáo án mới
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminStatCard
          icon={Users}
          label="Tổng Người Dùng"
          value={stats?.totalUsers?.toLocaleString() ?? '0'}
          iconBgClass="bg-blue-500/10"
          iconTextClass="text-blue-400"
        />
        <AdminStatCard
          icon={Zap}
          label="Đã lập hồ sơ"
          value={stats?.totalProfiles?.toLocaleString() ?? '0'}
          iconBgClass="bg-[#F42A68]/10"
          iconTextClass="text-[#F42A68]"
        />
        <AdminStatCard
          icon={Map}
          label="Người dùng mới hôm nay"
          value={stats?.newUsersToday?.toLocaleString() ?? '0'}
          iconBgClass="bg-[#9130F8]/10"
          iconTextClass="text-[#9130F8]"
        />
        <AdminStatCard
          icon={Activity}
          label="Tổng hoạt động ghi nhận"
          value={stats?.totalUsers?.toLocaleString() ?? '0'}
          iconBgClass="bg-orange-500/10"
          iconTextClass="text-orange-400"
        />
      </div>

      {/* Main data section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <AdminRecentUsersTable users={stats?.recentUsers ?? []} />
        </div>
        <div className="xl:col-span-1 flex flex-col gap-6">
          <AdminAlertsWidget />
          <AdminSystemResources />
        </div>
      </div>
    </div>
  );
}
