/**
 * Loads SERVER-OWNED data (UserProfile, recent StravaActivity, DailyCheckin history) and
 * maps it into the shapes recompute.ts expects. RED TEAM FIX #1: this is the ONLY data
 * source for the recompute — coaching.service.ts never accepts a client-sent profile or
 * recommendation. Defensive try/catch throughout (never let a downstream read failure
 * escape as a 500 — the narrative endpoint must never error to the client).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { HealthCondition } from '../profile/profile.dto.js';
import type {
  RecomputeActivity,
  RecomputeCheckin,
  CommitmentLevel,
  ExperienceLevel,
} from './recompute/recompute-types.js';
import type { RecomputeUserProfile } from './recompute/recompute.js';

const RECENT_ACTIVITIES_LIMIT = 50;
const RHR_HISTORY_LOOKBACK_DAYS = 14;

const KNOWN_HEALTH_CONDITIONS = new Set<string>(Object.values(HealthCondition));
const KNOWN_EXPERIENCE = new Set<string>([
  'NONE',
  'INCONSISTENT',
  'REGULAR_NEW',
  'ADVANCED',
]);
const KNOWN_COMMITMENT = new Set<string>(['HEALTH', 'BASE', 'PERFORMANCE']);

@Injectable()
export class CoachingRepository {
  private readonly logger = new Logger(CoachingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Maps the persisted UserProfile row into recompute.ts's input shape. Returns null when no profile exists yet. */
  async loadProfile(userId: string): Promise<RecomputeUserProfile | null> {
    try {
      const row = await this.prisma.userProfile.findUnique({
        where: { userId },
      });
      if (!row) return null;

      const experience: ExperienceLevel = KNOWN_EXPERIENCE.has(row.experience)
        ? (row.experience as ExperienceLevel)
        : 'NONE';
      const commitment: CommitmentLevel = KNOWN_COMMITMENT.has(row.commitment)
        ? (row.commitment as CommitmentLevel)
        : 'HEALTH';
      const healthConditions = (row.healthConditions ?? []).filter(
        (c): c is HealthCondition => KNOWN_HEALTH_CONDITIONS.has(c),
      );

      return {
        age: row.age,
        height: row.height,
        weight: row.weight,
        experience,
        commitment,
        isRecovering: row.isRecovering,
        isMedicatedOrInjured: row.isMedicatedOrInjured,
        isProbation: row.isProbation,
        healthConditions,
        hasClearance: row.clearedAt != null,
      };
    } catch (err: unknown) {
      this.logger.error(
        `Profile load failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  async loadRecentActivities(userId: string): Promise<RecomputeActivity[]> {
    try {
      const rows = await this.prisma.stravaActivity.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
        take: RECENT_ACTIVITIES_LIMIT,
        select: { startDate: true, distance: true },
      });
      return rows.map((r) => ({
        startDate: r.startDate,
        distanceMeters: r.distance,
      }));
    } catch (err: unknown) {
      this.logger.error(
        `Activity load failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return [];
    }
  }

  /** Check-in restingHr from the prior N days (today excluded) — RHR baseline for rhrSignal. */
  async loadRhrHistory(userId: string, serverToday: Date): Promise<number[]> {
    try {
      const from = new Date(
        serverToday.getTime() - RHR_HISTORY_LOOKBACK_DAYS * 86400000,
      );
      const rows = await this.prisma.dailyCheckin.findMany({
        where: {
          userId,
          restingHr: { not: null },
          date: { gte: from, lt: serverToday },
        },
        orderBy: { date: 'desc' },
        select: { restingHr: true },
      });
      return rows.map((r) => r.restingHr).filter((n): n is number => n != null);
    } catch (err: unknown) {
      this.logger.error(
        `RHR history load failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return [];
    }
  }

  async loadTodayCheckin(
    userId: string,
    serverToday: Date,
  ): Promise<RecomputeCheckin | null> {
    try {
      const row = await this.prisma.dailyCheckin.findUnique({
        where: { userId_date: { userId, date: serverToday } },
      });
      if (!row) return null;
      return {
        sleepQuality: row.sleepQuality,
        fatigue: row.fatigue,
        soreness: row.soreness,
        restingHr: row.restingHr,
      };
    } catch (err: unknown) {
      this.logger.error(
        `Check-in load failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
