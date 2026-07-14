import {
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * Body for POST /checkins. `date` is intentionally OMITTED — RED TEAM FIX #7:
 * the server derives the authoritative Asia/Ho_Chi_Minh calendar date for the
 * unique-key upsert; the client never sends the authoritative date. The global
 * ValidationPipe (main.ts) runs with `forbidNonWhitelisted: true`, so a client
 * that tries to smuggle a `date` field gets a 400 rejection outright, not a
 * silent drop.
 */
export class UpsertCheckinDto {
  @IsInt()
  @Min(1)
  @Max(5)
  sleepQuality: number;

  @IsInt()
  @Min(1)
  @Max(5)
  fatigue: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  soreness?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  restingHr?: number;
}

/** Query for GET /checkins?from&to. `to` defaults to the server ICT "today" (see checkin.service.ts). */
export class CheckinRangeQueryDto {
  @IsDateString()
  from: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
