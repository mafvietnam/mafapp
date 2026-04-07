import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  type?: string;
}

export class DailySummaryQueryDto {
  @IsDateString()
  from: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
