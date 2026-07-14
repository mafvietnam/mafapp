import { api } from './api-client';
import type { UserProfile } from '../types';

export interface ServerProfile {
  id: string;
  userId: string;
  age: number;
  height: number;
  weight: number;
  experience: string;
  commitment: string;
  isRecovering: boolean;
  isMedicatedOrInjured: boolean;
  isMedicalClearanceConfirmed: boolean;
  previousMonthPace: string | null;
  isProbation: boolean;
  probationStartDate: string | null;
  lastLongRunDuration: number | null;
  lastLongRunHeartRate: number | null;
  lastLongRunFeeling: string | null;
  // --- Phase 3: health-condition screening (sensitive PII, read-only audit fields) ---
  healthConditions: string[];
  healthScreenedAt: string | null;
  healthConsentAt: string | null;
  clearedAt: string | null;
  clearedBy: string | null;
}

/** Fetch user profile from server */
export async function getProfile(): Promise<ServerProfile | null> {
  try {
    const res = await api.get('/users/me/profile');
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Save user profile to server */
export async function updateProfile(profile: UserProfile): Promise<boolean> {
  try {
    const res = await api.put('/users/me/profile', {
      age: parseInt(String(profile.age)) || 0,
      height: parseFloat(String(profile.height)) || 0,
      weight: parseFloat(String(profile.weight)) || 0,
      experience: profile.experience,
      commitment: profile.commitment,
      isRecovering: profile.isRecovering,
      isMedicatedOrInjured: profile.isMedicatedOrInjured,
      isMedicalClearanceConfirmed: profile.isMedicalClearanceConfirmed,
      previousMonthPace: profile.previousMonthPace || undefined,
      isProbation: profile.isProbation,
      probationStartDate: profile.probationStartDate || undefined,
      lastLongRunDuration: profile.lastLongRunDuration,
      lastLongRunHeartRate: profile.lastLongRunHeartRate,
      lastLongRunFeeling: profile.lastLongRunFeeling,
      // Phase 3 — full-replace PUT semantics (matches every other field above):
      // absent/empty = "no conditions", NOT "leave existing untouched" (server
      // mirrors this exactly, profile.service.ts). healthConsent/
      // healthClearanceConfirmed are WRITE-intent booleans only — the server
      // derives the audited healthConsentAt/clearedAt/clearedBy timestamps.
      healthConditions: profile.healthConditions ?? [],
      healthConsent: profile.healthConsentGiven ?? false,
      healthClearanceConfirmed: profile.healthClearanceConfirmed ?? false,
    });
    return res.ok;
  } catch {
    return false;
  }
}
