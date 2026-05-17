import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { StravaEncryptionService } from './strava-encryption.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import type { StravaTokenResponse } from './strava-auth.service.js';
import type { StravaActivityQueryDto } from './dto/strava-activity-query.dto.js';

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
    await this.prisma.stravaConnection.upsert({
      where: { userId },
      update: {
        stravaAthleteId: String(tokens.athlete.id),
        accessToken: this.encryption.encrypt(tokens.access_token),
        refreshToken: this.encryption.encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        status: 'CONNECTED',
      },
      create: {
        userId,
        stravaAthleteId: String(tokens.athlete.id),
        accessToken: this.encryption.encrypt(tokens.access_token),
        refreshToken: this.encryption.encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        status: 'CONNECTED',
      },
    });
    this.logger.log(
      `Strava connection saved for user ${userId} (athlete ${tokens.athlete.id})`,
    );
  }

  /** Get connection status — never returns tokens */
  async getStatus(userId: string) {
    // 30s TTL cache in AppSettingsService covers the extra read cost
    const cfg = await this.appSettings.getStravaRuntimeConfig();

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
      };
    }

    return {
      connected: conn.status === 'CONNECTED',
      status: conn.status,
      stravaAthleteId: conn.stravaAthleteId,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      connectedAt: conn.createdAt.toISOString(),
      featureEnabled: cfg.enabled,
    };
  }

  /** Paginated list of a user's synced activities */
  async getActivities(userId: string, query: StravaActivityQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: { userId: string; type?: string; isDuplicate?: boolean } = { userId };
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
      await this.prisma.stravaConnection
        .update({ where: { userId }, data: { status: 'DISCONNECTED' } })
        .catch(() => {});

      await this.prisma.stravaActivity.deleteMany({ where: { userId } });
      await this.prisma.stravaConnection
        .delete({ where: { userId } })
        .catch(() => {});
    } finally {
      if (locked) await this.redis.del(lockKey);
    }
    this.logger.log(`Strava disconnected for user ${userId}`);
  }
}
