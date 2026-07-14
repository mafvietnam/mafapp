import { AiProviderService } from './ai-provider.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { AppSettingsService } from '../shared/app-settings.service.js';
import type { GarminEncryptionService } from '../shared/garmin-encryption.service.js';
import type { OpenAiCompatibleAdapterService } from './adapters/openai-compatible-adapter.service.js';
import type { AnthropicAdapterService } from './adapters/anthropic-adapter.service.js';
import type { GeminiAdapterService } from './adapters/gemini-adapter.service.js';

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

function buildService(opts: {
  byokKey?: { provider: string; encryptedKey: string } | null;
  byokLookupThrows?: boolean;
  decryptedKey?: string;
  decryptThrows?: boolean;
  runtimeConfig?: {
    enabled: boolean;
    openRouterKey: string;
    defaultModel: string;
    defaultMonthlyQuota: number;
  };
  usageCount?: number;
  openAiResult?: string | null;
  anthropicResult?: string | null;
  geminiResult?: string | null;
}) {
  const findUnique = opts.byokLookupThrows
    ? jest
        .fn()
        .mockRejectedValue(new Error('relation "UserAiKey" does not exist'))
    : jest.fn().mockResolvedValue(opts.byokKey ?? null);

  const aiUsageUpsert = jest
    .fn()
    .mockResolvedValue({ count: opts.usageCount ?? 0 });

  const prisma = {
    userAiKey: { findUnique },
    aiUsage: { upsert: aiUsageUpsert },
  } as unknown as PrismaService;

  const getAiRuntimeConfig = jest.fn().mockResolvedValue(
    opts.runtimeConfig ?? {
      enabled: false,
      openRouterKey: '',
      defaultModel: 'google/gemini-2.0-flash-001',
      defaultMonthlyQuota: 30,
    },
  );
  const appSettings = { getAiRuntimeConfig } as unknown as AppSettingsService;

  const decrypt = opts.decryptThrows
    ? jest.fn(() => {
        throw new Error('bad ciphertext');
      })
    : jest.fn().mockReturnValue(opts.decryptedKey ?? 'plain-key');
  const encryption = { decrypt } as unknown as GarminEncryptionService;

  const openAiGenerate = jest.fn().mockResolvedValue(opts.openAiResult ?? null);
  const openAiCompatible = {
    generate: openAiGenerate,
  } as unknown as OpenAiCompatibleAdapterService;

  const anthropicGenerate = jest
    .fn()
    .mockResolvedValue(opts.anthropicResult ?? null);
  const anthropic = {
    generate: anthropicGenerate,
  } as unknown as AnthropicAdapterService;

  const geminiGenerate = jest.fn().mockResolvedValue(opts.geminiResult ?? null);
  const gemini = {
    generate: geminiGenerate,
  } as unknown as GeminiAdapterService;

  const service = new AiProviderService(
    prisma,
    appSettings,
    encryption,
    openAiCompatible,
    anthropic,
    gemini,
  );

  return {
    service,
    findUnique,
    aiUsageUpsert,
    getAiRuntimeConfig,
    decrypt,
    openAiGenerate,
    anthropicGenerate,
    geminiGenerate,
  };
}

describe('AiProviderService.hasAiPath', () => {
  it('true when the user has a stored BYOK key, regardless of system config', async () => {
    const { service } = buildService({
      byokKey: { provider: 'OPENAI', encryptedKey: 'enc' },
      runtimeConfig: {
        enabled: false,
        openRouterKey: '',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
    });
    await expect(service.hasAiPath('user-1')).resolves.toBe(true);
  });

  it('true when no BYOK key but system tier is enabled with a key configured', async () => {
    const { service } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'or-key',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
    });
    await expect(service.hasAiPath('user-1')).resolves.toBe(true);
  });

  it('false when neither a BYOK key nor an enabled system tier exists (default ships-off state)', async () => {
    const { service } = buildService({ byokKey: null });
    await expect(service.hasAiPath('user-1')).resolves.toBe(false);
  });
});

