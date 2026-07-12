import { Module } from '@nestjs/common';
import { StravaController } from './strava.controller.js';
import { StravaWebhookController } from './strava-webhook.controller.js';
import { StravaService } from './strava.service.js';
import { StravaAuthService } from './strava-auth.service.js';
import { StravaTokenService } from './strava-token.service.js';
import { StravaEncryptionService } from './strava-encryption.service.js';
import { StravaSyncService } from './strava-sync.service.js';
import { StravaCronService } from './strava-cron.service.js';
import { StravaWebhookService } from './strava-webhook.service.js';

@Module({
  controllers: [StravaController, StravaWebhookController],
  providers: [
    StravaService,
    StravaAuthService,
    StravaTokenService,
    StravaEncryptionService,
    StravaSyncService,
    StravaCronService,
    StravaWebhookService,
  ],
  exports: [
    StravaService,
    StravaTokenService,
    StravaSyncService,
    StravaWebhookService,
  ],
})
export class StravaModule {}
