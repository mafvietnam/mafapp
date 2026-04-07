import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { AdminUserQueryDto } from './admin-user-query.dto.js';
import { AdminUpdateUserDto } from './admin-update-user.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly settingsService: AdminSettingsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('garmin')
  getGarminOverview() {
    return this.adminService.getGarminOverview();
  }

  @Post('garmin/:userId/sync')
  triggerGarminSync(@Param('userId') userId: string) {
    return this.adminService.triggerGarminSync(userId);
  }

  @Get('settings/garmin')
  getGarminSettings() {
    return this.settingsService.getGarminSettings();
  }

  @Post('settings/garmin')
  saveGarminSettings(@Body() body: { clientId?: string; clientSecret?: string; callbackUrl?: string; enabled?: boolean }) {
    const settings: Record<string, string> = {};
    if (body.clientId !== undefined) settings['garmin.clientId'] = body.clientId;
    if (body.clientSecret !== undefined) settings['garmin.clientSecret'] = body.clientSecret;
    if (body.callbackUrl !== undefined) settings['garmin.callbackUrl'] = body.callbackUrl;
    if (body.enabled !== undefined) settings['garmin.enabled'] = String(body.enabled);
    return this.settingsService.setMany(settings);
  }

  @Get('users')
  getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as { id: string }).id;
    return this.adminService.updateUser(id, dto, currentUserId);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
