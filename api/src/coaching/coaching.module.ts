import { Module } from '@nestjs/common';
import { CoachingController } from './coaching.controller.js';
import { CoachingService } from './coaching.service.js';
import { CoachingRepository } from './coaching-repository.js';
import { CoachingCacheService } from './coaching-cache.service.js';
import { CoachingLockBudgetService } from './coaching-lock-budget.service.js';
import { AiModule } from '../ai/ai.module.js';

/**
 * Registered UNCONDITIONALLY (unlike Garmin/Strava's feature-flagged module
 * registration) — the endpoint must always answer with the template narrative even
 * when AI is off. Key resolution + the `ai.enabled` system-tier kill-switch now live in
 * AiModule/AiProviderService (Phase 5) — CoachingModule imports it rather than owning a
 * provider client directly.
 */
@Module({
  imports: [AiModule],
  controllers: [CoachingController],
  providers: [
    CoachingService,
    CoachingRepository,
    CoachingCacheService,
    CoachingLockBudgetService,
  ],
})
export class CoachingModule {}
