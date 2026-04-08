import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  Param,
  UseGuards,
  Res,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { StravaService } from './strava.service.js';
import { StravaAuthService } from './strava-auth.service.js';
import { StravaSyncService } from './strava-sync.service.js';
import { StravaWebhookService, type StravaWebhookEvent } from './strava-webhook.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { StravaActivityQueryDto } from './dto/strava-activity-query.dto.js';

@Controller('strava')
export class StravaController {
  private readonly logger = new Logger(StravaController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly stravaService: StravaService,
    private readonly authService: StravaAuthService,
    private readonly syncService: StravaSyncService,
    private readonly webhookService: StravaWebhookService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  }

  /**
   * Strava webhook challenge validation (GET) — called once during subscription setup.
   * Public — no JWT guard. Strava sends: hub.mode, hub.verify_token, hub.challenge.
   */
  @Get('webhook')
  handleWebhookChallenge(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (!this.webhookService.isValidVerifyToken(verifyToken) || mode !== 'subscribe') {
      throw new BadRequestException('Invalid webhook verification');
    }
    return { 'hub.challenge': challenge };
  }

  /**
   * Strava webhook event push (POST) — called on each new activity, update, or delete.
   * Public — no JWT guard. Must respond 200 within 2s; processing is async.
   */
  @Post('webhook')
  @HttpCode(200)
  handleWebhookEvent(@Body() event: StravaWebhookEvent) {
    // Respond immediately, process asynchronously
    setImmediate(() => {
      this.webhookService.processEvent(event).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown';
        this.logger.error(`Webhook event processing error: ${msg}`);
      });
    });
    return { ok: true };
  }

  /** Return Strava OAuth authorization URL — frontend navigates to it */
  @Get('connect')
  @UseGuards(JwtAuthGuard)
  getConnectUrl(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const authUrl = this.authService.getAuthorizationUrl(userId);
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
      const userId = this.authService.verifyState(state);
      const tokens = await this.authService.exchangeCodeForTokens(code);
      await this.stravaService.saveTokensFromCallback(userId, tokens);
      this.logger.log(`Strava connected for user ${userId}`);
      return res.redirect(`${profileUrl}?strava_connected=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Strava callback failed: ${msg}`);
      return res.redirect(`${profileUrl}?strava_error=1`);
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
  async getActivities(@Req() req: Request, @Query() query: StravaActivityQueryDto) {
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
