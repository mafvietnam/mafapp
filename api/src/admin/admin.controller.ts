import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { AdminAiService } from './admin-ai.service.js';
import { AppSettingsService } from '../shared/app-settings.service.js';
import { AdminUserQueryDto } from './admin-user-query.dto.js';
import { AdminUpdateUserDto } from './admin-update-user.dto.js';
import { StravaSettingsDto } from './dto/strava-settings.dto.js';
import { AiSettingsDto } from './dto/ai-settings.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly settingsService: AppSettingsService,
    private readonly adminAiService: AdminAiService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // ── Garmin ────────────────────────────────────────────────────────────────

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
  saveGarminSettings(
    @Body()
    body: {
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
      enabled?: boolean;
    },
  ) {
    const settings: Record<string, string> = {};
    if (body.clientId !== undefined)
      settings['garmin.clientId'] = body.clientId;
    if (body.clientSecret !== undefined)
      settings['garmin.clientSecret'] = body.clientSecret;
    if (body.callbackUrl !== undefined)
      settings['garmin.callbackUrl'] = body.callbackUrl;
    if (body.enabled !== undefined)
      settings['garmin.enabled'] = String(body.enabled);
    return this.settingsService.setMany(settings);
  }

  // ── Strava ────────────────────────────────────────────────────────────────

  @Get('strava')
  getStravaOverview() {
    return this.adminService.getStravaOverview();
  }

  @Post('strava/:userId/sync')
  triggerStravaSync(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() req: Request,
  ) {
    const adminId = (req.user as { id: string }).id;
    return this.adminService.triggerStravaSync(userId, adminId);
  }

  @Get('settings/strava')
  getStravaSettings() {
    return this.settingsService.getStravaSettings();
  }

  @Post('settings/strava')
  saveStravaSettings(@Body() body: StravaSettingsDto) {
    return this.adminService.saveStravaSettings(body);
  }

  // ── AI (Phase 5) ─────────────────────────────────────────────────────────

  @Get('ai/settings')
  getAiSettings() {
    return this.adminAiService.getSettings();
  }

  @Put('ai/settings')
  saveAiSettings(@Body() body: AiSettingsDto) {
    return this.adminAiService.saveSettings(body);
  }

  @Get('ai/usage')
  getAiUsage() {
    return this.adminAiService.getUsage();
  }

  // ── Users ─────────────────────────────────────────────────────────────────

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
