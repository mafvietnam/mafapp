import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStravaActivityDetail,
  type StravaActivityDetailResponse,
} from '../services/strava-service';
// Monotonic request-sequence guard. A plain boolean cancel flag races on an
// in-place `id` change (/activities/A -> /activities/B without unmount): the
// cleanup sets it true, then the new effect resets it false before A's slow
// response resolves, so A's result overwrites B. The sequence number is bumped
// on every fetch AND on cleanup, so any superseded response is dropped.

export interface UseStravaActivityDetailResult {
  data: StravaActivityDetailResponse | null;
  loading: boolean;
  error: boolean;
  /** Re-calls the detail endpoint (used by the hydrated:false retry button, see phase-04). */
  refetch: () => void;
}

/**
 * Fetch hook for a single activity's detail + streams, keyed on `id`.
 * Follows the never-throws contract from use-strava-activities.ts — a
 * failed/null response (404, network error, etc.) surfaces as `error: true`,
 * it never throws into the component tree.
 */
export function useStravaActivityDetail(id: string | undefined): UseStravaActivityDetailResult {
  const [data, setData] = useState<StravaActivityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const seqRef = useRef(0);

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setError(true);
      setData(null);
      setLoading(false);
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const result = await getStravaActivityDetail(id);
      if (seq !== seqRef.current) return; // superseded (id changed / unmounted / refetched)
      if (result === null) {
        setError(true);
        setData(null);
      } else {
        setData(result);
        setError(false);
      }
    } catch {
      if (seq === seqRef.current) {
        setError(true);
        setData(null);
      }
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    return () => {
      seqRef.current++; // invalidate any in-flight request on unmount / id change
    };
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
}
