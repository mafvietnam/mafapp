const resources = [
  {
    label: 'Dung lượng Data',
    value: '75% (3.2 TB)',
    percent: 75,
    gradient: 'from-blue-500 to-cyan-400',
    textClass: 'text-slate-400',
  },
  {
    label: 'Băng thông tháng',
    value: '42% (840 GB)',
    percent: 42,
    gradient: 'from-[#9130F8] to-[#F42A68]',
    textClass: 'text-slate-400',
  },
  {
    label: 'API Strava Quota',
    value: '92% (Gần giới hạn)',
    percent: 92,
    gradient: '',
    barClass: 'bg-[#F42A68]',
    textClass: 'text-[#F42A68]',
  },
];

export default function AdminSystemResources() {
  return (
    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
      <h3 className="text-base font-bold text-white mb-4">Tài nguyên hệ thống</h3>
      <div className="space-y-5">
        {resources.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-300">{r.label}</span>
              <span className={r.textClass}>{r.value}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${r.gradient ? `bg-gradient-to-r ${r.gradient}` : r.barClass}`}
                style={{ width: `${r.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
