import { CoachingRepository } from './coaching-repository.js';
import type { PrismaService } from '../shared/prisma.service.js';

function buildRepo(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    userProfile: { findUnique: jest.fn() },
    stravaActivity: { findMany: jest.fn() },
    dailyCheckin: { findMany: jest.fn(), findUnique: jest.fn() },
    ...prismaOverrides,
  } as unknown as PrismaService;
  return { repo: new CoachingRepository(prisma), prisma };
}

const SERVER_TODAY = new Date('2026-07-14T00:00:00.000Z');

describe('CoachingRepository.loadProfile', () => {
  it('returns null when no UserProfile row exists', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(repo.loadProfile('user-1')).resolves.toBeNull();
  });

  it('maps a valid row, deriving hasClearance from clearedAt != null', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
      age: 40,
      height: 175,
      weight: 70,
      experience: 'ADVANCED',
      commitment: 'PERFORMANCE',
      isRecovering: false,
      isMedicatedOrInjured: false,
      isProbation: false,
      healthConditions: ['JOINT_ISSUES'],
      clearedAt: new Date('2026-01-01'),
    });
    const profile = await repo.loadProfile('user-1');
    expect(profile).toMatchObject({
      age: 40,
      experience: 'ADVANCED',
      commitment: 'PERFORMANCE',
      hasClearance: true,
    });
    expect(profile?.healthConditions).toEqual(['JOINT_ISSUES']);
  });

  it('filters out any non-whitelisted healthConditions entries defensively', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
      age: 40,
      height: 175,
      weight: 70,
      experience: 'NONE',
      commitment: 'HEALTH',
      isRecovering: false,
      isMedicatedOrInjured: false,
      isProbation: false,
      healthConditions: ['JOINT_ISSUES', 'SOME_UNKNOWN_LEGACY_VALUE'],
      clearedAt: null,
    });
    const profile = await repo.loadProfile('user-1');
    expect(profile?.healthConditions).toEqual(['JOINT_ISSUES']);
    expect(profile?.hasClearance).toBe(false);
  });

  it('never throws when the read fails — returns null (table/column-absent guard)', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.userProfile.findUnique as jest.Mock).mockRejectedValue(
      new Error('relation does not exist'),
    );
    await expect(repo.loadProfile('user-1')).resolves.toBeNull();
  });
});

describe('CoachingRepository.loadRecentActivities', () => {
  it('maps distance -> distanceMeters and never throws on failure', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.stravaActivity.findMany as jest.Mock).mockResolvedValue([
      { startDate: SERVER_TODAY, distance: 5000 },
    ]);
    const activities = await repo.loadRecentActivities('user-1');
    expect(activities).toEqual([
      { startDate: SERVER_TODAY, distanceMeters: 5000 },
    ]);
  });

  it('returns [] when the query fails', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.stravaActivity.findMany as jest.Mock).mockRejectedValue(
      new Error('db down'),
    );
    await expect(repo.loadRecentActivities('user-1')).resolves.toEqual([]);
  });
});

describe('CoachingRepository.loadRhrHistory', () => {
  it('returns restingHr values, excluding today (date < serverToday)', async () => {
    const { repo, prisma } = buildRepo();
    // mockImplementationOnce with an explicitly-typed param captures the call args without
    // indexing into `.mock.calls` (which stays `any[]` on an untyped jest.fn()).
    let capturedWhere: { date: { lt: Date } } | undefined;
    (prisma.dailyCheckin.findMany as jest.Mock).mockImplementationOnce(
      (args: { where: { date: { lt: Date } } }) => {
        capturedWhere = args.where;
        return Promise.resolve([{ restingHr: 50 }, { restingHr: 52 }]);
      },
    );
    const history = await repo.loadRhrHistory('user-1', SERVER_TODAY);
    expect(history).toEqual([50, 52]);
    expect(capturedWhere?.date.lt).toEqual(SERVER_TODAY);
  });

  it('returns [] when the query fails', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.dailyCheckin.findMany as jest.Mock).mockRejectedValue(
      new Error('db down'),
    );
    await expect(repo.loadRhrHistory('user-1', SERVER_TODAY)).resolves.toEqual(
      [],
    );
  });
});

describe('CoachingRepository.loadTodayCheckin', () => {
  it('returns null when no check-in exists for today', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.dailyCheckin.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      repo.loadTodayCheckin('user-1', SERVER_TODAY),
    ).resolves.toBeNull();
  });

  it('maps the row fields', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.dailyCheckin.findUnique as jest.Mock).mockResolvedValue({
      sleepQuality: 3,
      fatigue: 2,
      soreness: 'calf',
      restingHr: 55,
    });
    const checkin = await repo.loadTodayCheckin('user-1', SERVER_TODAY);
    expect(checkin).toEqual({
      sleepQuality: 3,
      fatigue: 2,
      soreness: 'calf',
      restingHr: 55,
    });
  });

  it('returns null when the query fails', async () => {
    const { repo, prisma } = buildRepo();
    (prisma.dailyCheckin.findUnique as jest.Mock).mockRejectedValue(
      new Error('db down'),
    );
    await expect(
      repo.loadTodayCheckin('user-1', SERVER_TODAY),
    ).resolves.toBeNull();
  });
});
