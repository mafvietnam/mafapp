import { api } from './api-client';
import type { DailyCheckin } from '../types';

/**
 * Payload for POST /checkins — intentionally has NO date field (RED TEAM FIX
 * #7): the server derives the authoritative Asia/Ho_Chi_Minh calendar date
 * server-side for the (userId, date) upsert key.
 */
export interface UpsertCheckinPayload {
  sleepQuality: number; // 1-5
  fatigue: number; // 1-5
  soreness?: string;
  note?: string;
  restingHr?: number;
}

/** Mirrors garmin-service.ts / strava-service.ts style — try/catch, safe fallback, never throws. */
export async function getCheckins(from: string, to?: string): Promise<DailyCheckin[]> {
  try {
    const params = new URLSearchParams({ from });
    if (to) params.set('to', to);
    const res = await api.get(`/checkins?${params.toString()}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Upsert today's check-in (server-derived date). Returns null on failure (never throws). */
export async function upsertCheckin(payload: UpsertCheckinPayload): Promise<DailyCheckin | null> {
  try {
    const res = await api.post('/checkins', payload);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
