/**
 * Pure rule-based selection of GuidanceCard[] from today's DailyRecommendation +
 * profile flags. No React, no I/O — mirrors daily-recommendation-engine.ts /
 * maf-coaching-insights.ts so it stays unit-testable.
 *
 * Ordering note: the phase-02 spec's Architecture section has two slightly
 * conflicting phrasings ("prepend readiness-education" vs. the explicit "Output:
 * ordered [...] pre-run first, then bài bổ trợ, then post-run, then
 * education/disclaimer"). This implementation follows the more specific
 * "Output:" line — readiness-education is appended (not prepended), directly
 * before the always-last safety-disclaimer card.
 *
 * Cap note: active-training days curate a small essential set PER category
 * (PRE_RUN_LIMIT/POST_RUN_LIMIT/SUPPLEMENTARY_LIMIT below) rather than dumping
 * the whole library and slicing — dumping-then-slicing would let the 6-card
 * pre-run library crowd out post-run/education entirely. The library still
 * holds the extra pre/post-run cards (meal timing, caffeine, hydration, the
 * PDF-gap TODOs) for future surfacing; only the essentials render by default.
 * The safety-disclaimer card is "Always include... (short)" per spec — treated
 * as outside the per-category limits (a persistent footer). REST days render
 * the FULL R.E.S.T set uncapped (Success Criteria: "shows full R.E.S.T card
 * set" — REST-day content isn't a cap competition, it's the only content the
 * day has).
 */

import type { DailyRecommendation } from '../types';
import type { GuidanceCard, GuidanceFlag, GuidanceFlagsInput } from './guidance-types';
import { PRE_RUN_CARDS } from './pre-run';
import { POST_RUN_CARDS } from './post-run';
import { SUPPLEMENTARY_CARDS } from './supplementary';
import { REST_CARDS } from './rest';
import { READINESS_CARDS } from './readiness';
import { SAFETY_DISCLAIMER } from './safety';

const PRE_RUN_LIMIT = 2; // pre_warm_up_aerobic + avoid_static_stretching (array order)
const POST_RUN_LIMIT = 1; // post_cool_down only — the 2 PDF-gap TODO cards stay unsurfaced until reviewed
const SUPPLEMENTARY_LIMIT = 1; // "optional bài bổ trợ" (singular) — one standing suggestion, see supplementary.ts

/** Maps the appliesTo.flags union (matches GuidanceCitation's data-shape naming)
 *  onto GuidanceFlagsInput's `is`-prefixed profile-flag naming (matches
 *  ReadinessProfile's existing convention). Kept local — tiny, single-use. */
const FLAG_KEY: Record<GuidanceFlag, keyof GuidanceFlagsInput> = {
  probation: 'isProbation',
  recovering: 'isRecovering',
  beginner: 'isBeginner',
  highBmi: 'highBmi',
};

/** True when `card` matches the day's dayType + tier + profile flags. Exported
 *  for direct unit testing (no production content currently sets `flags` — see
 *  supplementary.ts YAGNI note — so this needs its own synthetic-card tests to
 *  reach full branch coverage). */
export function cardMatches(
  card: GuidanceCard,
  recommendation: DailyRecommendation,
  flags: GuidanceFlagsInput,
): boolean {
  const { dayTypes, tiers, flags: reqFlags } = card.appliesTo;
  if (dayTypes && !dayTypes.includes(recommendation.dayType)) return false;
  if (tiers && !tiers.includes(recommendation.tier)) return false;
  if (reqFlags && reqFlags.length > 0 && !reqFlags.some((f) => flags[FLAG_KEY[f]])) return false;
  return true;
}

/** First readiness-signal reason code (in reasons order) mapped to its most
 *  relevant education card; falls back to the general RHR-tracking card. */
const REASON_TO_READINESS_ID: Partial<Record<string, string>> = {
  rhr_bad: 'readiness_rhr_red',
  rhr_warn: 'readiness_rhr_red',
  sleep_warn: 'readiness_sleep_quality',
  fatigue_warn: 'readiness_mood_fatigue',
  fatigue_bad: 'readiness_mood_fatigue',
};
const DEFAULT_READINESS_ID = 'readiness_rhr_baseline';

/**
 * Picks the single most relevant readiness-education card from candidates
 * already filtered to today's tier (via cardMatches — readiness.ts cards all
 * carry appliesTo.tiers=['AMBER','RED'], so GREEN naturally yields []).
 */
function pickReadinessCard(
  recommendation: DailyRecommendation,
  flags: GuidanceFlagsInput,
): GuidanceCard | null {
  const candidates = READINESS_CARDS.filter((c) => cardMatches(c, recommendation, flags));
  if (candidates.length === 0) return null;
  const matchedId = recommendation.reasons
    .map((r) => REASON_TO_READINESS_ID[r.code])
    .find((id): id is string => Boolean(id));
  return (
    candidates.find((c) => c.id === matchedId) ??
    candidates.find((c) => c.id === DEFAULT_READINESS_ID) ??
    candidates[0]
  );
}

function buildRestDayCards(recommendation: DailyRecommendation, flags: GuidanceFlagsInput): GuidanceCard[] {
  const restSet = REST_CARDS.filter((c) => cardMatches(c, recommendation, flags));
  const education = pickReadinessCard(recommendation, flags);
  return education ? [...restSet, education] : restSet;
}

function buildActiveDayCards(recommendation: DailyRecommendation, flags: GuidanceFlagsInput): GuidanceCard[] {
  const preRun = PRE_RUN_CARDS.filter((c) => cardMatches(c, recommendation, flags)).slice(0, PRE_RUN_LIMIT);
  const supplementary = SUPPLEMENTARY_CARDS.filter((c) => cardMatches(c, recommendation, flags)).slice(
    0,
    SUPPLEMENTARY_LIMIT,
  );
  const postRun = POST_RUN_CARDS.filter((c) => cardMatches(c, recommendation, flags)).slice(0, POST_RUN_LIMIT);
  const education = pickReadinessCard(recommendation, flags);

  const ordered = [...preRun, ...supplementary, ...postRun];
  return education ? [...ordered, education] : ordered;
}

/**
 * Selects and orders the GuidanceCard[] for today's TodayCard. REST dayType
 * (any tier — RED always maps to REST per Phase 1's RED TEAM FIX #13) renders
 * the full R.E.S.T set; every other dayType renders pre-run/post-run/optional
 * bài bổ trợ. The safety-disclaimer card is always appended last.
 */
export function selectGuidanceCards(
  recommendation: DailyRecommendation,
  flags: GuidanceFlagsInput,
): GuidanceCard[] {
  const content =
    recommendation.dayType === 'REST'
      ? buildRestDayCards(recommendation, flags)
      : buildActiveDayCards(recommendation, flags);

  return [...content, SAFETY_DISCLAIMER];
}
