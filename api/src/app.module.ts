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
        // Required for AES-256-GCM encryption of secrets + Strava OAuth state HMAC signing
        GARMIN_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
        BACKEND_URL: Joi.string().default('http://localhost:3001'),
        FEATURE_STRAVA: Joi.string().default('false'),
        // Strava credentials are optional in env — admin UI DB values take precedence at runtime
        STRAVA_CLIENT_ID: Joi.string().default(''),
        STRAVA_CLIENT_SECRET: Joi.string().default(''),
        STRAVA_WEBHOOK_VERIFY_TOKEN: Joi.string().default(''),
        // Required when FEATURE_STRAVA=true for AES-256-GCM encryption of user tokens at rest
        STRAVA_ENCRYPTION_KEY: Joi.alternatives().conditional('FEATURE_STRAVA', {
          is: 'true',
          then: Joi.string().hex().length(64).required(),
          otherwise: Joi.string().default(''),
        }),
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
