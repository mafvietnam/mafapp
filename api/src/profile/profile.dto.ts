import {
  IsInt,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';

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
}
