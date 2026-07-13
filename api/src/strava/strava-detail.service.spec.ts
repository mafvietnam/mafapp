import { StravaDetailService } from './strava-detail.service.js';
import {
  Prisma,
  type StravaActivity,
  type StravaActivityDetail,
} from '@prisma/client';
import type { PrismaService } from '../shared/prisma.service.js';
import type { StravaTokenService } from './strava-token.service.js';

/**
 * Unit coverage for the lazy-hydration orchestration: cache read/TTL, Strava error-tier mapping,
 * transient-vs-genuine streams absence, P2002 race recovery, and userId-scoped cross-user safety.
 * Mirrors strava-sync.service.spec.ts style: plain `new Service(mocks)`, jest.fn() mocks.
 * global.fetch is mocked directly — no real network calls.
 */

const baseActivity: StravaActivity = {
  id: 'act-1',
  userId: 'user-1',
  stravaActivityId: '900001',
  source: 'STRAVA',
  name: 'Morning MAF Run',
  type: 'Run',
  startDate: new Date('2026-07-12T00:00:00Z'),
  distance: 5000,
  movingTime: 2100,
  elapsedTime: 2160,
  avgHeartRate: 139,
  maxHeartRate: 150,
  avgSpeed: 2.38,
  maxSpeed: 3.1,
  totalElevationGain: 42,
  calories: 320, // kilojoules (summary row) — distinct from detail.calories (real kcal)
  avgPace: 7.0,
  isDuplicate: false,
  createdAt: new Date('2026-07-12T00:00:00Z'),
  updatedAt: new Date('2026-07-12T00:00:00Z'),
};

/** Minimal typed shapes for the two prisma calls under test — avoids `any` leaking through jest.fn(). */
interface FindFirstArgs {
  where: { stravaActivityId: string; userId: string };
}
interface UpsertArgs {
  where: { stravaActivityId: string };
  create: {
    stravaActivityId: string;
    userId: string;
    detailJson: unknown;
    streamsJson: unknown;
    fetchedAt: Date;
  };
  update: {
    userId: string;
    detailJson: unknown;
    streamsJson: unknown;
    fetchedAt: Date;
  };
}

function buildService() {
  const findFirst = jest.fn<
    Promise<StravaActivityDetail | null>,
    [FindFirstArgs]
  >();
  const upsert = jest.fn<Promise<StravaActivityDetail>, [UpsertArgs]>();
  const prisma = {
    stravaActivityDetail: { findFirst, upsert },
  } as unknown as PrismaService;

  const getValidAccessToken = jest.fn().mockResolvedValue('access-token-abc');
  const tokenService = { getValidAccessToken } as unknown as StravaTokenService;

  const service = new StravaDetailService(prisma, tokenService);
  return { service, findFirst, upsert, getValidAccessToken };
}

/** Builds a mock fetch Response — matches the subset the service reads (ok, status, json()). */
function fetchResponse(status: number, json: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(json),
  } as unknown as Response;
}

