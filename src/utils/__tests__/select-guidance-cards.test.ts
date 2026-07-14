/**
 * Tests for select-guidance-cards.ts. Covers dayType/tier/flag combinations,
 * the always-non-empty citation invariant, cap behavior, and RED TEAM FIX #13
 * (no guidance card ever suggests a light run on a RED/REST day).
 */

import { describe, it, expect } from 'vitest';
import type { DailyRecommendation, ReasonCode, ReadinessTier } from '../../types';
import type { GuidanceCard, GuidanceFlag, GuidanceFlagsInput } from '../../content/guidance-types';
import { cardMatches, selectGuidanceCards } from '../../content/select-guidance-cards';
import { PRE_RUN_CARDS } from '../../content/pre-run';
import { POST_RUN_CARDS } from '../../content/post-run';
import { SUPPLEMENTARY_CARDS } from '../../content/supplementary';
import { REST_CARDS } from '../../content/rest';
import { READINESS_CARDS } from '../../content/readiness';
import { SAFETY_DISCLAIMER } from '../../content/safety';

const NO_FLAGS: GuidanceFlagsInput = { isProbation: false, isRecovering: false, isBeginner: false, highBmi: false };

function rec(overrides: Partial<DailyRecommendation> = {}): DailyRecommendation {
  return {
    dayType: 'RUN',
    title: 'Chạy nhẹ nhàng 45 phút',
    totalMinutes: 45,
    warmupMin: 9,
    cooldownMin: 9,
    mainMinutes: 27,
    hrZone: { lower: 135, upper: 145 },
    tier: 'GREEN',
    reasons: [],
    citations: ['CH5', 'CH6'],
    ...overrides,
  };
}

function reason(code: string, severity: ReasonCode['severity'] = 'warn'): ReasonCode {
  return { code, severity, text: 'x' };
}

const ALL_CARDS: GuidanceCard[] = [
  ...PRE_RUN_CARDS,
  ...POST_RUN_CARDS,
  ...SUPPLEMENTARY_CARDS,
  ...REST_CARDS,
  ...READINESS_CARDS,
  SAFETY_DISCLAIMER,
];

describe('content library — every card has a non-empty citation', () => {
  it.each(ALL_CARDS.map((c) => [c.id, c] as const))('%s', (_id, card) => {
    expect(card.citation.label.length).toBeGreaterThan(0);
  });
});

describe('cardMatches — dayType/tier/flag predicates', () => {
  const base: GuidanceCard = {
    id: 'test_card',
    category: 'pre-run',
    title: 't',
    body: 'b',
    citation: { label: 'l' },
    appliesTo: {},
  };

  it('matches everything when appliesTo is empty', () => {
    expect(cardMatches(base, rec(), NO_FLAGS)).toBe(true);
  });

  it('respects dayTypes predicate', () => {
    const card = { ...base, appliesTo: { dayTypes: ['REST'] as DailyRecommendation['dayType'][] } };
    expect(cardMatches(card, rec({ dayType: 'REST' }), NO_FLAGS)).toBe(true);
    expect(cardMatches(card, rec({ dayType: 'RUN' }), NO_FLAGS)).toBe(false);
  });

  it('respects tiers predicate', () => {
    const card = { ...base, appliesTo: { tiers: ['AMBER', 'RED'] as ReadinessTier[] } };
    expect(cardMatches(card, rec({ tier: 'AMBER' }), NO_FLAGS)).toBe(true);
    expect(cardMatches(card, rec({ tier: 'GREEN' }), NO_FLAGS)).toBe(false);
  });

  it('respects flags predicate — matches when ANY required flag is set', () => {
    const flags: GuidanceFlag[] = ['beginner', 'highBmi'];
    const card = { ...base, appliesTo: { flags } };
    expect(cardMatches(card, rec(), NO_FLAGS)).toBe(false);
    expect(cardMatches(card, rec(), { ...NO_FLAGS, isBeginner: true })).toBe(true);
    expect(cardMatches(card, rec(), { ...NO_FLAGS, highBmi: true })).toBe(true);
  });

  it('probation/recovering flags map onto is-prefixed input keys', () => {
    const probationFlags: GuidanceFlag[] = ['probation'];
    const recoveringFlags: GuidanceFlag[] = ['recovering'];
    const probationCard = { ...base, appliesTo: { flags: probationFlags } };
    const recoveringCard = { ...base, appliesTo: { flags: recoveringFlags } };
    expect(cardMatches(probationCard, rec(), { ...NO_FLAGS, isProbation: true })).toBe(true);
    expect(cardMatches(recoveringCard, rec(), { ...NO_FLAGS, isRecovering: true })).toBe(true);
    expect(cardMatches(probationCard, rec(), NO_FLAGS)).toBe(false);
  });
});

