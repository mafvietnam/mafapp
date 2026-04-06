import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import type { WpUserInfo } from '../auth/auth.types.js';
import type { GoogleProfile } from '../auth/google.strategy.js';

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

  /** Create or update local user from Google OAuth profile */
  async findOrCreateFromGoogle(profile: GoogleProfile) {
    // First check if user exists by googleId
    const byGoogle = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (byGoogle) {
      return this.prisma.user.update({
        where: { id: byGoogle.id },
        data: { name: profile.name, avatar: profile.avatar },
      });
    }

    // Check if user exists by email (may have logged in via WP before)
    const byEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: profile.googleId, name: profile.name, avatar: profile.avatar },
      });
    }

    // Create new user
    return this.prisma.user.create({
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
