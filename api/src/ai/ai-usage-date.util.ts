/**
 * Server-authoritative "this month" for the AiUsage monthly quota counter — mirrors
 * checkin.service.ts `deriveIctDate()` (Asia/Ho_Chi_Minh, fixed UTC+7). The quota resets
 * on the SERVER's calendar month, never a client-sent value, so a user can't extend
 * their free quota by spoofing a date.
 */
import { deriveIctDate } from '../checkin/checkin.service.js';

/** Returns the server ICT "YYYY-MM" for the AiUsage.yearMonth unique key. */
export function deriveIctYearMonth(now: Date = new Date()): string {
  const d = deriveIctDate(now);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
