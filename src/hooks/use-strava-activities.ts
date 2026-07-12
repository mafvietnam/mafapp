import { useState, useEffect } from 'react';
import { getStravaActivities, type StravaActivity } from '../services/strava-service';

export interface UseStravaActivitiesResult {
  activities: StravaActivity[];
  loading: boolean;
  error: boolean;
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

  useEffect(() => {
    let cancelled = false;

    async function fetchActivities() {
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
  }, []);

  return { activities, loading, error };
}
