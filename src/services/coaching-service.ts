import { api } from './api-client';
import type { DailyRecommendation } from '../types';

// -- Types --

export interface CoachingTodayResponse {
  source: 'ai' | 'template';
  narrative: string;
  /** null only when the user has no profile yet. */
  recommendation: DailyRecommendation | null;
}

// -- API functions --

/**
 * GET /coaching/today — optional AI narrative layer (Phase 4). Mirrors garmin-service.ts's
 * try/catch -> null style: any network error, non-2xx, or the endpoint simply not existing
 * (older backend) resolves to `null` so callers can feature-detect and fall back to the
 * deterministic template card with zero visible change.
 */
export async function getTodayNarrative(): Promise<CoachingTodayResponse | null> {
  try {
    const res = await api.get('/coaching/today');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
