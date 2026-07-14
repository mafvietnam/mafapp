import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { CheckinService } from './checkin.service.js';
import { UpsertCheckinDto, CheckinRangeQueryDto } from './checkin.dto.js';

/** Shape of req.user after JWT strategy validate() */
interface JwtUser {
  id: string;
  email: string;
  role: string;
}

@Controller('checkins')
@UseGuards(JwtAuthGuard)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  /**
   * RED TEAM FIX #7: the server derives the ICT date server-side — this DTO
   * carries no client date field, so there is nothing to trust/ignore.
   * RED TEAM FIX #15: throttled per real client IP (see app.module.ts
   * CfConnectingIpThrottlerGuard) — a low daily-use endpoint doesn't need a
   * generous limit.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async upsert(@Req() req: Request, @Body() dto: UpsertCheckinDto) {
    const userId = (req.user as JwtUser).id;
    return this.checkinService.upsert(userId, dto);
  }

  @Get()
  async list(@Req() req: Request, @Query() query: CheckinRangeQueryDto) {
    const userId = (req.user as JwtUser).id;
    return this.checkinService.list(userId, query.from, query.to);
  }
}
