import { BadRequestException, Logger } from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import type { PrismaService } from '../shared/prisma.service.js';
import type { UpdateProfileDto } from './profile.dto.js';
import { HealthCondition } from './profile.dto.js';

/**
 * Phase 3 red-team fixes covered here:
 * - FIX #9: unknown health-condition codes are a DTO-validation concern
 *   (class-validator @IsEnum) — service-level tests assume the DTO already
 *   validated, and instead assert lossless round-trip of whitelisted codes.
 * - FIX #10: server-enforced commitment gate (flagged + !clearance => reject
 *   elevated commitment); audited clearedAt/clearedBy (not a bare boolean).
 * - FIX #11: consent gate (no consent, no store); erasure on consent
 *   withdrawal; error logs never contain profile content.
 */
describe('ProfileService', () => {
  function baseDto(
    overrides: Partial<UpdateProfileDto> = {},
  ): UpdateProfileDto {
    return {
      age: 30,
      height: 170,
      weight: 65,
      experience: 'REGULAR_NEW',
      commitment: 'BASE',
      isRecovering: false,
      isMedicatedOrInjured: false,
      isMedicalClearanceConfirmed: false,
      ...overrides,
    };
  }

  function buildService(
    overrides: {
      findUnique?: jest.Mock;
      upsert?: jest.Mock;
    } = {},
  ) {
    const prisma = {
      userProfile: {
        findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
        upsert: overrides.upsert ?? jest.fn().mockResolvedValue({ id: 'p1' }),
      },
    } as unknown as PrismaService;
    return { service: new ProfileService(prisma), prisma };
  }

  /** Typed extraction of the `data` shape profile.service.ts writes — avoids
   *  `any` propagation from jest.fn()'s untyped mock.calls (no-unsafe-*). */
  interface UpsertCreateArgs {
    create: {
      healthConditions: string[];
      healthConsentAt: Date | null;
      clearedAt: Date | null;
      clearedBy: string | null;
    };
  }

  function upsertCreateArgs(upsert: jest.Mock): UpsertCreateArgs['create'] {
    // Cast the whole mock reference up front (not the chained member access) so
    // every subsequent `.mock.calls[0][0]` step resolves against a known type —
    // avoids @typescript-eslint/no-unsafe-member-access on jest.Mock's untyped `any[]`.
    const typedMock = upsert as unknown as {
      mock: { calls: [UpsertCreateArgs][] };
    };
    return typedMock.mock.calls[0][0].create;
  }

  describe('getProfile — table/column-absent guard (FIX #8)', () => {
    it('soft-fails to null when the query throws', async () => {
      const findUnique = jest
        .fn()
        .mockRejectedValue(
          new Error('column "healthConditions" does not exist'),
        );
      const { service } = buildService({ findUnique });
      const result = await service.getProfile('user-1');
      expect(result).toBeNull();
    });

    it('never logs profile content on failure — only userId + message (FIX #11)', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const findUnique = jest.fn().mockRejectedValue(new Error('boom'));
      const { service } = buildService({ findUnique });
      await service.getProfile('user-1');
      const loggedArgs = errorSpy.mock.calls.map((c) => String(c[0]));
      expect(
        loggedArgs.some((m) => m.includes('user-1') && m.includes('boom')),
      ).toBe(true);
      expect(loggedArgs.some((m) => m.includes('CARDIOVASCULAR'))).toBe(false);
      errorSpy.mockRestore();
    });
  });

  describe('consent gate (FIX #11)', () => {
    it('rejects healthConditions without healthConsent=true', async () => {
      const { service } = buildService();
      await expect(
        service.upsertProfile(
          'user-1',
          baseDto({ healthConditions: [HealthCondition.JOINT_ISSUES] }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts healthConditions with healthConsent=true and stamps healthConsentAt', async () => {
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ upsert });
      await service.upsertProfile(
        'user-1',
        baseDto({
          commitment: 'HEALTH',
          healthConditions: [HealthCondition.JOINT_ISSUES],
          healthConsent: true,
        }),
      );
      const create = upsertCreateArgs(upsert);
      expect(create.healthConditions).toEqual([HealthCondition.JOINT_ISSUES]);
      expect(create.healthConsentAt).toBeInstanceOf(Date);
    });

    it('withdrawing consent (omitted) wipes previously-stored conditions — erasure', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        healthConsentAt: new Date('2026-01-01'),
        clearedAt: null,
        clearedBy: null,
        healthScreenedAt: new Date('2026-01-01'),
      });
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ findUnique, upsert });
      await service.upsertProfile('user-1', baseDto({ healthConditions: [] }));
      const create = upsertCreateArgs(upsert);
      expect(create.healthConditions).toEqual([]);
      expect(create.healthConsentAt).toBeNull();
    });

    it('healthConsentAt is preserved (not advanced) across repeat consent=true writes', async () => {
      const firstConsentAt = new Date('2026-01-01T00:00:00.000Z');
      const findUnique = jest.fn().mockResolvedValue({
        healthConditions: [HealthCondition.JOINT_ISSUES],
        healthConsentAt: firstConsentAt,
        clearedAt: null,
        clearedBy: null,
        healthScreenedAt: firstConsentAt,
      });
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ findUnique, upsert });
      await service.upsertProfile(
        'user-1',
        baseDto({
          commitment: 'HEALTH',
          healthConditions: [HealthCondition.JOINT_ISSUES],
          healthConsent: true,
        }),
      );
      const create = upsertCreateArgs(upsert);
      expect(create.healthConsentAt).toBe(firstConsentAt);
    });
  });

  describe('server-enforced clearance/commitment gate (FIX #10)', () => {
    it('rejects BASE commitment when flagged + not cleared', async () => {
      const { service } = buildService();
      await expect(
        service.upsertProfile(
          'user-1',
          baseDto({
            commitment: 'BASE',
            healthConditions: [HealthCondition.CARDIOVASCULAR],
            healthConsent: true,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects PERFORMANCE commitment when flagged + not cleared', async () => {
      const { service } = buildService();
      await expect(
        service.upsertProfile(
          'user-1',
          baseDto({
            commitment: 'PERFORMANCE',
            healthConditions: [HealthCondition.HYPERTENSION],
            healthConsent: true,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows HEALTH commitment when flagged + not cleared (gate only blocks ELEVATED commitment)', async () => {
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ upsert });
      const result = await service.upsertProfile(
        'user-1',
        baseDto({
          commitment: 'HEALTH',
          healthConditions: [HealthCondition.CARDIOVASCULAR],
          healthConsent: true,
        }),
      );
      expect(result).toEqual({ id: 'p1' });
    });

    it('allows BASE commitment when flagged + healthClearanceConfirmed=true, and records clearedAt/clearedBy audit', async () => {
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ upsert });
      await service.upsertProfile(
        'user-1',
        baseDto({
          commitment: 'BASE',
          healthConditions: [HealthCondition.CARDIOVASCULAR],
          healthConsent: true,
          healthClearanceConfirmed: true,
        }),
      );
      const create = upsertCreateArgs(upsert);
      expect(create.clearedAt).toBeInstanceOf(Date);
      expect(create.clearedBy).toBe('self-attested');
    });

    it('clearedAt is preserved (not advanced) across repeat clearance=true writes', async () => {
      const firstClearedAt = new Date('2026-01-01T00:00:00.000Z');
      const findUnique = jest.fn().mockResolvedValue({
        healthConditions: [HealthCondition.CARDIOVASCULAR],
        healthConsentAt: firstClearedAt,
        clearedAt: firstClearedAt,
        clearedBy: 'self-attested',
        healthScreenedAt: firstClearedAt,
      });
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ findUnique, upsert });
      await service.upsertProfile(
        'user-1',
        baseDto({
          commitment: 'BASE',
          healthConditions: [HealthCondition.CARDIOVASCULAR],
          healthConsent: true,
          healthClearanceConfirmed: true,
        }),
      );
      const create = upsertCreateArgs(upsert);
      expect(create.clearedAt).toBe(firstClearedAt);
    });

    it('un-checking clearance clears clearedAt/clearedBy back to null', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        healthConditions: [],
        healthConsentAt: null,
        clearedAt: new Date('2026-01-01'),
        clearedBy: 'self-attested',
        healthScreenedAt: null,
      });
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ findUnique, upsert });
      await service.upsertProfile('user-1', baseDto({ commitment: 'HEALTH' }));
      const create = upsertCreateArgs(upsert);
      expect(create.clearedAt).toBeNull();
      expect(create.clearedBy).toBeNull();
    });

    it('no health conditions => gate never blocks any commitment level', async () => {
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ upsert });
      await expect(
        service.upsertProfile('user-1', baseDto({ commitment: 'PERFORMANCE' })),
      ).resolves.toBeDefined();
    });
  });

  describe('lossless round-trip (FIX #9)', () => {
    it('persists exactly the whitelisted codes sent, in order, no stripping', async () => {
      const upsert = jest.fn().mockResolvedValue({ id: 'p1' });
      const { service } = buildService({ upsert });
      const conditions = [
        HealthCondition.CARDIOVASCULAR,
        HealthCondition.JOINT_ISSUES,
      ];
      await service.upsertProfile(
        'user-1',
        baseDto({
          commitment: 'HEALTH',
          healthConditions: conditions,
          healthConsent: true,
        }),
      );
      const create = upsertCreateArgs(upsert);
      expect(create.healthConditions).toEqual(conditions);
    });
  });

  describe('write failure never leaks profile content into logs (FIX #11)', () => {
    it('re-throws and logs only userId + message on a DB error', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const upsert = jest.fn().mockRejectedValue(new Error('db down'));
      const { service } = buildService({ upsert });
      await expect(
        service.upsertProfile('user-1', baseDto({ commitment: 'HEALTH' })),
      ).rejects.toThrow('db down');
      const loggedArgs = errorSpy.mock.calls.map((c) => String(c[0]));
      expect(
        loggedArgs.some((m) => m.includes('user-1') && m.includes('db down')),
      ).toBe(true);
      errorSpy.mockRestore();
    });
  });
});
