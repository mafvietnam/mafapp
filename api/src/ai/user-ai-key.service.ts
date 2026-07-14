/**
 * User-facing BYOK (bring-your-own-key) CRUD — GET/PUT/DELETE /ai/key. Keys are
 * AES-256-GCM encrypted at rest (garmin-encryption.service.ts, reused) and NEVER
 * returned raw to the client (mirrors AppSettingsService.mask). Table-absent guards
 * (DB-first migration rollout gap) soft-fail rather than 500.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service.js';
import { GarminEncryptionService } from '../shared/garmin-encryption.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { deriveIctYearMonth } from './ai-usage-date.util.js';
import type { UserAiKeyDto } from './dto/user-ai-key.dto.js';

/** Loose "does this look like a real key for this provider" sanity check — not a hard guarantee. */
const PREFIX_HINTS: Record<AiProvider, RegExp> = {
  OPENROUTER: /^sk-or-/,
  OPENAI: /^sk-/,
  ANTHROPIC: /^sk-ant-/,
  GEMINI: /^AIza/,
};

export interface UserAiKeyStatus {
  provider: AiProvider | null;
  hasKey: boolean;
  /** Which tier a coaching request would actually use right now. */
  source: 'byok' | 'system' | 'none';
  usageThisMonth: number;
  quota: number;
}

@Injectable()
export class UserAiKeyService {
  private readonly logger = new Logger(UserAiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: GarminEncryptionService,
    private readonly appSettings: AppSettingsService,
  ) {}

  /** Masked status for GET /ai/key — never returns the raw key. */
  async getStatus(userId: string): Promise<UserAiKeyStatus> {
    const [byok, cfg, usageThisMonth] = await Promise.all([
      this.safeLoadKey(userId),
      this.appSettings.getAiRuntimeConfig().catch(() => ({
        enabled: false,
        openRouterKey: '',
        defaultModel: '',
        defaultMonthlyQuota: 0,
      })),
      this.safeLoadUsage(userId),
    ]);

    if (byok) {
      return {
        provider: byok.provider,
        hasKey: true,
        source: 'byok',
        usageThisMonth,
        quota: cfg.defaultMonthlyQuota,
      };
    }

    return {
      provider: null,
      hasKey: false,
      source: cfg.enabled && cfg.openRouterKey ? 'system' : 'none',
      usageThisMonth,
      quota: cfg.defaultMonthlyQuota,
    };
  }

  /** PUT /ai/key — validates, encrypts, upserts (one active BYOK key per user). */
  async setKey(userId: string, dto: UserAiKeyDto): Promise<{ ok: true }> {
    const key = dto.key.trim();
    if (key.length === 0) {
      throw new BadRequestException('key must not be empty');
    }
    if (!PREFIX_HINTS[dto.provider].test(key)) {
      throw new BadRequestException(
        `key does not look like a valid ${dto.provider} API key`,
      );
    }

    const encryptedKey = this.encryption.encrypt(key);
    try {
      await this.prisma.userAiKey.upsert({
        where: { userId },
        update: { provider: dto.provider, encryptedKey },
        create: { userId, provider: dto.provider, encryptedKey },
      });
    } catch (err: unknown) {
      this.logger.error(
        `BYOK key upsert failed for user ${userId}: ${this.errMessage(err)}`,
      );
      throw new BadRequestException('Unable to save key — please try again');
    }
    return { ok: true };
  }

  /** DELETE /ai/key — idempotent (no-op if the user has no key). */
  async deleteKey(userId: string): Promise<{ ok: true }> {
    try {
      await this.prisma.userAiKey.deleteMany({ where: { userId } });
    } catch (err: unknown) {
      this.logger.error(
        `BYOK key delete failed for user ${userId}: ${this.errMessage(err)}`,
      );
    }
    return { ok: true };
  }

  private async safeLoadKey(userId: string) {
    try {
      return await this.prisma.userAiKey.findUnique({ where: { userId } });
    } catch (err: unknown) {
      this.logger.warn(
        `BYOK key lookup failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private async safeLoadUsage(userId: string): Promise<number> {
    try {
      const row = await this.prisma.aiUsage.findUnique({
        where: {
          userId_yearMonth: { userId, yearMonth: deriveIctYearMonth() },
        },
      });
      return row?.count ?? 0;
    } catch (err: unknown) {
      this.logger.warn(
        `AI usage lookup failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return 0;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
