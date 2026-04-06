import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type { GoogleProfile } from './google.strategy.js';

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

  /** Login with WordPress credentials */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: { username: string; password: string },
    @Res() res: Response,
  ) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('Missing username or password');
    }

    const { accessToken, refreshToken } = await this.authService.login(
      body.username,
      body.password,
    );

    res.cookie('maf_access', accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie('maf_refresh', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000, '/auth/refresh'));

    res.json({ ok: true });
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

  /** Redirect to Google consent screen */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Guard redirects to Google automatically
  }

  /** Google OAuth callback — issue cookies and redirect to app */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const { accessToken, refreshToken } =
      await this.authService.loginWithGoogle(profile);

    res.cookie('maf_access', accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie('maf_refresh', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000, '/auth/refresh'));

    // Redirect to the frontend app after successful Google login
    const frontendUrl = IS_PROD ? 'https://app.maf.run' : 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard`);
  }
}
