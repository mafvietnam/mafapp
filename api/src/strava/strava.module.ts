import { Module } from '@nestjs/common';
import { StravaController } from './strava.controller.js';
import { StravaWebhookController } from './strava-webhook.controller.js';
import { StravaUploadController } from './strava-upload.controller.js';
import { StravaService } from './strava.service.js';
import { StravaUploadService } from './strava-upload.service.js';
import { StravaAuthService } from './strava-auth.service.js';
import { StravaTokenService } from './strava-token.service.js';
import { StravaEncryptionService } from './strava-encryption.service.js';
import { StravaSyncService } from './strava-sync.service.js';
import { StravaCronService } from './strava-cron.service.js';
import { StravaWebhookService } from './strava-webhook.service.js';
import { StravaDetailService } from './strava-detail.service.js';

@Module({
  controllers: [StravaController, StravaWebhookController, StravaUploadController],
  providers: [
    StravaService,
    StravaUploadService,
    StravaAuthService,
    StravaTokenService,
    StravaEncryptionService,
    StravaSyncService,
    StravaCronService,
    StravaWebhookService,
    StravaDetailService,
  ],
  exports: [
    StravaService,
    StravaTokenService,
    StravaSyncService,
    StravaWebhookService,
  ],
})
export class StravaModule {}
