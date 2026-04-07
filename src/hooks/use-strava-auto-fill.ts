import { useState, useEffect } from 'react';
import { getStravaStatus, getStravaActivities } from '../services/strava-service';

const FEATURE_STRAVA = import.meta.env.VITE_FEATURE_STRAVA === 'true';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

export interface StravaAutoFillData {
  avgHr: string;
  hours: string;
  minutes: string;
  seconds: string;
  distance: string;
  activityDate: string;
  activityType: string;
}

/**
 * Fetches latest Strava running activity (< 7 days old) for MAF Lab auto-fill.
 * No-ops if VITE_FEATURE_STRAVA is not enabled.
 * Never throws — returns null on any failure.
 */
export function useStravaAutoFill() {
  const [autoFill, setAutoFill] = useState<StravaAutoFillData | null>(null);
  const [loading, setLoading] = useState(FEATURE_STRAVA);

  useEffect(() => {
    if (!FEATURE_STRAVA) return;

    let cancelled = false;

    async function fetchLatestRun() {
      try {
        const status = await getStravaStatus();
        if (!status?.connected) return;

        // Fetch latest 10 to find the most recent run (some may be non-running types)
        const result = await getStravaActivities(1, 10);
        if (!result?.data.length) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activity = result.data.find((a) => {
          return RUN_TYPES.has(a.type) && new Date(a.startDate) >= sevenDaysAgo;
        });
        if (!activity) return;

        const totalSec = activity.movingTime;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const distKm = activity.distance ? (activity.distance / 1000).toFixed(2) : '';

        if (!cancelled) {
          setAutoFill({
            avgHr: activity.avgHeartRate?.toString() ?? '',
            hours: h.toString(),
            minutes: m.toString(),
            seconds: s.toString(),
            distance: distKm,
            activityDate: new Date(activity.startDate).toLocaleDateString('vi-VN'),
            activityType: activity.type,
          });
        }
      } catch {
        // Strava not available — silently skip auto-fill
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLatestRun();
    return () => { cancelled = true; };
  }, []);

  return { autoFill, loading };
}
