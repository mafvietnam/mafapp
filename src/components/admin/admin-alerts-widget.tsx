import { AlertCircle, MessageSquare, Flag } from 'lucide-react';

const alerts = [
  {
    icon: MessageSquare,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    title: 'Lỗi đồng bộ Strava',
    description: 'User báo cáo lỗi không lấy được nhịp tim từ Strava.',
    time: '15 phút trước',
  },
  {
    icon: Flag,
    iconBg: 'bg-[#F42A68]/10',
    iconColor: 'text-[#F42A68]',
    title: 'Duyệt kết quả sự kiện',
    description: 'Chờ xác nhận thủ công tracklog giải ảo "Thử thách 21 Days MAF".',
    time: '1 giờ trước',
  },
];

export default function AdminAlertsWidget() {
  return (
    <div className="bg-[#111827] border border-[#F42A68]/30 rounded-2xl p-6">
      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-[#F42A68]" /> Cần xử lý ({alerts.length})
      </h3>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.title}
            className="bg-[#0B1121] p-3 rounded-xl border border-white/5 flex gap-3 hover:border-white/10 transition-colors cursor-pointer"
          >
            <div
              className={`w-8 h-8 rounded ${alert.iconBg} flex items-center justify-center ${alert.iconColor} shrink-0`}
            >
              <alert.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{alert.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {alert.description}
              </p>
              <p className="text-[10px] text-slate-500 mt-2">{alert.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
