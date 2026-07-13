import {
  Controller,
  Get,
  Post,
  Req,
  Query,
  Param,
  UseGuards,
  Res,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { StravaService } from './strava.service.js';
import { StravaAuthService } from './strava-auth.service.js';
import { StravaSyncService } from './strava-sync.service.js';
import { StravaDetailService } from './strava-detail.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { StravaActivityQueryDto } from './dto/strava-activity-query.dto.js';
import { mapStravaCallbackError } from './strava-callback-error.util.js';

/** Webhook GET/POST endpoints live in StravaWebhookController (kept separate to stay under 200 LOC). */
@Controller('strava')
export class StravaController {
  private readonly logger = new Logger(StravaController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly stravaService: StravaService,
    private readonly authService: StravaAuthService,
    private readonly syncService: StravaSyncService,
    private readonly detailService: StravaDetailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>(
      'CORS_ORIGIN',
      'http://localhost:5173',
    );
  }

  /** Strava OAuth authorization URL — 409 for genuinely new connections once the slot cap is reached (H6); reconnects exempt */
  @Get('connect')
  @UseGuards(JwtAuthGuard)
  async getConnectUrl(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    if (await this.stravaService.isNewConnectionBlocked(userId)) {
      throw new ConflictException(
        'Đã đạt giới hạn số người dùng Strava (hết slot). Vui lòng thử lại sau.',
      );
    }
    const authUrl = await this.authService.getAuthorizationUrl(userId);
    return { authUrl };
  }

  /**
   * Strava OAuth callback — no auth guard; userId recovered from signed state.
   * On success: redirects to frontend profile page.
   * On error: redirects to frontend with ?strava_error=1.
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const profileUrl = `${this.frontendUrl}/profile`;

    // User denied access on Strava side
    if (error) {
      this.logger.warn(`Strava OAuth denied: ${error}`);
      return res.redirect(`${profileUrl}?strava_error=denied`);
    }

    if (!code || !state) {
      return res.redirect(`${profileUrl}?strava_error=invalid`);
    }

    try {
      const userId = await this.authService.verifyState(state);

      // Race guard (H6d): another new user may have filled the last slot between
      // the frontend's /connect check and this callback. Reconnects are exempt.
      if (await this.stravaService.isNewConnectionBlocked(userId)) {
        this.logger.warn(
          `Strava slot cap reached during callback for user ${userId}`,
        );
        return res.redirect(`${profileUrl}?strava_error=full`);
      }

      const tokens = await this.authService.exchangeCodeForTokens(code);
      await this.stravaService.saveTokensFromCallback(userId, tokens);
      this.logger.log(`Strava connected for user ${userId}`);
      return res.redirect(`${profileUrl}?strava_connected=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Strava callback failed: ${msg}`);
      return res.redirect(
        `${profileUrl}?strava_error=${mapStravaCallbackError(msg)}`,
      );
    }
  }

  /** Connection status — never returns tokens */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    return this.stravaService.getStatus(userId);
  }

  /** Disconnect Strava — deletes connection + all activities */
  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async disconnect(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;

    const conn = await this.stravaService.findConnection(userId);
    if (!conn) throw new BadRequestException('No Strava connection found');

    // Verify user owns this connection (redundant but explicit)
    if (conn.userId !== userId) throw new UnauthorizedException();

    await this.stravaService.disconnect(userId);
    return { disconnected: true };
  }

  /** Paginated list of the user's synced running activities */
  @Get('activities')
  @UseGuards(JwtAuthGuard)
  async getActivities(
    @Req() req: Request,
    @Query() query: StravaActivityQueryDto,
  ) {
    const userId = (req.user as { id: string }).id;
    return this.stravaService.getActivities(userId, query);
  }

  /** Single activity by internal ID */
  @Get('activities/:id')
  @UseGuards(JwtAuthGuard)
  async getActivity(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { id: string }).id;
    const activity = await this.stravaService.getActivity(userId, id);
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  /** Activity detail + streams — lazily hydrated from Strava, cached thereafter. Private, never edge-cached. */
  @Get('activities/:id/detail')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getActivityDetail(
    @Req() req: Request,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'private, no-store');
    const userId = (req.user as { id: string }).id;
    const activity = await this.stravaService.getActivity(userId, id);
    if (!activity) throw new NotFoundException('Activity not found');
    return this.detailService.getDetail(userId, activity);
  }

  /** Trigger manual activity sync (async — returns 202 immediately) */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 1, ttl: 300000 } })
  async triggerSync(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;

    const conn = await this.stravaService.findConnection(userId);
    if (!conn) throw new BadRequestException('No Strava connection found');

    // Fire async — sync engine implemented in Phase 3
    this.syncService.syncUser(userId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.error(`Manual sync failed for user ${userId}: ${msg}`);
    });

    return { ok: true, message: 'Sync started' };
  }
}
