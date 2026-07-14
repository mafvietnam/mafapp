import { AdminAiService } from './admin-ai.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { AppSettingsService } from '../shared/app-settings.service.js';
import type { AiSettingsDto } from './dto/ai-settings.dto.js';

function buildService(opts: {
  usageRows?: Array<{
    userId: string;
    count: number;
    user: { name: string; email: string };
  }>;
  usageThrows?: boolean;
}) {
  const findMany = opts.usageThrows
    ? jest
        .fn()
        .mockRejectedValue(new Error('relation "AiUsage" does not exist'))
    : jest.fn().mockResolvedValue(opts.usageRows ?? []);
  const prisma = { aiUsage: { findMany } } as unknown as PrismaService;

  const getAiSettings = jest.fn().mockResolvedValue({
    enabled: false,
    openRouterKey: '',
    hasOpenRouterKey: false,
    defaultModel: 'x',
    defaultMonthlyQuota: 30,
  });
  const setMany = jest.fn().mockResolvedValue(undefined);
  const appSettings = {
    getAiSettings,
    setMany,
  } as unknown as AppSettingsService;

  const service = new AdminAiService(prisma, appSettings);
  return { service, findMany, getAiSettings, setMany };
}

describe('AdminAiService.getSettings', () => {
  it('delegates to AppSettingsService.getAiSettings (masked)', async () => {
    const { service, getAiSettings } = buildService({});
    await service.getSettings();
    expect(getAiSettings).toHaveBeenCalled();
  });
});

describe('AdminAiService.saveSettings', () => {
  it('maps DTO fields to prefixed ai.* keys and calls setMany', async () => {
    const { service, setMany } = buildService({});
    const dto: AiSettingsDto = {
      enabled: true,
      openRouterKey: 'or-key',
      defaultModel: 'google/gemini-2.0-flash-001',
      defaultMonthlyQuota: 50,
    };
    const result = await service.saveSettings(dto);
    expect(result).toEqual({ ok: true });
    expect(setMany).toHaveBeenCalledWith({
      'ai.enabled': 'true',
      'ai.openRouterKey': 'or-key',
      'ai.defaultModel': 'google/gemini-2.0-flash-001',
      'ai.defaultMonthlyQuota': '50',
    });
  });

  it('only includes provided fields (partial update)', async () => {
    const { service, setMany } = buildService({});
    await service.saveSettings({ enabled: false });
    expect(setMany).toHaveBeenCalledWith({ 'ai.enabled': 'false' });
  });
});

describe('AdminAiService.getUsage', () => {
  it('returns per-user counts + total for the current month', async () => {
    const { service } = buildService({
      usageRows: [
        { userId: 'u1', count: 12, user: { name: 'Alice', email: 'a@x.com' } },
        { userId: 'u2', count: 3, user: { name: 'Bob', email: 'b@x.com' } },
      ],
    });
    const usage = await service.getUsage();
    expect(usage.total).toBe(15);
    expect(usage.users).toEqual([
      { userId: 'u1', userName: 'Alice', userEmail: 'a@x.com', count: 12 },
      { userId: 'u2', userName: 'Bob', userEmail: 'b@x.com', count: 3 },
    ]);
    expect(usage.yearMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns an empty summary (never throws) when the table is absent', async () => {
    const { service } = buildService({ usageThrows: true });
    const usage = await service.getUsage();
    expect(usage).toEqual(expect.objectContaining({ total: 0, users: [] }));
  });
});
