import { Injectable, Module } from '@nestjs/common';
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
import { CheckinModule } from './checkin/checkin.module.js';
import { CoachingModule } from './coaching/coaching.module.js';
import { AiModule } from './ai/ai.module.js';

const isStravaEnabled = process.env.FEATURE_STRAVA === 'true';

/**
 * RED TEAM FIX #15: the app runs behind a Cloudflare Tunnel — every request's
 * immediate peer is the same tunnel connector, so the default IP-based
 * `getTracker` (req.ip) collapses ALL users onto one throttle bucket (a
 * whole-app single-bucket DoS / no real per-user limiting). Cloudflare's edge
 * stamps the real client IP on `CF-Connecting-IP` (unspoofable — only
 * Cloudflare can reach the tunnel origin), so prefer that header; fall back to
 * `req.ip` (works once `trust proxy` is set in main.ts) for local/dev traffic
 * that bypasses Cloudflare.
 */
@Injectable()
class CfConnectingIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req.headers as Record<string, unknown> | undefined;
    const cfIp = headers?.['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.length > 0)
      return Promise.resolve(cfIp);

    const ip = typeof req.ip === 'string' ? req.ip : undefined;
    const socket = req.socket as { remoteAddress?: unknown } | undefined;
    const remoteAddress =
      typeof socket?.remoteAddress === 'string'
        ? socket.remoteAddress
        : undefined;
    return Promise.resolve(ip ?? remoteAddress ?? 'unknown');
  }
}

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
        STRAVA_ENCRYPTION_KEY: Joi.alternatives().conditional(
          'FEATURE_STRAVA',
          {
            is: 'true',
            then: Joi.string().hex().length(64).required(),
            otherwise: Joi.string().default(''),
          },
        ),
        // Phase 4/5 — AI Narrative Layer. The per-provider kill-switch/keys/model/quota
        // moved to runtime admin config (`ai.*` AppSetting rows — see
        // AppSettingsService.getAiRuntimeConfig() / PUT /admin/ai/settings) so they can be
        // changed without a redeploy; env vars for them were removed. Module is always
        // registered (endpoint always answers) but never calls a provider unless an admin
        // explicitly enables it or a user configures their own BYOK key.
        // MANDATORY global daily generation cap (RED TEAM FIX #2) — breach falls back to
        // template + logs a warn-level alert; never silently overspends. Still env-sourced
        // (infra-level safety net, not a per-tenant admin setting).
        AI_COACHING_DAILY_BUDGET: Joi.number().integer().min(0).default(2000),
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
    CheckinModule,
    AiModule,
    CoachingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CfConnectingIpThrottlerGuard }],
})
export class AppModule {}