describe('AiProviderService.generateNarrative — BYOK bypasses quota entirely', () => {
  it('dispatches to the Anthropic adapter for provider=ANTHROPIC and never touches AiUsage', async () => {
    const { service, anthropicGenerate, aiUsageUpsert } = buildService({
      byokKey: { provider: 'ANTHROPIC', encryptedKey: 'enc-key' },
      decryptedKey: 'sk-ant-real',
      anthropicResult: 'Hôm nay chạy nhẹ nhàng nhé!',
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toEqual({
      narrative: 'Hôm nay chạy nhẹ nhàng nhé!',
      model: 'claude-haiku-4-5-20251001',
      source: 'byok',
    });
    expect(anthropicGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-ant-real' }),
    );
    expect(aiUsageUpsert).not.toHaveBeenCalled();
  });

  it('dispatches to the OpenAI-compatible adapter (OpenRouter baseURL) for provider=OPENROUTER', async () => {
    const { service, openAiGenerate } = buildService({
      byokKey: { provider: 'OPENROUTER', encryptedKey: 'enc-key' },
      decryptedKey: 'sk-or-real',
      openAiResult: 'narrative',
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result?.source).toBe('byok');
    expect(openAiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-or-real',
        baseURL: 'https://openrouter.ai/api/v1',
      }),
    );
  });

  it('dispatches to the OpenAI-compatible adapter with no baseURL for provider=OPENAI', async () => {
    const { service, openAiGenerate } = buildService({
      byokKey: { provider: 'OPENAI', encryptedKey: 'enc-key' },
      decryptedKey: 'sk-real',
      openAiResult: 'narrative',
    });
    await service.generateNarrative('user-1', '{}');
    // Full equality (not objectContaining) — proves baseURL is genuinely absent, not just unchecked.
    expect(openAiGenerate).toHaveBeenCalledWith({
      apiKey: 'sk-real',
      model: 'gpt-4o-mini',
      structuredInputJson: '{}',
    });
  });

  it('dispatches to the Gemini adapter for provider=GEMINI', async () => {
    const { service, geminiGenerate } = buildService({
      byokKey: { provider: 'GEMINI', encryptedKey: 'enc-key' },
      decryptedKey: 'AIzaReal',
      geminiResult: 'narrative',
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result?.source).toBe('byok');
    expect(geminiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'AIzaReal' }),
    );
  });

  it('a failed BYOK call returns null and does NOT fall through to the system tier', async () => {
    const { service, getAiRuntimeConfig } = buildService({
      byokKey: { provider: 'ANTHROPIC', encryptedKey: 'enc-key' },
      anthropicResult: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'system-key',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toBeNull();
    expect(getAiRuntimeConfig).not.toHaveBeenCalled();
  });

  it('a decrypt failure returns null without attempting any provider call', async () => {
    const { service, anthropicGenerate, openAiGenerate, geminiGenerate } =
      buildService({
        byokKey: { provider: 'ANTHROPIC', encryptedKey: 'corrupt' },
        decryptThrows: true,
      });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toBeNull();
    expect(anthropicGenerate).not.toHaveBeenCalled();
    expect(openAiGenerate).not.toHaveBeenCalled();
    expect(geminiGenerate).not.toHaveBeenCalled();
  });
});

describe('AiProviderService.generateNarrative — system tier (shared OpenRouter quota)', () => {
  it('disabled (ai.enabled=false, the ships-with default) => null, never calls the adapter', async () => {
    const { service, openAiGenerate } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: false,
        openRouterKey: '',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toBeNull();
    expect(openAiGenerate).not.toHaveBeenCalled();
  });

  it('enabled but no openRouterKey configured => null, never calls the adapter', async () => {
    const { service, openAiGenerate } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: '',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toBeNull();
    expect(openAiGenerate).not.toHaveBeenCalled();
  });

  it('under quota => calls OpenRouter, returns source:"system", increments usage by 1', async () => {
    const { service, openAiGenerate, aiUsageUpsert } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'or-system-key',
        defaultModel: 'google/gemini-2.0-flash-001',
        defaultMonthlyQuota: 30,
      },
      usageCount: 5,
      openAiResult: 'Hôm nay chạy nhẹ nhàng nhé!',
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toEqual({
      narrative: 'Hôm nay chạy nhẹ nhàng nhé!',
      model: 'google/gemini-2.0-flash-001',
      source: 'system',
    });
    expect(openAiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'or-system-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'google/gemini-2.0-flash-001',
      }),
    );
    // First upsert = quota read (update: {}); second = the post-success increment.
    expect(aiUsageUpsert).toHaveBeenCalledTimes(2);
    expect(aiUsageUpsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        update: { count: { increment: 1 } },
        where: {
          userId_yearMonth: {
            userId: 'user-1',
            yearMonth: expect.stringMatching(YEAR_MONTH_RE) as string,
          },
        },
      }),
    );
  });

  it('at/over quota => returns null, adapter never called, usage NOT incremented', async () => {
    const { service, openAiGenerate, aiUsageUpsert } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'or-system-key',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
      usageCount: 30,
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toBeNull();
    expect(openAiGenerate).not.toHaveBeenCalled();
    expect(aiUsageUpsert).toHaveBeenCalledTimes(1); // only the quota-read upsert
  });

  it('a failed system-tier call returns null and does NOT increment usage', async () => {
    const { service, aiUsageUpsert } = buildService({
      byokKey: null,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'or-system-key',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
      usageCount: 0,
      openAiResult: null,
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result).toBeNull();
    expect(aiUsageUpsert).toHaveBeenCalledTimes(1); // only the quota-read upsert, no increment
  });
});

describe('AiProviderService.generateNarrative — never throws (table-absent / unexpected errors)', () => {
  it('UserAiKey table-absent falls through to the system tier instead of throwing', async () => {
    const { service, openAiGenerate } = buildService({
      byokLookupThrows: true,
      runtimeConfig: {
        enabled: true,
        openRouterKey: 'or-system-key',
        defaultModel: 'x',
        defaultMonthlyQuota: 30,
      },
      usageCount: 0,
      openAiResult: 'narrative',
    });
    const result = await service.generateNarrative('user-1', '{}');
    expect(result?.source).toBe('system');
    expect(openAiGenerate).toHaveBeenCalled();
  });

  it('an unexpected error anywhere in the pipeline resolves to null, never rejects', async () => {
    const { service, getAiRuntimeConfig } = buildService({ byokKey: null });
    getAiRuntimeConfig.mockRejectedValue(new Error('redis down'));
    await expect(service.generateNarrative('user-1', '{}')).resolves.toBeNull();
  });
});
