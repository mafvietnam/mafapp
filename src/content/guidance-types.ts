/**
 * Content model for the guidance-card library (Phase 2). Static Vietnamese
 * data — no logic here. `BookRef` is reused from maf-coaching-insights.ts
 * (DRY, single source of truth for the CH3-CH9 union) and `DailyRecommendation`
 * / `ReadinessTier` from types.ts (Phase 1's "today" engine output).
 */

import type { BookRef } from '../utils/maf-coaching-insights';
import type { DailyRecommendation, ReadinessTier } from '../types';

export type GuidanceCategory =
  | 'pre-run'
  | 'post-run'
  | 'supplementary'
  | 'recovery'
  | 'eat'
  | 'sleep'
  | 'time'
  | 'readiness-edu'
  | 'safety-disclaimer';

/** Every card must cite a source: a book chapter, an external article, or both. */
export interface GuidanceCitation {
  label: string; // always present — VN or source title, e.g. "Aerobic Training Guidelines"
  bookRef?: BookRef;
  url?: string; // opens with rel="noopener noreferrer" (Security Considerations)
}

/** Selection predicate tags — a card matches when ALL provided predicates match. */
export interface GuidanceAppliesTo {
  dayTypes?: DailyRecommendation['dayType'][];
  tiers?: ReadinessTier[];
  flags?: GuidanceFlag[]; // matches if the recommendation-holder has ANY of these flags set
}

export type GuidanceFlag = 'probation' | 'recovering' | 'beginner' | 'highBmi';

/** Profile flags passed into `selectGuidanceCards` — naming mirrors the existing
 *  ReadinessProfile shape (isProbation/isRecovering) plus isBeginner/highBmi,
 *  which the "today" hook derives from isNewbie / BMI >= 30. */
export interface GuidanceFlagsInput {
  isProbation: boolean;
  isRecovering: boolean;
  isBeginner: boolean;
  highBmi: boolean;
}

export interface GuidanceCard {
  id: string; // stable, e.g. 'pre_warm_up_aerobic'
  category: GuidanceCategory;
  title: string; // VN
  body: string; // VN, template-literal (XSS-safe — no dangerouslySetInnerHTML)
  citation: GuidanceCitation;
  appliesTo: GuidanceAppliesTo;
}
