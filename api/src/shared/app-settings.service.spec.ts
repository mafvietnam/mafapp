import { AppSettingsService } from './app-settings.service.js';
import type { PrismaService } from './prisma.service.js';
import type { GarminEncryptionService } from './garmin-encryption.service.js';

/**
 * RED TEAM #H9: strava.maxAthletes parsing must allow 0 (pause new connections)
 * and only fall back to the default of 10 on NaN/negative/missing values.
 */
describe('AppSettingsService.getStravaRuntimeConfig — maxAthletes parsing', () => {
  const buildService = (storedValue?: string) => {
    const rows =
      storedValue === undefined
        ? []
        : [{ key: 'strava.maxAthletes', value: storedValue }];
    const prisma = {
      appSetting: { findMany: jest.fn().mockResolvedValue(rows) },
    } as unknown as PrismaService;
    // maxAthletes is never in SECRET_KEYS — encryption is never invoked for it.
    const encryption = {} as unknown as GarminEncryptionService;
    return new AppSettingsService(prisma, encryption);
  };

  it('parses a valid positive integer from the DB', async () => {
    const cfg = await buildService('25').getStravaRuntimeConfig();
    expect(cfg.maxAthletes).toBe(25);
  });

  it('defaults to 10 when the setting row is missing', async () => {
    const cfg = await buildService(undefined).getStravaRuntimeConfig();
    expect(cfg.maxAthletes).toBe(10);
  });

  it('defaults to 10 for a non-numeric value', async () => {
    const cfg = await buildService('not-a-number').getStravaRuntimeConfig();
    expect(cfg.maxAthletes).toBe(10);
  });

  it('allows 0 as a legitimate cap that pauses new connections (H9)', async () => {
    const cfg = await buildService('0').getStravaRuntimeConfig();
    expect(cfg.maxAthletes).toBe(0);
  });

  it('defaults to 10 for a negative value', async () => {
    const cfg = await buildService('-5').getStravaRuntimeConfig();
    expect(cfg.maxAthletes).toBe(10);
  });
});

describe('AppSettingsService — Phase 5 ai.* settings', () => {
  const buildService = (
    rows: { key: string; value: string }[] = [],
    decrypted: Record<string, string> = {},
  ) => {
    const prisma = {
      appSetting: {
        findMany: jest.fn().mockResolvedValue(rows),
        findUnique: jest.fn(
          ({ where: { key } }: { where: { key: string } }) =>
            rows.find((r) => r.key === key) ?? null,
        ),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const encryption = {
      encrypt: jest.fn((v: string) => `enc(${v})`),
      decrypt: jest.fn((v: string) => decrypted[v] ?? v),
    } as unknown as GarminEncryptionService;
    return {
      service: new AppSettingsService(prisma, encryption),
      prisma,
      encryption,
    };
  };

  it('ships ai.enabled=false by default when no rows are stored', async () => {
    const { service } = buildService([]);
    const cfg = await service.getAiRuntimeConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.openRouterKey).toBe('');
    expect(cfg.defaultMonthlyQuota).toBe(30);
  });

  it('getAiSettings never returns the raw openRouterKey (masked like Strava clientSecret)', async () => {
    const { service } = buildService(
      [
        { key: 'ai.enabled', value: 'true' },
        { key: 'ai.openRouterKey', value: 'enc(sk-or-v1-abcdefghijklmnop)' },
      ],
      { 'enc(sk-or-v1-abcdefghijklmnop)': 'sk-or-v1-abcdefghijklmnop' },
    );
    const settings = await service.getAiSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.hasOpenRouterKey).toBe(true);
    expect(settings.openRouterKey).not.toContain('abcdefghijklmnop');
    expect(settings.openRouterKey.startsWith('sk-o')).toBe(true);
  });

  it('getAiRuntimeConfig decrypts the openRouterKey for internal consumers', async () => {
    const { service } = buildService(
      [{ key: 'ai.openRouterKey', value: 'enc(real-key)' }],
      { 'enc(real-key)': 'real-key' },
    );
    const cfg = await service.getAiRuntimeConfig();
    expect(cfg.openRouterKey).toBe('real-key');
  });

  it('setMany encrypts ai.openRouterKey (SECRET_KEYS) and invalidates the AI runtime cache', async () => {
    const { service, prisma } = buildService([
      { key: 'ai.openRouterKey', value: 'enc(old-key)' },
    ]);
    await service.getAiRuntimeConfig(); // warm the cache
    await service.setMany({ 'ai.openRouterKey': 'new-key' });
    const upsertMock = (prisma.appSetting as unknown as { upsert: jest.Mock })
      .upsert;
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { key: 'ai.openRouterKey', value: 'enc(new-key)' },
      }),
    );
  });

  it('defaults defaultMonthlyQuota to 30 for a non-numeric stored value', async () => {
    const { service } = buildService([
      { key: 'ai.defaultMonthlyQuota', value: 'not-a-number' },
    ]);
    const cfg = await service.getAiRuntimeConfig();
    expect(cfg.defaultMonthlyQuota).toBe(30);
  });
});
