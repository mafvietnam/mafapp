/** MAF Test progress chart — gradient line chart matching mockup */
export default function ChartPlaceholder() {
  return (
    <div className="hidden lg:block desktop-card p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white">Biểu đồ tiến độ MAF Test</h3>
        <select className="bg-[#1F2937] border border-white/10 text-sm text-white rounded-md px-3 py-1.5 outline-none focus:border-maf-violet">
          <option>3 tháng qua</option>
          <option>6 tháng qua</option>
          <option>Năm nay</option>
        </select>
      </div>

      <div className="h-64 w-full relative flex items-end px-2 pb-6 border-b border-white/10 pt-4">
        {/* Y-Axis pace labels */}
        <div className="absolute w-full h-full flex flex-col justify-between text-[10px] text-slate-500 font-medium left-0 top-0">
          {['6:00', '6:30', '7:00', '7:30', '8:00'].map((label) => (
            <div key={label} className="flex items-center gap-2 border-b border-white/5 w-full h-0">
              <span className="-mt-2 w-8 text-right">{label}</span>
            </div>
          ))}
        </div>

        {/* Gradient line chart */}
        <svg className="absolute inset-0 h-full w-full pl-12 pr-4 pb-6" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F42A68" />
              <stop offset="100%" stopColor="#9130F8" />
            </linearGradient>
          </defs>
          <path
            d="M 0,180 L 150,150 L 300,160 L 450,110 L 600,90 L 750,60"
            fill="none"
            stroke="url(#chartGradient)"
            strokeWidth="3"
          />
        </svg>

        {/* Data points */}
        <div className="w-full flex justify-between absolute bottom-6 pl-12 pr-4 h-full items-end">
          {[175, 145, 155, 105, 85, 55].map((mb, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-dark-card border-2 border-maf-red rounded-full z-10 cursor-pointer hover:scale-150 transition-transform"
              style={{ marginBottom: `${mb}px` }}
            />
          ))}
        </div>

        {/* X-Axis month labels */}
        <div className="absolute w-full bottom-0 left-0 pl-12 pr-4 flex justify-between text-[10px] text-slate-500 font-bold uppercase pt-2">
          {['Thg 5', 'Thg 6', 'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10'].map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
