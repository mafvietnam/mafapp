import {
  Injectable,
  Optional,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { GarminSyncService } from '../garmin/garmin-sync.service.js';
import { StravaSyncService } from '../strava/strava-sync.service.js';
import { StravaWebhookService } from '../strava/strava-webhook.service.js';
import { REVOKED_USER_KEY } from '../auth/auth.guard.js';
import type { AdminStatsResponse } from './admin-stats.dto.js';
import type { AdminUserQueryDto } from './admin-user-query.dto.js';
import type { AdminUpdateUserDto } from './admin-update-user.dto.js';
import type { StravaSettingsDto } from './dto/strava-settings.dto.js';
import type { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly appSettings: AppSettingsService,
    @Optional() @Inject(GarminSyncService) private readonly garminSync?: GarminSyncService,
    @Optional() @Inject(StravaSyncService) private readonly stravaSync?: StravaSyncService,
    @Optional() @Inject(StravaWebhookService) private readonly stravaWebhook?: StravaWebhookService,
  ) {}

  async getStats(): Promise<AdminStatsResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalProfiles, newUsersToday, recentUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.userProfile.count(),
        this.prisma.user.count({ where: { createdAt: { gte: today } } }),
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      totalUsers,
      totalProfiles,
      newUsersToday,
      recentUsers: recentUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  async getUsers(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, currentUserId: string) {
    // Prevent admin from disabling or demoting themselves
    if (id === currentUserId) {
      if (dto.isActive === false) {
        throw new ForbiddenException('Cannot deactivate your own account');
      }
      if (dto.role && dto.role !== 'ADMIN') {
        throw new ForbiddenException('Cannot demote your own account');
      }
    }

    await this.ensureUserExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role && { role: dto.role as Role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Sync Redis revocation set for immediate JWT invalidation
    if (dto.isActive === false) {
      await this.redis.set(`${REVOKED_USER_KEY}${id}`, '1');
    } else if (dto.isActive === true) {
      await this.redis.del(`${REVOKED_USER_KEY}${id}`);
    }

    return user;
  }

  async deleteUser(id: string) {
    await this.ensureUserExists(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  /** Admin overview of all Garmin connections with user info and sync stats */
  async getGarminOverview() {
    const isEnabled = process.env.FEATURE_GARMIN === 'true';

    const connections = await this.prisma.garminConnection.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    const activityCounts = await this.prisma.garminActivity.groupBy({
      by: ['userId'],
      _count: { id: true },
    });
    const countMap = new Map(activityCounts.map((c) => [c.userId, c._count.id]));

    return {
      featureEnabled: isEnabled,
      totalConnections: connections.length,
      connections: connections.map((c) => ({
        userId: c.userId,
        userName: c.user.name,
        userEmail: c.user.email,
        userAvatar: c.user.avatar,
        garminUserId: c.garminUserId,
        status: c.status,
        backfillStatus: c.backfillStatus,
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        connectedAt: c.createdAt.toISOString(),
        activityCount: countMap.get(c.userId) ?? 0,
      })),
    };
  }

  /** Trigger a manual Garmin sync for a specific user */
  async triggerGarminSync(userId: string) {
    if (!this.garminSync) {
      return { ok: false, message: 'Garmin feature is disabled' };
    }

    const conn = await this.prisma.garminConnection.findUnique({
      where: { userId },
    });
    if (!conn) throw new NotFoundException('Garmin connection not found');

    // Fire async — don't await
    this.garminSync.syncUser(userId).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.error(`Admin-triggered sync failed for user ${userId}: ${msg}`);
    });

    return { ok: true, message: 'Sync triggered' };
  }

  /** Admin overview of all Strava connections with user info and activity counts */
  async getStravaOverview() {
    const isEnabled = process.env.FEATURE_STRAVA === 'true';

    const connections = await this.prisma.stravaConnection.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    const activityCounts = await this.prisma.stravaActivity.groupBy({
      by: ['userId'],
      _count: { id: true },
    });
    const countMap = new Map(activityCounts.map((c) => [c.userId, c._count.id]));

    return {
      featureEnabled: isEnabled,
      totalConnections: connections.length,
      connections: connections.map((c) => ({
        userId: c.userId,
        userName: c.user.name,
        userEmail: c.user.email,
        userAvatar: c.user.avatar,
        stravaAthleteId: c.stravaAthleteId,
        status: c.status,
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        lastSyncStartedAt: c.lastSyncStartedAt?.toISOString() ?? null,
        lastSyncFinishedAt: c.lastSyncFinishedAt?.toISOString() ?? null,
        lastSyncError: c.lastSyncError ?? null,
        connectedAt: c.createdAt.toISOString(),
        activityCount: countMap.get(c.userId) ?? 0,
      })),
    };
  }

  /** Trigger a manual Strava sync for a specific user (admin-initiated) */
  async triggerStravaSync(userId: string, adminUserId: string) {
    if (!this.stravaSync) {
      return { ok: false, message: 'Strava feature is disabled' };
    }

    const conn = await this.prisma.stravaConnection.findUnique({ where: { userId } });
    if (!conn) throw new NotFoundException('Strava connection not found');

    // Idempotency guard: refuse if a sync started < 5 min ago and hasn't finished
    if (
      conn.lastSyncStartedAt &&
      Date.now() - conn.lastSyncStartedAt.getTime() < 5 * 60_000 &&
      (!conn.lastSyncFinishedAt || conn.lastSyncFinishedAt < conn.lastSyncStartedAt)
    ) {
      return { ok: false, message: 'Sync already in progress' };
    }

    await this.prisma.stravaConnection.update({
      where: { userId },
      data: { lastSyncStartedAt: new Date(), lastSyncError: null },
    });

    this.logger.log(`Admin ${adminUserId} triggered Strava sync for user ${userId}`);

    // Fire async — persist completion/error back to DB
    this.stravaSync
      .syncUser(userId)
      .then(() =>
        this.prisma.stravaConnection.update({
          where: { userId },
          data: { lastSyncFinishedAt: new Date() },
        }),
      )
      .catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown';
        this.logger.error(`Admin-triggered Strava sync failed for user ${userId}: ${msg}`);
        await this.prisma.stravaConnection
          .update({
            where: { userId },
            data: { lastSyncFinishedAt: new Date(), lastSyncError: msg.slice(0, 500) },
          })
          .catch(() => {});
      });

    return { ok: true, message: 'Sync triggered' };
  }

  /**
   * Persist Strava settings and synchronously resubscribe webhook if credentials changed.
   * Returns setMany result plus optional webhookResubscribed / webhookResubscribeError fields.
   */
  async saveStravaSettings(body: StravaSettingsDto) {
    const settings: Record<string, string> = {};
    if (body.clientId !== undefined) settings['strava.clientId'] = body.clientId.trim();
    if (body.clientSecret !== undefined) settings['strava.clientSecret'] = body.clientSecret.trim();
    if (body.webhookVerifyToken !== undefined) settings['strava.webhookVerifyToken'] = body.webhookVerifyToken.trim();
    if (body.enabled !== undefined) settings['strava.enabled'] = body.enabled === true ? 'true' : 'false';

    await this.appSettings.setMany(settings);

    const tokenChanged = body.webhookVerifyToken !== undefined;
    const credsChanged = body.clientId !== undefined || body.clientSecret !== undefined;
    const result: { ok: boolean; webhookResubscribed?: boolean; webhookResubscribeError?: string } = { ok: true };

    if ((tokenChanged || credsChanged) && this.stravaWebhook) {
      try {
        await this.stravaWebhook.refreshSubscription();
        result.webhookResubscribed = true;
      } catch (err: unknown) {
        result.webhookResubscribeError = err instanceof Error ? err.message : 'Unknown';
        this.logger.warn(`Webhook resubscribe failed after settings save: ${result.webhookResubscribeError}`);
      }
    }

    return result;
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
  }
}
