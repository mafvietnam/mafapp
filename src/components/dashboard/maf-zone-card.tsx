import { Activity, Calculator } from 'lucide-react';
import DashboardCard from '../ui/dashboard-card';

interface MafZoneCardProps {
  mafHr: number;
  age: number;
}

/** MAF heart rate zone card — the one functional dashboard widget */
export default function MafZoneCard({ mafHr, age }: MafZoneCardProps) {
  const lowerZone = mafHr - 10;

  return (
    <DashboardCard className="p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Gradient heart rate icon */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-maf-red to-maf-violet flex items-center justify-center shrink-0 shadow-[0_2px_10px_rgba(244,42,104,0.4)]">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white/80 text-[10px] lg:text-xs font-bold uppercase tracking-wider mb-0">
              Vùng Nhịp Tim MAF Của Bạn
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                {lowerZone}-{mafHr}
              </span>
              <span className="text-white/80 font-bold text-[10px]">BPM</span>
            </div>
          </div>
        </div>

        {/* Formula badge */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md border border-white/10">
            <Calculator className="w-3 h-3 text-maf-violet" />
            <span className="text-[10px] text-white/90 font-medium">
              180 - {age}
            </span>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
