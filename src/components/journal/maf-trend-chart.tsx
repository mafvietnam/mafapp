import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TrendPoint } from '../../utils/journal-analytics';

interface MafTrendChartProps {
  points: TrendPoint[];
}

/** ≥3 non-null values needed for a line to be meaningful. */
const MIN_POINTS = 3;

/** sec/km → "m:ss" for the (reversed) pace axis + tooltip. */
function paceTick(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Efficiency axis tick → 2 decimals. WITHOUT this the domain padding
 * (`dataMin - 0.1`) yields raw floats like 0.8300000000000001 on the axis.
 */
function effTick(value: number): string {
  return value.toFixed(2);
}

/** Chart X tick: show only the week's START date ("20/4"), not the full range — the
 *  full "dd/M – dd/M" range stays on the week-group headers; compact here avoids
 *  label overlap on narrow (mobile) charts. */
function weekTick(label: string): string {
  return label.split('–')[0].trim();
}

function EmptyChart() {
  return (
    <div className="glass-card lg:desktop-card rounded-2xl p-6 flex items-center justify-center h-48 text-center">
      <p className="text-white/40 text-sm max-w-xs">
        Cần ít nhất {MIN_POINTS} tuần dữ liệu để vẽ biểu đồ xu hướng MAF.
      </p>
    </div>
  );
}

/**
 * Long-term MAF trend: pace@MAF (reversed axis — faster/up = better) + aerobic
 * efficiency. Each line is gated independently on its own non-null count and
 * carries an explicit yAxisId (recharts v3 needs it or lines bind to phantom
 * axis id 0). If neither line qualifies, the empty message shows.
 */
export default function MafTrendChart({ points }: MafTrendChartProps) {
  const pacePts = points.filter((p) => p.paceAtMaf != null).length;
  const effPts = points.filter((p) => p.efficiency != null).length;
  const showPace = pacePts >= MIN_POINTS;
  const showEff = effPts >= MIN_POINTS;

  if (!showPace && !showEff) return <EmptyChart />;

  return (
    <div className="glass-card lg:desktop-card rounded-2xl p-4 lg:p-6">
      <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide mb-4">Xu hướng MAF theo tuần</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
              tickFormatter={weekTick}
              minTickGap={16}
            />
            {showPace && (
              <YAxis
                yAxisId="pace"
                reversed
                stroke="#10b981"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                tickFormatter={paceTick}
                width={44}
                domain={['dataMin - 15', 'dataMax + 15']}
              />
            )}
            {showEff && (
              <YAxis
                yAxisId="eff"
                orientation="right"
                stroke="#9130F8"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                tickFormatter={effTick}
                width={44}
                domain={['dataMin - 0.1', 'dataMax + 0.1']}
              />
            )}
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              formatter={(value, name) => {
                // recharts passes null-valued series (connectNulls gaps) to the
                // formatter — guard before formatting or it crashes / shows 0:00.
                if (value == null || typeof value !== 'number') return null;
                return name === 'Pace@MAF'
                  ? [`${paceTick(value)} /km`, name]
                  : [`${value.toFixed(2)} m/nhịp`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {showPace && (
              <Line
                yAxisId="pace"
                type="monotone"
                dataKey="paceAtMaf"
                name="Pace@MAF"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {showEff && (
              <Line
                yAxisId="eff"
                type="monotone"
                dataKey="efficiency"
                name="Hiệu suất"
                stroke="#9130F8"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
