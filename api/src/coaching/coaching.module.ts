import { Module } from '@nestjs/common';
import { CoachingController } from './coaching.controller.js';
import { CoachingService } from './coaching.service.js';
import { CoachingRepository } from './coaching-repository.js';
import { CoachingCacheService } from './coaching-cache.service.js';
import { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import { ClaudeClientService } from './claude-client.service.js';

/**
 * Registered UNCONDITIONALLY (unlike Garmin/Strava's feature-flagged module
 * registration) — the endpoint must always answer with the template narrative even
 * when AI is off. `AI_COACHING_ENABLED` (default 'false') gates only the internal
 * Claude call path inside coaching.service.ts, not module/route registration.
 */
@Module({
  controllers: [CoachingController],
  providers: [
    CoachingService,
    CoachingRepository,
    CoachingCacheService,
    CoachingLockBudgetService,
    ClaudeClientService,
  ],
})
export class CoachingModule {}
