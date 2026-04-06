import { Activity, Timer, Map } from 'lucide-react';

interface DesktopStatsRowProps {
  mafHr: number;
}

/** Three stat cards for desktop layout — MAF HR, Avg Pace, Weekly Distance */
export default function DesktopStatsRow({ mafHr }: DesktopStatsRowProps) {
  const lowerZone = mafHr > 0 ? mafHr - 10 : 0;

  return (
    <div className="hidden lg:grid grid-cols-3 gap-6">
      <div className="desktop-card p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Vùng Nhịp Tim MAF
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">
              {mafHr > 0 ? `${lowerZone}-${mafHr}` : '--'}
            </span>
            <span className="text-sm text-slate-400 font-semibold">bpm</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-maf-red/10 flex items-center justify-center text-maf-red">
          <Activity className="w-6 h-6" />
        </div>
      </div>

      <div className="desktop-card p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Pace MAF Trung Bình
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">--:--</span>
            <span className="text-sm text-slate-400 font-semibold">/km</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <Timer className="w-6 h-6" />
        </div>
      </div>

      <div className="desktop-card p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Tổng khoảng cách tuần
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">--</span>
            <span className="text-sm text-slate-400 font-semibold">km</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-maf-violet/10 flex items-center justify-center text-maf-violet">
          <Map className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
