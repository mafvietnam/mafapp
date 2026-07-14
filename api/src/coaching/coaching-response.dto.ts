/**
 * Response shape for GET /coaching/today. Outbound-only (no client input to validate —
 * the request carries no body/params; the server derives everything from the JWT
 * userId), so this is a plain interface rather than a class-validator DTO.
 */
import type { DailyRecommendation } from './recompute/recompute-types.js';

export interface CoachingTodayResponse {
  source: 'ai' | 'template';
  narrative: string;
  /** null only when the user has no UserProfile yet (mirrors the frontend's `hasProfile` gate). */
  recommendation: DailyRecommendation | null;
}
