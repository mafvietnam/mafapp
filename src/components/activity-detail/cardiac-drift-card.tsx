import { Activity } from 'lucide-react';
import { cardiacDrift } from '../../utils/maf-activity-analysis';
import type { StravaStreams } from '../../services/strava-service';

interface CardiacDriftCardProps {
  streams: StravaStreams;
}

function interpret(drift: number): { label: string; colorClass: string } {
  if (drift < 5) {
    return {
      label: 'Dưới 5% — nền tảng hiếu khí tốt, nhịp tim ổn định so với tốc độ suốt buổi chạy.',
      colorClass: 'text-emerald-400',
    };
  }
  return {
    label: 'Trên 5% — có dấu hiệu trôi tim mạch, có thể do mệt mỏi, nắng nóng hoặc thiếu nền tảng hiếu khí.',
    colorClass: 'text-maf-red',
  };
}

/**
 * Aerobic decoupling (%) between the first/second half of the run (see
 * maf-activity-analysis.cardiacDrift). Labeled "ước tính" — the moving-sample
 * filter is an approximation, not a lab-grade measurement. Hidden entirely
 * when the underlying streams can't support the calculation.
 */
export default function CardiacDriftCard({ streams }: CardiacDriftCardProps) {
  const drift = cardiacDrift(streams.velocitySmooth, streams.heartrate, streams.time);
  if (drift == null) return null;

  const { label, colorClass } = interpret(drift);

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-full bg-maf-violet/10 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-maf-violet" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide">Trôi tim mạch (ước tính)</p>
          <p className={`text-2xl font-black ${colorClass}`}>
            {drift > 0 ? '+' : ''}
            {drift}%
          </p>
        </div>
      </div>
      <p className="text-sm text-white/70">{label}</p>
    </div>
  );
}
