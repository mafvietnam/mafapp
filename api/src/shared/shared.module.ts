import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { RedisService } from './redis.service.js';
import { GarminEncryptionService } from './garmin-encryption.service.js';
import { AppSettingsService } from './app-settings.service.js';

@Global()
@Module({
  providers: [PrismaService, RedisService, GarminEncryptionService, AppSettingsService],
  exports: [PrismaService, RedisService, GarminEncryptionService, AppSettingsService],
})
export class SharedModule {}
