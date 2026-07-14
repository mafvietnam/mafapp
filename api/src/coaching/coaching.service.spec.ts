import { CoachingService } from './coaching.service.js';
import type { CoachingRepository } from './coaching-repository.js';
import type { CoachingCacheService } from './coaching-cache.service.js';
import type { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import type { ClaudeClientService } from './claude-client.service.js';
import type { ConfigService } from '@nestjs/config';
import type { RecomputeUserProfile } from './recompute/recompute.js';

function validProfile(
  overrides: Partial<RecomputeUserProfile> = {},
): RecomputeUserProfile {
  return {
    age: 35,
    height: 170,
    weight: 65,
    experience: 'REGULAR_NEW',
    commitment: 'BASE',
    isRecovering: false,
    isMedicatedOrInjured: false,
    isProbation: false,
    healthConditions: [],
    hasClearance: false,
    ...overrides,
  };
}

function buildService(opts: {
  profile?: RecomputeUserProfile | null;
  env?: Record<string, string>;
  cachedHit?: { narrative: string; model: string } | null;
  lockAcquired?: boolean;
  withinBudget?: boolean;
  claudeNarrative?: string | null;
}) {
  // Standalone mock-fn variables (not accessed via `obj.method` in assertions below) —
  // avoids the @typescript-eslint/unbound-method false positive on `expect(obj.method)...`.
  const loadProfile = jest
    .fn()
    .mockResolvedValue(
      opts.profile === undefined ? validProfile() : opts.profile,
    );
  const loadRecentActivities = jest.fn().mockResolvedValue([]);
  const loadRhrHistory = jest.fn().mockResolvedValue([]);
  const loadTodayCheckin = jest.fn().mockResolvedValue(null);
  const repo = {
    loadProfile,
    loadRecentActivities,
    loadRhrHistory,
    loadTodayCheckin,
  } as unknown as CoachingRepository;

  const getCached = jest.fn().mockResolvedValue(opts.cachedHit ?? null);
  const saveNarrative = jest.fn().mockResolvedValue(undefined);
  const cache = { getCached, saveNarrative } as unknown as CoachingCacheService;

  const acquireLock = jest.fn().mockResolvedValue(opts.lockAcquired ?? true);
  const releaseLock = jest.fn().mockResolvedValue(undefined);
  const checkAndReserveBudget = jest
    .fn()
    .mockResolvedValue(opts.withinBudget ?? true);
  const lockBudget = {
    acquireLock,
    releaseLock,
    checkAndReserveBudget,
  } as unknown as CoachingLockBudgetService;

  const env = opts.env ?? {};
  const configGet = jest.fn((key: string, def?: unknown) => env[key] ?? def);
  const config = { get: configGet } as unknown as ConfigService;

  const generateNarrative = jest
    .fn()
    .mockResolvedValue(opts.claudeNarrative ?? null);
  const getModel = jest.fn().mockReturnValue('claude-haiku-4-5-20251001');
  const claude = {
    generateNarrative,
    getModel,
  } as unknown as ClaudeClientService;

  const service = new CoachingService(repo, cache, lockBudget, config, claude);
  return {
    service,
    loadProfile,
    loadRecentActivities,
    getCached,
    acquireLock,
    releaseLock,
    checkAndReserveBudget,
    saveNarrative,
    generateNarrative,
  };
}

const AI_ON_ENV = {
  AI_COACHING_ENABLED: 'true',
  ANTHROPIC_API_KEY: 'test-key',
};

describe('CoachingService.getToday — no profile', () => {
  it('returns a template narrative with recommendation:null and never queries activities/checkin', async () => {
    const { service, loadRecentActivities } = buildService({ profile: null });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(result.recommendation).toBeNull();
    expect(loadRecentActivities).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — cache hit', () => {
  it('returns the cached AI narrative without calling Claude', async () => {
    const { service, generateNarrative } = buildService({
      cachedHit: {
        narrative: 'cached VN text',
        model: 'claude-haiku-4-5-20251001',
      },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('ai');
    expect(result.narrative).toBe('cached VN text');
    expect(result.recommendation).not.toBeNull();
    expect(generateNarrative).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — kill-switch / missing key (AI off by default)', () => {
  it('AI_COACHING_ENABLED unset => template, zero Claude calls, zero lock/budget calls', async () => {
    const { service, generateNarrative, acquireLock } = buildService({
      env: {},
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.recommendation).not.toBeNull();
    expect(generateNarrative).not.toHaveBeenCalled();
    expect(acquireLock).not.toHaveBeenCalled();
  });

  it('AI_COACHING_ENABLED=true but no ANTHROPIC_API_KEY => template, zero Claude calls', async () => {
    const { service, generateNarrative } = buildService({
      env: { AI_COACHING_ENABLED: 'true' },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(generateNarrative).not.toHaveBeenCalled();
  });

  it('ANTHROPIC_API_KEY present but AI_COACHING_ENABLED=false => template', async () => {
    const { service, generateNarrative } = buildService({
      env: { ANTHROPIC_API_KEY: 'test-key', AI_COACHING_ENABLED: 'false' },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(generateNarrative).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — SETNX single-flight lock (RED TEAM FIX #2)', () => {
  it('lock not acquired (concurrent request already generating) => template, Claude never called, no budget spent', async () => {
    const { service, generateNarrative, checkAndReserveBudget } = buildService({
      env: AI_ON_ENV,
      lockAcquired: false,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(generateNarrative).not.toHaveBeenCalled();
    expect(checkAndReserveBudget).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — budget breach (RED TEAM FIX #2 mandatory cap)', () => {
  it('over budget => template fallback, Claude never called, lock released', async () => {
    const { service, generateNarrative, releaseLock } = buildService({
      env: AI_ON_ENV,
      withinBudget: false,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(generateNarrative).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — Claude error/unsafe output => template fallback', () => {
  it('Claude call fails (returns null) => template, lock released', async () => {
    const { service, releaseLock, saveNarrative } = buildService({
      env: AI_ON_ENV,
      claudeNarrative: null,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(releaseLock).toHaveBeenCalled();
    expect(saveNarrative).not.toHaveBeenCalled();
  });

  it('Claude returns an unsafe narrative (invented number) => template, never cached', async () => {
    const { service, saveNarrative } = buildService({
      env: AI_ON_ENV,
      claudeNarrative: 'Giữ nhịp tim dưới 999 bpm nhé.',
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(saveNarrative).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — successful AI generation', () => {
  it('returns source:"ai" with the Claude narrative and persists it via cache.saveNarrative', async () => {
    const { service, saveNarrative } = buildService({
      env: AI_ON_ENV,
      claudeNarrative: 'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('ai');
    expect(result.narrative).toBe(
      'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
    );
    expect(saveNarrative).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      expect.any(String),
      expect.any(String),
      'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
      'claude-haiku-4-5-20251001',
    );
  });
});

describe('CoachingService.getToday — always returns a server-recomputed recommendation, never client-influenced', () => {
  it('getToday only accepts a userId — there is no parameter surface for a client-sent recommendation', () => {
    expect(CoachingService.prototype.getToday.length).toBe(1);
  });
});
