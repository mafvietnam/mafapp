import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../shared/prisma.service.js';
import { type WhitelistedDetail } from './strava-detail-transform.js';
import { parseTracklog } from './tracklog/tracklog-parser.js';
import { buildStreams } from './tracklog/tracklog-streams.js';
import { type ParsedTracklog } from './tracklog/tracklog-types.js';

const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const P2002 = 'P2002';

export interface UploadIngestResult {
  id: string;
  duplicate: boolean;
}

/**
 * Ingests an uploaded GPX/TCX file into a StravaActivity(source=UPLOAD) + its detail cache.
 * Writes are userId-scoped (stravaActivityId is globally unique but NOT a tenant boundary — RT-C1)
 * and transactional (summary + detail commit together — RT-H6).
 */
@Injectable()
export class StravaUploadService {
  private readonly logger = new Logger(StravaUploadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingest(userId: string, buffer: Buffer, filename: string): Promise<UploadIngestResult> {
    const parsed = parseTracklog(buffer, filename); // throws Unsupported/Invalid → caller maps per-file
    const stravaActivityId = 'upload_' + this.contentHash(userId, parsed);
    const streams = buildStreams(parsed.points);
    const avgPace =
      parsed.distance > 0 ? parsed.movingTime / 60 / (parsed.distance / 1000) : null;
    const ext = /\.tcx$/i.test(filename) ? 'TCX' : 'GPX';

    const summary = {
      name: parsed.name,
      type: parsed.type,
      startDate: parsed.startDate,
      distance: parsed.distance,
      movingTime: parsed.movingTime,
      elapsedTime: parsed.elapsedTime,
      avgHeartRate: parsed.avgHeartRate,
      maxHeartRate: parsed.maxHeartRate,
      avgSpeed: parsed.avgSpeed,
      maxSpeed: null,
      totalElevationGain: parsed.totalElevationGain,
      calories: null, // summary column is kJ (sync); TCX kcal goes to detailJson only (RT-M6)
      avgPace,
    };
    const detail: WhitelistedDetail = {
      description: parsed.name,
      deviceName: `Tải lên (${ext})`,
      gearName: null,
      calories: parsed.calories,
      splitsMetric: [],
    };
    const detailData = {
      detailJson: detail as unknown as Prisma.InputJsonValue,
      streamsJson:
        streams === null ? Prisma.DbNull : (streams as unknown as Prisma.InputJsonValue), // RT-M7
      fetchedAt: new Date(),
    };

    const id = await this.writeScoped(userId, stravaActivityId, summary, detailData);
    // The row is valid data even if dedup fails — never fail the whole ingest (which would report
    // "error" while the row stays committed on the dashboard). Worst case: missing duplicate badge.
    let duplicate = false;
    try {
      duplicate = await this.markDuplicate(userId, id, stravaActivityId, parsed.startDate);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.warn(`Dedup check failed for ${id} (row kept): ${msg}`);
    }
    return { id, duplicate };
  }

  /** Deterministic id so re-uploading the same run upserts (idempotent) instead of duplicating. */
  private contentHash(userId: string, p: ParsedTracklog): string {
    return createHash('sha256')
      .update(`${userId}|${p.startDate.toISOString()}|${Math.round(p.distance)}`)
      .digest('hex')
      .slice(0, 24);
  }

  /**
   * userId-scoped update-or-create for BOTH summary + detail, in one transaction.
   * A create that hits the global-unique key owned by another user → P2002 → ConflictException
   * (never overwrite another tenant's row). Same-user re-upload → updateMany matches → idempotent.
   */
  private async writeScoped(
    userId: string,
    stravaActivityId: string,
    summary: Record<string, unknown>,
    detailData: Record<string, unknown>,
  ): Promise<string> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const upd = await tx.stravaActivity.updateMany({
          where: { stravaActivityId, userId },
          data: summary,
        });
        let id: string;
        if (upd.count === 0) {
          const row = await tx.stravaActivity.create({
            data: { userId, stravaActivityId, source: 'UPLOAD', ...summary } as Prisma.StravaActivityUncheckedCreateInput,
            select: { id: true },
          });
          id = row.id;
        } else {
          const row = await tx.stravaActivity.findFirstOrThrow({
            where: { stravaActivityId, userId },
            select: { id: true },
          });
          id = row.id;
        }
        const detailUpd = await tx.stravaActivityDetail.updateMany({
          where: { stravaActivityId, userId },
          data: detailData,
        });
        if (detailUpd.count === 0) {
          await tx.stravaActivityDetail.create({
            data: { stravaActivityId, userId, ...detailData } as Prisma.StravaActivityDetailUncheckedCreateInput,
          });
        }
        return id;
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === P2002) {
        this.logger.warn(`Upload id conflict (cross-user) for ${stravaActivityId}`);
        throw new ConflictException('Hoạt động đã tồn tại');
      }
      throw err;
    }
  }

  /**
   * Cross-source dedup, precedence STRAVA > Garmin > UPLOAD (RT-C2). If this upload overlaps an
   * existing higher/equal-precedence activity in ±5min, flag THIS upload isDuplicate. userId-scoped.
   */
  private async markDuplicate(
    userId: string,
    id: string,
    stravaActivityId: string,
    startDate: Date,
  ): Promise<boolean> {
    const gte = new Date(startDate.getTime() - DEDUP_WINDOW_MS);
    const lte = new Date(startDate.getTime() + DEDUP_WINDOW_MS);

    const strava = await this.prisma.stravaActivity.findFirst({
      where: {
        userId,
        stravaActivityId: { not: stravaActivityId },
        startDate: { gte, lte },
      },
      select: { id: true },
    });
    const garmin = strava
      ? null
      : await this.prisma.garminActivity.findFirst({
          where: { userId, startTime: { gte, lte } },
          select: { id: true },
        });

    if (!strava && !garmin) return false;
    await this.prisma.stravaActivity.update({
      where: { id },
      data: { isDuplicate: true },
    });
    return true;
  }
}
