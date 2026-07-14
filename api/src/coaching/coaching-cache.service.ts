/**
 * Narrative cache (Redis + durable DB row). Only AI-sourced narratives are cached (the
 * template is free to recompute on every request, so caching it buys nothing). Lock/budget
 * concerns live in coaching-lock-budget.service.ts (kept separate to stay under the
 * 200-LOC modularization guideline).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';

const REDIS_CACHE_TTL_SEC = 26 * 60 * 60; // slightly over one ICT day

interface CachedNarrative {
  narrative: string;
  model: string;
}

@Injectable()
export class CoachingCacheService {
  private readonly logger = new Logger(CoachingCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private redisKey(userId: string, ictDateKey: string): string {
    return `coaching:${userId}:${ictDateKey}`;
  }

  /** Redis first, DB fallback for durability across a Redis flush. Miss unless the stored inputHash matches. */
  async getCached(
    userId: string,
    ictDateKey: string,
    inputHash: string,
    serverToday: Date,
  ): Promise<CachedNarrative | null> {
    try {
      const raw = await this.redis.get(this.redisKey(userId, ictDateKey));
      if (raw) {
        const parsed = JSON.parse(raw) as {
          narrative: string;
          inputHash: string;
          model: string;
        };
        if (parsed.inputHash === inputHash)
          return { narrative: parsed.narrative, model: parsed.model };
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Coaching Redis cache read failed: ${this.errMessage(err)}`,
      );
    }

    try {
      const row = await this.prisma.coachingNarrative.findUnique({
        where: { userId_date: { userId, date: serverToday } },
      });
      if (row && row.inputHash === inputHash) {
        await this.writeRedisCache(
          userId,
          ictDateKey,
          row.narrative,
          row.inputHash,
          row.model,
        );
        return { narrative: row.narrative, model: row.model };
      }
    } catch (err: unknown) {
      // Table-absent guard (DB-first migration rollout gap) — soft-fail to miss, never throw.
      this.logger.error(
        `Coaching narrative DB read failed for user ${userId}: ${this.errMessage(err)}`,
      );
    }
    return null;
  }

  async saveNarrative(
    userId: string,
    serverToday: Date,
    ictDateKey: string,
    inputHash: string,
    narrative: string,
    model: string,
  ): Promise<void> {
    await this.writeRedisCache(userId, ictDateKey, narrative, inputHash, model);
    try {
      await this.prisma.coachingNarrative.upsert({
        where: { userId_date: { userId, date: serverToday } },
        update: { inputHash, narrative, model, source: 'ai' },
        create: {
          userId,
          date: serverToday,
          inputHash,
          narrative,
          model,
          source: 'ai',
        },
      });
    } catch (err: unknown) {
      // Table-absent guard / P2002 race (lock should prevent this, but upsert is safe either way).
      this.logger.error(
        `Coaching narrative DB persist failed for user ${userId}: ${this.errMessage(err)}`,
      );
    }
  }

  private async writeRedisCache(
    userId: string,
    ictDateKey: string,
    narrative: string,
    inputHash: string,
    model: string,
  ): Promise<void> {
    try {
      const value = JSON.stringify({ narrative, inputHash, model });
      await this.redis.set(
        this.redisKey(userId, ictDateKey),
        value,
        'EX',
        REDIS_CACHE_TTL_SEC,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Coaching Redis cache write failed: ${this.errMessage(err)}`,
      );
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
