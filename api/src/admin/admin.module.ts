import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { GarminModule } from '../garmin/garmin.module.js';
import { StravaModule } from '../strava/strava.module.js';

// AdminSettingsService (alias: AppSettingsService) is globally provided by SharedModule.
// No need to re-declare it here.
@Module({
  imports: [GarminModule, StravaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
