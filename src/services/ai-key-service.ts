import { api } from './api-client';
import type { AiProvider } from '../utils/ai-provider-validation';

// -- Types --

export type AiKeySource = 'byok' | 'system' | 'none';

export interface AiKeyStatus {
  provider: AiProvider | null;
  hasKey: boolean;
  source: AiKeySource;
  usageThisMonth: number;
  quota: number;
}

export interface SetAiKeyResult {
  ok: boolean;
  error?: string;
}

// -- API functions --

/**
 * GET /ai/key — mirrors garmin-service.ts's try/catch -> null style: any network
 * error, non-2xx, or the endpoint not existing resolves to null so the caller can
 * degrade to a safe empty state.
 */
export async function getAiKeyStatus(): Promise<AiKeyStatus | null> {
  try {
    const res = await api.get('/ai/key');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * PUT /ai/key — the raw key is never echoed back by the backend; on success the
 * caller should re-fetch getAiKeyStatus() for the fresh masked status.
 */
export async function setAiKey(provider: AiProvider, key: string): Promise<SetAiKeyResult> {
  try {
    const res = await api.put('/ai/key', { provider, key });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { message?: string });
      return { ok: false, error: data.message || 'Lưu khóa API thất bại.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Không thể kết nối. Vui lòng thử lại.' };
  }
}

/** DELETE /ai/key — idempotent on the backend; treat any non-2xx/network error as failure. */
export async function deleteAiKey(): Promise<boolean> {
  try {
    const res = await api.delete('/ai/key');
    return res.ok;
  } catch {
    return false;
  }
}
