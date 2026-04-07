import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { GarminModule } from '../garmin/garmin.module.js';

@Module({
  imports: [GarminModule],
  controllers: [AdminController],
  providers: [AdminService, AdminSettingsService],
})
export class AdminModule {}
