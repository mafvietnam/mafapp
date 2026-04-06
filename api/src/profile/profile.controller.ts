import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './profile.dto.js';

@Controller('users/me/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@Req() req: Request) {
    const { id } = req.user as { id: string };
    const profile = await this.profileService.getProfile(id);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Put()
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const { id } = req.user as { id: string };
    return this.profileService.upsertProfile(id, dto);
  }
}
