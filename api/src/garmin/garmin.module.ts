import { Module } from '@nestjs/common';
import { GarminController } from './garmin.controller.js';
import { GarminService } from './garmin.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';
import { GarminSyncService } from './garmin-sync.service.js';
import { GarminCronService } from './garmin-cron.service.js';

@Module({
  controllers: [GarminController],
  providers: [
    GarminService,
    GarminEncryptionService,
    GarminSyncService,
    GarminCronService,
  ],
  exports: [GarminService],
})
export class GarminModule {}
