import { CoachingService } from './coaching.service.js';
import type { CoachingRepository } from './coaching-repository.js';
import type { CoachingCacheService } from './coaching-cache.service.js';
import type { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import type { AiProviderService } from '../ai/ai-provider.service.js';
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
  cachedHit?: {
    narrative: string;
    model: string;
    source: 'byok' | 'system';
  } | null;
  hasAiPath?: boolean;
  lockAcquired?: boolean;
  withinBudget?: boolean;
  aiResult?: {
    narrative: string;
    model: string;
    source: 'byok' | 'system';
  } | null;
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

  const hasAiPath = jest.fn().mockResolvedValue(opts.hasAiPath ?? true);
  const generateNarrative = jest.fn().mockResolvedValue(opts.aiResult ?? null);
  const aiProvider = {
    hasAiPath,
    generateNarrative,
  } as unknown as AiProviderService;

  const service = new CoachingService(repo, cache, lockBudget, aiProvider);
  return {
    service,
    loadProfile,
    loadRecentActivities,
    getCached,
    acquireLock,
    releaseLock,
    checkAndReserveBudget,
    saveNarrative,
    hasAiPath,
    generateNarrative,
  };
}

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
  it('returns the cached narrative + its stored tier without calling the AI provider', async () => {
    const { service, generateNarrative } = buildService({
      cachedHit: {
        narrative: 'cached VN text',
        model: 'claude-haiku-4-5-20251001',
        source: 'system',
      },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('system');
    expect(result.narrative).toBe('cached VN text');
    expect(result.recommendation).not.toBeNull();
    expect(generateNarrative).not.toHaveBeenCalled();
  });

  it('a BYOK-tier cache hit reports source:"byok"', async () => {
    const { service } = buildService({
      cachedHit: { narrative: 'cached', model: 'x', source: 'byok' },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('byok');
  });
});

describe('CoachingService.getToday — no AI path available (default ships-off state)', () => {
  it('hasAiPath:false => template, zero generation calls, zero lock/budget calls', async () => {
    const { service, generateNarrative, acquireLock } = buildService({
      hasAiPath: false,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.recommendation).not.toBeNull();
    expect(generateNarrative).not.toHaveBeenCalled();
    expect(acquireLock).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — SETNX single-flight lock (RED TEAM FIX #2)', () => {
  it('lock not acquired (concurrent request already generating) => template, provider never called, no budget spent', async () => {
    const { service, generateNarrative, checkAndReserveBudget } = buildService({
      lockAcquired: false,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(generateNarrative).not.toHaveBeenCalled();
    expect(checkAndReserveBudget).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — budget breach (RED TEAM FIX #2 mandatory cap)', () => {
  it('over budget => template fallback, provider never called, lock released', async () => {
    const { service, generateNarrative, releaseLock } = buildService({
      withinBudget: false,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(generateNarrative).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — provider error/unsafe output => template fallback', () => {
  it('provider call fails (returns null) => template, lock released', async () => {
    const { service, releaseLock, saveNarrative } = buildService({
      aiResult: null,
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(releaseLock).toHaveBeenCalled();
    expect(saveNarrative).not.toHaveBeenCalled();
  });

  it('provider returns an unsafe narrative (invented number) => template, never cached', async () => {
    const { service, saveNarrative } = buildService({
      aiResult: {
        narrative: 'Giữ nhịp tim dưới 999 bpm nhé.',
        model: 'x',
        source: 'system',
      },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('template');
    expect(saveNarrative).not.toHaveBeenCalled();
  });
});

describe('CoachingService.getToday — successful system-tier generation', () => {
  it('returns source:"system" with the narrative and persists it via cache.saveNarrative', async () => {
    const { service, saveNarrative } = buildService({
      aiResult: {
        narrative: 'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
        model: 'google/gemini-2.0-flash-001',
        source: 'system',
      },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('system');
    expect(result.narrative).toBe(
      'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
    );
    expect(saveNarrative).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      expect.any(String),
      expect.any(String),
      'Hôm nay cứ chạy nhẹ nhàng và thoải mái nhé!',
      'google/gemini-2.0-flash-001',
      'system',
    );
  });
});

describe('CoachingService.getToday — successful BYOK-tier generation', () => {
  it('returns source:"byok" and persists the "byok" tier in the cache write', async () => {
    const { service, saveNarrative } = buildService({
      aiResult: {
        narrative: 'Chạy thoải mái nhé!',
        model: 'claude-haiku-4-5-20251001',
        source: 'byok',
      },
    });
    const result = await service.getToday('user-1');
    expect(result.source).toBe('byok');
    expect(saveNarrative).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
      expect.any(String),
      expect.any(String),
      'Chạy thoải mái nhé!',
      'claude-haiku-4-5-20251001',
      'byok',
    );
  });
});

describe('CoachingService.getToday — always returns a server-recomputed recommendation, never client-influenced', () => {
  it('getToday only accepts a userId — there is no parameter surface for a client-sent recommendation', () => {
    expect(CoachingService.prototype.getToday.length).toBe(1);
  });
});
