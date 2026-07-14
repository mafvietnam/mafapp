import { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import type { RedisService } from '../shared/redis.service.js';
import type { ConfigService } from '@nestjs/config';

const ICT_DATE_KEY = '2026-07-14';

function buildService(opts: { budget?: number } = {}) {
  const redisSet = jest.fn().mockResolvedValue('OK');
  const redisDel = jest.fn().mockResolvedValue(1);
  const redisIncr = jest.fn().mockResolvedValue(1);
  const redisExpire = jest.fn().mockResolvedValue(1);
  const redis = {
    set: redisSet,
    del: redisDel,
    incr: redisIncr,
    expire: redisExpire,
  } as unknown as RedisService;

  const config = {
    get: jest.fn((key: string, def?: unknown) =>
      key === 'AI_COACHING_DAILY_BUDGET' ? (opts.budget ?? def) : def,
    ),
  } as unknown as ConfigService;

  const service = new CoachingLockBudgetService(redis, config);
  return { service, redisSet, redisDel, redisIncr, redisExpire };
}

describe('CoachingLockBudgetService — SETNX single-flight lock', () => {
  it('acquireLock returns true when the SET NX wins ("OK")', async () => {
    const { service, redisSet } = buildService();
    redisSet.mockResolvedValue('OK');
    await expect(service.acquireLock('user-1', ICT_DATE_KEY)).resolves.toBe(
      true,
    );
  });

  it('acquireLock returns false when another request already holds the lock (SET NX returns null)', async () => {
    const { service, redisSet } = buildService();
    redisSet.mockResolvedValue(null);
    await expect(service.acquireLock('user-1', ICT_DATE_KEY)).resolves.toBe(
      false,
    );
  });

  it('acquireLock fails CLOSED (false) when Redis errors — never risks uncoordinated concurrent spend', async () => {
    const { service, redisSet } = buildService();
    redisSet.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.acquireLock('user-1', ICT_DATE_KEY)).resolves.toBe(
      false,
    );
  });

  it('releaseLock never throws even when Redis errors', async () => {
    const { service, redisDel } = buildService();
    redisDel.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      service.releaseLock('user-1', ICT_DATE_KEY),
    ).resolves.toBeUndefined();
  });
});

describe('CoachingLockBudgetService.checkAndReserveBudget — RED TEAM FIX #2 mandatory cap', () => {
  it('returns true while under budget', async () => {
    const { service, redisIncr } = buildService({ budget: 100 });
    redisIncr.mockResolvedValue(5);
    await expect(service.checkAndReserveBudget(ICT_DATE_KEY)).resolves.toBe(
      true,
    );
  });

  it('returns false once the count exceeds the configured daily budget', async () => {
    const { service, redisIncr } = buildService({ budget: 10 });
    redisIncr.mockResolvedValue(11);
    await expect(service.checkAndReserveBudget(ICT_DATE_KEY)).resolves.toBe(
      false,
    );
  });

  it('sets an expiry only on the FIRST increment of the day (count===1)', async () => {
    const { service, redisIncr, redisExpire } = buildService({ budget: 10 });
    redisIncr.mockResolvedValue(1);
    await service.checkAndReserveBudget(ICT_DATE_KEY);
    expect(redisExpire).toHaveBeenCalled();
  });

  it('fails CLOSED (false) when Redis errors — never risks an unmetered spend', async () => {
    const { service, redisIncr } = buildService({ budget: 10 });
    redisIncr.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.checkAndReserveBudget(ICT_DATE_KEY)).resolves.toBe(
      false,
    );
  });
});
