import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { PrismaService } from '../shared/prisma.service.js';
import { StravaTokenService } from './strava-token.service.js';
import { StravaSyncService } from './strava-sync.service.js';

export interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;           // activity ID
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;            // Strava athlete ID
  subscription_id: number;
  event_time: number;          // Unix timestamp
  updates?: Record<string, string>;
}

const STRAVA_API_HOST = 'www.strava.com';
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

@Injectable()
export class StravaWebhookService implements OnModuleInit {
  private readonly logger = new Logger(StravaWebhookService.name);
  private readonly verifyToken: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly backendUrl: string;
  private readonly isEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: StravaTokenService,
    private readonly syncService: StravaSyncService,
    config: ConfigService,
  ) {
    this.verifyToken = config.get<string>('STRAVA_WEBHOOK_VERIFY_TOKEN', '');
    this.clientId = config.get<string>('STRAVA_CLIENT_ID', '');
    this.clientSecret = config.get<string>('STRAVA_CLIENT_SECRET', '');
    this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');
    this.isEnabled = config.get<string>('FEATURE_STRAVA', 'false') === 'true';
  }

  async onModuleInit() {
    if (!this.isEnabled) return;
    try {
      await this.registerWebhookSubscription();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Non-fatal — app starts regardless; Strava may not be reachable in local dev
      this.logger.warn(`Webhook subscription registration skipped: ${msg}`);
    }
  }

  /** Validate Strava webhook challenge GET request */
  isValidVerifyToken(token: string): boolean {
    return token === this.verifyToken;
  }

  /**
   * Process a webhook event asynchronously.
   * Controller must call this via setImmediate — never await in the request handler.
   */
  async processEvent(event: StravaWebhookEvent): Promise<void> {
    // MVP: only handle new activity creates
    if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
      return;
    }

    const conn = await this.prisma.stravaConnection.findFirst({
      where: { stravaAthleteId: String(event.owner_id) },
      select: { userId: true, status: true },
    });

    if (!conn || conn.status !== 'CONNECTED') {
      this.logger.debug(`No connected user for athlete ${event.owner_id}, ignoring event`);
      return;
    }

    try {
      const accessToken = await this.tokenService.getValidAccessToken(conn.userId);
      const activity = await this.fetchActivity(accessToken, event.object_id);

      if (!RUN_TYPES.has(activity.type as string)) {
        this.logger.debug(`Activity ${event.object_id} is type "${activity.type as string}", skipping`);
        return;
      }

      await this.syncService.upsertActivity(conn.userId, activity);

      await this.prisma.stravaConnection.update({
        where: { userId: conn.userId },
        data: { lastSyncAt: new Date() },
      });

      this.logger.log(`Webhook: synced activity ${event.object_id} for user ${conn.userId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      this.logger.error(`Webhook processing failed for activity ${event.object_id}: ${msg}`);
    }
  }

  /** Register webhook subscription with Strava — idempotent, safe to call on every startup */
  async registerWebhookSubscription(): Promise<void> {
    const callbackUrl = `${this.backendUrl}/strava/webhook`;
    const existing = await this.getExistingSubscription();

    if (existing) {
      if (existing.callback_url === callbackUrl) {
        this.logger.log(`Webhook subscription ${existing.id} already registered`);
        return;
      }
      // URL changed (e.g. backend URL updated) — delete and re-register
      this.logger.log(`Webhook callback URL changed, re-registering subscription`);
      await this.deleteSubscription(existing.id);
    }

    await this.createSubscription(callbackUrl);
  }

  /** Fetch a single Strava activity by ID */
  private fetchActivity(accessToken: string, activityId: number): Promise<Record<string, unknown>> {
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
              reject(new Error(`Strava GET activity ${activityId} returned ${res.statusCode}`));
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

  private getExistingSubscription(): Promise<{ id: number; callback_url: string } | null> {
    return new Promise((resolve) => {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
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
              const subs = JSON.parse(data) as Array<{ id: number; callback_url: string }>;
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

  private deleteSubscription(id: number): Promise<void> {
    return new Promise((resolve) => {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
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

  private createSubscription(callbackUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        callback_url: callbackUrl,
        verify_token: this.verifyToken,
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
              reject(new Error(`Failed to create subscription (${res.statusCode}): ${data}`));
              return;
            }
            try {
              const result = JSON.parse(data) as { id: number };
              this.logger.log(`Webhook subscription created: id=${result.id}`);
            } catch {
              // non-fatal parse issue
            }
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