describe('REST day', () => {
  it('GREEN REST shows the full R.E.S.T set + disclaimer, no readiness-education', () => {
    const cards = selectGuidanceCards(rec({ dayType: 'REST', tier: 'GREEN' }), NO_FLAGS);
    const ids = cards.map((c) => c.id);
    expect(REST_CARDS.every((c) => ids.includes(c.id))).toBe(true);
    expect(ids).toContain('safety_general_disclaimer');
    expect(ids.some((id) => READINESS_CARDS.some((r) => r.id === id))).toBe(false);
    expect(cards[cards.length - 1].id).toBe('safety_general_disclaimer');
  });

  it('AMBER REST prepends a readiness-education card before the disclaimer', () => {
    const cards = selectGuidanceCards(
      rec({ dayType: 'REST', tier: 'AMBER', reasons: [reason('sleep_warn')] }),
      NO_FLAGS,
    );
    const ids = cards.map((c) => c.id);
    expect(ids).toContain('readiness_sleep_quality');
    expect(ids[ids.length - 1]).toBe('safety_general_disclaimer');
    expect(ids[ids.length - 2]).toBe('readiness_sleep_quality');
  });

  it('RED REST maps rhr_bad -> readiness_rhr_red and never suggests running', () => {
    const cards = selectGuidanceCards(
      rec({ dayType: 'REST', tier: 'RED', reasons: [reason('rhr_bad', 'bad')] }),
      NO_FLAGS,
    );
    const ids = cards.map((c) => c.id);
    expect(ids).toContain('readiness_rhr_red');
    for (const card of cards) {
      expect(card.body).not.toMatch(/chạy nhẹ/i);
      expect(card.title).not.toMatch(/chạy nhẹ/i);
    }
  });

  it('RED REST with no mapped reason falls back to the general RHR-baseline card', () => {
    const cards = selectGuidanceCards(rec({ dayType: 'REST', tier: 'RED', reasons: [] }), NO_FLAGS);
    expect(cards.map((c) => c.id)).toContain('readiness_rhr_baseline');
  });

  it('fatigue_bad reason maps to the mood/fatigue readiness card', () => {
    const cards = selectGuidanceCards(
      rec({ dayType: 'REST', tier: 'RED', reasons: [reason('fatigue_bad', 'bad')] }),
      NO_FLAGS,
    );
    expect(cards.map((c) => c.id)).toContain('readiness_mood_fatigue');
  });
});

describe('Active training day (RUN/LONG_RUN/WALK/RECOVERY)', () => {
  const activeTypes: DailyRecommendation['dayType'][] = ['RUN', 'LONG_RUN', 'WALK', 'RECOVERY'];

  it.each(activeTypes)('%s GREEN shows pre-run + post-run + bài bổ trợ + disclaimer', (dayType) => {
    const cards = selectGuidanceCards(rec({ dayType, tier: 'GREEN' }), NO_FLAGS);
    const ids = cards.map((c) => c.id);
    expect(ids.some((id) => PRE_RUN_CARDS.some((c) => c.id === id))).toBe(true);
    expect(ids.some((id) => POST_RUN_CARDS.some((c) => c.id === id))).toBe(true);
    expect(ids.some((id) => SUPPLEMENTARY_CARDS.some((c) => c.id === id))).toBe(true);
    expect(ids[ids.length - 1]).toBe('safety_general_disclaimer');
  });

  it('GREEN includes the anti-static-stretching "what to do instead" card', () => {
    const cards = selectGuidanceCards(rec({ tier: 'GREEN' }), NO_FLAGS);
    expect(cards.map((c) => c.id)).toContain('avoid_static_stretching');
  });

  it('AMBER is recovery-leaning: no bài bổ trợ, but prepends readiness-education', () => {
    const cards = selectGuidanceCards(rec({ tier: 'AMBER', reasons: [reason('rhr_warn')] }), NO_FLAGS);
    const ids = cards.map((c) => c.id);
    expect(ids.some((id) => SUPPLEMENTARY_CARDS.some((c) => c.id === id))).toBe(false);
    expect(ids).toContain('readiness_rhr_red');
    expect(ids.some((id) => PRE_RUN_CARDS.some((c) => c.id === id))).toBe(true);
    expect(ids.some((id) => POST_RUN_CARDS.some((c) => c.id === id))).toBe(true);
  });

  it('caps content cards at 4 (excluding the always-appended disclaimer)', () => {
    const cards = selectGuidanceCards(rec({ tier: 'AMBER', reasons: [reason('sleep_warn')] }), NO_FLAGS);
    const withoutDisclaimer = cards.filter((c) => c.id !== 'safety_general_disclaimer');
    expect(withoutDisclaimer.length).toBeLessThanOrEqual(4);
  });

  it('safety-disclaimer is always the last card', () => {
    for (const tier of ['GREEN', 'AMBER'] as ReadinessTier[]) {
      const cards = selectGuidanceCards(rec({ tier, reasons: tier === 'AMBER' ? [reason('sleep_warn')] : [] }), NO_FLAGS);
      expect(cards[cards.length - 1].id).toBe('safety_general_disclaimer');
    }
  });
});
