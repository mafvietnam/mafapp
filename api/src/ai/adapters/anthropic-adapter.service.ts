/**
 * Anthropic Messages API adapter — BYOK-Anthropic only (system tier always goes through
 * OpenRouter, see openai-compatible-adapter.service.ts). Generalized from Phase 4's
 * coaching/claude-client.service.ts: apiKey/model are now per-call params (a user's own
 * key), not env-sourced singletons. Returns `null` on ANY error/timeout — the caller
 * (AiProviderService) always falls back to the template narrative; this adapter never
 * throws. Never logs prompt/response content (PII/cost — only error messages).
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { COACHING_SYSTEM_PROMPT } from '../../coaching/coaching-prompt.js';
import type { AiAdapterParams } from '../ai-provider-types.js';

const MAX_TOKENS = 400;
const REQUEST_TIMEOUT_MS = 8000;

@Injectable()
export class AnthropicAdapterService {
  private readonly logger = new Logger(AnthropicAdapterService.name);

  async generate(params: AiAdapterParams): Promise<string | null> {
    try {
      const client = new Anthropic({
        apiKey: params.apiKey,
        timeout: REQUEST_TIMEOUT_MS,
      });
      const response = await client.messages.create({
        model: params.model,
        max_tokens: MAX_TOKENS,
        system: COACHING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: params.structuredInputJson }],
      });
      const block = response.content.find((b) => b.type === 'text');
      const text = block && block.type === 'text' ? block.text.trim() : '';
      return text.length > 0 ? text : null;
    } catch (err: unknown) {
      this.logger.warn(
        `Anthropic BYOK generation failed, falling back: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
