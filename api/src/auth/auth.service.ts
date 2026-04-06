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
  private readonly wpUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly userService: UserService,
  ) {
    this.wpUrl = this.config.get<string>('WP_OAUTH_URL', 'https://maf.run');
  }

  /** Validate credentials against WordPress REST API, return JWT + refresh token */
  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Validate against WordPress custom auth endpoint
    const wpRes = await fetch(`${this.wpUrl}/wp-json/maf/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!wpRes.ok) {
      this.logger.warn(`WP auth failed for user: ${username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const wpUser: WpUserInfo = await wpRes.json();

    // Upsert local user from WordPress data
    const user = await this.userService.findOrCreateFromWp(wpUser);

    // Generate JWT + refresh token
    const accessToken = await this.generateAccessToken(user.id, user.email);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
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
        await this.redis.del(graceKey); // Single-use
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
    await this.redis.set(`refresh:${token}`, userId, 'EX', 7 * 24 * 60 * 60);
    return token;
  }
}
