import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { PrismaService } from '../shared/prisma.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { StravaTokenService } from './strava-token.service.js';
import { StravaSyncService } from './strava-sync.service.js';

export interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number; // activity ID
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number; // Strava athlete ID
  subscription_id: number;
  event_time: number; // Unix timestamp
  updates?: Record<string, string>;
}

const STRAVA_API_HOST = 'www.strava.com';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

@Injectable()
export class StravaWebhookService implements OnModuleInit {
  private readonly logger = new Logger(StravaWebhookService.name);

  // Boot-time env values — used only for onModuleInit subscription registration
  private readonly verifyTokenEnv: string;
  private readonly clientIdEnv: string;
  private readonly clientSecretEnv: string;
  private readonly backendUrl: string;
  private readonly isEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettings: AppSettingsService,
    private readonly tokenService: StravaTokenService,
    private readonly syncService: StravaSyncService,
    config: ConfigService,
  ) {
    // Boot-time values — used in onModuleInit only; runtime calls use getStravaRuntimeConfig()
    this.verifyTokenEnv = config.get<string>('STRAVA_WEBHOOK_VERIFY_TOKEN', '');
    this.clientIdEnv = config.get<string>('STRAVA_CLIENT_ID', '');
    this.clientSecretEnv = config.get<string>('STRAVA_CLIENT_SECRET', '');
    this.backendUrl = config.get<string>(
      'BACKEND_URL',
      'http://localhost:3001',
    );
    this.isEnabled = config.get<string>('FEATURE_STRAVA', 'false') === 'true';
  }

  async onModuleInit() {
    if (!this.isEnabled) return;
    if (!this.verifyTokenEnv || !this.clientIdEnv || !this.clientSecretEnv) {
      this.logger.warn(
        'Strava webhook env vars missing — skipping subscription registration at boot',
      );
      return;
    }
    try {
      await this.registerWebhookSubscription();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Non-fatal — app starts regardless; Strava may not be reachable in local dev
      this.logger.warn(`Webhook subscription registration skipped: ${msg}`);
    }
  }

  /**
   * Validate Strava webhook challenge GET request.
   * Reads token lazily from DB (with env fallback) — supports DB-backed token rotation.
   */
  async isValidVerifyToken(token: string): Promise<boolean> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    return token === cfg.webhookVerifyToken;
  }

  /**
   * Re-subscribe webhook with current DB-backed credentials.
   * Called by AdminService.saveStravaSettings when token or credentials change.
   */
  async refreshSubscription(): Promise<void> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    const callbackUrl = `${this.backendUrl}/strava/webhook`;

    const existing = await this.getExistingSubscription(
      cfg.clientId,
      cfg.clientSecret,
    );
    if (existing) {
      this.logger.log(
        `Deleting existing webhook subscription ${existing.id} before refresh`,
      );
      await this.deleteSubscription(
        existing.id,
        cfg.clientId,
        cfg.clientSecret,
      );
    }

    const id = await this.createSubscription(
      callbackUrl,
      cfg.clientId,
      cfg.clientSecret,
      cfg.webhookVerifyToken,
    );
    await this.persistSubscriptionId(id);
    this.logger.log('Webhook subscription refreshed successfully');
  }

  /**
   * Process a webhook event asynchronously.
   * Controller must call this via setImmediate — never await in the request handler.
   */
  async processEvent(event: StravaWebhookEvent): Promise<void> {
    // Athlete revoked app access on Strava's side — free the local slot (H6c).
    // This is a destructive, unauthenticated-webhook path — gated by subscription_id (see below).
    if (
      event.object_type === 'athlete' &&
      event.updates?.authorized === 'false'
    ) {
      await this.handleAthleteDeauthIfTrusted(event);
      return;
    }

    // MVP: only handle new activity creates
    if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
      return;
    }

    const conn = await this.prisma.stravaConnection.findFirst({
      where: { stravaAthleteId: String(event.owner_id) },
      select: { userId: true, status: true },
    });

    if (!conn || conn.status !== 'CONNECTED') {
      this.logger.debug(
        `No connected user for athlete ${event.owner_id}, ignoring event`,
      );
      return;
    }

    try {
      const accessToken = await this.tokenService.getValidAccessToken(
        conn.userId,
      );
      const activity = await this.fetchActivity(accessToken, event.object_id);

      if (!RUN_TYPES.has(activity.type as string)) {
        this.logger.debug(
          `Activity ${event.object_id} is type "${activity.type as string}", skipping`,
        );
        return;
      }

      await this.syncService.upsertActivity(conn.userId, activity);

      await this.prisma.stravaConnection.update({
        where: { userId: conn.userId },
        data: { lastSyncAt: new Date() },
      });

      this.logger.log(
        `Webhook: synced activity ${event.object_id} for user ${conn.userId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.error(
        `Webhook processing failed for activity ${event.object_id}: ${msg}`,
      );
    }
  }

  /**
   * Only process the destructive athlete-deauth branch when the event's subscription_id
   * matches our own trusted subscription — anyone can POST to the public webhook endpoint,
   * so an unmatched/missing id must fail closed (skip) rather than delete data.
   */
  private async handleAthleteDeauthIfTrusted(
    event: StravaWebhookEvent,
  ): Promise<void> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    if (
      !cfg.webhookSubscriptionId ||
      String(event.subscription_id) !== cfg.webhookSubscriptionId
    ) {
      this.logger.warn(
        `Rejected athlete-deauth webhook for owner ${event.owner_id}: subscription_id ${event.subscription_id} does not match trusted subscription`,
      );
      return;
    }
    await this.handleAthleteDeauth(event.owner_id);
  }

  /** Remove the local connection + activities when an athlete deauthorizes the app on Strava's side (H6c) */
  private async handleAthleteDeauth(ownerId: number): Promise<void> {
    const conn = await this.prisma.stravaConnection.findFirst({
      where: { stravaAthleteId: String(ownerId) },
    });
    if (!conn) return;

    // Transactional: never leave activities deleted while the connection row survives (or vice versa).
    await this.prisma.$transaction([
      this.prisma.stravaActivity.deleteMany({ where: { userId: conn.userId } }),
      this.prisma.stravaConnection.delete({ where: { userId: conn.userId } }),
    ]);
    this.logger.log(
      `Athlete ${ownerId} deauthorized on Strava — freed local slot`,
    );
  }

  /** Persist the trusted push-subscription id — enables the deauth webhook gate above. */
  private async persistSubscriptionId(id: number | null): Promise<void> {
    if (id === null) {
      this.logger.warn(
        'Strava subscription id unavailable — deauth webhook gate stays closed until next resubscribe',
      );
      return;
    }
    await this.appSettings.setMany({
      'strava.webhookSubscriptionId': String(id),
    });
  }

  /** Register webhook subscription with Strava — idempotent, safe to call on every startup */
  private async registerWebhookSubscription(): Promise<void> {
    const callbackUrl = `${this.backendUrl}/strava/webhook`;
    const existing = await this.getExistingSubscription(
      this.clientIdEnv,
      this.clientSecretEnv,
    );

    if (existing) {
      if (existing.callback_url === callbackUrl) {
        this.logger.log(
          `Webhook subscription ${existing.id} already registered`,
        );
        await this.persistSubscriptionId(existing.id);
        return;
      }
      // URL changed (e.g. backend URL updated) — delete and re-register
      this.logger.log(
        `Webhook callback URL changed, re-registering subscription`,
      );
      await this.deleteSubscription(
        existing.id,
        this.clientIdEnv,
        this.clientSecretEnv,
      );
    }

    const id = await this.createSubscription(
      callbackUrl,
      this.clientIdEnv,
      this.clientSecretEnv,
      this.verifyTokenEnv,
    );
    await this.persistSubscriptionId(id);
  }

  /** Fetch a single Strava activity by ID */
  private fetchActivity(
    accessToken: string,
    activityId: number,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: STRAVA_API_HOST,
          path: `/api/v3/activities/${activityId}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(
                new Error(
                  `Strava GET activity ${activityId} returned ${res.statusCode}`,
                ),
              );
              return;
            }
            try {
              resolve(JSON.parse(data) as Record<string, unknown>);
            } catch {
              reject(new Error('Failed to parse Strava activity response'));
            }
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  private getExistingSubscription(
    clientId: string,
    clientSecret: string,
  ): Promise<{ id: number; callback_url: string } | null> {
    return new Promise((resolve) => {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      });
      const req = https.request(
        {
          hostname: STRAVA_API_HOST,
          path: `/api/v3/push_subscriptions?${params.toString()}`,
          method: 'GET',
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            try {
              const subs = JSON.parse(data) as Array<{
                id: number;
                callback_url: string;
              }>;
              resolve(Array.isArray(subs) && subs.length > 0 ? subs[0] : null);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.end();
    });
  }

  private deleteSubscription(
    id: number,
    clientId: string,
    clientSecret: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      });
      const req = https.request(
        {
          hostname: STRAVA_API_HOST,
          path: `/api/v3/push_subscriptions/${id}?${params.toString()}`,
          method: 'DELETE',
        },
        (res) => {
          res.resume();
          res.on('end', resolve);
        },
      );
      req.on('error', () => resolve());
      req.end();
    });
  }

  /** Creates the subscription with Strava and returns its id (null if the response body couldn't be parsed). */
  private createSubscription(
    callbackUrl: string,
    clientId: string,
    clientSecret: string,
    verifyToken: string,
  ): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const payload = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }).toString();

      const req = https.request(
        {
          hostname: STRAVA_API_HOST,
          path: '/api/v3/push_subscriptions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode !== 201) {
              reject(
                new Error(
                  `Failed to create subscription (${res.statusCode}): ${data}`,
                ),
              );
              return;
            }
            try {
              const result = JSON.parse(data) as { id: number };
              this.logger.log(`Webhook subscription created: id=${result.id}`);
              resolve(result.id);
            } catch {
              // non-fatal parse issue — subscription exists on Strava's side but we can't trust its id yet
              resolve(null);
            }
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
