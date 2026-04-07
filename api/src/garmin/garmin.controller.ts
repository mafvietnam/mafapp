import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { GarminService } from './garmin.service.js';
import { GarminSyncService } from './garmin-sync.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { ConnectGarminDto } from './garmin-connect.dto.js';
import {
  ListActivitiesDto,
  DailySummaryQueryDto,
} from './garmin-activity.dto.js';
/** Shape of req.user after JWT strategy validate() */
interface JwtUser { id: string; email: string; role: string }

@Controller('garmin')
@UseGuards(JwtAuthGuard)
export class GarminController {
  constructor(
    private readonly garminService: GarminService,
    private readonly syncService: GarminSyncService,
  ) {}

  @Post('connect')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async connect(@Req() req: Request, @Body() dto: ConnectGarminDto) {
    const userId = (req.user as JwtUser).id;
    const result = await this.garminService.connect(
      userId,
      dto.email,
      dto.password,
    );
    // Fire async backfill (don't await — return connected immediately)
    this.syncService.syncUser(userId).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Unknown';
      console.error(`Backfill failed for user ${userId}: ${msg}`);
    });
    return result;
  }

  @Post('disconnect')
  async disconnect(@Req() req: Request) {
    const userId = (req.user as JwtUser).id;
    return this.garminService.disconnect(userId);
  }

  @Get('status')
  async getStatus(@Req() req: Request) {
    const userId = (req.user as JwtUser).id;
    return this.garminService.getStatus(userId);
  }

  @Post('sync')
  @Throttle({ default: { limit: 1, ttl: 300000 } })
  async sync(@Req() req: Request) {
    const userId = (req.user as JwtUser).id;
    await this.syncService.syncUser(userId);
    return { ok: true };
  }

  @Get('activities')
  async getActivities(@Req() req: Request, @Query() query: ListActivitiesDto) {
    const userId = (req.user as JwtUser).id;
    return this.garminService.getActivities(
      userId,
      query.page ?? 1,
      query.limit ?? 20,
      query.type,
    );
  }

  @Get('activities/:id')
  async getActivity(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as JwtUser).id;
    const activity = await this.garminService.getActivity(userId, id);
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  @Get('daily-summary')
  async getDailySummary(
    @Req() req: Request,
    @Query() query: DailySummaryQueryDto,
  ) {
    const userId = (req.user as JwtUser).id;
    const to = query.to ?? new Date().toISOString().split('T')[0];
    return this.garminService.getDailySummaries(userId, query.from, to);
  }
}
