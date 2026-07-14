/**
 * Admin AI settings + usage — split out of admin.service.ts (already >200 LOC) to keep
 * the Phase 5 addition modular. Mirrors the Strava admin settings pattern
 * (AppSettingsService.getStravaSettings/saveStravaSettings) but for `ai.*` keys.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { deriveIctYearMonth } from '../ai/ai-usage-date.util.js';
import type { AiSettingsDto } from './dto/ai-settings.dto.js';

export interface AiUsageSummary {
  yearMonth: string;
  total: number;
  users: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    count: number;
  }>;
}

@Injectable()
export class AdminAiService {
  private readonly logger = new Logger(AdminAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettings: AppSettingsService,
  ) {}

  getSettings() {
    return this.appSettings.getAiSettings();
  }

  async saveSettings(dto: AiSettingsDto): Promise<{ ok: true }> {
    const settings: Record<string, string> = {};
    if (dto.enabled !== undefined) settings['ai.enabled'] = String(dto.enabled);
    if (dto.openRouterKey !== undefined)
      settings['ai.openRouterKey'] = dto.openRouterKey.trim();
    if (dto.defaultModel !== undefined)
      settings['ai.defaultModel'] = dto.defaultModel.trim();
    if (dto.defaultMonthlyQuota !== undefined)
      settings['ai.defaultMonthlyQuota'] = String(dto.defaultMonthlyQuota);

    await this.appSettings.setMany(settings);
    return { ok: true };
  }

  /** Per-user + total system-tier generation counts for the current server ICT month. */
  async getUsage(): Promise<AiUsageSummary> {
    const yearMonth = deriveIctYearMonth();
    try {
      const rows = await this.prisma.aiUsage.findMany({
        where: { yearMonth },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { count: 'desc' },
      });
      const total = rows.reduce((sum, r) => sum + r.count, 0);
      return {
        yearMonth,
        total,
        users: rows.map((r) => ({
          userId: r.userId,
          userName: r.user.name,
          userEmail: r.user.email,
          count: r.count,
        })),
      };
    } catch (err: unknown) {
      // Table-absent guard (DB-first migration rollout gap) — soft-fail to empty, never 500.
      this.logger.error(
        `AI usage summary read failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      return { yearMonth, total: 0, users: [] };
    }
  }
}
