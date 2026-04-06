import { MoreVertical } from 'lucide-react';
import type { AdminUserSummary } from '../../services/admin-service';

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
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

interface Props {
  users: AdminUserSummary[];
}

export default function AdminRecentUsersTable({ users }: Props) {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl flex flex-col">
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white">Người dùng hoạt động gần đây</h3>
          <p className="text-xs text-slate-400 mt-1">
            Danh sách runners vừa đồng bộ dữ liệu hoặc nâng cấp tài khoản.
          </p>
        </div>
        <button className="w-8 h-8 rounded bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="text-xs uppercase text-slate-500 bg-[#0B1121]/50 border-b border-white/5">
            <tr>
              <th className="px-6 py-4 font-bold">Runner</th>
              <th className="px-6 py-4 font-bold">Vai trò</th>
              <th className="px-6 py-4 font-bold">Đăng ký</th>
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
                        <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
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
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded ${badge.bg} ${badge.text} text-[11px] font-bold border`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{timeAgo(u.createdAt)}</td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                  Chưa có người dùng
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
