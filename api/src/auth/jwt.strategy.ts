import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { TokenPayload } from './auth.types.js';

/** Extract JWT from httpOnly cookie instead of Authorization header */
function extractFromCookie(req: Request): string | null {
  return req?.cookies?.maf_access ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const publicKey = Buffer.from(
      config.get<string>('JWT_PUBLIC_KEY', ''),
      'base64',
    ).toString('utf-8');

    super({
      jwtFromRequest: extractFromCookie,
      algorithms: ['RS256'],
      secretOrKey: publicKey,
    });
  }

  /** Passport attaches return value to `req.user` */
  validate(payload: TokenPayload) {
    return { id: payload.sub, email: payload.email };
  }
}
