import { LinkIcon, AlertTriangle, Smartphone, Footprints, Flame, AlertCircle } from 'lucide-react';

const SAMPLE_ACTIVITIES = [
  { date: '12 Thg 10', name: 'Bài Test MAF Tháng 10', dist: '5.00 km', pace: '7:15 /km', hr: '142 bpm', hrColor: 'text-maf-violet', warn: false, source: 'phone' },
  { date: '10 Thg 10', name: 'Chạy phục hồi (Recovery)', dist: '8.50 km', pace: '8:05 /km', hr: '128 bpm', hrColor: 'text-emerald-400', warn: false, source: 'strava' },
  { date: '08 Thg 10', name: 'Chạy tự do (Vượt MAF)', dist: '12.2 km', pace: '6:30 /km', hr: '155 bpm', hrColor: 'text-maf-red', warn: true, source: 'strava' },
];

export default function ActivitySection() {
  return (
    <>
      {/* Mobile: activity cards */}
      <div className="lg:hidden">
        <h3 className="text-base font-bold text-white mb-3 px-1">Lịch Sử Hoạt Động</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3 glass-card rounded-[16px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center shrink-0 border border-white/10">
                <Footprints className="w-4 h-4 text-maf-violet" />
              </div>
              <div>
                <p className="font-bold text-white text-[14px]">Morning Run</p>
                <p className="text-[11px] font-medium text-white/60 mt-0.5">Hôm qua &bull; 45 phút</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-white text-base tracking-tight">7:20</p>
              <p className="text-[10px] font-bold text-maf-violet mt-0.5">140 bpm</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 glass-card rounded-[16px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-maf-red/30 text-white flex items-center justify-center shrink-0 border border-maf-red/40 shadow-[0_0_10px_rgba(244,42,104,0.3)]">
                <Flame className="w-4 h-4 text-maf-red" />
              </div>
              <div>
                <p className="font-bold text-white text-[14px]">Chạy tự do cuối tuần</p>
                <p className="text-[11px] font-medium text-white/60 mt-0.5">10 Thg 10 &bull; 60 phút</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-white text-base tracking-tight">6:50</p>
              <p className="text-[10px] font-bold text-maf-red mt-0.5 flex items-center justify-end gap-1">
                <AlertCircle className="w-2.5 h-2.5" /> 152 bpm
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: data table */}
      <div className="hidden lg:block desktop-card overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Lịch sử hoạt động gần đây</h3>
          <a href="#" className="text-sm font-medium text-maf-red hover:text-white transition-colors">
            Xem tất cả
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-bold">Ngày</th>
                <th className="px-6 py-4 font-bold">Bài tập</th>
                <th className="px-6 py-4 font-bold">Khoảng cách</th>
                <th className="px-6 py-4 font-bold">Pace (Avg)</th>
                <th className="px-6 py-4 font-bold">Nhịp tim (Avg)</th>
                <th className="px-6 py-4 font-bold text-right">Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {SAMPLE_ACTIVITIES.map((a) => (
                <tr key={a.date} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-slate-300">{a.date}</td>
                  <td className="px-6 py-4 font-bold text-white group-hover:text-maf-red transition-colors cursor-pointer flex items-center gap-2">
                    {a.warn && <AlertTriangle className="w-3.5 h-3.5 text-maf-red" />}
                    {a.name}
                  </td>
                  <td className="px-6 py-4">{a.dist}</td>
                  <td className="px-6 py-4 font-bold text-white">{a.pace}</td>
                  <td className={`px-6 py-4 font-bold ${a.hrColor}`}>{a.hr}</td>
                  <td className="px-6 py-4 text-right">
                    {a.source === 'phone' ? (
                      <Smartphone className="w-4 h-4 text-slate-500 inline" />
                    ) : (
                      <LinkIcon className="w-4 h-4 text-slate-500 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
