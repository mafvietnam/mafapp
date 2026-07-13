import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StravaActivity, StravaActivityDetail } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service.js';
import { StravaTokenService } from './strava-token.service.js';
import {
  whitelistDetail,
  downsampleStreams,
  type StravaDetailRaw,
  type StravaStreamSet,
  type WhitelistedDetail,
  type DownsampledStreams,
} from './strava-detail-transform.js';

const STRAVA_API_HOST = 'www.strava.com';
const STREAM_KEYS = 'time,heartrate,velocity_smooth,altitude,distance';
const STREAM_CAP = 1000;
const FETCH_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d — self-heals privatized/edited/deleted activities
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

export type DetailReason =
  | 'deleted'
  | 'unauthorized'
  | 'rate_limited'
  | 'error';

export interface DetailResponse {
  activity: StravaActivity;
  detail: WhitelistedDetail | null;
  streams: DownsampledStreams | null;
  hydrated: boolean;
  reason?: DetailReason;
}

/** `null` = the fetch itself threw (timeout/network) — no HTTP status to branch on. */
interface FetchResult {
  ok: boolean;
  status: number;
  json: unknown;
}

@Injectable()
export class StravaDetailService {
  private readonly logger = new Logger(StravaDetailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: StravaTokenService,
  ) {}

  /** Serve cached detail if fresh, else hydrate. Never throws for expected edge cases (see `reason`). */
  async getDetail(userId: string, activity: StravaActivity): Promise<DetailResponse> {
    // UPLOAD activities have no Strava API to hydrate from — their detail + streams were written
    // at upload time. Serve the stored row directly (no TTL, never call Strava). Branch BEFORE the
    // numeric-id guard below, since "upload_<hash>" ids are non-numeric by design.
    if (activity.source === 'UPLOAD') {
      const row = await this.prisma.stravaActivityDetail.findFirst({
        where: { stravaActivityId: activity.stravaActivityId, userId },
      });
      // Row present (even with streamsJson=null for a no-HR upload) → hydrated. Missing → offer retry.
      return row ? this.fromCacheRow(activity, row) : this.errorResponse(activity, 'error');
    }

    // Never interpolate an untrusted id into a Strava URL (defense-in-depth on the trusted DB row).
    if (!/^\d+$/.test(activity.stravaActivityId))
      return this.errorResponse(activity, 'error');

    // userId-scoped — a disconnected+reused stravaActivityId must never serve a prior owner's cache.
    const cached = await this.prisma.stravaActivityDetail.findFirst({
      where: { stravaActivityId: activity.stravaActivityId, userId },
    });
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return this.fromCacheRow(activity, cached);
    }
    return this.hydrate(userId, activity);
  }

  private async hydrate(userId: string, activity: StravaActivity) {
    let accessToken: string;
    try {
      accessToken = await this.tokenService.getValidAccessToken(userId);
    } catch (err) {
      this.logger.warn(`Token error id=${activity.id}: ${this.errMsg(err)}`);
      return this.errorResponse(activity, 'error');
    }

    const safeId = encodeURIComponent(activity.stravaActivityId);
    const detailUrl = `https://${STRAVA_API_HOST}/api/v3/activities/${safeId}`;
    const detailResult = await this.fetchStrava(detailUrl, accessToken);
    if (!detailResult) return this.errorResponse(activity, 'error');
    if (!detailResult.ok) {
      this.logger.warn(`Detail ${detailResult.status} id=${activity.id}`);
      const reason = this.detailErrorReason(detailResult.status);
      return this.errorResponse(activity, reason);
    }
    // A 2xx with a non-JSON body (204/empty, or an edge maintenance HTML page served 200)
    // parses to null -> whitelistDetail(null) would throw -> 500. Treat as transient error, no write.
    if (typeof detailResult.json !== 'object' || detailResult.json === null) {
      this.logger.warn(`Detail body not JSON id=${activity.id}`);
      return this.errorResponse(activity, 'error');
    }

    const streamsUrl = `${detailUrl}/streams?keys=${STREAM_KEYS}&key_by_type=true`;
    const streamsResult = await this.fetchStrava(streamsUrl, accessToken);
    const info = this.readStreams(streamsResult, activity.id);
    const { rawStreams, missing } = info;

    const detail = whitelistDetail(detailResult.json as StravaDetailRaw);
    const streams = downsampleStreams(rawStreams, STREAM_CAP);

    if (!missing) {
      const said = activity.stravaActivityId;
      const row = await this.writeCache(userId, said, detail, streams);
      if (row) return this.fromCacheRow(activity, row);
    }
    return { activity, detail, streams, hydrated: true };
  }

  /** TRANSIENT (429/5xx/thrown) -> missing:true, no cache write (retry next open). 404 -> missing:false, streams:null IS cached. */
  private readStreams(result: FetchResult | null, activityId: string) {
    if (!result) {
      this.logger.warn(`Streams fetch threw id=${activityId}`);
      return { rawStreams: null as StravaStreamSet | null, missing: true };
    }
    if (result.status === 404) {
      return { rawStreams: null as StravaStreamSet | null, missing: false };
    }
    if (!result.ok) {
      this.logger.warn(`Streams transient ${result.status} id=${activityId}`);
      return { rawStreams: null as StravaStreamSet | null, missing: true };
    }
    return { rawStreams: result.json as StravaStreamSet, missing: false };
  }

  /** Upsert cache row. On P2002 (concurrent race) re-read winner's row instead of erroring. */
  private async writeCache(
    userId: string,
    stravaActivityId: string,
    detail: WhitelistedDetail,
    streams: DownsampledStreams | null,
  ) {
    const data = {
      userId,
      detailJson: detail as unknown as Prisma.InputJsonValue,
      streamsJson: this.toJsonInput(streams),
      fetchedAt: new Date(),
    };
    try {
      return await this.prisma.stravaActivityDetail.upsert({
        where: { stravaActivityId },
        update: data,
        create: { stravaActivityId, ...data },
      });
    } catch (err: unknown) {
      if (!this.isUniqueConstraintError(err)) {
        const msg = this.errMsg(err);
        this.logger.warn(`Cache write id=${stravaActivityId}: ${msg}`);
        return null;
      }
      return this.prisma.stravaActivityDetail.findFirst({
        where: { stravaActivityId, userId },
      });
    }
  }

  private toJsonInput(streams: DownsampledStreams | null) {
    return streams === null
      ? Prisma.DbNull
      : (streams as unknown as Prisma.InputJsonValue);
  }

  private errorResponse(activity: StravaActivity, reason: DetailReason) {
    return { activity, detail: null, streams: null, hydrated: false, reason };
  }

  private fromCacheRow(activity: StravaActivity, row: StravaActivityDetail) {
    const streams =
      (row.streamsJson as unknown as DownsampledStreams | null) ?? null;
    const detail = row.detailJson as unknown as WhitelistedDetail;
    return { activity, detail, streams, hydrated: true };
  }

  /** Never throws; thrown/network/timeout errors collapse to `null` (caller -> reason:'error'). */
  private async fetchStrava(url: string, accessToken: string) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const json: unknown = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, json } satisfies FetchResult;
    } catch (err) {
      this.logger.warn(`Strava fetch failed: ${this.errMsg(err)}`);
      return null;
    }
  }

  private detailErrorReason(status: number): DetailReason {
    if (status === 404) return 'deleted';
    if (status === 401 || status === 403) return 'unauthorized';
    if (status === 429) return 'rate_limited';
    return 'error';
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === PRISMA_UNIQUE_CONSTRAINT_CODE
    );
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
