import { api } from './api-client';

/**
 * Admin AI settings + usage (Phase 5). Split out of admin-service.ts (already >200 LOC)
 * — mirrors api/src/admin/admin-ai.service.ts being split out of admin.service.ts for
 * the same reason. Follows the same try/catch -> null/false style as the rest of
 * admin-service.ts.
 */

export interface AdminAiSettingsData {
  enabled: boolean;
  /** Masked (e.g. "sk-o••••abcd") — never the raw key. */
  openRouterKey: string;
  hasOpenRouterKey: boolean;
  defaultModel: string;
  defaultMonthlyQuota: number;
}

export interface AdminAiUsageUser {
  userId: string;
  userName: string;
  userEmail: string;
  count: number;
}

export interface AdminAiUsage {
  yearMonth: string;
  total: number;
  users: AdminAiUsageUser[];
}

export async function getAdminAiSettings(): Promise<AdminAiSettingsData | null> {
  try {
    const res = await api.get('/admin/ai/settings');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveAdminAiSettings(data: {
  enabled?: boolean;
  openRouterKey?: string;
  defaultModel?: string;
  defaultMonthlyQuota?: number;
}): Promise<boolean> {
  try {
    const res = await api.put('/admin/ai/settings', data);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAdminAiUsage(): Promise<AdminAiUsage | null> {
  try {
    const res = await api.get('/admin/ai/usage');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
