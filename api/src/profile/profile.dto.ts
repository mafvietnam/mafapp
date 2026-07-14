import {
  IsInt,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
  IsArray,
  IsEnum,
  ArrayMaxSize,
  Min,
  Max,
} from 'class-validator';

/**
 * Phase 3 — server-side WHITELIST for health-condition screening codes
 * (RED TEAM FIX #9). The whitelist IS the enum: `@IsEnum(HealthCondition, {
 * each: true })` below rejects any code not in this set with a 400 at WRITE
 * time — never "accept unknown + silent-strip-on-read" (that would destroy
 * round-trip and let junk into the column). Extending the whitelist requires
 * adding a member here AND bumping `@ArrayMaxSize` if it grows past 3.
 */
export enum HealthCondition {
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  HYPERTENSION = 'HYPERTENSION',
  JOINT_ISSUES = 'JOINT_ISSUES',
}

export class UpdateProfileDto {
  @IsInt()
  @Min(1)
  @Max(120)
  age!: number;

  @IsNumber()
  @Min(100)
  @Max(250)
  height!: number;

  @IsNumber()
  @Min(30)
  @Max(200)
  weight!: number;

  @IsIn(['NONE', 'INCONSISTENT', 'REGULAR_NEW', 'ADVANCED'])
  experience!: string;

  @IsIn(['HEALTH', 'BASE', 'PERFORMANCE'])
  commitment!: string;

  @IsBoolean()
  isRecovering!: boolean;

  @IsBoolean()
  isMedicatedOrInjured!: boolean;

  @IsBoolean()
  isMedicalClearanceConfirmed!: boolean;

  @IsOptional()
  @IsString()
  previousMonthPace?: string;

  @IsOptional()
  @IsBoolean()
  isProbation?: boolean;

  @IsOptional()
  @IsString()
  probationStartDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  lastLongRunDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(220)
  lastLongRunHeartRate?: number;

  @IsOptional()
  @IsIn(['GOOD', 'TIRED', 'VERY_TIRED'])
  lastLongRunFeeling?: string;

  // --- Phase 3: health-condition screening ---------------------------------

  /**
   * Whitelisted health-condition codes (RED TEAM FIX #9). Absent/omitted =
   * "no conditions" (full-replace PUT semantics, same as every other field on
   * this DTO) — NOT "leave existing value untouched". `@IsEnum({ each: true })`
   * rejects any non-whitelisted element with a 400; `@ArrayMaxSize(3)` bounds
   * the array to the number of known codes.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(HealthCondition, { each: true })
  healthConditions?: HealthCondition[];

  /**
   * Explicit consent intent for THIS write (RED TEAM FIX #11) — `true` stamps
   * `healthConsentAt` (first time only; preserved on repeat `true`). Consent
   * is required before `healthConditions` can be persisted; withdrawing
   * consent (omitted/false) wipes any stored conditions.
   */
  @IsOptional()
  @IsBoolean()
  healthConsent?: boolean;

  /**
   * Medical-clearance intent for THIS write (RED TEAM FIX #10) — `true`
   * stamps an AUDITED `clearedAt`/`clearedBy` pair (first time only,
   * preserved on repeat `true`), not a bare self-attested boolean. Required
   * (together with a non-HEALTH `commitment`) whenever `healthConditions` is
   * non-empty — enforced server-side in profile.service.ts.
   */
  @IsOptional()
  @IsBoolean()
  healthClearanceConfirmed?: boolean;
}
