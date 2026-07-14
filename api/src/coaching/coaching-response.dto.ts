/**
 * Response shape for GET /coaching/today. Outbound-only (no client input to validate —
 * the request carries no body/params; the server derives everything from the JWT
 * userId), so this is a plain interface rather than a class-validator DTO.
 */
import type { DailyRecommendation } from './recompute/recompute-types.js';

/**
 * Phase 5: 'source' widened from 'ai'|'template' to distinguish which tier produced the
 * narrative — 'byok' (user's own key), 'system' (shared OpenRouter quota), or 'template'
 * (deterministic fallback, always available).
 */
export interface CoachingTodayResponse {
  source: 'byok' | 'system' | 'template';
  narrative: string;
  /** null only when the user has no UserProfile yet (mirrors the frontend's `hasProfile` gate). */
  recommendation: DailyRecommendation | null;
}
