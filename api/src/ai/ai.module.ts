import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { UserAiKeyService } from './user-ai-key.service.js';
import { AiProviderService } from './ai-provider.service.js';
import { OpenAiCompatibleAdapterService } from './adapters/openai-compatible-adapter.service.js';
import { AnthropicAdapterService } from './adapters/anthropic-adapter.service.js';
import { GeminiAdapterService } from './adapters/gemini-adapter.service.js';

/**
 * Registered UNCONDITIONALLY (mirrors CoachingModule) — GET/PUT/DELETE /ai/key must
 * always answer even when `ai.enabled=false`; the kill-switch only gates the SYSTEM
 * tier inside AiProviderService, never module/route registration.
 * Exports AiProviderService so CoachingModule can inject it directly.
 */
@Module({
  controllers: [AiController],
  providers: [
    UserAiKeyService,
    AiProviderService,
    OpenAiCompatibleAdapterService,
    AnthropicAdapterService,
    GeminiAdapterService,
  ],
  exports: [AiProviderService],
})
export class AiModule {}
