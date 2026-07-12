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
