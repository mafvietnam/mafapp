import { CoachingCacheService } from './coaching-cache.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { RedisService } from '../shared/redis.service.js';

const SERVER_TODAY = new Date('2026-07-14T00:00:00.000Z');
const ICT_DATE_KEY = '2026-07-14';

function buildService() {
  const redisGet = jest.fn();
  const redisSet = jest.fn().mockResolvedValue('OK');
  const redis = { get: redisGet, set: redisSet } as unknown as RedisService;

  const findUnique = jest.fn().mockResolvedValue(null);
  const upsert = jest.fn().mockResolvedValue({});
  const prisma = {
    coachingNarrative: { findUnique, upsert },
  } as unknown as PrismaService;

  const service = new CoachingCacheService(prisma, redis);
  return { service, redisGet, redisSet, findUnique, upsert };
}

describe('CoachingCacheService.getCached', () => {
  it('returns the Redis-cached narrative when the stored inputHash matches', async () => {
    const { service, redisGet } = buildService();
    redisGet.mockResolvedValue(
      JSON.stringify({
        narrative: 'cached text',
        inputHash: 'abc',
        model: 'claude-haiku-4-5-20251001',
      }),
    );
    const result = await service.getCached(
      'user-1',
      ICT_DATE_KEY,
      'abc',
      SERVER_TODAY,
    );
    expect(result).toEqual({
      narrative: 'cached text',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('treats a Redis hit with a MISMATCHED inputHash as a miss (falls through to DB)', async () => {
    const { service, redisGet, findUnique } = buildService();
    redisGet.mockResolvedValue(
      JSON.stringify({ narrative: 'stale', inputHash: 'old-hash', model: 'x' }),
    );
    findUnique.mockResolvedValue(null);
    const result = await service.getCached(
      'user-1',
      ICT_DATE_KEY,
      'new-hash',
      SERVER_TODAY,
    );
    expect(result).toBeNull();
  });

  it('falls back to the DB row when Redis is empty (durability across a Redis flush)', async () => {
    const { service, redisGet, findUnique } = buildService();
    redisGet.mockResolvedValue(null);
    findUnique.mockResolvedValue({
      narrative: 'db text',
      inputHash: 'abc',
      model: 'claude-haiku-4-5-20251001',
    });
    const result = await service.getCached(
      'user-1',
      ICT_DATE_KEY,
      'abc',
      SERVER_TODAY,
    );
    expect(result).toEqual({
      narrative: 'db text',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('returns null (never throws) when the DB read fails — table-absent guard', async () => {
    const { service, redisGet, findUnique } = buildService();
    redisGet.mockResolvedValue(null);
    findUnique.mockRejectedValue(
      new Error('relation "CoachingNarrative" does not exist'),
    );
    await expect(
      service.getCached('user-1', ICT_DATE_KEY, 'abc', SERVER_TODAY),
    ).resolves.toBeNull();
  });

  it('returns null (never throws) when Redis itself errors', async () => {
    const { service, redisGet, findUnique } = buildService();
    redisGet.mockRejectedValue(new Error('ECONNREFUSED'));
    findUnique.mockResolvedValue(null);
    await expect(
      service.getCached('user-1', ICT_DATE_KEY, 'abc', SERVER_TODAY),
    ).resolves.toBeNull();
  });
});

describe('CoachingCacheService.saveNarrative', () => {
  it('writes both Redis and the DB row, never throws on DB failure', async () => {
    const { service, redisSet, upsert } = buildService();
    await service.saveNarrative(
      'user-1',
      SERVER_TODAY,
      ICT_DATE_KEY,
      'abc',
      'narrative text',
      'claude-haiku-4-5-20251001',
    );
    expect(redisSet).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_date: { userId: 'user-1', date: SERVER_TODAY } },
      }),
    );
  });

  it('does not throw when the DB upsert fails (table-absent rollout gap)', async () => {
    const { service, upsert } = buildService();
    upsert.mockRejectedValue(new Error('relation does not exist'));
    await expect(
      service.saveNarrative(
        'user-1',
        SERVER_TODAY,
        ICT_DATE_KEY,
        'abc',
        'text',
        'model',
      ),
    ).resolves.toBeUndefined();
  });
});
