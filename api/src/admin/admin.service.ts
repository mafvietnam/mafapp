import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { RedisService } from '../shared/redis.service.js';
import { REVOKED_USER_KEY } from '../auth/auth.guard.js';
import type { AdminStatsResponse } from './admin-stats.dto.js';
import type { AdminUserQueryDto } from './admin-user-query.dto.js';
import type { AdminUpdateUserDto } from './admin-update-user.dto.js';
import type { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getStats(): Promise<AdminStatsResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalProfiles, newUsersToday, recentUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.userProfile.count(),
        this.prisma.user.count({ where: { createdAt: { gte: today } } }),
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      totalUsers,
      totalProfiles,
      newUsersToday,
      recentUsers: recentUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  async getUsers(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, currentUserId: string) {
    // Prevent admin from disabling or demoting themselves
    if (id === currentUserId) {
      if (dto.isActive === false) {
        throw new ForbiddenException('Cannot deactivate your own account');
      }
      if (dto.role && dto.role !== 'ADMIN') {
        throw new ForbiddenException('Cannot demote your own account');
      }
    }

    await this.ensureUserExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role && { role: dto.role as Role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Sync Redis revocation set for immediate JWT invalidation
    if (dto.isActive === false) {
      await this.redis.set(`${REVOKED_USER_KEY}${id}`, '1');
    } else if (dto.isActive === true) {
      await this.redis.del(`${REVOKED_USER_KEY}${id}`);
    }

    return user;
  }

  async deleteUser(id: string) {
    await this.ensureUserExists(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
  }
}
