/**
 * Pure transform utilities for Strava activity detail + streams.
 * No HTTP, no Prisma — fully unit-testable in isolation (mirrors how
 * `StravaSyncService.upsertActivity`'s mapping is tested separately from the fetch).
 */

/** Raw Strava `splits_metric[]` item — only the fields we whitelist are typed. */
interface SplitMetricRaw {
  distance?: number;
  elapsed_time?: number;
  elevation_difference?: number;
  moving_time?: number;
  split?: number;
  average_speed?: number;
  average_heartrate?: number;
  pace_zone?: number;
}

/** Whitelisted split — keeps Strava's snake_case keys inside the item (FE contract), never spreads raw. */
export interface SplitMetric {
  distance: number | null;
  elapsed_time: number | null;
  elevation_difference: number | null;
  moving_time: number | null;
  split: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  pace_zone: number | null;
}

/** Raw Strava GET /activities/:id response — only fields we read are typed (never spread raw downstream). */
export interface StravaDetailRaw {
  description?: string | null;
  device_name?: string | null;
  gear?: { name?: string | null } | null;
  calories?: number | null;
  splits_metric?: SplitMetricRaw[] | null;
}

export interface WhitelistedDetail {
  description: string | null;
  deviceName: string | null;
  gearName: string | null;
  calories: number | null; // real kcal — NOTE: StravaActivity.calories (summary row) stores kilojoules
  splitsMetric: SplitMetric[];
}

/** Copies ONLY whitelisted keys from a raw split — never spreads raw (avoids leaking undocumented fields). */
function pickSplit(raw: SplitMetricRaw): SplitMetric {
  return {
    distance: raw.distance ?? null,
    elapsed_time: raw.elapsed_time ?? null,
    elevation_difference: raw.elevation_difference ?? null,
    moving_time: raw.moving_time ?? null,
    split: raw.split ?? null,
    average_speed: raw.average_speed ?? null,
    average_heartrate: raw.average_heartrate ?? null,
    pace_zone: raw.pace_zone ?? null,
  };
}

/**
 * Whitelist a raw Strava activity-detail payload down to fields the FE needs.
 * `laps` is intentionally dropped — Strava auto-laps at 1km overlap with `splits_metric`
 * for our use case (v1 scope cut).
 */
export function whitelistDetail(raw: StravaDetailRaw): WhitelistedDetail {
  return {
    description: raw.description ?? null,
    deviceName: raw.device_name ?? null,
    gearName: raw.gear?.name ?? null,
    calories: raw.calories ?? null,
    splitsMetric: (raw.splits_metric ?? []).map(pickSplit),
  };
}

/** Stride needed to downsample `len` points to at most `cap` points. 1 = no downsampling needed. */
export function computeStride(len: number, cap: number): number {
  return len <= cap ? 1 : Math.ceil(len / cap);
}

/** Raw Strava GET /activities/:id/streams response shape (key_by_type=true). */
export interface StravaStreamSet {
  time?: { data: number[] };
  heartrate?: { data: number[] };
  velocity_smooth?: { data: number[] };
  altitude?: { data: number[] };
  distance?: { data: number[] };
}

export interface DownsampledStreams {
  time?: number[];
  heartrate?: number[];
  velocitySmooth?: number[];
  altitude?: number[];
  distance?: number[];
}

/** Maps raw Strava stream keys -> output keys, in output order. */
const STREAM_KEY_MAP: ReadonlyArray<{
  raw: keyof StravaStreamSet;
  out: keyof DownsampledStreams;
}> = [
  { raw: 'time', out: 'time' },
  { raw: 'heartrate', out: 'heartrate' },
  { raw: 'velocity_smooth', out: 'velocitySmooth' },
  { raw: 'altitude', out: 'altitude' },
  { raw: 'distance', out: 'distance' },
];

/**
 * Downsample a raw Strava stream set to at most `cap` points.
 * Requires `time` AND `heartrate` present with data — otherwise nothing chartable, returns null.
 *
 * Truncates ALL present streams to the shortest common length BEFORE computing stride —
 * a dropped HR strap mid-run yields `heartrate` shorter than `time`; naive same-index
 * sampling against the full-length `time` array would then read past the end of the
 * shorter arrays (interior `undefined` -> `NaN` downstream in the FE chart).
 */
export function downsampleStreams(
  rawStreams: StravaStreamSet | null | undefined,
  cap = 1000,
): DownsampledStreams | null {
  if (!rawStreams?.time?.data?.length || !rawStreams?.heartrate?.data?.length) {
    return null;
  }

  const present = STREAM_KEY_MAP.filter(({ raw }) =>
    Array.isArray(rawStreams[raw]?.data),
  );
  const commonLength = Math.min(
    ...present.map(({ raw }) => rawStreams[raw]!.data.length),
  );
  if (commonLength === 0) return null;

  const stride = computeStride(commonLength, cap);
  const out: DownsampledStreams = {};

  for (const { raw, out: outKey } of present) {
    const src = rawStreams[raw]!.data;
    const sampled: number[] = [];
    for (let i = 0; i < commonLength; i += stride) {
      sampled.push(src[i]);
    }
    out[outKey] = sampled;
  }

  return out;
}
