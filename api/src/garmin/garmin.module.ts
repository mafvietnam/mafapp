import { Module } from '@nestjs/common';
import { GarminController } from './garmin.controller.js';
import { GarminService } from './garmin.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';
import { GarminSyncService } from './garmin-sync.service.js';
import { GarminCronService } from './garmin-cron.service.js';

const isGarminEnabled = process.env.FEATURE_GARMIN === 'true';

@Module({
  // Only register user-facing controller + cron when feature is enabled
  controllers: isGarminEnabled ? [GarminController] : [],
  providers: [
    GarminEncryptionService,
    // Sync + cron only when enabled
    ...(isGarminEnabled
      ? [GarminService, GarminSyncService, GarminCronService]
      : []),
  ],
  exports: [GarminEncryptionService, ...(isGarminEnabled ? [GarminService, GarminSyncService] : [])],
})
export class GarminModule {}
