import { StravaSyncService } from './strava-sync.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { RedisService } from '../shared/redis.service.js';
import type { StravaTokenService } from './strava-token.service.js';

/**
 * Unit coverage for the sync engine's data-mapping + dedup — the code that runs
 * when Strava returns activity JSON. Isolates the parse/transform logic from the
 * (external) HTTP fetch. Guards the avgPace-unit contract (min/km) that Bug #3 exposed.
 */
function buildService(
  opts: {
    garminMatch?: { id: string } | null;
    uploadMatchCount?: number;
  } = {},
) {
  const upsert = jest.fn().mockResolvedValue({ id: 'act-1', startDate: new Date('2026-07-12T00:00:00Z') });
  const garminFindFirst = jest.fn().mockResolvedValue(opts.garminMatch ?? null);
  const garminUpdate = jest.fn().mockResolvedValue({});
  // Reverse-direction (STRAVA-wins-over-UPLOAD) dedup — added for symmetric dedup (RT-C2).
  const stravaUpdateMany = jest
    .fn()
    .mockResolvedValue({ count: opts.uploadMatchCount ?? 0 });

  const prisma = {
    stravaActivity: { upsert, updateMany: stravaUpdateMany },
    garminActivity: { findFirst: garminFindFirst, update: garminUpdate },
  } as unknown as PrismaService;

  const redis = {} as unknown as RedisService;
  const tokenService = {} as unknown as StravaTokenService;

  const service = new StravaSyncService(prisma, redis, tokenService);
  return { service, upsert, garminFindFirst, garminUpdate, stravaUpdateMany };
}

const rawRun = {
  id: 900001,
  name: 'Morning MAF Run',
  type: 'Run',
  start_date: '2026-07-12T00:00:00Z',
  distance: 5000, // meters
  moving_time: 2100, // seconds -> 35:00 over 5km
  elapsed_time: 2160,
  average_heartrate: 138.6,
  max_heartrate: 150.2,
  average_speed: 2.38,
  max_speed: 3.1,
  total_elevation_gain: 42,
  kilojoules: 320,
};

describe('StravaSyncService.upsertActivity — mapping', () => {
  it('maps a Strava payload to StravaActivity fields with avgPace in MIN/km', async () => {
    const { service, upsert } = buildService();
    await service.upsertActivity('user-1', rawRun);

    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ stravaActivityId: '900001' });
    const data = arg.create;
    expect(data.userId).toBe('user-1');
    expect(data.name).toBe('Morning MAF Run');
    expect(data.type).toBe('Run');
    expect(data.distance).toBe(5000);
    expect(data.movingTime).toBe(2100);
    // avgPace = movingTime/60 / (distance/1000) = 2100/60 / 5 = 7.0 min/km
    expect(data.avgPace).toBeCloseTo(7.0, 5);
    // HR floats rounded to int
    expect(data.avgHeartRate).toBe(139);
    expect(data.maxHeartRate).toBe(150);
  });

  it('sets avgPace null when distance is 0 (guards divide-by-zero)', async () => {
    const { service, upsert } = buildService();
    await service.upsertActivity('user-1', { ...rawRun, distance: 0 });
    expect(upsert.mock.calls[0][0].create.avgPace).toBeNull();
  });

  it('leaves HR null when Strava omits heart-rate fields', async () => {
    const { service, upsert } = buildService();
    const noHr = { ...rawRun } as Record<string, unknown>;
    delete noHr.average_heartrate;
    delete noHr.max_heartrate;
    await service.upsertActivity('user-1', noHr);
    const data = upsert.mock.calls[0][0].create;
    expect(data.avgHeartRate).toBeNull();
    expect(data.maxHeartRate).toBeNull();
  });
});

describe('StravaSyncService.checkAndMarkDuplicate — dedup', () => {
  it('marks an overlapping Garmin activity as duplicate (Strava wins)', async () => {
    const { service, garminFindFirst, garminUpdate } = buildService({ garminMatch: { id: 'garmin-9' } });
    await service.checkAndMarkDuplicate('user-1', {
      id: 'act-1',
      startDate: new Date('2026-07-12T00:00:00Z'),
    });
    // ±5min window around the activity start
    const where = garminFindFirst.mock.calls[0][0].where;
    expect(where.userId).toBe('user-1');
    expect(where.startTime.gte).toEqual(new Date('2026-07-11T23:55:00Z'));
    expect(where.startTime.lte).toEqual(new Date('2026-07-12T00:05:00Z'));
    expect(garminUpdate).toHaveBeenCalledWith({ where: { id: 'garmin-9' }, data: { isDuplicate: true } });
  });

  it('does nothing when no overlapping Garmin activity exists', async () => {
    const { service, garminUpdate } = buildService({ garminMatch: null });
    await service.checkAndMarkDuplicate('user-1', {
      id: 'act-1',
      startDate: new Date('2026-07-12T00:00:00Z'),
    });
    expect(garminUpdate).not.toHaveBeenCalled();
  });

  it('marks an overlapping earlier UPLOAD as duplicate (symmetric dedup, RT-C2)', async () => {
    const { service, stravaUpdateMany } = buildService({ uploadMatchCount: 1 });
    await service.checkAndMarkDuplicate('user-1', {
      id: 'sync-act-1',
      startDate: new Date('2026-07-12T00:00:00Z'),
    });
    const arg = stravaUpdateMany.mock.calls[0][0];
    expect(arg.where.userId).toBe('user-1');
    expect(arg.where.source).toBe('UPLOAD');
    expect(arg.where.isDuplicate).toBe(false);
    expect(arg.where.id).toEqual({ not: 'sync-act-1' }); // never flag itself
    expect(arg.where.startDate.gte).toEqual(new Date('2026-07-11T23:55:00Z'));
    expect(arg.where.startDate.lte).toEqual(new Date('2026-07-12T00:05:00Z'));
    expect(arg.data).toEqual({ isDuplicate: true });
  });
});
