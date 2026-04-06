import type { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  iconBgClass: string;
  iconTextClass: string;
}

export default function AdminStatCard({
  icon: Icon,
  label,
  value,
  change,
  iconBgClass,
  iconTextClass,
}: AdminStatCardProps) {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-10 h-10 rounded-xl ${iconBgClass} flex items-center justify-center ${iconTextClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {change && (
          <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
            {change}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        <h3 className="text-2xl font-black text-white">{value}</h3>
      </div>
    </div>
  );
}
