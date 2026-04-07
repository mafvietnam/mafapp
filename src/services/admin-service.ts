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
