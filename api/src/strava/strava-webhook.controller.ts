import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Logger,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import {
  StravaWebhookService,
  type StravaWebhookEvent,
} from './strava-webhook.service.js';

/**
 * Strava webhook endpoints — split out from StravaController to keep both files under the
 * 200-LOC guideline. Public routes (no JWT guard); Strava calls these directly.
 */
@Controller('strava')
export class StravaWebhookController {
  private readonly logger = new Logger(StravaWebhookController.name);

  constructor(private readonly webhookService: StravaWebhookService) {}

  /**
   * Strava webhook challenge validation (GET) — called once during subscription setup.
   * Public — no JWT guard. Strava sends: hub.mode, hub.verify_token, hub.challenge.
   */
  @Get('webhook')
  async handleWebhookChallenge(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    // Log every challenge hit — helps diagnose subscription-registration failures
    // (e.g. whether Strava's validator actually reaches this origin through the CDN).
    this.logger.log(`Webhook challenge GET received (mode=${mode})`);
    const valid = await this.webhookService.isValidVerifyToken(verifyToken);
    if (!valid || mode !== 'subscribe') {
      this.logger.warn('Webhook challenge rejected — invalid token or mode');
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
}
