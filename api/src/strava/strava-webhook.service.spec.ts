import {
  StravaWebhookService,
  type StravaWebhookEvent,
} from './strava-webhook.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { AppSettingsService } from '../shared/app-settings.service.js';
import type { StravaTokenService } from './strava-token.service.js';
import type { StravaSyncService } from './strava-sync.service.js';
import type { ConfigService } from '@nestjs/config';

/**
 * RED TEAM #H6c + code-review HIGH finding: athlete-deauth webhook events are a destructive,
 * unauthenticated path (anyone can POST to /strava/webhook). Trusting event.subscription_id
 * against our own stored subscription id is the only gate — must fail closed on mismatch/missing.
 */
describe('StravaWebhookService.processEvent — athlete deauth branch', () => {
  function buildService(
    opts: { connFindFirst?: unknown; webhookSubscriptionId?: string } = {},
  ) {
    const findFirst = jest.fn().mockResolvedValue(opts.connFindFirst ?? null);
    const deleteConnection = jest.fn().mockResolvedValue(undefined);
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const detailDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const transaction = jest.fn((ops: unknown[]) => Promise.all(ops));

    const prisma = {
      stravaConnection: { findFirst, delete: deleteConnection },
      stravaActivity: { deleteMany },
      stravaActivityDetail: { deleteMany: detailDeleteMany },
      $transaction: transaction,
    } as unknown as PrismaService;

    const getStravaRuntimeConfig = jest.fn().mockResolvedValue({
      enabled: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      webhookVerifyToken: 'verify-token',
      maxAthletes: 10,
      webhookSubscriptionId: opts.webhookSubscriptionId ?? '',
    });
    const appSettings = {
      getStravaRuntimeConfig,
    } as unknown as AppSettingsService;
    const tokenService = {} as unknown as StravaTokenService;
    const syncService = {} as unknown as StravaSyncService;
    const config = {
      get: jest.fn((_key: string, def?: unknown) => def),
    } as unknown as ConfigService;

    const service = new StravaWebhookService(
      prisma,
      appSettings,
      tokenService,
      syncService,
      config,
    );
    return {
      service,
      findFirst,
      deleteConnection,
      deleteMany,
      detailDeleteMany,
      transaction,
    };
  }

  const deauthEvent: StravaWebhookEvent = {
    object_type: 'athlete',
    object_id: 999,
    aspect_type: 'update',
    owner_id: 12345,
    subscription_id: 1,
    event_time: 1700000000,
    updates: { authorized: 'false' },
  };

  it('deletes the connection, activities AND detail cache transactionally when subscription_id matches (H2)', async () => {
    const {
      service,
      findFirst,
      deleteMany,
      detailDeleteMany,
      deleteConnection,
      transaction,
    } = buildService({
      connFindFirst: { userId: 'user-1' },
      webhookSubscriptionId: '1',
    });

    await service.processEvent(deauthEvent);

    expect(findFirst).toHaveBeenCalledWith({
      where: { stravaAthleteId: '12345' },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    // Health PII (HR streams + description) must be purged on deauth, not just on manual disconnect.
    expect(detailDeleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(deleteConnection).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('is a no-op when no local connection matches the athlete (trusted subscription, nothing to delete)', async () => {
    const { service, deleteMany, deleteConnection } = buildService({
      webhookSubscriptionId: '1',
    });

    await service.processEvent(deauthEvent);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(deleteConnection).not.toHaveBeenCalled();
  });

  it('rejects a forged event when no subscription id has been persisted yet', async () => {
    const { service, findFirst, deleteMany, deleteConnection } = buildService({
      webhookSubscriptionId: '',
    });

    await service.processEvent(deauthEvent);

    expect(findFirst).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(deleteConnection).not.toHaveBeenCalled();
  });

  it('rejects a forged event whose subscription_id does not match the trusted one', async () => {
    const { service, findFirst, deleteMany, deleteConnection } = buildService({
      webhookSubscriptionId: '999999',
    });

    await service.processEvent(deauthEvent);

    expect(findFirst).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(deleteConnection).not.toHaveBeenCalled();
  });
});
