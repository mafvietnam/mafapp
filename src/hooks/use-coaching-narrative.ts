import { useEffect, useState } from 'react';
import { getTodayNarrative } from '../services/coaching-service';

export interface UseCoachingNarrativeResult {
  /** Non-null only on a successful 'ai' response — TodayCard shows the intro paragraph only then. */
  narrative: string | null;
  source: 'ai' | 'template' | null;
}

/**
 * Optional, additive AI-narrative hydration for TodayCard (Phase 4). Split out of
 * use-today-recommendation.ts to keep that hook under the 200-LOC guideline and to keep
 * this fetch fully independent/non-blocking: the deterministic template recommendation
 * (Phases 1-3) always renders first; this hook only asks the backend for a warmer
 * narrative afterward and swaps it in on success.
 *
 * Fully graceful: `enabled` should be false until the base recommendation has loaded
 * (avoids a wasted call while there's nothing to narrate yet); any error, non-'ai' source,
 * disabled backend flag, or the endpoint not existing at all resolves to narrative:null —
 * TodayCard then renders exactly as it does today (no visual regression when AI is off).
 */
export function useCoachingNarrative(enabled: boolean): UseCoachingNarrativeResult {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [source, setSource] = useState<'ai' | 'template' | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const result = await getTodayNarrative();
      if (cancelled || !result) return;
      setSource(result.source);
      setNarrative(result.source === 'ai' ? result.narrative : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { narrative, source };
}
