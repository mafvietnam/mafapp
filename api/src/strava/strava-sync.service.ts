import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { StravaTokenService } from './strava-token.service.js';

interface StravaActivityRaw {
  id: number;
  name: string;
  type: string;              // Run | TrailRun | VirtualRun
  start_date: string;        // ISO 8601
  distance: number;          // meters
  moving_time: number;       // seconds
  elapsed_time: number;      // seconds
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;    // m/s
  max_speed?: number;        // m/s
  total_elevation_gain?: number;
  kilojoules?: number;
}

const STRAVA_API_HOST = 'www.strava.com';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 200;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class StravaSyncService {
  private readonly logger = new Logger(StravaSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokenService: StravaTokenService,
  ) {}

  /** Full activity sync for a user — used by manual trigger and cron fallback */
  async syncUser(userId: string): Promise<void> {
    const lockKey = `strava:sync:${userId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');
    if (!locked) {
      this.logger.debug(`Sync already in progress for user ${userId}, skipping`);
      return;
    }

    const conn = await this.prisma.stravaConnection.findUnique({
      where: { userId },
      select: { status: true, lastSyncAt: true },
    });

    if (!conn || conn.status !== 'CONNECTED') {
      await this.redis.del(lockKey);
      return;
    }

    try {
      const accessToken = await this.tokenService.getValidAccessToken(userId);
      const since = conn.lastSyncAt ?? new Date(Date.now() - 30 * 86400000);
      const after = Math.floor(since.getTime() / 1000);

      const activities = await this.fetchActivitiesSince(accessToken, after);
      let synced = 0;

      for (const activity of activities) {
        if (!RUN_TYPES.has(activity.type)) continue;
        await this.upsertActivity(userId, activity);
        synced++;
      }

      await this.prisma.stravaConnection.update({
        where: { userId },
        data: { lastSyncAt: new Date(), status: 'CONNECTED' },
      });

      this.logger.log(`Synced ${synced} activities for user ${userId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Sync failed for user ${userId}: ${msg}`);
      await this.prisma.stravaConnection
        .update({ where: { userId }, data: { status: 'ERROR' } })
        .catch(() => {});
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /** Fetch all running activities after a Unix timestamp, paginated */
  private async fetchActivitiesSince(
    accessToken: string,
    after: number,
  ): Promise<StravaActivityRaw[]> {
    const all: StravaActivityRaw[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await this.fetchActivitiesPage(accessToken, after, page);
      if (!Array.isArray(batch) || batch.length === 0) break;

      all.push(...batch);
      if (batch.length < PAGE_SIZE) break; // last page

      await delay(PAGE_DELAY_MS);
    }

    return all;
  }

  private fetchActivitiesPage(
    accessToken: string,
    after: number,
    page: number,
  ): Promise<StravaActivityRaw[]> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        after: String(after),
        per_page: String(PAGE_SIZE),
        page: String(page),
      });

      const req = https.request(
        {
          hostname: STRAVA_API_HOST,
          path: `/api/v3/athlete/activities?${params.toString()}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode === 429) {
              // Rate limit hit — abort pagination gracefully
              this.logger.warn('Strava rate limit (429) hit, aborting sync pagination');
              resolve([]);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`Strava activities API returned ${res.statusCode}`));
              return;
            }
            try {
              resolve(JSON.parse(data) as StravaActivityRaw[]);
            } catch {
              reject(new Error('Failed to parse Strava activities response'));
            }
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  /** Upsert a single activity and run dedup check against Garmin */
  async upsertActivity(
    userId: string,
    raw: StravaActivityRaw | Record<string, unknown>,
  ): Promise<void> {
    // Normalize raw fields (works for both typed StravaActivityRaw and webhook fetch result)
    const r = raw as StravaActivityRaw;
    const stravaActivityId = String(r.id);
    const distance = r.distance ?? 0;
    const movingTime = r.moving_time ?? 0;
    const avgPace = distance > 0 ? movingTime / 60 / (distance / 1000) : null;

    const data = {
      name: String(r.name ?? ''),
      type: String(r.type ?? ''),
      startDate: new Date(r.start_date),
      distance,
      movingTime,
      elapsedTime: r.elapsed_time ?? 0,
      avgHeartRate: r.average_heartrate != null ? Math.round(r.average_heartrate) : null,
      maxHeartRate: r.max_heartrate != null ? Math.round(r.max_heartrate) : null,
      avgSpeed: r.average_speed ?? null,
      maxSpeed: r.max_speed ?? null,
      totalElevationGain: r.total_elevation_gain ?? null,
      calories: r.kilojoules ?? null,
      avgPace,
    };

    const activity = await this.prisma.stravaActivity.upsert({
      where: { stravaActivityId },
      update: data,
      create: { userId, stravaActivityId, ...data },
      select: { id: true, startDate: true },
    });

    await this.checkAndMarkDuplicate(userId, activity);
  }

  /**
   * Flag overlapping lower-precedence activities as duplicate — a synced STRAVA row wins over both
   * Garmin and any user-UPLOADed tracklog of the same run (precedence STRAVA > Garmin > UPLOAD).
   * Marking the UPLOAD side here (not only at upload time) makes dedup symmetric + order-independent:
   * upload-then-sync no longer double-counts in dashboard/journal/trends (RT-C2).
   */
  async checkAndMarkDuplicate(
    userId: string,
    activity: { id: string; startDate: Date },
  ): Promise<void> {
    const startWindow = new Date(activity.startDate.getTime() - 5 * 60 * 1000);
    const endWindow   = new Date(activity.startDate.getTime() + 5 * 60 * 1000);

    const garminMatch = await this.prisma.garminActivity.findFirst({
      where: {
        userId,
        startTime: { gte: startWindow, lte: endWindow },
      },
      select: { id: true },
    });

    if (garminMatch) {
      await this.prisma.garminActivity.update({
        where: { id: garminMatch.id },
        data: { isDuplicate: true },
      });
      this.logger.debug(`Marked Garmin activity ${garminMatch.id} as duplicate (Strava wins)`);
    }

    // Reverse-direction dedup: an earlier UPLOAD of this same run must lose to the authoritative sync.
    const uploadMatches = await this.prisma.stravaActivity.updateMany({
      where: {
        userId,
        source: 'UPLOAD',
        isDuplicate: false,
        id: { not: activity.id },
        startDate: { gte: startWindow, lte: endWindow },
      },
      data: { isDuplicate: true },
    });
    if (uploadMatches.count > 0) {
      this.logger.debug(`Marked ${uploadMatches.count} UPLOAD activity(ies) duplicate (Strava wins)`);
    }
  }
}
