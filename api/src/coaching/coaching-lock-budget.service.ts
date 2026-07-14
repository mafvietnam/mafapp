/**
 * SETNX single-flight lock + the MANDATORY daily generation budget — RED TEAM FIX #2.
 * Split out of coaching-cache.service.ts (concurrency-control vs. cache-storage are
 * separate concerns) to keep both files under the 200-LOC modularization guideline.
 *
 * Fail-safe posture: any Redis error here returns "not available"/"over budget"
 * (fail-CLOSED to the template) rather than risking uncoordinated concurrent spend when
 * Redis is unreachable.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../shared/redis.service.js';

const LOCK_TTL_SEC = 30; // just covers one in-flight generation call
const BUDGET_KEY_TTL_SEC = 30 * 60 * 60; // safety margin over 24h ICT day
const DEFAULT_DAILY_BUDGET = 2000;

@Injectable()
export class CoachingLockBudgetService {
  private readonly logger = new Logger(CoachingLockBudgetService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private lockKey(userId: string, ictDateKey: string): string {
    return `coaching:lock:${userId}:${ictDateKey}`;
  }
  private budgetKey(ictDateKey: string): string {
    return `coaching:budget:${ictDateKey}`;
  }

  /** SETNX single-flight lock — true when THIS request won the race and should generate. */
  async acquireLock(userId: string, ictDateKey: string): Promise<boolean> {
    try {
      const result = await this.redis.set(
        this.lockKey(userId, ictDateKey),
        '1',
        'EX',
        LOCK_TTL_SEC,
        'NX',
      );
      return result === 'OK';
    } catch (err: unknown) {
      this.logger.warn(
        `Coaching lock acquire failed (fail-closed to template): ${this.errMessage(err)}`,
      );
      return false;
    }
  }

  async releaseLock(userId: string, ictDateKey: string): Promise<void> {
    try {
      await this.redis.del(this.lockKey(userId, ictDateKey));
    } catch (err: unknown) {
      this.logger.warn(`Coaching lock release failed: ${this.errMessage(err)}`);
    }
  }

  /** Atomically reserves one generation slot; false when today's MANDATORY budget is exhausted. */
  async checkAndReserveBudget(ictDateKey: string): Promise<boolean> {
    const budget = this.config.get<number>(
      'AI_COACHING_DAILY_BUDGET',
      DEFAULT_DAILY_BUDGET,
    );
    try {
      const key = this.budgetKey(ictDateKey);
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, BUDGET_KEY_TTL_SEC);
      if (count > budget) {
        this.logger.warn(
          `AI coaching daily budget exceeded: count=${count} budget=${budget} date=${ictDateKey}`,
        );
        return false;
      }
      return true;
    } catch (err: unknown) {
      this.logger.warn(
        `Coaching budget check failed (fail-closed to template): ${this.errMessage(err)}`,
      );
      return false;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
