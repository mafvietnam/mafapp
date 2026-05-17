import { Module } from '@nestjs/common';
import { GarminController } from './garmin.controller.js';
import { GarminService } from './garmin.service.js';
import { GarminSyncService } from './garmin-sync.service.js';
import { GarminCronService } from './garmin-cron.service.js';

const isGarminEnabled = process.env.FEATURE_GARMIN === 'true';

// GarminEncryptionService moved to SharedModule (api/src/shared/garmin-encryption.service.ts)
// It is globally available via SharedModule — no need to re-provide here.
@Module({
  // Only register user-facing controller + cron when feature is enabled
  controllers: isGarminEnabled ? [GarminController] : [],
  providers: [
    ...(isGarminEnabled
      ? [GarminService, GarminSyncService, GarminCronService]
      : []),
  ],
  exports: [
    ...(isGarminEnabled ? [GarminService, GarminSyncService] : []),
  ],
})
export class GarminModule {}
