/**
 * Orchestrates GET /coaching/today: RECOMPUTE (server-owned data only, RED TEAM FIX #1)
 * -> structured-only LLM input -> cache lookup -> budget/single-flight-gated generation
 * (key resolved by AiProviderService: BYOK -> system+quota -> none) -> template
 * fallback. NEVER throws to the caller — every failure mode (no profile, no key,
 * disabled, over budget, lock contention, provider error, unsafe output) degrades to the
 * deterministic template narrative.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { deriveIctDate } from '../checkin/checkin.service.js';
import { CoachingRepository } from './coaching-repository.js';
import { CoachingCacheService } from './coaching-cache.service.js';
import { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import { AiProviderService } from '../ai/ai-provider.service.js';
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
    private readonly aiProvider: AiProviderService,
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
      return {
        source: cached.source,
        narrative: cached.narrative,
        recommendation,
      };
    }

    const generated = await this.tryGenerateAiNarrative(
      userId,
      serverToday,
      ictDateKey,
      inputHash,
      structuredInput,
    );
    if (generated) {
      return {
        source: generated.source,
        narrative: generated.narrative,
        recommendation,
      };
    }

    return {
      source: 'template',
      narrative: buildTemplateNarrative(recommendation),
      recommendation,
    };
  }

  /** Returns the generated narrative + tier on success, or null when unavailable/locked/over-budget/unsafe/error. */
  private async tryGenerateAiNarrative(
    userId: string,
    serverToday: Date,
    ictDateKey: string,
    inputHash: string,
    structuredInput: StructuredCoachingInput,
  ): Promise<{ narrative: string; source: 'byok' | 'system' } | null> {
    // Cheap pre-check (RED TEAM FIX #2 spirit) — skip the Redis lock/budget entirely when
    // there is definitely no AI path (no BYOK key, system tier off) — default deploy state.
    const available = await this.aiProvider.hasAiPath(userId);
    if (!available) return null;

    // Single-flight lock — a losing concurrent request just serves the template this time
    // (no double-spend, no P2002 upsert race on the CoachingNarrative unique key).
    const gotLock = await this.lockBudget.acquireLock(userId, ictDateKey);
    if (!gotLock) return null;

    try {
      const withinBudget =
        await this.lockBudget.checkAndReserveBudget(ictDateKey);
      if (!withinBudget) return null;

      const result = await this.aiProvider.generateNarrative(
        userId,
        JSON.stringify(structuredInput),
      );
      if (!result || !isNarrativeSafe(result.narrative, structuredInput))
        return null;

      await this.cache.saveNarrative(
        userId,
        serverToday,
        ictDateKey,
        inputHash,
        result.narrative,
        result.model,
        result.source,
      );
      return { narrative: result.narrative, source: result.source };
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
