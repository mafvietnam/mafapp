import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GarminSyncService } from './garmin-sync.service.js';

@Injectable()
export class GarminCronService {
  private readonly logger = new Logger(GarminCronService.name);

  constructor(private readonly syncService: GarminSyncService) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleSync() {
    this.logger.log('Starting scheduled Garmin sync...');
    const start = Date.now();
    await this.syncService.syncAllUsers();
    this.logger.log(`Scheduled sync complete in ${Date.now() - start}ms`);
  }
}
