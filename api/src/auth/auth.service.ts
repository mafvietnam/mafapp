import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { RedisService } from '../shared/redis.service.js';
import { UserService } from '../user/user.service.js';
import type { TokenPayload, WpUserInfo } from './auth.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly wpOAuthUrl: string;
  private readonly wpClientId: string;
  private readonly redirectUri: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly userService: UserService,
  ) {
    this.wpOAuthUrl = this.config.get<string>('WP_OAUTH_URL', 'https://maf.run');
    this.wpClientId = this.config.get<string>('WP_OAUTH_CLIENT_ID', '');
    this.redirectUri = this.config.get<string>(
      'WP_OAUTH_REDIRECT_URI',
      'https://api.maf.run/auth/callback',
    );
    this.frontendUrl = this.config.get<string>('CORS_ORIGIN', 'https://app.maf.run');
  }

  /** Generate PKCE code verifier + challenge, store in Redis, return WP authorize URL */
  async initiateLogin(): Promise<string> {
    const codeVerifier = crypto.randomBytes(64).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    // Store verifier + state in Redis (5min TTL)
    await this.redis.set(
      `oauth:state:${state}`,
      JSON.stringify({ codeVerifier }),
      'EX',
      300,
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.wpClientId,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'openid profile email',
    });

    return `${this.wpOAuthUrl}/oauth/authorize?${params.toString()}`;
  }

  /** Exchange authorization code for tokens, upsert user, return JWT + refresh token */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ accessToken: string; refreshToken: string; redirectUrl: string }> {
    // Validate state (CSRF protection)
    const stored = await this.redis.get(`oauth:state:${state}`);
    if (!stored) throw new UnauthorizedException('Invalid or expired state');
    await this.redis.del(`oauth:state:${state}`);

    const { codeVerifier } = JSON.parse(stored);

    // Exchange code for WP access token
    const tokenRes = await fetch(`${this.wpOAuthUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.wpClientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error(`WP token exchange failed: ${tokenRes.status}`);
      throw new UnauthorizedException('WordPress token exchange failed');
    }

    const tokenData = await tokenRes.json();

    // Fetch WP user info
    const userRes = await fetch(`${this.wpOAuthUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) throw new UnauthorizedException('Failed to fetch WP user info');

    const wpUser: WpUserInfo = await userRes.json();

    // Upsert local user
    const user = await this.userService.findOrCreateFromWp(wpUser);

    // Generate JWT + refresh token
    const accessToken = await this.generateAccessToken(user.id, user.email);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      redirectUrl: `${this.frontendUrl}/dashboard`,
    };
  }

  /** Rotate refresh token: validate old, issue new pair */
  async refreshToken(
    oldRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const key = `refresh:${oldRefreshToken}`;
    const userId = await this.redis.get(key);

    if (!userId) {
      // Grace period: check if this token was recently rotated
      const graceKey = `refresh:grace:${oldRefreshToken}`;
      const graceData = await this.redis.get(graceKey);
      if (graceData) {
        await this.redis.del(graceKey); // Single-use: delete after first replay
        const { accessToken, refreshToken } = JSON.parse(graceData);
        return { accessToken, refreshToken };
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Delete old token
    await this.redis.del(key);

    // Get user for new JWT
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = await this.generateAccessToken(user.id, user.email);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Store grace period (60s) for race condition mitigation
    await this.redis.set(
      `refresh:grace:${oldRefreshToken}`,
      JSON.stringify({ accessToken, refreshToken }),
      'EX',
      60,
    );

    return { accessToken, refreshToken };
  }

  /** Invalidate refresh token */
  async logout(refreshToken: string): Promise<void> {
    await this.redis.del(`refresh:${refreshToken}`);
  }

  private async generateAccessToken(userId: string, email: string): Promise<string> {
    const payload: TokenPayload = { sub: userId, email };
    return this.jwt.signAsync(payload, { expiresIn: '15m' });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    // Store in Redis with 7-day TTL
    await this.redis.set(`refresh:${token}`, userId, 'EX', 7 * 24 * 60 * 60);
    return token;
  }
}
