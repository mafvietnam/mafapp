/**
 * Build a downsampled stream set (time/HR/velocity/altitude/distance) from parsed points,
 * reusing the Strava detail-transform `downsampleStreams` (DRY) so uploaded activities render
 * on the SAME detail chart + MAF analysis path as synced ones.
 */
import {
  downsampleStreams,
  type DownsampledStreams,
  type StravaStreamSet,
} from '../strava-detail-transform.js';
import { segmentDistance } from './tracklog-parser.js';
import { HR_MAX, HR_MIN, type TrackPoint } from './tracklog-types.js';

/** In-range HR only — a 0/out-of-range sample is a strap dropout, not a real reading (parity with summary). */
const inRangeHr = (h?: number): h is number => h != null && h >= HR_MIN && h <= HR_MAX;

/** Aligned (points-length) arrays fed into the raw stream shape downsampleStreams expects. */
interface AlignedStreams {
  time: number[];
  heartrate?: number[];
  velocity: number[];
  altitude?: number[];
  distance: number[];
}

/** Forward+back fill so a brief HR/altitude dropout keeps arrays aligned to `time` (RT-M1/M4). */
function fillAligned(points: TrackPoint[]): AlignedStreams {
  const t0 = points[0].t;
  const time: number[] = [];
  const distance: number[] = [];
  const velocity: number[] = [];
  const hr: number[] = [];
  const alt: number[] = [];
  const hasHr = points.some((p) => inRangeHr(p.hr));
  const hasAlt = points.some((p) => p.ele != null);
  let lastHr = points.find((p) => inRangeHr(p.hr))?.hr ?? 0;
  let lastAlt = points.find((p) => p.ele != null)?.ele ?? 0;
  let cumDist = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    time.push(Math.round((p.t - t0) / 1000));
    if (i > 0) {
      const seg = segmentDistance(points[i - 1], p);
      const dt = (p.t - points[i - 1].t) / 1000;
      cumDist += seg;
      velocity.push(dt > 0 ? seg / dt : 0);
    } else {
      velocity.push(0);
    }
    distance.push(Math.round(cumDist));
    if (inRangeHr(p.hr)) lastHr = p.hr;
    hr.push(lastHr);
    if (p.ele != null) lastAlt = p.ele;
    alt.push(lastAlt);
  }
  // point 0 velocity: mirror point 1 so the chart doesn't start at a false 0.
  if (velocity.length > 1) velocity[0] = velocity[1];

  return {
    time,
    distance,
    velocity,
    heartrate: hasHr ? hr : undefined,
    altitude: hasAlt ? alt : undefined,
  };
}

/**
 * Returns downsampled streams (≤cap points) or null when there's no HR — in which case the
 * detail page hides the HR chart and MAF analysis degrades gracefully (same as a synced no-HR run).
 */
export function buildStreams(points: TrackPoint[], cap = 1000): DownsampledStreams | null {
  if (points.length < 2) return null;
  const a = fillAligned(points);
  const raw: StravaStreamSet = {
    time: { data: a.time },
    distance: { data: a.distance },
    velocity_smooth: { data: a.velocity },
    ...(a.heartrate ? { heartrate: { data: a.heartrate } } : {}),
    ...(a.altitude ? { altitude: { data: a.altitude } } : {}),
  };
  return downsampleStreams(raw, cap);
}
