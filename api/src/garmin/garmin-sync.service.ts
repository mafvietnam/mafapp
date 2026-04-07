import { Injectable, Logger } from '@nestjs/common';
import type { GarminConnect } from 'garmin-connect';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { GarminService } from './garmin.service.js';

/** Delay helper — avoids Garmin rate limiting */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Zero-safe number coercion: returns null only if value is null/undefined/NaN */
const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

@Injectable()
export class GarminSyncService {
  private readonly logger = new Logger(GarminSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly garminService: GarminService,
  ) {}

  /** Sync a single user's activities + daily summaries */
  async syncUser(userId: string) {
    // Per-user mutex — prevent concurrent syncs for the same user
    const userLock = `garmin:sync:${userId}`;
    const locked = await this.redis.set(userLock, '1', 'EX', 300, 'NX');
    if (!locked) {
      this.logger.debug(`Sync already in progress for user ${userId}, skipping`);
      return;
    }

    const conn = await this.prisma.garminConnection.findUnique({
      where: { userId },
    });
    if (!conn || conn.status === 'DISCONNECTED') {
      await this.redis.del(userLock);
      return;
    }

    // Mark backfill in-progress if pending
    if (conn.backfillStatus === 'PENDING') {
      await this.prisma.garminConnection.update({
        where: { userId },
        data: { backfillStatus: 'IN_PROGRESS' },
      });
    }

    try {
      const client = await this.garminService.getAuthenticatedClient(userId);
      const since = conn.lastSyncAt ?? new Date(Date.now() - 30 * 86400000);

      await this.syncActivities(client, userId, since);
      await this.syncDailySummaries(client, userId, since);

      await this.prisma.garminConnection.update({
        where: { userId },
        data: {
          lastSyncAt: new Date(),
          status: 'CONNECTED',
          backfillStatus: 'COMPLETE',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Sync failed for user ${userId}: ${msg}`);
      await this.prisma.garminConnection
        .update({
          where: { userId },
          data: {
            status: 'ERROR',
            backfillStatus: conn.backfillStatus === 'NONE' ? 'NONE' : 'FAILED',
          },
        })
        .catch(() => {});
    } finally {
      await this.redis.del(userLock);
    }
  }

  /** Fetch and upsert activities from Garmin */
  private async syncActivities(
    client: GarminConnect,
    userId: string,
    since: Date,
  ) {
    const raw = (await client.getActivities(0, 50)) as any[];
    if (!Array.isArray(raw)) return;

    let count = 0;
    for (const a of raw) {
      const startTimeStr = a.startTimeLocal as string | undefined;
      if (!startTimeStr) continue;

      const startTime = new Date(startTimeStr);
      if (startTime <= since) continue;

      const garminActivityId = String(a.activityId);
      const activityType = ((a.activityType as Record<string, unknown>)
        ?.typeKey ?? 'OTHER') as string;

      // Compute avg pace (min/km) from duration + distance
      const duration = Number(a.duration) || 0;
      const distance = Number(a.distance) || 0;
      const avgPace = distance > 0 ? duration / 60 / (distance / 1000) : null;

      const activityData = {
        activityType: activityType.toUpperCase(),
        startTime,
        duration,
        distance: distance || null,
        avgHeartRate: toNum(a.averageHR),
        maxHeartRate: toNum(a.maxHR),
        minHeartRate: null as number | null,
        avgPace,
        calories: toNum(a.calories),
        vo2Max: toNum(a.vO2MaxValue),
        trainingEffect: toNum(a.aerobicTrainingEffect),
      };

      await this.prisma.garminActivity.upsert({
        where: { garminActivityId },
        update: activityData,
        create: { userId, garminActivityId, ...activityData },
      });
      count++;
    }
    this.logger.log(`Synced ${count} activities for user ${userId}`);
  }

  /** Fetch and upsert daily health summaries */
  private async syncDailySummaries(
    client: GarminConnect,
    userId: string,
    since: Date,
  ) {
    const today = new Date();
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);

    // Limit to 30 days to avoid rate limiting
    const maxDays = 30;
    const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    const daysToSync = Math.min(diffDays + 1, maxDays);

    let count = 0;
    for (let i = 0; i < daysToSync; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (daysToSync - 1 - i));
      date.setHours(0, 0, 0, 0);

      try {
        const [hr, steps, sleep] = await Promise.all([
          client.getHeartRate(date).catch(() => null) as Promise<any>,
          client.getSteps(date).catch(() => null) as Promise<any>,
          client.getSleepData(date).catch(() => null) as Promise<any>,
        ]);

        const sleepSec = toNum(sleep?.sleepTimeSeconds);
        const data = {
          steps: toNum(steps?.totalSteps),
          restingHeartRate: toNum(hr?.restingHeartRate),
          avgHeartRate: null as number | null,
          maxHeartRate: toNum(hr?.maxHeartRate),
          minHeartRate: toNum(hr?.minHeartRate),
          sleepDuration: sleepSec != null ? Math.round(sleepSec / 60) : null,
          sleepScore: toNum(sleep?.overallSleepScore),
          stressAvg: null as number | null,
          calories: null as number | null,
          activeMinutes: null as number | null,
        };

        await this.prisma.garminDailySummary.upsert({
          where: { userId_date: { userId, date } },
          update: data,
          create: { userId, date, ...data },
        });
        count++;
      } catch {
        this.logger.warn(
          `Failed to fetch daily data for ${date.toISOString().split('T')[0]}`,
        );
      }

      // Rate limit: 500ms between requests
      await delay(500);
    }
    this.logger.log(`Synced ${count} daily summaries for user ${userId}`);
  }

  /** Sync all connected users (called by cron) */
  async syncAllUsers() {
    const lockKey = 'garmin:sync:lock';
    const locked = await this.redis.set(lockKey, '1', 'EX', 7200, 'NX');
    if (!locked) {
      this.logger.warn('Sync already in progress, skipping');
      return;
    }

    try {
      const oneHourAgo = new Date(Date.now() - 3600000);
      const connections = await this.prisma.garminConnection.findMany({
        where: {
          status: 'CONNECTED',
          OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: oneHourAgo } }],
        },
        select: { userId: true },
      });

      let success = 0;
      const startTime = Date.now();

      for (const conn of connections) {
        // Abort if cycle exceeds 90 minutes
        if (Date.now() - startTime > 90 * 60 * 1000) {
          this.logger.warn('Sync cycle exceeded 90 minutes, aborting');
          break;
        }

        try {
          await this.syncUser(conn.userId);
          success++;
        } catch {
          // syncUser handles its own errors; this catches unexpected throws
        }
      }

      this.logger.log(
        `Sync complete: ${success}/${connections.length} users synced`,
      );
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
