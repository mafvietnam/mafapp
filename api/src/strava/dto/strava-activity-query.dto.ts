import {
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class StravaActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000) // cap OFFSET depth (skip = (page-1)*limit) — bound resource cost from adversarial page values
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365) // date-window queries (journal) may pull up to a year in one call
  limit?: number = 20;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  excludeDuplicates?: boolean;

  /** Half-open date range on startDate: gte since, lt until (ISO 8601). */
  @IsOptional()
  @IsDateString()
  since?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
