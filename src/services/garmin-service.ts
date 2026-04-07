import { api } from './api-client';

// -- Types --

export interface GarminStatus {
  connected: boolean;
  status: string | null;
  garminUserId: string | null;
  lastSyncAt: string | null;
  backfillStatus: string | null;
  connectedAt: string | null;
}

export interface GarminActivity {
  id: string;
  garminActivityId: string;
  activityType: string;
  startTime: string;
  duration: number;
  distance: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  avgPace: number | null;
  calories: number | null;
  vo2Max: number | null;
  trainingEffect: number | null;
}

export interface GarminDailySummary {
  id: string;
  date: string;
  steps: number | null;
  restingHeartRate: number | null;
  avgHeartRate: number | null;
  sleepDuration: number | null;
  sleepScore: number | null;
  stressAvg: number | null;
  calories: number | null;
  activeMinutes: number | null;
}

export interface PaginatedActivities {
  items: GarminActivity[];
  total: number;
  page: number;
  limit: number;
}

// -- API functions --

export async function getGarminStatus(): Promise<GarminStatus | null> {
  try {
    const res = await api.get('/garmin/status');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function connectGarmin(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.post('/garmin/connect', { email, password });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.message || 'Kết nối thất bại' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Không thể kết nối. Vui lòng thử lại.' };
  }
}

export async function disconnectGarmin(): Promise<boolean> {
  try {
    const res = await api.post('/garmin/disconnect');
    return res.ok;
  } catch {
    return false;
  }
}

export async function getGarminActivities(
  page = 1,
  limit = 20,
  type?: string,
): Promise<PaginatedActivities | null> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (type) params.set('type', type);
    const res = await api.get(`/garmin/activities?${params}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getGarminDailySummary(
  from: string,
  to: string,
): Promise<GarminDailySummary[]> {
  try {
    const res = await api.get(`/garmin/daily-summary?from=${from}&to=${to}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function triggerGarminSync(): Promise<boolean> {
  try {
    const res = await api.post('/garmin/sync');
    return res.ok;
  } catch {
    return false;
  }
}
