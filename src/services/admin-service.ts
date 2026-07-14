import { api } from './api-client';

export interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  newUsersToday: number;
  recentUsers: AdminUserSummary[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  profile: Record<string, unknown> | null;
}

export interface PaginatedUsers {
  data: AdminUserDetail[];
  total: number;
  page: number;
  limit: number;
}

export async function getAdminStats(): Promise<AdminStats | null> {
  try {
    const res = await api.get('/admin/stats');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedUsers | null> {
  try {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    const res = await api.get(`/admin/users?${qs}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function updateAdminUser(
  id: string,
  data: { role?: string; isActive?: boolean },
) {
  const res = await api.patch(`/admin/users/${id}`, data);
  return res.ok;
}

export async function deleteAdminUser(id: string) {
  const res = await api.delete(`/admin/users/${id}`);
  return res.ok;
}

/* ── Garmin Admin ── */

export interface AdminGarminConnection {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  garminUserId: string | null;
  status: string;
  backfillStatus: string;
  lastSyncAt: string | null;
  connectedAt: string;
  activityCount: number;
}

export interface AdminGarminOverview {
  featureEnabled: boolean;
  totalConnections: number;
  connections: AdminGarminConnection[];
}

export async function getAdminGarminOverview(): Promise<AdminGarminOverview | null> {
  try {
    const res = await api.get('/admin/garmin');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function triggerAdminGarminSync(userId: string): Promise<boolean> {
  try {
    const res = await api.post(`/admin/garmin/${userId}/sync`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Garmin Settings ── */

export interface GarminSettingsData {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  hasClientSecret: boolean;
}

export async function getGarminSettings(): Promise<GarminSettingsData | null> {
  try {
    const res = await api.get('/admin/settings/garmin');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveGarminSettings(data: {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  enabled?: boolean;
}): Promise<boolean> {
  try {
    const res = await api.post('/admin/settings/garmin', data);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Strava Admin ── */

export type StravaConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'TOKEN_EXPIRED' | 'ERROR';

export interface AdminStravaConnection {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  stravaAthleteId: string | null;
  status: StravaConnectionStatus;
  lastSyncAt: string | null;
  lastSyncStartedAt: string | null;
  lastSyncError: string | null;
  connectedAt: string;
  activityCount: number;
}

export interface AdminStravaOverview {
  featureEnabled: boolean;
  totalConnections: number;
  connections: AdminStravaConnection[];
}

export async function getAdminStravaOverview(): Promise<AdminStravaOverview | null> {
  try {
    const res = await api.get('/admin/strava');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function triggerAdminStravaSync(userId: string): Promise<boolean> {
  try {
    const res = await api.post(`/admin/strava/${userId}/sync`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Strava Settings ── */

export interface StravaSettingsData {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  hasClientSecret: boolean;
  hasWebhookVerifyToken: boolean;
  webhookCallbackUrl: string;
}

export interface SaveStravaSettingsResult {
  ok: boolean;
  webhookResubscribed?: boolean;
  webhookResubscribeError?: string;
}

export async function getStravaSettings(): Promise<StravaSettingsData | null> {
  try {
    const res = await api.get('/admin/settings/strava');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveStravaSettings(data: {
  clientId?: string;
  clientSecret?: string;
  webhookVerifyToken?: string;
  enabled?: boolean;
}): Promise<SaveStravaSettingsResult> {
  try {
    const res = await api.post('/admin/settings/strava', data);
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return { ...body, ok: true };
  } catch {
    return { ok: false };
  }
}

// AI admin settings/usage live in ./admin-ai-service.ts (mirrors admin-ai.service.ts split on the backend).
