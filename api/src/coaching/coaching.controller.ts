import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { CoachingService } from './coaching.service.js';
import type { CoachingTodayResponse } from './coaching-response.dto.js';

/** Shape of req.user after JWT strategy validate() */
interface JwtUser {
  id: string;
  email: string;
  role: string;
}

@Controller('coaching')
@UseGuards(JwtAuthGuard)
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  /**
   * RED TEAM FIX #1: no request body/params carrying recommendation data — the server
   * recomputes everything from the authenticated user's own server-owned data.
   * RED TEAM FIX #15: throttled per real client IP (see app.module.ts
   * CfConnectingIpThrottlerGuard); generous limit since this is a read-mostly,
   * cache-hit-heavy endpoint (cache/budget gate the actually-expensive path).
   */
  @Get('today')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getToday(@Req() req: Request): Promise<CoachingTodayResponse> {
    const userId = (req.user as JwtUser).id;
    return this.coachingService.getToday(userId);
  }
}
