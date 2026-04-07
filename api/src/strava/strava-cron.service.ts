import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { StravaSyncService } from './strava-sync.service.js';

const CRON_LOCK_KEY = 'strava:cron:lock';
const CRON_LOCK_TTL = 3600; // seconds — 1 hour max run time
const SYNC_THRESHOLD_MS = 25 * 60 * 60 * 1000; // 25h — catches daily missed syncs
const INTER_USER_DELAY_MS = 2000; // rate limit buffer between users

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class StravaCronService {
  private readonly logger = new Logger(StravaCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly syncService: StravaSyncService,
  ) {}

  /**
   * Daily fallback sync at 03:00 — catches activities missed by webhook failures.
   * Only syncs users not synced in the last 25 hours.
   * Global Redis lock prevents concurrent cron runs on multi-instance deploys.
   */
  @Cron('0 3 * * *')
  async dailySyncAll(): Promise<void> {
    const locked = await this.redis.set(CRON_LOCK_KEY, '1', 'EX', CRON_LOCK_TTL, 'NX');
    if (!locked) {
      this.logger.debug('Strava cron already running, skipping');
      return;
    }

    try {
      const cutoff = new Date(Date.now() - SYNC_THRESHOLD_MS);
      const connections = await this.prisma.stravaConnection.findMany({
        where: {
          status: 'CONNECTED',
          OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: cutoff } }],
        },
        select: { userId: true },
      });

      this.logger.log(`Strava cron: syncing ${connections.length} users`);

      for (const { userId } of connections) {
        await this.syncService.syncUser(userId);
        await delay(INTER_USER_DELAY_MS);
      }

      this.logger.log('Strava cron complete');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.error(`Strava cron error: ${msg}`);
    } finally {
      await this.redis.del(CRON_LOCK_KEY);
    }
  }
}
