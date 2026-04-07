import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import Joi from 'joi';
import { SharedModule } from './shared/shared.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { AdminModule } from './admin/admin.module.js';
import { StravaModule } from './strava/strava.module.js';

const isStravaEnabled = process.env.FEATURE_STRAVA === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        JWT_PRIVATE_KEY: Joi.string().required(),
        JWT_PUBLIC_KEY: Joi.string().required(),
        WP_OAUTH_URL: Joi.string().default('https://maf.run'),
        GOOGLE_CLIENT_ID: Joi.string().default(''),
        GOOGLE_CLIENT_SECRET: Joi.string().default(''),
        CORS_ORIGIN: Joi.string().default('https://app.maf.run'),
        PORT: Joi.number().default(3001),
        GARMIN_ENCRYPTION_KEY: Joi.string().default(''),
        BACKEND_URL: Joi.string().default('http://localhost:3001'),
        FEATURE_STRAVA: Joi.string().default('false'),
        STRAVA_ENCRYPTION_KEY: isStravaEnabled
          ? Joi.string().hex().length(64).required()
          : Joi.string().default(''),
        STRAVA_CLIENT_ID: isStravaEnabled
          ? Joi.string().required()
          : Joi.string().default(''),
        STRAVA_CLIENT_SECRET: isStravaEnabled
          ? Joi.string().required()
          : Joi.string().default(''),
        STRAVA_WEBHOOK_VERIFY_TOKEN: isStravaEnabled
          ? Joi.string().required()
          : Joi.string().default(''),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    SharedModule,
    HealthModule,
    AuthModule,
    UserModule,
    ProfileModule,
    AdminModule,
    ...(isStravaEnabled ? [StravaModule] : []),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
