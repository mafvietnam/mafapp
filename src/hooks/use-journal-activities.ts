import { useState, useEffect, useRef, useCallback } from 'react';
import { getStravaActivities, type StravaActivity } from '../services/strava-service';
import { windowRange } from '../utils/journal-date-utils';

/** 4 back-to-back 6-month windows = 2 years of history before "Tải thêm" stops. */
const WINDOW_CAP = 4;
const WINDOW_LIMIT = 365;

export interface UseJournalActivitiesResult {
  activities: StravaActivity[];
  loading: boolean; // initial load
  loadingMore: boolean; // "Tải thêm" in flight
  error: boolean; // initial load failed (nothing rendered yet)
  loadMoreError: boolean; // a "Tải thêm" failed but loaded weeks are preserved
  hasMore: boolean;
  loadMore: () => void;
}

interface WindowLoadResult {
  rows: StravaActivity[];
  stoppedIndex: number; // last window index attempted
  hasMore: boolean; // more windows remain below the cap
  failed: boolean; // a fetch returned null (transient)
}

/**
 * Advance through 6-month windows starting at `startIndex`, skipping EMPTY
 * windows (a 6-month gap in training ≠ end of history — RT-4), until a
 * non-empty window is found or the cap is reached. A single `now` is passed in
 * so every window tiles exactly (RT-3).
 */
async function collectFromWindow(now: Date, startIndex: number): Promise<WindowLoadResult> {
  let index = startIndex;
  while (index < WINDOW_CAP) {
    const { since, until } = windowRange(now, index);
    const res = await getStravaActivities(1, WINDOW_LIMIT, undefined, true, since, until);
    if (res === null) {
      return { rows: [], stoppedIndex: index, hasMore: true, failed: true };
    }
    if (res.data.length >= WINDOW_LIMIT) {
      // Runs-only DB makes this near-impossible; safety net only (no within-window paging — YAGNI).
      console.warn(
        `[journal] window ${index} returned the ${WINDOW_LIMIT}-row cap; older runs may be omitted.`,
      );
    }
    if (res.data.length > 0) {
      return { rows: res.data, stoppedIndex: index, hasMore: index + 1 < WINDOW_CAP, failed: false };
    }
    index += 1; // empty window → keep looking further back
  }
  return { rows: [], stoppedIndex: WINDOW_CAP - 1, hasMore: false, failed: false };
}

/** Append only ids not seen before; mutates `seen` so overlap across windows can't double-count (RT-3). */
function dedupe(rows: StravaActivity[], seen: Set<string>): StravaActivity[] {
  const fresh: StravaActivity[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    fresh.push(r);
  }
  return fresh;
}

/**
 * Journal fetch hook: loads the most recent non-empty 6-month window, then
 * "Tải thêm" walks older windows to a 2-year cap. Hardened per red-team:
 * stable `now`, synchronous re-entrancy lock, seeded/populated dedupe set,
 * non-clobbering load-more errors, empty-window skip.
 */
export function useJournalActivities(): UseJournalActivitiesResult {
  const nowRef = useRef(new Date()); // captured ONCE — every windowRange uses this instant
  const windowIndexRef = useRef(0);
  const loadingRef = useRef(false); // synchronous lock (state guard misses same-tick double-click)
  const seenIds = useRef(new Set<string>());

  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await collectFromWindow(nowRef.current, 0);
      if (cancelled) return; // seed seenIds only for the surviving run (strict-mode safe)
      if (result.failed && result.rows.length === 0) {
        setError(true);
      } else {
        setActivities(dedupe(result.rows, seenIds.current));
        windowIndexRef.current = result.stoppedIndex;
        setHasMore(result.hasMore);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return; // ref lock, not state — re-entrancy safe (RT-1)
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    void (async () => {
      try {
        const result = await collectFromWindow(nowRef.current, windowIndexRef.current + 1);
        if (result.failed && result.rows.length === 0) {
          setLoadMoreError(true); // preserve loaded weeks; do NOT touch hasMore (RT-2)
          return;
        }
        const fresh = dedupe(result.rows, seenIds.current);
        windowIndexRef.current = result.stoppedIndex;
        setActivities((prev) => [...prev, ...fresh]); // functional — no stale closure (RT-3)
        setHasMore(result.hasMore);
      } finally {
        setLoadingMore(false);
        loadingRef.current = false;
      }
    })();
  }, [hasMore]);

  return { activities, loading, loadingMore, error, loadMoreError, hasMore, loadMore };
}
