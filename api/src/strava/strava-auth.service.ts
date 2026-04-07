import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  athlete: { id: number };
}

const STRAVA_TOKEN_URL = '/oauth/token';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class StravaAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly backendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = config.get<string>('STRAVA_CLIENT_ID', '');
    this.clientSecret = config.get<string>('STRAVA_CLIENT_SECRET', '');
    this.backendUrl = config.get<string>('BACKEND_URL', 'http://localhost:3001');
  }

  /** Build HMAC-signed state: base64url(userId:timestamp:sig) */
  private signState(userId: string): string {
    const ts = Date.now().toString();
    const payload = `${userId}:${ts}`;
    const sig = crypto
      .createHmac('sha256', this.clientSecret)
      .update(payload)
      .digest('hex');
    return Buffer.from(`${payload}:${sig}`).toString('base64url');
  }

  /** Verify state — returns userId or throws */
  verifyState(state: string): string {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const colonCount = (decoded.match(/:/g) || []).length;
    if (colonCount < 2) throw new Error('Invalid state format');

    // Split on first two colons only (userId may contain colons in theory — use fixed split)
    const firstColon = decoded.indexOf(':');
    const secondColon = decoded.indexOf(':', firstColon + 1);
    const userId = decoded.substring(0, firstColon);
    const ts = decoded.substring(firstColon + 1, secondColon);
    const sig = decoded.substring(secondColon + 1);

    if (!userId || !ts || !sig) throw new Error('Invalid state parts');

    if (Date.now() - parseInt(ts, 10) > STATE_TTL_MS) {
      throw new Error('OAuth state expired');
    }

    const expected = crypto
      .createHmac('sha256', this.clientSecret)
      .update(`${userId}:${ts}`)
      .digest('hex');

    // Constant-time comparison — pad to same length if hex lengths differ
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sig.padEnd(expected.length, '0'), 'hex');
    if (expectedBuf.length !== sigBuf.length) throw new Error('Invalid state signature');
    if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      throw new Error('Invalid state signature');
    }

    return userId;
  }

  /** Build Strava OAuth authorization URL */
  getAuthorizationUrl(userId: string): string {
    const state = this.signState(userId);
    const redirectUri = `${this.backendUrl}/strava/callback`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      approval_prompt: 'auto',
      state,
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /** Exchange authorization code for tokens (grant_type=authorization_code) */
  async exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
    return this.postStravaToken({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
    });
  }

  /** Refresh access token (grant_type=refresh_token) */
  async refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
    return this.postStravaToken({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
  }

  private postStravaToken(
    body: Record<string, string>,
  ): Promise<StravaTokenResponse> {
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
              const parsed = JSON.parse(data) as StravaTokenResponse & {
                message?: string;
              };
              if (res.statusCode !== 200) {
                reject(
                  new Error(
                    `Strava token exchange failed: ${parsed.message ?? data}`,
                  ),
                );
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
