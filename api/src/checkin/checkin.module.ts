import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller.js';
import { CheckinService } from './checkin.service.js';

/** Check-in is core (unlike Garmin/Strava) — registered unconditionally, no feature flag. */
@Module({
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
