import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUserProfile } from './use-user-profile';
import { useDailyCheckin } from './use-daily-checkin';
import { calculateMAF } from '../utils/maf-calculator-orchestrator';
import { computeReadiness } from '../utils/daily-readiness-score';
import { buildDailyRecommendation } from '../utils/daily-recommendation-engine';
import { computeAdherence, type AdherenceDay } from '../utils/adherence-analysis';
import { localToday, localWeekdayLabel, ictDateString, isSameLocalDate } from '../utils/local-today';
import { mondayOf } from '../utils/journal-date-utils';
import { getStravaActivities, getStravaStatus, type StravaActivity } from '../services/strava-service';
import { getGarminDailySummary, type GarminDailySummary } from '../services/garmin-service';
import type { UpsertCheckinPayload } from '../services/checkin-service';
import type { DailyRecommendation, DailyCheckin } from '../types';
import { selectGuidanceCards } from '../content/select-guidance-cards';
import type { GuidanceCard } from '../content/guidance-types';

const RECENT_ACTIVITIES_LIMIT = 50; // enough range for the 14-day RHR baseline / load-spike window
const DAILY_SUMMARY_LOOKBACK_DAYS = 30;
const STALE_SYNC_THRESHOLD_MS = 12 * 60 * 60 * 1000;
const ACK_STORAGE_PREFIX = 'maf_today_ack_';
const HIGH_BMI_THRESHOLD = 30; // matches the existing "Béo phì" (obese) cut-point in maf-calculator-orchestrator.ts

export interface UseTodayRecommendationResult {
  loading: boolean;
  isChild: boolean;
  hasProfile: boolean;
  recommendation: DailyRecommendation | null;
  /** Selected via select-guidance-cards.ts (pure) — pre/post-run, bài bổ trợ, R.E.S.T,
   *  readiness-education, safety-disclaimer. Empty for children / missing recommendation. */
  guidanceCards: GuidanceCard[];
  adherence: AdherenceDay[];
  lastSyncAt: string | null;
  /** RED TEAM FIX #12: true when today's Strava sync looks stale AND there's no matching activity/ack yet. */
  staleSync: boolean;
  todayAck: boolean;
  ackRanToday: () => void;
  /** Re-exposed from use-daily-checkin (single instance — keeps the checkin-mini-form and the
   *  readiness recomputation in sync; a second independent hook instance would desync them). */
  checkin: DailyCheckin | null;
  checkinSubmitting: boolean;
  submitCheckin: (payload: UpsertCheckinPayload) => Promise<boolean>;
}

function readAckFromStorage(dateKey: string): boolean {
  try {
    return localStorage.getItem(ACK_STORAGE_PREFIX + dateKey) === '1';
  } catch {
    return false; // localStorage unavailable (privacy mode, etc.) — degrade gracefully
  }
}

function writeAckToStorage(dateKey: string): void {
  try {
    localStorage.setItem(ACK_STORAGE_PREFIX + dateKey, '1');
  } catch {
    // best-effort UX nicety — never blocks the recommendation
  }
}

/**
 * Orchestrates the "Today" recommendation: runs the orchestrator (RED TEAM
 * FIX #4 — adjusted schedule + adjusted mafHr, the SAME engine /plan renders),
 * gathers readiness signals (check-in-first; Garmin bonus-only and gracefully
 * absent when FEATURE_GARMIN is off), and composes readiness -> recommendation
 * -> adherence. Mirrors journal-page's useMemo pattern. Exposes stale-sync
 * state + the manual "đã chạy hôm nay" ack (RED TEAM FIX #12).
 */
