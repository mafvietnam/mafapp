import { useState, useEffect, useCallback } from 'react';
import { getCheckins, upsertCheckin, type UpsertCheckinPayload } from '../services/checkin-service';
import { ictDateString } from '../utils/local-today';
import type { DailyCheckin } from '../types';

export interface UseDailyCheckinResult {
  checkin: DailyCheckin | null;
  loading: boolean;
  submitting: boolean;
  error: boolean;
  /** Returns true on success (and updates `checkin`); false on failure (leaves prior state, sets `error`). */
  submit: (payload: UpsertCheckinPayload) => Promise<boolean>;
}

/**
 * Today's check-in (if any) + submit handler. Purely optional — the "Today"
 * card and readiness engine work fine with `checkin: null` (RED TEAM FIX #5).
 * Uses the client's DISPLAY-only `ictDateString()` just to query the row for
 * "today"; the server is still authoritative for which date it actually wrote
 * to (RED TEAM FIX #7).
 */
export function useDailyCheckin(): UseDailyCheckinResult {
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = ictDateString();
      const rows = await getCheckins(today, today);
      if (cancelled) return;
      setCheckin(rows[0] ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (payload: UpsertCheckinPayload): Promise<boolean> => {
    setSubmitting(true);
    setError(false);
    try {
      const result = await upsertCheckin(payload);
      if (result) {
        setCheckin(result);
        return true;
      }
      setError(true);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { checkin, loading, submitting, error, submit };
}
