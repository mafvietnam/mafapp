import { api } from './api-client';

// -- Types --

export interface StravaStatus {
  connected: boolean;
  status: string | null;
  stravaAthleteId: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  /** Reflects strava.enabled DB flag set by admin at runtime. Backend returns this from /strava/status. */
  featureEnabled: boolean;
  /** True when the app has hit its global Strava-connected-user cap (no numeric count exposed to the client). */
  connectionLimitReached: boolean;
}

// -- API functions --

export async function getStravaStatus(): Promise<StravaStatus | null> {
  try {
    const res = await api.get('/strava/status');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface ConnectStravaResult {
  ok: boolean;
  error?: 'full' | 'unknown';
}

/** Redirect browser to Strava OAuth — backend returns { authUrl }. 409 = connection cap reached. */
export async function connectStrava(): Promise<ConnectStravaResult> {
  try {
    const res = await api.get('/strava/connect');
    if (res.status === 409) return { ok: false, error: 'full' };
    if (!res.ok) return { ok: false, error: 'unknown' };
    const { authUrl } = (await res.json()) as { authUrl: string };
    if (authUrl) window.location.href = authUrl;
    return { ok: true };
  } catch {
    return { ok: false, error: 'unknown' };
  }
}

export async function disconnectStrava(): Promise<boolean> {
  try {
    const res = await api.post('/strava/disconnect');
    return res.ok;
  } catch {
    return false;
  }
}

export async function triggerStravaSync(): Promise<boolean> {
  try {
    const res = await api.post('/strava/sync');
    return res.ok;
  } catch {
    return false;
  }
}

export interface StravaActivity {
  id: string;
  stravaActivityId: string;
  name: string;
  type: string;
  startDate: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgSpeed: number | null;
  maxSpeed: number | null;
  totalElevationGain: number | null;
  calories: number | null;
  avgPace: number | null;
  isDuplicate: boolean;
}

export interface StravaActivitiesResponse {
  data: StravaActivity[];
  total: number;
  page: number;
  limit: number;
}

export async function getStravaActivities(
  page = 1,
  limit = 20,
  type?: string,
  excludeDuplicates?: boolean,
  since?: string,
  until?: string,
): Promise<StravaActivitiesResponse | null> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) params.set('type', type);
    if (excludeDuplicates !== undefined) params.set('excludeDuplicates', String(excludeDuplicates));
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    const res = await api.get(`/strava/activities?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// -- Activity detail --

/** Per-km auto-lap split, passed through from Strava's `splits_metric` (kept snake_case to match backend). */
export interface StravaSplitMetric {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone?: number;
}

/**
 * Detail-endpoint-only fields (fetched live from Strava, not stored on the summary row).
 * NOTE: `calories` here is real kcal — the summary `StravaActivity.calories` field is kJ.
 * `laps` intentionally omitted for v1 (splitsMetric covers the auto-lap use case).
 */
export interface StravaActivityDetailData {
  description: string | null;
  deviceName: string | null;
  gearName: string | null;
  calories: number | null;
  splitsMetric: StravaSplitMetric[];
}

/** Time-series streams for chart rendering (phase-04). All arrays optional except `time`. */
export interface StravaStreams {
  time: number[];
  heartrate?: number[];
  velocitySmooth?: number[];
  altitude?: number[];
  distance?: number[];
}

export interface StravaActivityDetailResponse {
  activity: StravaActivity;
  detail: StravaActivityDetailData | null;
  streams: StravaStreams | null;
  hydrated: boolean;
  reason?: 'deleted' | 'unauthorized' | 'rate_limited' | 'error';
}

export async function getStravaActivityDetail(id: string): Promise<StravaActivityDetailResponse | null> {
  try {
    const res = await api.get(`/strava/activities/${id}/detail`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
