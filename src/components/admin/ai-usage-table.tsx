import { Users } from 'lucide-react';
import type { AdminAiUsage } from '../../services/admin-ai-service';

interface AiUsageTableProps {
  usage: AdminAiUsage | null;
  loading: boolean;
  quota: number;
}

/** Per-user AI usage table for the current month — split out to keep AdminAiPage under 200 LOC. */
export default function AiUsageTable({ usage, loading, quota }: AiUsageTableProps) {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          Lượt dùng AI hệ thống {usage ? `— ${usage.yearMonth}` : ''}
        </h3>
        {usage && <span className="text-xs text-slate-400">Tổng: {usage.total}</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : !usage || usage.users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Users className="w-10 h-10 mb-3 text-slate-600" />
          <p className="font-bold text-white mb-1">Chưa có lượt dùng</p>
          <p className="text-sm">Chưa có người dùng nào dùng lượt AI hệ thống trong tháng này.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-xs uppercase text-slate-500 bg-[#0B1121]/50 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-bold">Người dùng</th>
                <th className="px-6 py-4 font-bold">Email</th>
                <th className="px-6 py-4 font-bold text-right">Đã dùng / Hạn mức</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usage.users.map((u) => {
                const overQuota = u.count >= quota;
                return (
                  <tr key={u.userId} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{u.userName}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{u.userEmail}</td>
                    <td className={`px-6 py-4 text-right font-bold ${overQuota ? 'text-amber-400' : 'text-slate-300'}`}>
                      {u.count} / {quota}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
