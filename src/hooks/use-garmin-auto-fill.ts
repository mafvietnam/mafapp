import { useState, useEffect } from 'react';
import { getGarminStatus, getGarminActivities } from '../services/garmin-service';

export interface GarminAutoFillData {
  avgHr: string;
  hours: string;
  minutes: string;
  seconds: string;
  distance: string;
  activityDate: string;
  activityType: string;
}

/**
 * Fetches latest Garmin running activity (< 7 days old) for MAF Lab auto-fill.
 * Returns null if no Garmin connection or no recent run.
 */
export function useGarminAutoFill() {
  const [autoFill, setAutoFill] = useState<GarminAutoFillData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLatestRun() {
      try {
        const status = await getGarminStatus();
        if (!status?.connected) return;

        const data = await getGarminActivities(1, 1, 'RUNNING');
        if (!data?.items.length) return;

        const activity = data.items[0];
        const activityDate = new Date(activity.startTime);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        if (activityDate < sevenDaysAgo) return;

        const totalSec = activity.duration;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const distKm = activity.distance
          ? (activity.distance / 1000).toFixed(2)
          : '';

        if (!cancelled) {
          setAutoFill({
            avgHr: activity.avgHeartRate?.toString() ?? '',
            hours: h.toString(),
            minutes: m.toString(),
            seconds: s.toString(),
            distance: distKm,
            activityDate: activityDate.toLocaleDateString('vi-VN'),
            activityType: activity.activityType,
          });
        }
      } catch {
        // Garmin not available — silently skip auto-fill
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLatestRun();
    return () => { cancelled = true; };
  }, []);

  return { autoFill, loading };
}
