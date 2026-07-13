import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { StravaEncryptionService } from './strava-encryption.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import type { StravaTokenResponse } from './strava-auth.service.js';
import type { StravaActivityQueryDto } from './dto/strava-activity-query.dto.js';

/** Slot availability derived from AppSettings cap + live authorization count. Internal — never sent whole to clients (see M14). */
export interface StravaSlotInfo {
  maxAthletes: number;
  active: number;
  slotsAvailable: number;
  limitReached: boolean;
}

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly encryption: StravaEncryptionService,
    private readonly appSettings: AppSettingsService,
  ) {}

  /** Find Strava connection for a user */
  async findConnection(userId: string) {
    return this.prisma.stravaConnection.findUnique({ where: { userId } });
  }

  /** Persist tokens from OAuth callback (upsert) */
  async saveTokensFromCallback(
    userId: string,
    tokens: StravaTokenResponse,
  ): Promise<void> {
    const data = {
      stravaAthleteId: String(tokens.athlete.id),
      accessToken: this.encryption.encrypt(tokens.access_token),
      refreshToken: this.encryption.encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(tokens.expires_at * 1000),
      status: 'CONNECTED' as const,
    };
    await this.prisma.stravaConnection.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    this.logger.log(
      `Strava connection saved for user ${userId} (athlete ${tokens.athlete.id})`,
    );
  }

  /** Every row is a live Strava-side authorization — counts against the slot grant regardless of local status (H6b) */
  async countActiveConnections(): Promise<number> {
    return this.prisma.stravaConnection.count();
  }

  /** Slot availability derived from AppSettings cap + live authorization count. Internal use only (M14). */
  async getSlotInfo(): Promise<StravaSlotInfo> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    const active = await this.countActiveConnections();
    return {
      maxAthletes: cfg.maxAthletes,
      active,
      slotsAvailable: Math.max(0, cfg.maxAthletes - active),
      limitReached: active >= cfg.maxAthletes,
    };
  }

  /** True when userId has no existing connection AND the app-wide slot cap is reached (H6/H6d) — reconnects are exempt. */
  async isNewConnectionBlocked(userId: string): Promise<boolean> {
    const existing = await this.findConnection(userId);
    if (existing) return false;
    const slot = await this.getSlotInfo();
    return slot.limitReached;
  }

  /** Get connection status — never returns tokens or numeric slot counts (M14) */
  async getStatus(userId: string) {
    // 30s TTL cache in AppSettingsService covers the extra read cost
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    const slot = await this.getSlotInfo();

    const conn = await this.prisma.stravaConnection.findUnique({
      where: { userId },
      select: {
        status: true,
        stravaAthleteId: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    if (!conn) {
      return {
        connected: false,
        status: null,
        stravaAthleteId: null,
        lastSyncAt: null,
        connectedAt: null,
        featureEnabled: cfg.enabled,
        connectionLimitReached: slot.limitReached,
      };
    }

    return {
      connected: conn.status === 'CONNECTED',
      status: conn.status,
      stravaAthleteId: conn.stravaAthleteId,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      connectedAt: conn.createdAt.toISOString(),
      featureEnabled: cfg.enabled,
      connectionLimitReached: slot.limitReached,
    };
  }

  /** Paginated list of a user's synced activities */
  async getActivities(userId: string, query: StravaActivityQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: { userId: string; type?: string; isDuplicate?: boolean } = {
      userId,
    };
    if (query.type) where.type = query.type;
    if (query.excludeDuplicates) where.isDuplicate = false;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stravaActivity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.stravaActivity.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** Single activity — only returns if owned by userId */
  async getActivity(userId: string, id: string) {
    return this.prisma.stravaActivity.findFirst({ where: { id, userId } });
  }

  /** Disconnect Strava — deletes connection + all activities, uses sync lock */
  async disconnect(userId: string): Promise<void> {
    const lockKey = `strava:sync:${userId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    try {
      // Mark disconnected first so any in-flight sync bails out
      const conn = await this.prisma.stravaConnection
        .update({ where: { userId }, data: { status: 'DISCONNECTED' } })
        .catch(() => null);

      // Best-effort: revoke the Strava-side authorization so the app slot is freed (H6a).
      // Token may already be expired — acceptable; never blocks the local delete below.
      if (conn) {
        await this.deauthorizeBestEffort(conn.accessToken);
      }

      await this.prisma.stravaActivity.deleteMany({ where: { userId } });
      // Purge detail cache too — honors data-deletion + prevents stale HR/PII resurrection
      // if this stravaActivityId is later reused by another account's sync.
      await this.prisma.stravaActivityDetail.deleteMany({ where: { userId } });
      await this.prisma.stravaConnection
        .delete({ where: { userId } })
        .catch(() => {});
    } finally {
      if (locked) await this.redis.del(lockKey);
    }
    this.logger.log(`Strava disconnected for user ${userId}`);
  }

  /** Best-effort POST /oauth/deauthorize — logs failure, never throws to caller */
  private async deauthorizeBestEffort(
    encryptedAccessToken: string,
  ): Promise<void> {
    try {
      const accessToken = this.encryption.decrypt(encryptedAccessToken);
      const res = await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: accessToken }),
        // Best-effort call — don't let a hung Strava request block disconnect indefinitely.
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`Strava deauthorize returned status ${res.status}`);
      }
      this.logger.log('Strava authorization revoked');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Strava deauthorize failed (non-blocking): ${msg}`);
    }
  }
}
