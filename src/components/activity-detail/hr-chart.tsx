import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import type { StravaStreams } from '../../services/strava-service';
import type { MafZone } from '../../utils/maf-activity-analysis';

interface HrChartProps {
  streams: StravaStreams;
  zone: MafZone;
  avgHr: number | null;
}

interface HrPoint {
  min: number;
  hr: number;
}

/** Cap chart points for smooth/performant rendering on long activities (see phase-04 plan). */
const MAX_POINTS = 1000;

/** heartrate[]/time[] -> {min, hr} points, decimated to MAX_POINTS by taking every Nth sample. */
function buildPoints(streams: StravaStreams): HrPoint[] {
  const hr = streams.heartrate;
  const time = streams.time;
  if (!hr || !time) return [];

  const n = Math.min(hr.length, time.length);
  const step = n > MAX_POINTS ? Math.ceil(n / MAX_POINTS) : 1;
  const points: HrPoint[] = [];
  for (let i = 0; i < n; i += step) {
    const h = hr[i];
    if (h == null || Number.isNaN(h)) continue;
    points.push({ min: Math.round((time[i] / 60) * 100) / 100, hr: h });
  }
  return points;
}

/** Heart-rate-vs-elapsed-minutes line chart with the MAF band + avg-HR reference line. Render only when a heartrate stream exists. */
export default function HrChart({ streams, zone, avgHr }: HrChartProps) {
  if (!streams.heartrate?.length) return null;
  const points = buildPoints(streams);
  if (points.length === 0) return null;

  return (
    <div className="glass-card lg:desktop-card rounded-[16px] lg:rounded-2xl p-4 lg:p-6">
      <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide mb-4">Nhịp tim theo thời gian</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="min"
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
              unit=" phút"
            />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              itemStyle={{ color: '#F42A68' }}
              formatter={(value: number) => [`${value} bpm`, 'Nhịp tim']}
              labelFormatter={(min: number) => `${min} phút`}
            />
            <ReferenceArea y1={zone.lower} y2={zone.upper} fill="#10b981" fillOpacity={0.12} strokeOpacity={0} />
            {avgHr != null && (
              <ReferenceLine
                y={avgHr}
                stroke="#9130F8"
                strokeDasharray="4 4"
                label={{ value: 'TB', position: 'right', fill: '#9130F8', fontSize: 11 }}
              />
            )}
            <Line type="monotone" dataKey="hr" stroke="#F42A68" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
