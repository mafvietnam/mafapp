import { Controller, Get, UseGuards, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { UserService } from './user.service.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** Return current authenticated user from local DB cache */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request) {
    const { id } = req.user as { id: string; email: string; role: string };
    const user = await this.userService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
    };
  }
}
