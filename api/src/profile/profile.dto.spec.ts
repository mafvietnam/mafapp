import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto, HealthCondition } from './profile.dto.js';

/**
 * Phase 3 — RED TEAM FIX #9: proves the WHITELIST is enforced at the DTO
 * layer exactly as the global ValidationPipe (main.ts, `whitelist: true,
 * forbidNonWhitelisted: true`) would run it — unknown healthConditions codes
 * must be rejected (400 downstream), never silently stripped. Mirrors
 * strava-activity-query.dto.spec.ts's `validate()` pattern.
 */
async function validateDto(raw: Record<string, unknown>) {
  const dto = plainToInstance(UpdateProfileDto, raw, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  const props = errors.map((e) => e.property);
  return { dto, errors, props };
}

const baseProfile = {
  age: 30,
  height: 170,
  weight: 65,
  experience: 'REGULAR_NEW',
  commitment: 'HEALTH',
  isRecovering: false,
  isMedicatedOrInjured: false,
  isMedicalClearanceConfirmed: false,
};

describe('UpdateProfileDto — healthConditions whitelist (RED TEAM FIX #9)', () => {
  it('omitted healthConditions is valid (optional)', async () => {
    const { errors } = await validateDto(baseProfile);
    expect(errors).toHaveLength(0);
  });

  it('empty array is valid', async () => {
    const { errors } = await validateDto({
      ...baseProfile,
      healthConditions: [],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts each whitelisted code individually', async () => {
    for (const code of Object.values(HealthCondition)) {
      const { errors } = await validateDto({
        ...baseProfile,
        healthConditions: [code],
      });
      expect(errors).toHaveLength(0);
    }
  });

  it('accepts all 3 whitelisted codes together', async () => {
    const { errors } = await validateDto({
      ...baseProfile,
      healthConditions: [
        HealthCondition.CARDIOVASCULAR,
        HealthCondition.HYPERTENSION,
        HealthCondition.JOINT_ISSUES,
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown code — 400 at write, not silently stripped', async () => {
    const { props, dto } = await validateDto({
      ...baseProfile,
      healthConditions: ['DIABETES'],
    });
    expect(props).toContain('healthConditions');
    // Round-trip proof: the invalid value is preserved on the DTO instance (not
    // stripped) — the ValidationPipe rejects the WHOLE request (400) rather
    // than silently dropping the bad element and persisting a partial write.
    expect(dto.healthConditions).toEqual(['DIABETES']);
  });

  it('rejects a mix of valid + unknown codes', async () => {
    const { props } = await validateDto({
      ...baseProfile,
      healthConditions: [HealthCondition.CARDIOVASCULAR, 'NOT_A_REAL_CODE'],
    });
    expect(props).toContain('healthConditions');
  });

  it('rejects a non-array value', async () => {
    const { props } = await validateDto({
      ...baseProfile,
      healthConditions: 'CARDIOVASCULAR',
    });
    expect(props).toContain('healthConditions');
  });

  it('rejects an array larger than the known-code bound (ArrayMaxSize 3)', async () => {
    const { props } = await validateDto({
      ...baseProfile,
      healthConditions: [
        HealthCondition.CARDIOVASCULAR,
        HealthCondition.HYPERTENSION,
        HealthCondition.JOINT_ISSUES,
        HealthCondition.CARDIOVASCULAR,
      ],
    });
    expect(props).toContain('healthConditions');
  });
});

describe('UpdateProfileDto — consent/clearance intent flags', () => {
  it('healthConsent and healthClearanceConfirmed are optional booleans', async () => {
    const { errors } = await validateDto({
      ...baseProfile,
      healthConsent: true,
      healthClearanceConfirmed: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('omitted consent/clearance flags are valid (optional — treated as false by profile.service.ts)', async () => {
    const { errors } = await validateDto(baseProfile);
    expect(errors).toHaveLength(0);
  });
});
