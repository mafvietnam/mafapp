import { HealthCondition } from '../../profile/profile.dto.js';
import {
  recomputeDailyRecommendation,
  type RecomputeUserProfile,
} from './recompute.js';
import type { RecomputeActivity, RecomputeCheckin } from './recompute-types.js';

const SERVER_TODAY = new Date('2026-07-14T00:00:00.000Z'); // Tuesday

function baseProfile(
  overrides: Partial<RecomputeUserProfile> = {},
): RecomputeUserProfile {
  return {
    age: 35,
    height: 170,
    weight: 65,
    experience: 'REGULAR_NEW',
    commitment: 'BASE',
    isRecovering: false,
    isMedicatedOrInjured: false,
    isProbation: false,
    healthConditions: [],
    hasClearance: false,
    ...overrides,
  };
}

function params(
  overrides: {
    profile?: Partial<RecomputeUserProfile>;
    recentActivities?: RecomputeActivity[];
    checkin?: RecomputeCheckin | null;
    rhrHistory?: number[];
  } = {},
) {
  return {
    profile: baseProfile(overrides.profile),
    recentActivities: overrides.recentActivities ?? [],
    checkin: overrides.checkin ?? null,
    rhrHistory: overrides.rhrHistory ?? [],
    serverToday: SERVER_TODAY,
  };
}

describe('recomputeDailyRecommendation — end-to-end composition', () => {
  it('healthy profile, no signals => GREEN RUN on the BASE Tuesday template (60min)', () => {
    const { recommendation, readiness } =
      recomputeDailyRecommendation(params());
    expect(readiness.tier).toBe('GREEN');
    expect(recommendation.tier).toBe('GREEN');
    expect(recommendation.dayType).toBe('RUN');
    expect(recommendation.totalMinutes).toBe(60);
    expect(recommendation.hrZone).toEqual({ lower: 135, upper: 145 }); // mafHr = 180-35 = 145
  });

  it('child (age<16) short-circuits to play-only REST regardless of other signals', () => {
    const { recommendation } = recomputeDailyRecommendation(
      params({ profile: { age: 10 } }),
    );
    expect(recommendation.dayType).toBe('REST');
    expect(recommendation.hrZone).toBeNull();
    expect(recommendation.restCopy).toContain('VUI CHƠI');
  });

  it('bad check-in signal (fatigue=5) => RED => REST, never a run', () => {
    const { recommendation } = recomputeDailyRecommendation(
      params({
        checkin: {
          sleepQuality: 3,
          fatigue: 5,
          soreness: null,
          restingHr: null,
        },
      }),
    );
    expect(recommendation.tier).toBe('RED');
    expect(recommendation.dayType).toBe('REST');
    expect(recommendation.totalMinutes).toBe(0);
  });

  describe('RED TEAM FIX #10 — server-enforced health gate applies during recompute', () => {
    it('JOINT_ISSUES condition floors readiness to AMBER and caps/walk-firsts the recommendation even with a clean check-in', () => {
      const { recommendation, readiness, healthAdjustment } =
        recomputeDailyRecommendation(
          params({
            profile: { healthConditions: [HealthCondition.JOINT_ISSUES] },
          }),
        );
      expect(healthAdjustment.tierFloor).toBe('AMBER');
      expect(readiness.tier).toBe('AMBER');
      expect(recommendation.dayType).toBe('WALK'); // walkFirst swap
      expect(
        recommendation.reasons.some(
          (r) => r.code === 'health_joint_walk_first',
        ),
      ).toBe(true);
    });

    it('an un-cleared flagged user never gets an un-gated GREEN recommendation, even on a perfect check-in day', () => {
      const { recommendation } = recomputeDailyRecommendation(
        params({
          profile: {
            healthConditions: [HealthCondition.CARDIOVASCULAR],
            hasClearance: false,
          },
          checkin: {
            sleepQuality: 5,
            fatigue: 1,
            soreness: null,
            restingHr: null,
          },
        }),
      );
      expect(recommendation.tier).not.toBe('GREEN');
    });
  });

  it('BMI>=30 recompute converts a run day to WALK', () => {
    const { recommendation } = recomputeDailyRecommendation(
      params({ profile: { weight: 110, height: 170 } }),
    ); // bmi ~38
    expect(recommendation.dayType).toBe('WALK');
  });

  it('is deterministic — same inputs produce byte-identical output (required for inputHash stability)', () => {
    const p = params({
      checkin: { sleepQuality: 4, fatigue: 2, soreness: null, restingHr: null },
    });
    const first = recomputeDailyRecommendation(p);
    const second = recomputeDailyRecommendation(p);
    expect(JSON.stringify(first.recommendation)).toBe(
      JSON.stringify(second.recommendation),
    );
  });
});
