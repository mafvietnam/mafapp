import { CheckinService, deriveIctDate } from './checkin.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { UpsertCheckinDto } from './checkin.dto.js';

/**
 * RED TEAM FIX #7: the server is the single source of "today" (Asia/Ho_Chi_Minh,
 * fixed UTC+7, no DST). Boundary tests mirror the frontend parity test in
 * src/utils/__tests__/local-today.test.ts.
 */
describe('deriveIctDate', () => {
  it('23:30 ICT stays on the same calendar date', () => {
    // 2026-07-14T16:30:00Z = 2026-07-14 23:30 ICT
    const d = deriveIctDate(new Date('2026-07-14T16:30:00.000Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  it('00:30 ICT flips to the next calendar date', () => {
    // 2026-07-14T17:30:00Z = 2026-07-15 00:30 ICT
    const d = deriveIctDate(new Date('2026-07-14T17:30:00.000Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('the exact 17:00:00.000Z instant is the first moment of the next ICT date', () => {
    const justBefore = deriveIctDate(new Date('2026-07-14T16:59:59.999Z'));
    const atBoundary = deriveIctDate(new Date('2026-07-14T17:00:00.000Z'));
    expect(justBefore.toISOString().slice(0, 10)).toBe('2026-07-14');
    expect(atBoundary.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('defaults to the current instant when no `now` is passed', () => {
    expect(deriveIctDate()).toBeInstanceOf(Date);
  });
});

describe('CheckinService', () => {
  const dto: UpsertCheckinDto = {
    sleepQuality: 4,
    fatigue: 2,
    soreness: 'calf',
    restingHr: 52,
  };

  function buildService(
    overrides: { upsert?: jest.Mock; findMany?: jest.Mock } = {},
  ) {
    const prisma = {
      dailyCheckin: {
        upsert:
          overrides.upsert ?? jest.fn().mockResolvedValue({ id: 'c1', ...dto }),
        findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    return new CheckinService(prisma);
  }

  it('upsert derives the date server-side and never trusts a client-sent date (DTO has no date field)', async () => {
    const upsertMock = jest.fn().mockResolvedValue({ id: 'c1', ...dto });
    const service = buildService({ upsert: upsertMock });
    await service.upsert('user-1', dto);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0][0];
    expect(call.where.userId_date.userId).toBe('user-1');
    expect(call.where.userId_date.date).toBeInstanceOf(Date);
    expect(call.create).toMatchObject({
      userId: 'user-1',
      sleepQuality: 4,
      fatigue: 2,
      soreness: 'calf',
      restingHr: 52,
    });
  });

  it('upsert soft-fails to null when the table is missing (RED TEAM FIX #8 rollout gap)', async () => {
    const upsertMock = jest
      .fn()
      .mockRejectedValue(new Error('relation "DailyCheckin" does not exist'));
    const service = buildService({ upsert: upsertMock });
    const result = await service.upsert('user-1', dto);
    expect(result).toBeNull();
  });

  it('list soft-fails to [] when the table is missing', async () => {
    const findManyMock = jest
      .fn()
      .mockRejectedValue(new Error('relation "DailyCheckin" does not exist'));
    const service = buildService({ findMany: findManyMock });
    const result = await service.list('user-1', '2026-07-01');
    expect(result).toEqual([]);
  });

  it('list defaults `to` to the server ICT date when omitted', async () => {
    const findManyMock = jest.fn().mockResolvedValue([]);
    const service = buildService({ findMany: findManyMock });
    await service.list('user-1', '2026-07-01');
    const call = findManyMock.mock.calls[0][0];
    expect(call.where.date.lte).toBeInstanceOf(Date);
  });
});
