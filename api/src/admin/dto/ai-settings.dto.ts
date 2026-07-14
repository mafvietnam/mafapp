import {
  IsBoolean,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class AiSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  openRouterKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultModel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  defaultMonthlyQuota?: number;
}
