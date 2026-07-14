import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { UserAiKeyService } from './user-ai-key.service.js';
import { UserAiKeyDto } from './dto/user-ai-key.dto.js';

/** Shape of req.user after JWT strategy validate() */
interface JwtUser {
  id: string;
  email: string;
  role: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly userAiKeyService: UserAiKeyService) {}

  /** Masked BYOK status: provider, hasKey, this month's usage, quota, effective source. */
  @Get('key')
  getKey(@Req() req: Request) {
    const userId = (req.user as JwtUser).id;
    return this.userAiKeyService.getStatus(userId);
  }

  @Put('key')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  setKey(@Req() req: Request, @Body() dto: UserAiKeyDto) {
    const userId = (req.user as JwtUser).id;
    return this.userAiKeyService.setKey(userId, dto);
  }

  @Delete('key')
  deleteKey(@Req() req: Request) {
    const userId = (req.user as JwtUser).id;
    return this.userAiKeyService.deleteKey(userId);
  }
}
