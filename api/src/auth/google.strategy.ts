import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const IS_PROD = config.get<string>('NODE_ENV') === 'production';
    const apiBase = IS_PROD
      ? 'https://api.maf.run'
      : `http://localhost:${config.get<number>('PORT', 3001)}`;

    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: `${apiBase}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  /** Passport calls this after Google returns user data */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; displayName: string; emails?: { value: string }[]; photos?: { value: string }[] },
    done: VerifyCallback,
  ): void {
    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value ?? null,
    };
    done(null, googleProfile);
  }
}
