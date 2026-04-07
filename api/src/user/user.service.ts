import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import type { WpUserInfo } from '../auth/auth.types.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create or update local user from WordPress user info.
   *  Handles email collision: if a user with the same email exists
   *  (e.g., created via Google OAuth with a different wpUserId),
   *  links the wpUserId to the existing user instead of creating a duplicate.
   */
  async findOrCreateFromWp(wpUser: WpUserInfo) {
    const avatar = wpUser.avatar_urls
      ? (Object.values(wpUser.avatar_urls).pop() ?? null)
      : null;

    // Try upsert by wpUserId first
    try {
      return await this.prisma.user.upsert({
        where: { wpUserId: wpUser.id },
        update: { name: wpUser.name, email: wpUser.email, avatar },
        create: {
          wpUserId: wpUser.id,
          name: wpUser.name,
          email: wpUser.email,
          avatar,
        },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation (email already exists for another user)
      if (err?.code === 'P2002') {
        return this.prisma.user.update({
          where: { email: wpUser.email },
          data: { wpUserId: wpUser.id, name: wpUser.name, avatar },
        });
      }
      throw err;
    }
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
