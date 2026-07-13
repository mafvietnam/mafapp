import { StravaService } from './strava.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { RedisService } from '../shared/redis.service.js';
import type { StravaEncryptionService } from './strava-encryption.service.js';
import type {
  AppSettingsService,
  StravaRuntimeConfig,
} from '../shared/app-settings.service.js';

const baseCfg: StravaRuntimeConfig = {
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  webhookVerifyToken: 'verify-token',
  maxAthletes: 10,
  webhookSubscriptionId: '1',
};

function buildService(
  opts: {
    maxAthletes?: number;
    activeCount?: number;
    connectionFindUnique?: unknown;
    connectionFindUniqueForConn?: unknown;
  } = {},
) {
  const deleteConnection = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    stravaConnection: {
      count: jest.fn().mockResolvedValue(opts.activeCount ?? 0),
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.connectionFindUnique ?? null),
      update: jest
        .fn()
        .mockResolvedValue(opts.connectionFindUniqueForConn ?? null),
      delete: deleteConnection,
    },
    stravaActivity: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    stravaActivityDetail: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaService;

  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as RedisService;

  const encryption = {
    encrypt: jest.fn((v: string) => `enc(${v})`),
    decrypt: jest.fn((v: string) => v.replace(/^enc\(|\)$/g, '')),
  } as unknown as StravaEncryptionService;

  const appSettings = {
    getStravaRuntimeConfig: jest.fn().mockResolvedValue({
      ...baseCfg,
      maxAthletes: opts.maxAthletes ?? baseCfg.maxAthletes,
    }),
  } as unknown as AppSettingsService;

  const service = new StravaService(prisma, redis, encryption, appSettings);
  return { service, prisma, redis, encryption, appSettings, deleteConnection };
}

describe('StravaService.getSlotInfo — slot math (H6b)', () => {
  it('reports slots available when under cap', async () => {
    const { service } = buildService({ maxAthletes: 10, activeCount: 4 });
    const slot = await service.getSlotInfo();
    expect(slot).toEqual({
      maxAthletes: 10,
      active: 4,
      slotsAvailable: 6,
      limitReached: false,
    });
  });

  it('reports limitReached when exactly at cap', async () => {
    const { service } = buildService({ maxAthletes: 10, activeCount: 10 });
    const slot = await service.getSlotInfo();
    expect(slot).toEqual({
      maxAthletes: 10,
      active: 10,
      slotsAvailable: 0,
      limitReached: true,
    });
  });

  it('reports limitReached and clamps slotsAvailable at 0 when over cap', async () => {
    const { service } = buildService({ maxAthletes: 10, activeCount: 13 });
    const slot = await service.getSlotInfo();
    expect(slot).toEqual({
      maxAthletes: 10,
      active: 13,
      slotsAvailable: 0,
      limitReached: true,
    });
  });

  it('maxAthletes=0 blocks all new connections (H9)', async () => {
    const { service } = buildService({ maxAthletes: 0, activeCount: 0 });
    const slot = await service.getSlotInfo();
    expect(slot.limitReached).toBe(true);
    expect(slot.slotsAvailable).toBe(0);
  });
});

describe('StravaService.isNewConnectionBlocked — reconnect exemption', () => {
  it('is false for a user with an existing connection, even at cap', async () => {
    const { service } = buildService({
      maxAthletes: 1,
      activeCount: 1,
      connectionFindUnique: { userId: 'u1', status: 'CONNECTED' },
    });
    await expect(service.isNewConnectionBlocked('u1')).resolves.toBe(false);
  });

  it('is true for a new user when the cap is reached', async () => {
    const { service } = buildService({
      maxAthletes: 1,
      activeCount: 1,
      connectionFindUnique: null,
    });
    await expect(service.isNewConnectionBlocked('new-user')).resolves.toBe(
      true,
    );
  });

  it('is false for a new user when slots remain', async () => {
    const { service } = buildService({
      maxAthletes: 10,
      activeCount: 1,
      connectionFindUnique: null,
    });
    await expect(service.isNewConnectionBlocked('new-user')).resolves.toBe(
      false,
    );
  });
});

describe('StravaService.getStatus — connectionLimitReached boolean only (M14)', () => {
  it('includes connectionLimitReached and excludes numeric slot fields when disconnected', async () => {
    const { service } = buildService({
      maxAthletes: 1,
      activeCount: 1,
      connectionFindUnique: null,
    });
    const status = await service.getStatus('u1');
    expect(status.connectionLimitReached).toBe(true);
    expect(status).not.toHaveProperty('slotsAvailable');
    expect(status).not.toHaveProperty('active');
    expect(status).not.toHaveProperty('maxAthletes');
  });

  it('includes connectionLimitReached=false when slots remain, for a connected user', async () => {
    const { service } = buildService({
      maxAthletes: 10,
      activeCount: 1,
      connectionFindUnique: {
        status: 'CONNECTED',
        stravaAthleteId: '123',
        lastSyncAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const status = await service.getStatus('u1');
    expect(status.connected).toBe(true);
    expect(status.connectionLimitReached).toBe(false);
  });
});

describe('StravaService.disconnect — best-effort deauthorize (H6a)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('calls Strava deauthorize with the decrypted access token and still deletes the row', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service, deleteConnection } = buildService({
      connectionFindUniqueForConn: {
        userId: 'u1',
        accessToken: 'enc(tok-123)',
      },
    });

    await service.disconnect('u1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/deauthorize',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { body: URLSearchParams; signal?: AbortSignal },
    ];
    expect(init.body.get('access_token')).toBe('tok-123');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(deleteConnection).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('never throws and still deletes the row when deauthorize fails (expired token — acceptable)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service, deleteConnection } = buildService({
      connectionFindUniqueForConn: {
        userId: 'u1',
        accessToken: 'enc(tok-expired)',
      },
    });

    await expect(service.disconnect('u1')).resolves.toBeUndefined();
    expect(deleteConnection).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('treats a fetch timeout the same as any other best-effort failure (never blocks delete)', async () => {
    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError',
    );
    const fetchMock = jest.fn().mockRejectedValue(timeoutError);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service, deleteConnection } = buildService({
      connectionFindUniqueForConn: {
        userId: 'u1',
        accessToken: 'enc(tok-slow)',
      },
    });

    await expect(service.disconnect('u1')).resolves.toBeUndefined();
    expect(deleteConnection).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });
});
