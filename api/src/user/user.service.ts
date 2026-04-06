import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import type { WpUserInfo } from '../auth/auth.types.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create or update local user from WordPress user info */
  async findOrCreateFromWp(wpUser: WpUserInfo) {
    // Pick largest avatar URL available
    const avatar = wpUser.avatar_urls
      ? Object.values(wpUser.avatar_urls).pop() ?? null
      : null;

    return this.prisma.user.upsert({
      where: { wpUserId: wpUser.id },
      update: {
        name: wpUser.name,
        email: wpUser.email,
        avatar,
      },
      create: {
        wpUserId: wpUser.id,
        name: wpUser.name,
        email: wpUser.email,
        avatar,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
