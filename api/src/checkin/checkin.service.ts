import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import type { UpsertCheckinDto } from './checkin.dto.js';

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Server-authoritative "today" in Asia/Ho_Chi_Minh (fixed UTC+7, NO daylight-
 * saving time) — RED TEAM FIX #7. This is the single source of truth for the
 * check-in unique key; the client's `local-today.ts` is DISPLAY-only and never
 * sent as the authoritative date. Algorithmically mirrored (not shared code —
 * separate runtimes) by the frontend parity test in
 * src/utils/__tests__/local-today.test.ts.
 * Returns a Date at UTC midnight of the ICT calendar date (safe for a `@db.Date` column).
 */
export function deriveIctDate(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + ICT_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert one check-in row for (userId, server-derived ICT date) —
   * RED TEAM FIX #7: any client-sent date is ignored (DTO has no date field).
   * RED TEAM FIX #8: table-absent guard — soft-fails to null during the
   * DB-first migration rollout gap instead of a 500 loop.
   */
  async upsert(userId: string, dto: UpsertCheckinDto) {
    const date = deriveIctDate();
    const data = {
      sleepQuality: dto.sleepQuality,
      fatigue: dto.fatigue,
      soreness: dto.soreness ?? null,
      note: dto.note ?? null,
      restingHr: dto.restingHr ?? null,
    };

    try {
      return await this.prisma.dailyCheckin.upsert({
        where: { userId_date: { userId, date } },
        update: data,
        create: { userId, date, ...data },
      });
    } catch (err: unknown) {
      // RED TEAM FIX #11: never log check-in vitals — only userId + error message.
      this.logger.error(
        `Check-in upsert failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  /** Range list, `to` defaults to server ICT today. Soft-fails to [] (table-absent guard). */
  async list(userId: string, from: string, to?: string) {
    const fromDate = new Date(from);
    const toDate = to ? new Date(to) : deriveIctDate();

    try {
      return await this.prisma.dailyCheckin.findMany({
        where: { userId, date: { gte: fromDate, lte: toDate } },
        orderBy: { date: 'desc' },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Check-in list failed for user ${userId}: ${this.errMessage(err)}`,
      );
      return [];
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
