/**
 * Tracklog dispatcher + summarizer. Detects GPX/TCX, delegates to the format parser,
 * then normalizes points into a StravaActivity-shaped summary with validation/clamping.
 */
import { haversineMeters } from './haversine.js';
import { parseGpx } from './gpx-parser.js';
import { parseTcx } from './tcx-parser.js';
import {
  type ParsedTracklog,
  type RawParse,
  type TrackPoint,
  UnsupportedTracklogError,
  InvalidTracklogError,
  ELE_GAIN_THRESHOLD,
  HR_MAX,
  HR_MIN,
  MAX_DISTANCE_M,
  MIN_MOVING_SPEED,
  isValidStart,
} from './tracklog-types.js';

export type TracklogFormat = 'gpx' | 'tcx';

/** Content-sniff the format (extension is only a hint — real gate is here, RT-M3 security). */
export function detectFormat(xml: string): TracklogFormat {
  const head = xml.slice(0, 4096);
  if (head.includes('<TrainingCenterDatabase')) return 'tcx';
  if (head.includes('<gpx')) return 'gpx';
  throw new UnsupportedTracklogError('Định dạng không hỗ trợ (chỉ nhận GPX/TCX)');
}

/** Distance between two points: haversine when both have coords, else device distM delta. */
export function segmentDistance(a: TrackPoint, b: TrackPoint): number {
  if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) {
    return haversineMeters(a.lat, a.lon, b.lat, b.lon);
  }
  if (a.distM != null && b.distM != null) return Math.max(0, b.distM - a.distM);
  return 0;
}

interface Accum {
  distance: number;
  movingTime: number; // seconds, from moving samples
  eleGain: number;
  hasCoordsOrDist: boolean;
}

/** Walk consecutive points once: cumulative distance, moving time (>threshold), elevation gain. */
function accumulate(points: TrackPoint[]): Accum {
  const acc: Accum = { distance: 0, movingTime: 0, eleGain: 0, hasCoordsOrDist: false };
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const segDist = segmentDistance(prev, cur);
    const segSec = (cur.t - prev.t) / 1000;
    if (segDist > 0) acc.hasCoordsOrDist = true;
    acc.distance += segDist;
    if (segSec > 0 && segDist / segSec >= MIN_MOVING_SPEED) acc.movingTime += segSec;
    if (prev.ele != null && cur.ele != null) {
      const d = cur.ele - prev.ele;
      if (d > ELE_GAIN_THRESHOLD) acc.eleGain += d;
    }
  }
  return acc;
}

/** Mean + max of in-range HR samples (RT-H4 clamp). */
function heartRate(points: TrackPoint[]): { avg: number | null; max: number | null } {
  let sum = 0;
  let n = 0;
  let max: number | null = null;
  for (const p of points) {
    if (p.hr == null || p.hr < HR_MIN || p.hr > HR_MAX) continue;
    sum += p.hr;
    n++;
    if (max == null || p.hr > max) max = p.hr;
  }
  return { avg: n > 0 ? Math.round(sum / n) : null, max };
}

/** Build the final summary from a raw parse, applying validation + clamping. */
export function summarize(raw: RawParse): ParsedTracklog {
  const points = raw.points.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  if (points.length < 2) throw new InvalidTracklogError('File thiếu dữ liệu điểm');

  const startMs = points[0].t;
  if (!isValidStart(startMs)) throw new InvalidTracklogError('File thiếu thời gian hợp lệ');

  const elapsedTime = Math.max(0, Math.round((points[points.length - 1].t - startMs) / 1000));
  const acc = accumulate(points);

  // Distance: explicit TCX hint wins; else accumulated. Clamp to sane range.
  let distance = raw.distanceHint ?? acc.distance;
  if (!Number.isFinite(distance) || distance < 0) distance = 0;
  distance = Math.min(distance, MAX_DISTANCE_M);

  // Moving time: explicit TCX lap sum wins; else moving-sample sum; else elapsed (no coords/dist).
  let movingTime = raw.movingTimeHint ?? (acc.hasCoordsOrDist ? acc.movingTime : elapsedTime);
  movingTime = Math.max(0, Math.round(movingTime)) || elapsedTime;

  const { avg: avgHeartRate, max: maxHeartRate } = heartRate(points);

  // Reject files with nothing analyzable (no distance AND no HR).
  if (distance <= 0 && avgHeartRate == null) {
    throw new InvalidTracklogError('File không có quãng đường lẫn nhịp tim');
  }

  const avgSpeed = distance > 0 && movingTime > 0 ? distance / movingTime : null;

  return {
    name: raw.name,
    type: raw.type,
    startDate: new Date(startMs),
    distance,
    movingTime,
    elapsedTime,
    avgHeartRate,
    maxHeartRate,
    avgSpeed,
    totalElevationGain: acc.eleGain > 0 ? Math.round(acc.eleGain) : null,
    calories: raw.calories,
    points,
  };
}

/** Parse a raw upload buffer into a normalized activity. Throws Unsupported/Invalid on bad input. */
export function parseTracklog(buffer: Buffer, _filename: string): ParsedTracklog {
  const xml = buffer.toString('utf-8');
  const fmt = detectFormat(xml);
  const raw = fmt === 'tcx' ? parseTcx(xml) : parseGpx(xml);
  return summarize(raw);
}
