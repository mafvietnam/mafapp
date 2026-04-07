import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GarminConnect } from 'garmin-connect';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';

@Injectable()
export class GarminService {
  private readonly logger = new Logger(GarminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly encryption: GarminEncryptionService,
  ) {}

  /** Connect Garmin account using email/password (MVP credential flow) */
  async connect(userId: string, email: string, password: string) {
    try {
      const client = new GarminConnect({ username: email, password });
      await client.login();

      const profile = await client.getUserProfile();
      const garminUserId = profile?.displayName || profile?.userName || null;

      const encryptedEmail = this.encryption.encrypt(email);
      const encryptedPassword = this.encryption.encrypt(password);

      await this.prisma.garminConnection.upsert({
        where: { userId },
        update: {
          garminUserId,
          accessToken: encryptedEmail,
          refreshToken: encryptedPassword,
          status: 'CONNECTED',
          backfillStatus: 'PENDING',
        },
        create: {
          userId,
          garminUserId,
          accessToken: encryptedEmail,
          refreshToken: encryptedPassword,
          status: 'CONNECTED',
          backfillStatus: 'PENDING',
        },
      });

      return { connected: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Garmin connect failed for user ${userId}: ${message}`);
      if (
        message.includes('credentials') ||
        message.includes('401') ||
        message.includes('login')
      ) {
        throw new UnauthorizedException(
          'Thông tin đăng nhập Garmin không đúng',
        );
      }
      throw new InternalServerErrorException(
        'Không thể kết nối Garmin. Vui lòng thử lại.',
      );
    }
  }

  /** Disconnect Garmin — full cleanup with sync lock */
  async disconnect(userId: string) {
    const lockKey = `garmin:sync:${userId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    try {
      // Mark disconnected first so in-flight sync bails out
      await this.prisma.garminConnection
        .update({ where: { userId }, data: { status: 'DISCONNECTED' } })
        .catch(() => {});

      await this.prisma.garminDailySummary.deleteMany({ where: { userId } });
      await this.prisma.garminActivity.deleteMany({ where: { userId } });
      await this.prisma.garminConnection
        .delete({ where: { userId } })
        .catch(() => {});
    } finally {
      if (locked) await this.redis.del(lockKey);
    }

    return { disconnected: true };
  }

  /** Get current Garmin connection status (never returns tokens) */
  async getStatus(userId: string) {
    const conn = await this.prisma.garminConnection.findUnique({
      where: { userId },
      select: {
        status: true,
        garminUserId: true,
        lastSyncAt: true,
        backfillStatus: true,
        createdAt: true,
      },
    });

    if (!conn) {
      return {
        connected: false,
        status: null,
        garminUserId: null,
        lastSyncAt: null,
        backfillStatus: null,
        connectedAt: null,
      };
    }

    return {
      connected: conn.status === 'CONNECTED',
      status: conn.status,
      garminUserId: conn.garminUserId,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      backfillStatus: conn.backfillStatus,
      connectedAt: conn.createdAt.toISOString(),
    };
  }

  /** Create an authenticated GarminConnect client for a user (used by sync) */
  async getAuthenticatedClient(userId: string): Promise<GarminConnect> {
    const conn = await this.prisma.garminConnection.findUnique({
      where: { userId },
    });
    if (!conn) throw new Error('No Garmin connection found');

    const email = this.encryption.decrypt(conn.accessToken);
    const password = this.encryption.decrypt(conn.refreshToken);

    try {
      const client = new GarminConnect({ username: email, password });
      await client.login();
      return client;
    } catch (err: unknown) {
      this.logger.error(`Garmin re-auth failed for user ${userId}`);
      await this.prisma.garminConnection.update({
        where: { userId },
        data: { status: 'TOKEN_EXPIRED' },
      });
      throw err;
    }
  }

  /** Get paginated activities for a user */
  async getActivities(
    userId: string,
    page: number,
    limit: number,
    type?: string,
  ) {
    const where = { userId, ...(type ? { activityType: type } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.garminActivity.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.garminActivity.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Get single activity detail (no rawData) */
  async getActivity(userId: string, activityId: string) {
    return this.prisma.garminActivity.findFirst({
      where: { id: activityId, userId },
    });
  }

  /** Get daily summaries for a date range (max 90 days) */
  async getDailySummaries(userId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    // Cap range to 90 days to prevent unbounded queries
    const maxFrom = new Date(toDate.getTime() - 90 * 86400000);
    const effectiveFrom = fromDate < maxFrom ? maxFrom : fromDate;

    return this.prisma.garminDailySummary.findMany({
      where: {
        userId,
        date: { gte: effectiveFrom, lte: toDate },
      },
      orderBy: { date: 'desc' },
    });
  }
}
