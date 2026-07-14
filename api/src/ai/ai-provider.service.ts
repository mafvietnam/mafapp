/**
 * Phase 5 key-resolution + generation orchestrator — replaces coaching.service.ts's
 * direct ClaudeClientService call. Resolution order (phase-05 spec, confirmed 2026-07-14):
 *   1. User has a stored BYOK key -> use it (unlimited, their cost, no quota consumed).
 *      A failed BYOK call does NOT fall through to the system tier (avoids silently
 *      spending the shared budget when the user's own key/config is broken).
 *   2. Else, system tier: `ai.enabled` + admin OpenRouter key set + this month's usage
 *      < quota -> use the shared OpenRouter key, increment usage atomically.
 *   3. Else -> null (caller falls back to the template narrative; this service never throws).
 * `ai.enabled` gates ONLY the system tier (per the spec's literal "system AI enabled"
 * wording) — a user's own BYOK key works regardless of the admin switch.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider, UserAiKey } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { GarminEncryptionService } from '../shared/garmin-encryption.service.js';
import { deriveIctYearMonth } from './ai-usage-date.util.js';
import { OpenAiCompatibleAdapterService } from './adapters/openai-compatible-adapter.service.js';
import { AnthropicAdapterService } from './adapters/anthropic-adapter.service.js';
import { GeminiAdapterService } from './adapters/gemini-adapter.service.js';
import {
  BYOK_DEFAULT_MODEL,
  OPENROUTER_BASE_URL,
  type AiGenerationResult,
} from './ai-provider-types.js';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettings: AppSettingsService,
    private readonly encryption: GarminEncryptionService,
    private readonly openAiCompatible: OpenAiCompatibleAdapterService,
    private readonly anthropic: AnthropicAdapterService,
    private readonly gemini: GeminiAdapterService,
  ) {}

  /**
   * Cheap pre-check (no external provider calls) so coaching.service.ts can skip
   * acquiring the SETNX lock / spending a budget slot when there is definitely no AI
   * path available — mirrors Phase 4's enabled+hasApiKey short-circuit.
   */
  async hasAiPath(userId: string): Promise<boolean> {
    const byok = await this.safeLoadByokKey(userId);
    if (byok) return true;
    try {
      const cfg = await this.appSettings.getAiRuntimeConfig();
      return cfg.enabled && cfg.openRouterKey.length > 0;
    } catch (err: unknown) {
      this.logger.warn(
        `AI runtime config read failed: ${this.errMessage(err)}`,
      );
      return false;
    }
  }

  /** Resolves BYOK -> system+quota -> null and generates the narrative. Never throws. */
  async generateNarrative(
    userId: string,
    structuredInputJson: string,
  ): Promise<AiGenerationResult | null> {
    try {
      const byok = await this.safeLoadByokKey(userId);
      if (byok) return this.generateWithByok(byok, structuredInputJson);
      return await this.generateWithSystem(userId, structuredInputJson);
    } catch (err: unknown) {
      this.logger.warn(
        `AI provider generation failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private async safeLoadByokKey(userId: string): Promise<UserAiKey | null> {
    try {
      return await this.prisma.userAiKey.findUnique({ where: { userId } });
    } catch (err: unknown) {
      // Table-absent guard (DB-first migration rollout gap) — treat as "no BYOK key".
      this.logger.warn(
        `UserAiKey lookup failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private async generateWithByok(
    byok: UserAiKey,
    structuredInputJson: string,
  ): Promise<AiGenerationResult | null> {
    let apiKey: string;
    try {
      apiKey = this.encryption.decrypt(byok.encryptedKey);
    } catch (err: unknown) {
      this.logger.warn(`BYOK key decrypt failed: ${this.errMessage(err)}`);
      return null;
    }

    const model = BYOK_DEFAULT_MODEL[byok.provider];
    const narrative = await this.dispatchByokProvider(
      byok.provider,
      apiKey,
      model,
      structuredInputJson,
    );
    return narrative ? { narrative, model, source: 'byok' } : null;
  }

  private dispatchByokProvider(
    provider: AiProvider,
    apiKey: string,
    model: string,
    structuredInputJson: string,
  ): Promise<string | null> {
    switch (provider) {
      case 'OPENROUTER':
        return this.openAiCompatible.generate({
          apiKey,
          model,
          baseURL: OPENROUTER_BASE_URL,
          structuredInputJson,
        });
      case 'OPENAI':
        return this.openAiCompatible.generate({
          apiKey,
          model,
          structuredInputJson,
        });
      case 'ANTHROPIC':
        return this.anthropic.generate({ apiKey, model, structuredInputJson });
      case 'GEMINI':
        return this.gemini.generate({ apiKey, model, structuredInputJson });
    }
  }

  private async generateWithSystem(
    userId: string,
    structuredInputJson: string,
  ): Promise<AiGenerationResult | null> {
    const cfg = await this.appSettings.getAiRuntimeConfig();
    if (!cfg.enabled || !cfg.openRouterKey) return null;

    const yearMonth = deriveIctYearMonth();
    const usage = await this.prisma.aiUsage.upsert({
      where: { userId_yearMonth: { userId, yearMonth } },
      update: {},
      create: { userId, yearMonth, count: 0 },
    });
    if (usage.count >= cfg.defaultMonthlyQuota) {
      this.logger.warn(
        `AI system-tier monthly quota exceeded: user=${userId} yearMonth=${yearMonth} quota=${cfg.defaultMonthlyQuota}`,
      );
      return null;
    }

    const narrative = await this.openAiCompatible.generate({
      apiKey: cfg.openRouterKey,
      model: cfg.defaultModel,
      baseURL: OPENROUTER_BASE_URL,
      structuredInputJson,
    });
    if (!narrative) return null;

    // Increment only on a SUCCESSFUL generation — a failed call never spends the user's quota.
    await this.prisma.aiUsage.upsert({
      where: { userId_yearMonth: { userId, yearMonth } },
      update: { count: { increment: 1 } },
      create: { userId, yearMonth, count: 1 },
    });

    return { narrative, model: cfg.defaultModel, source: 'system' };
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
