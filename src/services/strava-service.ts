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

/** Redirect browser to Strava OAuth — backend returns { authUrl } */
export async function connectStrava(): Promise<void> {
  try {
    const res = await api.get('/strava/connect');
    if (!res.ok) return;
    const { authUrl } = (await res.json()) as { authUrl: string };
    if (authUrl) window.location.href = authUrl;
  } catch {
    // ignore — user stays on page
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
): Promise<StravaActivitiesResponse | null> {
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) params.set('type', type);
    if (excludeDuplicates !== undefined) params.set('excludeDuplicates', String(excludeDuplicates));
    const res = await api.get(`/strava/activities?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
