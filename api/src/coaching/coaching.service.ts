/**
 * Orchestrates GET /coaching/today: RECOMPUTE (server-owned data only, RED TEAM FIX #1)
 * -> structured-only LLM input -> cache lookup -> kill-switch/budget/single-flight-gated
 * generation -> template fallback. NEVER throws to the caller — every failure mode
 * (no profile, no key, disabled, over budget, lock contention, Claude error, unsafe
 * output) degrades to the deterministic template narrative.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { deriveIctDate } from '../checkin/checkin.service.js';
import { CoachingRepository } from './coaching-repository.js';
import { CoachingCacheService } from './coaching-cache.service.js';
import { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import { ClaudeClientService } from './claude-client.service.js';
import { recomputeDailyRecommendation } from './recompute/recompute.js';
import {
  buildStructuredInput,
  type StructuredCoachingInput,
} from './coaching-prompt.js';
import { isNarrativeSafe } from './coaching-narrative-validator.js';
import { buildTemplateNarrative } from './template-narrative.js';
import type { CoachingTodayResponse } from './coaching-response.dto.js';

const NO_PROFILE_NARRATIVE =
  'Hoàn thiện hồ sơ MAF để nhận gợi ý tập luyện hôm nay dựa trên lịch tập cá nhân của bạn.';

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(
    private readonly repo: CoachingRepository,
    private readonly cache: CoachingCacheService,
    private readonly lockBudget: CoachingLockBudgetService,
    private readonly config: ConfigService,
    private readonly claude: ClaudeClientService,
  ) {}

  async getToday(userId: string): Promise<CoachingTodayResponse> {
    const profile = await this.repo.loadProfile(userId);
    if (!profile) {
      return {
        source: 'template',
        narrative: NO_PROFILE_NARRATIVE,
        recommendation: null,
      };
    }

    // RED TEAM FIX #7 — server-derived ICT "today"; the client sends no date.
    const serverToday = deriveIctDate();
    const ictDateKey = serverToday.toISOString().slice(0, 10);

    const [recentActivities, rhrHistory, checkin] = await Promise.all([
      this.repo.loadRecentActivities(userId),
      this.repo.loadRhrHistory(userId, serverToday),
      this.repo.loadTodayCheckin(userId, serverToday),
    ]);

    // RED TEAM FIX #1 / #10 — the only recommendation the rest of this method ever sees
    // is recomputed server-side (health gate applied inside recompute.ts).
    const { recommendation } = recomputeDailyRecommendation({
      profile,
      recentActivities,
      checkin,
      rhrHistory,
      serverToday,
    });

    const structuredInput = buildStructuredInput(recommendation);
    const inputHash = hashStructuredInput(structuredInput); // RED TEAM FIX #2 — server-derived, not client-sent

    const cached = await this.cache.getCached(
      userId,
      ictDateKey,
      inputHash,
      serverToday,
    );
    if (cached) {
      return { source: 'ai', narrative: cached.narrative, recommendation };
    }

    const narrative = await this.tryGenerateAiNarrative(
      userId,
      serverToday,
      ictDateKey,
      inputHash,
      structuredInput,
    );
    if (narrative) {
      return { source: 'ai', narrative, recommendation };
    }

    return {
      source: 'template',
      narrative: buildTemplateNarrative(recommendation),
      recommendation,
    };
  }

  /** Returns the AI narrative on success, or null when disabled/no-key/locked/over-budget/unsafe/error. */
  private async tryGenerateAiNarrative(
    userId: string,
    serverToday: Date,
    ictDateKey: string,
    inputHash: string,
    structuredInput: StructuredCoachingInput,
  ): Promise<string | null> {
    // Kill-switch (RED TEAM FIX #2) — default 'false', so a fresh deploy makes zero API calls.
    const enabled =
      this.config.get<string>('AI_COACHING_ENABLED', 'false') === 'true';
    const hasApiKey =
      (this.config.get<string>('ANTHROPIC_API_KEY', '') || '').length > 0;
    if (!enabled || !hasApiKey) return null;

    // Single-flight lock — a losing concurrent request just serves the template this time
    // (no double-spend, no P2002 upsert race on the CoachingNarrative unique key).
    const gotLock = await this.lockBudget.acquireLock(userId, ictDateKey);
    if (!gotLock) return null;

    try {
      const withinBudget =
        await this.lockBudget.checkAndReserveBudget(ictDateKey);
      if (!withinBudget) return null;

      const narrative = await this.claude.generateNarrative(
        JSON.stringify(structuredInput),
      );
      if (!narrative || !isNarrativeSafe(narrative, structuredInput))
        return null;

      await this.cache.saveNarrative(
        userId,
        serverToday,
        ictDateKey,
        inputHash,
        narrative,
        this.claude.getModel(),
      );
      return narrative;
    } catch (err: unknown) {
      this.logger.warn(
        `Coaching AI generation path failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    } finally {
      await this.lockBudget.releaseLock(userId, ictDateKey);
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}

function hashStructuredInput(input: StructuredCoachingInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