export function useTodayRecommendation(): UseTodayRecommendationResult {
  const { userProfile, profileLoading, ageNum, isChild, isNewbie, getBMI } = useUserProfile();
  const { checkin, loading: checkinLoading, submitting: checkinSubmitting, submit: submitCheckin } = useDailyCheckin();

  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [dailySummaries, setDailySummaries] = useState<GarminDailySummary[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const today = useMemo(() => localToday(), []);
  const todayKey = useMemo(() => ictDateString(), []);
  const [todayAck, setTodayAck] = useState(() => readAckFromStorage(todayKey));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const from = new Date(today.getTime() - DAILY_SUMMARY_LOOKBACK_DAYS * 86400000);
      const [activitiesRes, summaries, status] = await Promise.all([
        getStravaActivities(1, RECENT_ACTIVITIES_LIMIT, undefined, true),
        getGarminDailySummary(from.toISOString().slice(0, 10), todayKey),
        getStravaStatus(),
      ]);
      if (cancelled) return;
      setActivities(activitiesRes?.data ?? []);
      setDailySummaries(summaries);
      setLastSyncAt(status?.lastSyncAt ?? null);
      setSignalsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `today`/`todayKey` are memoized once per mount
  }, [todayKey]);

  const ackRanToday = useCallback(() => {
    writeAckToStorage(todayKey);
    setTodayAck(true);
  }, [todayKey]);

  const bmi = getBMI();
  const hasProfile = userProfile.age !== '' && !isNaN(ageNum);

  const mafResult = useMemo(
    () => calculateMAF({ userProfile, verifiedMafPace: null, ageNum, isChild, isNewbie, bmi }),
    [userProfile, ageNum, isChild, isNewbie, bmi],
  );

  const weekdayLabel = useMemo(() => localWeekdayLabel(today), [today]);
  const todayScheduleItem = useMemo(() => {
    if (!mafResult) return null;
    if (isChild) return mafResult.schedule[0] ?? null;
    return mafResult.schedule.find((s) => s.day === weekdayLabel) ?? mafResult.schedule[0] ?? null;
  }, [mafResult, isChild, weekdayLabel]);

  const hasTodayActivity = useMemo(
    () => activities.some((a) => isSameLocalDate(new Date(a.startDate), today)),
    [activities, today],
  );
  const staleSync = useMemo(() => {
    if (hasTodayActivity || todayAck) return false;
    if (!lastSyncAt) return true;
    return Date.now() - new Date(lastSyncAt).getTime() > STALE_SYNC_THRESHOLD_MS;
  }, [hasTodayActivity, todayAck, lastSyncAt]);

  const readiness = useMemo(
    () =>
      computeReadiness({
        recentActivities: activities,
        dailySummaries,
        checkin,
        profile: {
          age: ageNum,
          bmi,
          isProbation: !!userProfile.isProbation,
          isRecovering: userProfile.isRecovering,
          isMedicatedOrInjured: userProfile.isMedicatedOrInjured,
        },
        today,
        mafHr: mafResult?.mafHeartRate,
      }),
    [activities, dailySummaries, checkin, ageNum, bmi, userProfile, today, mafResult],
  );

  const recommendation = useMemo<DailyRecommendation | null>(() => {
    if (!mafResult || !todayScheduleItem) return null;
    return buildDailyRecommendation({
      adjustedScheduleItem: todayScheduleItem,
      mafHr: mafResult.mafHeartRate,
      readiness,
      profile: { age: ageNum, bmi },
    });
  }, [mafResult, todayScheduleItem, readiness, ageNum, bmi]);

  const adherence = useMemo<AdherenceDay[]>(() => {
    if (!mafResult || isChild) return [];
    return computeAdherence(mafResult.schedule, activities, mondayOf(today), today, todayAck);
  }, [mafResult, isChild, activities, today, todayAck]);

  // RED TEAM FIX #6 (extended to Phase 2): children get no structured guidance
  // content, same as no structured workout/HR zone.
  const guidanceCards = useMemo<GuidanceCard[]>(() => {
    if (!recommendation || isChild) return [];
    return selectGuidanceCards(recommendation, {
      isProbation: !!userProfile.isProbation,
      isRecovering: userProfile.isRecovering,
      isBeginner: isNewbie,
      highBmi: bmi >= HIGH_BMI_THRESHOLD,
    });
  }, [recommendation, isChild, userProfile.isProbation, userProfile.isRecovering, isNewbie, bmi]);

  return {
    loading: profileLoading || checkinLoading || signalsLoading,
    isChild,
    hasProfile,
    recommendation,
    guidanceCards,
    adherence,
    lastSyncAt,
    staleSync,
    todayAck,
    ackRanToday,
    checkin,
    checkinSubmitting,
    submitCheckin,
  };
}
