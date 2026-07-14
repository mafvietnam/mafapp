import { UserAiKeyService } from './user-ai-key.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { GarminEncryptionService } from '../shared/garmin-encryption.service.js';
import type { AppSettingsService } from '../shared/app-settings.service.js';
import type { UserAiKeyDto } from './dto/user-ai-key.dto.js';

function buildService(opts: {
  byokKey?: { provider: string; encryptedKey: string } | null;
  usageRow?: { count: number } | null;
  runtimeConfig?: {
    enabled: boolean;
    openRouterKey: string;
    defaultModel: string;
    defaultMonthlyQuota: number;
  };
  upsertThrows?: boolean;
}) {
  const findUnique = jest.fn().mockResolvedValue(opts.byokKey ?? null);
  const upsert = opts.upsertThrows
    ? jest.fn().mockRejectedValue(new Error('DB error'))
    : jest.fn().mockResolvedValue({});
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });

  const usageFindUnique = jest.fn().mockResolvedValue(opts.usageRow ?? null);

  const prisma = {
    userAiKey: { findUnique, upsert, deleteMany },
    aiUsage: { findUnique: usageFindUnique },
  } as unknown as PrismaService;

  const encrypt = jest.fn((v: string) => `enc(${v})`);
  const encryption = { encrypt } as unknown as GarminEncryptionService;

  const getAiRuntimeConfig = jest.fn().mockResolvedValue(
    opts.runtimeConfig ?? {
      enabled: false,
      openRouterKey: '',
      defaultModel: 'x',
      defaultMonthlyQuota: 30,
    },
  );
  const appSettings = { getAiRuntimeConfig } as unknown as AppSettingsService;

  const service = new UserAiKeyService(prisma, encryption, appSettings);
  return { service, findUnique, upsert, deleteMany, encrypt, usageFindUnique };
}

describe('UserAiKeyService.getStatus', () => {
  it('reports source:"byok" and hasKey:true when a key row exists', async () => {
    const { service } = buildService({
      byokKey: { provider: 'ANTHROPIC', encryptedKey: 'enc' },
      usageRow: { count: 3 },
    });
    const status = await service.getStatus('user-1');
    expect(status).toEqual({
      provider: 'ANTHROPIC',
      hasKey: true,
      source: 'byok',
      usageThisMonth: 3,
      quota: 30,
    });
  });

  it('reports source:"system" when no BYOK key but system tier is enabled', async () => {
    const { service } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'or-key',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
    });
    const status = await service.getStatus('user-1');
    expect(status.source).toBe('system');
    expect(status.hasKey).toBe(false);
  });

  it('reports source:"none" when no BYOK key and the system tier is off (ships-with default)', async () => {
    const { service } = buildService({ byokKey: null });
    const status = await service.getStatus('user-1');
    expect(status.source).toBe('none');
  });
});

describe('UserAiKeyService.setKey', () => {
  it('rejects a key that fails the provider prefix sanity check', async () => {
    const { service, upsert } = buildService({});
    const dto: UserAiKeyDto = {
      provider: 'ANTHROPIC' as never,
      key: 'not-a-real-key-format',
    };
    await expect(service.setKey('user-1', dto)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('encrypts the key before persisting — the raw key is never passed to prisma', async () => {
    const { service, upsert, encrypt } = buildService({});
    const dto: UserAiKeyDto = {
      provider: 'ANTHROPIC' as never,
      key: 'sk-ant-abcdefghijklmnop',
    };
    await service.setKey('user-1', dto);
    expect(encrypt).toHaveBeenCalledWith('sk-ant-abcdefghijklmnop');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          userId: 'user-1',
          provider: 'ANTHROPIC',
          encryptedKey: 'enc(sk-ant-abcdefghijklmnop)',
        },
      }),
    );
  });

  it('throws (never a raw 500) when the DB upsert fails', async () => {
    const { service } = buildService({ upsertThrows: true });
    const dto: UserAiKeyDto = {
      provider: 'ANTHROPIC' as never,
      key: 'sk-ant-abcdefghijklmnop',
    };
    await expect(service.setKey('user-1', dto)).rejects.toThrow();
  });
});

describe('UserAiKeyService.deleteKey', () => {
  it('is idempotent — resolves ok even when no key exists', async () => {
    const { service, deleteMany } = buildService({});
    await expect(service.deleteKey('user-1')).resolves.toEqual({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
