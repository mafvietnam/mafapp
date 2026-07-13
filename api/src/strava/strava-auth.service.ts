import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { GarminEncryptionService } from '../shared/garmin-encryption.service.js';
import { RedisService } from '../shared/redis.service.js';

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  athlete: { id: number };
}

const STRAVA_TOKEN_URL = '/oauth/token';
const NONCE_TTL_SECONDS = 600; // 10 minutes
const NONCE_KEY_PREFIX = 'stravaOAuth:';

@Injectable()
export class StravaAuthService implements OnModuleInit {
  private readonly backendUrl: string;

  // HMAC key for OAuth state — reused from GARMIN_ENCRYPTION_KEY
  // (shared crypto secret, dual-purpose AES + HMAC). KISS.
  private readonly stateSigningKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    private readonly appSettings: AppSettingsService,
    private readonly redis: RedisService,
    private readonly encryption: GarminEncryptionService,
  ) {
    this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');
    // Use centralized hmacKey accessor — key validated in GarminEncryptionService.onModuleInit
    this.stateSigningKey = encryption.hmacKey;
  }

  onModuleInit() {
    // Validate HMAC signing key at boot — ≥32 bytes required
    if (this.stateSigningKey.length < 32) {
      throw new Error(
        'GARMIN_ENCRYPTION_KEY must be at least 32 bytes (64 hex chars) — required for Strava OAuth state signing',
      );
    }
  }

  /** Build OAuth authorization URL with Redis-backed nonce for session binding */
  async getAuthorizationUrl(userId: string): Promise<string> {
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store nonce → userId in Redis with TTL (single-use; deleted on callback verify)
    await this.redis.set(`${NONCE_KEY_PREFIX}${nonce}`, userId, 'EX', NONCE_TTL_SECONDS);

    const state = this.signState(nonce);
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    const redirectUri = `${this.backendUrl}/strava/callback`;

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      // 'force' always shows the consent screen so the requested scope is (re)granted.
      // With 'auto', a returning athlete who previously authorized with a narrower scope
      // keeps that stale grant → the activities API then returns 403 (missing activity:read_all).
      approval_prompt: 'force',
      state,
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Verify state from callback, look up userId from Redis nonce store.
   * If currentUserId provided (JWT-authenticated caller), asserts it matches stored userId (CSRF protection).
   * Callback route is public (no JWT guard) — currentUserId is optional; nonce is still single-use + HMAC-verified.
   */
  async verifyState(state: string, currentUserId?: string): Promise<string> {
    const nonce = this.verifyStateSignature(state);

    const storedUserId = await this.redis.get(`${NONCE_KEY_PREFIX}${nonce}`);
    // Delete immediately — single-use
    await this.redis.del(`${NONCE_KEY_PREFIX}${nonce}`);

    if (!storedUserId) {
      throw new Error('OAuth state expired or already used');
    }

    if (currentUserId && storedUserId !== currentUserId) {
      throw new Error('OAuth state userId mismatch — possible CSRF attempt');
    }

    return storedUserId;
  }

  /** Exchange authorization code for tokens (grant_type=authorization_code) */
  async exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    return this.postStravaToken({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: 'authorization_code',
    });
  }

  /** Refresh access token (grant_type=refresh_token) */
  async refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
    const cfg = await this.appSettings.getStravaRuntimeConfig();
    return this.postStravaToken({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
  }

  /** Sign nonce into state: HMAC_SHA256(nonce, stateSigningKey) + ':' + nonce */
  private signState(nonce: string): string {
    const hmac = crypto
      .createHmac('sha256', this.stateSigningKey)
      .update(nonce)
      .digest('hex');
    return Buffer.from(`${hmac}:${nonce}`).toString('base64url');
  }

  /** Verify HMAC on state, return nonce — throws on invalid/tampered state */
  private verifyStateSignature(state: string): string {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx < 0) throw new Error('Invalid state format');

    const hmac = decoded.substring(0, colonIdx);
    const nonce = decoded.substring(colonIdx + 1);
    if (!hmac || !nonce) throw new Error('Invalid state parts');

    const expected = crypto
      .createHmac('sha256', this.stateSigningKey)
      .update(nonce)
      .digest('hex');

    // Check hex string lengths first — length mismatch reveals nothing useful about the key
    if (hmac.length !== expected.length) throw new Error('Invalid state signature');
    const expectedBuf = Buffer.from(expected, 'hex');
    const hmacBuf = Buffer.from(hmac, 'hex');
    // Both buffers same byte length guaranteed by equal hex string lengths above
    if (!crypto.timingSafeEqual(expectedBuf, hmacBuf)) {
      throw new Error('Invalid state signature');
    }

    return nonce;
  }

  private postStravaToken(body: Record<string, string>): Promise<StravaTokenResponse> {
    return new Promise((resolve, reject) => {
      const payload = new URLSearchParams(body).toString();
      const req = https.request(
        {
          hostname: 'www.strava.com',
          path: STRAVA_TOKEN_URL,
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
            try {
              const parsed = JSON.parse(data) as StravaTokenResponse & { message?: string };
              if (res.statusCode !== 200) {
                reject(new Error(`Strava token exchange failed: ${parsed.message ?? data}`));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error('Failed to parse Strava token response'));
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
