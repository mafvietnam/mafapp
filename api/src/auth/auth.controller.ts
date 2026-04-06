import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

const COOKIE_DOMAIN = '.maf.run';
const IS_PROD = process.env.NODE_ENV === 'production';

function cookieOptions(maxAgeMs: number, path = '/') {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax' as const,
    domain: IS_PROD ? COOKIE_DOMAIN : undefined,
    path,
    maxAge: maxAgeMs,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Initiate WordPress OAuth PKCE flow */
  @Get('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Res() res: Response) {
    const url = await this.authService.initiateLogin();
    res.redirect(url);
  }

  /** OAuth callback — exchange code, set cookies, redirect to frontend */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) throw new UnauthorizedException('Missing code or state');

    const { accessToken, refreshToken, redirectUrl } =
      await this.authService.handleCallback(code, state);

    // Set access token cookie (15min)
    res.cookie('maf_access', accessToken, cookieOptions(15 * 60 * 1000));
    // Set refresh token cookie (7 days, restricted path)
    res.cookie('maf_refresh', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000, '/auth/refresh'));

    res.redirect(redirectUrl);
  }

  /** Refresh access token using refresh cookie */
  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const oldRefreshToken = req.cookies?.maf_refresh;
    if (!oldRefreshToken) throw new UnauthorizedException('No refresh token');

    const { accessToken, refreshToken } =
      await this.authService.refreshToken(oldRefreshToken);

    res.cookie('maf_access', accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie('maf_refresh', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000, '/auth/refresh'));

    res.json({ ok: true });
  }

  /** Logout — clear cookies and invalidate refresh token */
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.maf_refresh;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('maf_access', cookieOptions(0));
    res.clearCookie('maf_refresh', cookieOptions(0, '/auth/refresh'));
    res.json({ ok: true });
  }
}