function cacheRow(
  overrides: Partial<StravaActivityDetail> = {},
): StravaActivityDetail {
  return {
    id: 'detail-1',
    stravaActivityId: '900001',
    userId: 'user-1',
    detailJson: {
      description: 'cached',
      deviceName: null,
      gearName: null,
      calories: 400,
      splitsMetric: [],
    },
    streamsJson: null,
    fetchedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as StravaActivityDetail;
}

const detailRaw = {
  description: 'Easy run',
  device_name: 'Garmin',
  gear: { name: 'Shoe' },
  calories: 405,
  splits_metric: [],
};
const streamsRaw = {
  time: { data: [0, 10, 20] },
  heartrate: { data: [120, 130, 140] },
};

describe('StravaDetailService.getDetail', () => {
  afterEach(() => jest.restoreAllMocks());

  it('guards non-numeric stravaActivityId — no DB/fetch calls, reason:error', async () => {
    const { service, findFirst } = buildService();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const badActivity = {
      ...baseActivity,
      stravaActivityId: '900001; DROP TABLE',
    };

    const result = await service.getDetail('user-1', badActivity);

    expect(result).toEqual({
      activity: badActivity,
      detail: null,
      streams: null,
      hydrated: false,
      reason: 'error',
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cache read is userId-scoped', async () => {
    const { service, findFirst } = buildService();
    findFirst.mockResolvedValue(cacheRow());

    await service.getDetail('user-1', baseActivity);

    expect(findFirst).toHaveBeenCalledWith({
      where: { stravaActivityId: '900001', userId: 'user-1' },
    });
  });

  it('cache-hit within TTL returns cached data, no Strava fetch', async () => {
    const { service, findFirst } = buildService();
    findFirst.mockResolvedValue(cacheRow({ fetchedAt: new Date() }));
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.getDetail('user-1', baseActivity);

    expect(result.hydrated).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.detail).toEqual(cacheRow().detailJson);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stale cache (fetchedAt > 30d) re-hydrates from Strava', async () => {
    const { service, findFirst, upsert } = buildService();
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    findFirst.mockResolvedValueOnce(cacheRow({ fetchedAt: staleDate }));
    upsert.mockResolvedValue(cacheRow({ fetchedAt: new Date() }));
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(fetchResponse(200, detailRaw))
      .mockResolvedValueOnce(fetchResponse(200, streamsRaw));

    const result = await service.getDetail('user-1', baseActivity);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.hydrated).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });

  describe('detail fetch error tiers (no cache row written)', () => {
    it.each([
      [404, 'deleted'],
      [401, 'unauthorized'],
      [403, 'unauthorized'],
      [429, 'rate_limited'],
      [500, 'error'],
    ])('detail status %i -> reason %s, no write', async (status, reason) => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(status, { message: 'err' }));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result).toEqual({
        activity: baseActivity,
        detail: null,
        streams: null,
        hydrated: false,
        reason,
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it('200 with non-JSON body (null) -> reason:error, no write, no 500 (H1)', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      // Strava/edge returns 200 with an empty/HTML body -> res.json() rejects -> json:null.
      // Must not reach whitelistDetail(null) (would throw -> 500).
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(200, null));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result).toEqual({
        activity: baseActivity,
        detail: null,
        streams: null,
        hydrated: false,
        reason: 'error',
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it('thrown timeout/network error on detail fetch -> reason:error, no write, no 500', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('The operation was aborted'));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result).toEqual({
        activity: baseActivity,
        detail: null,
        streams: null,
        hydrated: false,
        reason: 'error',
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it('token fetch failure -> reason:error, no write, no Strava call', async () => {
      const { service, findFirst, upsert, getValidAccessToken } =
        buildService();
      findFirst.mockResolvedValue(null);
      getValidAccessToken.mockRejectedValue(
        new Error('No Strava connection found'),
      );
      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await service.getDetail('user-1', baseActivity);

      expect(result.hydrated).toBe(false);
      expect(result.reason).toBe('error');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('streams tiers', () => {
    it('success — hydrates, whitelists detail, downsamples streams, upserts cache', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      upsert.mockImplementation((args) =>
        Promise.resolve(
          cacheRow({
            detailJson: args.create.detailJson,
            streamsJson:
              args.create.streamsJson === Prisma.DbNull
                ? null
                : args.create.streamsJson,
          }),
        ),
      );
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(200, detailRaw))
        .mockResolvedValueOnce(fetchResponse(200, streamsRaw));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result.hydrated).toBe(true);
      expect(result.reason).toBeUndefined();
      expect((result.detail as { calories: number }).calories).toBe(405);
      expect((result.detail as { deviceName: string }).deviceName).toBe(
        'Garmin',
      );
      expect(result.streams).toEqual({
        time: [0, 10, 20],
        heartrate: [120, 130, 140],
      });

      const upsertArg = upsert.mock.calls[0][0];
      expect(upsertArg.where).toEqual({ stravaActivityId: '900001' });
      expect(upsertArg.create.userId).toBe('user-1');
    });

    it('streams 404 -> genuine absence, streams:null, row IS written', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      upsert.mockResolvedValue(cacheRow({ streamsJson: null }));
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(200, detailRaw))
        .mockResolvedValueOnce(fetchResponse(404, { message: 'Not Found' }));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result.hydrated).toBe(true);
      expect(result.streams).toBeNull();
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert.mock.calls[0][0].create.streamsJson).toBe(Prisma.DbNull);
    });

    it('streams 429 -> transient, streams:null, row NOT written (retryable next open)', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(200, detailRaw))
        .mockResolvedValueOnce(fetchResponse(429, { message: 'rate limited' }));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result.hydrated).toBe(true);
      expect(result.streams).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    });

    it('streams 5xx -> transient, row NOT written', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(200, detailRaw))
        .mockResolvedValueOnce(fetchResponse(503, { message: 'unavailable' }));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result.hydrated).toBe(true);
      expect(result.streams).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    });

    it('streams fetch throws (timeout) -> transient, row NOT written', async () => {
      const { service, findFirst, upsert } = buildService();
      findFirst.mockResolvedValue(null);
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(fetchResponse(200, detailRaw))
        .mockRejectedValueOnce(new Error('aborted'));

      const result = await service.getDetail('user-1', baseActivity);

      expect(result.hydrated).toBe(true);
      expect(result.streams).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  it('P2002 on concurrent upsert -> re-reads cache (userId-scoped) and serves it', async () => {
    const { service, findFirst, upsert } = buildService();
    const winnerRow = cacheRow({
      detailJson: {
        description: 'winner',
        deviceName: null,
        gearName: null,
        calories: 500,
        splitsMetric: [],
      },
    });
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(winnerRow);
    upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(fetchResponse(200, detailRaw))
      .mockResolvedValueOnce(fetchResponse(200, streamsRaw));

    const result = await service.getDetail('user-1', baseActivity);

    expect(result.hydrated).toBe(true);
    expect(result.detail).toEqual(winnerRow.detailJson);
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst.mock.calls[1][0]).toEqual({
      where: { stravaActivityId: '900001', userId: 'user-1' },
    });
  });

  describe('UPLOAD source branch (RT phase-04)', () => {
    const uploadActivity = {
      ...baseActivity,
      source: 'UPLOAD' as const,
      stravaActivityId: 'upload_abc123',
    };

    it('serves the stored detail row directly — no Strava fetch, no token fetch', async () => {
      const { service, findFirst, getValidAccessToken } = buildService();
      const row = cacheRow({
        stravaActivityId: 'upload_abc123',
        streamsJson: { time: [0, 10], heartrate: [130, 140] } as never,
      });
      findFirst.mockResolvedValue(row);
      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await service.getDetail('user-1', uploadActivity);

      expect(result.hydrated).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.streams).toEqual({ time: [0, 10], heartrate: [130, 140] });
      expect(findFirst).toHaveBeenCalledWith({
        where: { stravaActivityId: 'upload_abc123', userId: 'user-1' },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(getValidAccessToken).not.toHaveBeenCalled();
    });

    it('no-HR upload (streamsJson=null) still hydrated:true', async () => {
      const { service, findFirst } = buildService();
      findFirst.mockResolvedValue(
        cacheRow({ stravaActivityId: 'upload_abc123', streamsJson: null }),
      );

      const result = await service.getDetail('user-1', uploadActivity);

      expect(result.hydrated).toBe(true);
      expect(result.streams).toBeNull();
    });

    it('missing detail row -> hydrated:false, reason:error (offer retry, RT-M8)', async () => {
      const { service, findFirst } = buildService();
      findFirst.mockResolvedValue(null);

      const result = await service.getDetail('user-1', uploadActivity);

      expect(result.hydrated).toBe(false);
      expect(result.reason).toBe('error');
    });
  });
});
