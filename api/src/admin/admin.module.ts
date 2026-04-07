import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { GarminModule } from '../garmin/garmin.module.js';

const isGarminEnabled = process.env.FEATURE_GARMIN === 'true';

@Module({
  imports: [...(isGarminEnabled ? [GarminModule] : [])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
