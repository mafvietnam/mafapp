import { useCallback, useEffect, useState } from 'react';
import { getStravaActivities, type StravaActivity } from '../services/strava-service';

export interface UseStravaActivitiesResult {
  activities: StravaActivity[];
  loading: boolean;
  error: boolean;
  /** Re-fetch the list (e.g. after a tracklog upload adds new activities). */
  refetch: () => void;
}

/**
 * Single-fetch hook for the dashboard activity list.
 * Called ONCE at the top of dashboard-page.tsx — do NOT call from
 * ActivitySection or its children (would double-fetch since both the
 * mobile and desktop layouts mount simultaneously, CSS-hidden only).
 * Never throws — a failed/null response surfaces as `error: true`.
 */
export function useStravaActivities(): UseStravaActivitiesResult {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivities() {
      setLoading(true);
      try {
        const result = await getStravaActivities(1, 10, undefined, true);
        if (cancelled) return;
        if (result === null) {
          setError(true);
          setActivities([]);
        } else {
          setActivities(result.data);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchActivities();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { activities, loading, error, refetch };
}
