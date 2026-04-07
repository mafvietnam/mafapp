import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { StravaEncryptionService } from './strava-encryption.service.js';
import {
  StravaAuthService,
  type StravaTokenResponse,
} from './strava-auth.service.js';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if within 5 min of expiry

@Injectable()
export class StravaTokenService {
  private readonly logger = new Logger(StravaTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: StravaEncryptionService,
    private readonly auth: StravaAuthService,
  ) {}

  /** Return a valid access token, auto-refreshing if near expiry */
  async getValidAccessToken(userId: string): Promise<string> {
    const conn = await this.prisma.stravaConnection.findUnique({
      where: { userId },
      select: {
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
    });
    if (!conn) throw new Error('No Strava connection found');

    const expiresAt = conn.tokenExpiresAt.getTime();
    if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
      // Token still valid — return it
      return this.encryption.decrypt(conn.accessToken);
    }

    // Token near expiry — refresh
    this.logger.log(`Refreshing Strava access token for user ${userId}`);
    const refreshToken = this.encryption.decrypt(conn.refreshToken);
    const tokens = await this.auth.refreshAccessToken(refreshToken);
    await this.updateTokens(userId, tokens);
    return tokens.access_token;
  }

  /** Persist refreshed tokens to DB */
  async updateTokens(userId: string, tokens: StravaTokenResponse): Promise<void> {
    await this.prisma.stravaConnection.update({
      where: { userId },
      data: {
        accessToken: this.encryption.encrypt(tokens.access_token),
        refreshToken: this.encryption.encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        status: 'CONNECTED',
      },
    });
  }
}
