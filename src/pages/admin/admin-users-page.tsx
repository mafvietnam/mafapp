import { useState, useEffect, useCallback } from 'react';
import { Search, Edit2, ShieldOff, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getAdminUsers,
  updateAdminUser,
  type AdminUserDetail,
} from '../../services/admin-service';

const ROLES = ['USER', 'COACH', 'ADMIN'] as const;

const roleBadge: Record<string, { bg: string; text: string; label: string }> = {
  ADMIN: { bg: 'bg-[#F42A68]/10 border-[#F42A68]/20', text: 'text-[#F42A68]', label: 'Admin' },
  COACH: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'Coach' },
  USER: { bg: 'bg-slate-800 border-white/10', text: 'text-slate-300', label: 'Thành viên' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await getAdminUsers({ page, limit, search: search || undefined });
    if (res) {
      setUsers(res.data);
      setTotal(res.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleRoleChange = async (id: string, role: string) => {
    const ok = await updateAdminUser(id, { role });
    if (ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    }
    setEditingId(null);
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean, name: string) => {
    const action = currentlyActive ? 'Vô hiệu hóa' : 'Kích hoạt lại';
    if (!window.confirm(`${action} tài khoản "${name}"?`)) return;
    const ok = await updateAdminUser(id, { isActive: !currentlyActive });
    if (ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: !currentlyActive } : u)),
      );
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Quản lý người dùng</h2>
        <p className="text-sm text-slate-400">Tổng cộng {total} người dùng trong hệ thống.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên hoặc email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#111827] border border-white/10 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#F42A68]/50 transition-all placeholder-slate-500"
        />
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-xs uppercase text-slate-500 bg-[#0B1121]/50 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-bold">Người dùng</th>
                  <th className="px-6 py-4 font-bold">Vai trò</th>
                  <th className="px-6 py-4 font-bold">Trạng thái</th>
                  <th className="px-6 py-4 font-bold">Đăng ký</th>
                  <th className="px-6 py-4 font-bold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const badge = roleBadge[u.role] ?? roleBadge.USER;
                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img src={u.avatar} className="w-8 h-8 rounded bg-slate-800" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-xs font-bold">
                              {u.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-white">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === u.id ? (
                          <select
                            defaultValue={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            autoFocus
                            className="bg-[#0B1121] border border-white/20 rounded px-2 py-1 text-xs text-white outline-none"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded ${badge.bg} ${badge.text} text-[11px] font-bold border`}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold">
                            Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {timeAgo(u.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setEditingId(u.id)}
                          className="text-slate-400 hover:text-white transition-colors p-1"
                          title="Sửa vai trò"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive, u.name)}
                          className={`transition-colors p-1 ml-2 ${
                            u.isActive
                              ? 'text-slate-400 hover:text-[#F42A68]'
                              : 'text-slate-400 hover:text-emerald-400'
                          }`}
                          title={u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                        >
                          {u.isActive ? (
                            <ShieldOff className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Không tìm thấy người dùng
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Trang {page} / {totalPages} &middot; {total} kết quả
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
