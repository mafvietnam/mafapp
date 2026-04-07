import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../shared/redis.service.js';

/** Redis key prefix for revoked (disabled) users */
export const REVOKED_USER_KEY = 'revoked:user:';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Run Passport JWT validation first
    const isValid = await (super.canActivate(context) as Promise<boolean>);
    if (!isValid) return false;

    // Check if user is revoked (disabled by admin)
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (userId) {
      const isRevoked = await this.redis.exists(`${REVOKED_USER_KEY}${userId}`);
      if (isRevoked) {
        throw new UnauthorizedException('Account is disabled');
      }
    }

    return true;
  }
}
