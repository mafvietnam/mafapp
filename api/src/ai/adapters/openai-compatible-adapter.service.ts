/**
 * OpenAI Chat Completions-compatible adapter — covers THREE call sites with one client:
 *   - system tier: OpenRouter (`baseURL: OPENROUTER_BASE_URL`, admin key)
 *   - BYOK OpenRouter (user's own OpenRouter key, same baseURL)
 *   - BYOK OpenAI (user's own OpenAI key, default OpenAI baseURL)
 * Returns `null` on ANY error/timeout/empty-response — the caller (AiProviderService)
 * always falls back through the tier chain / template; this adapter never throws. Never
 * logs prompt/response content (PII/cost) — only error messages.
 */

import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { COACHING_SYSTEM_PROMPT } from '../../coaching/coaching-prompt.js';
import type { AiAdapterParams } from '../ai-provider-types.js';

const MAX_TOKENS = 400;
const REQUEST_TIMEOUT_MS = 8000;

export interface OpenAiCompatibleParams extends AiAdapterParams {
  /** Omit to use the default OpenAI baseURL (BYOK-OpenAI); set to OPENROUTER_BASE_URL otherwise. */
  baseURL?: string;
}

@Injectable()
export class OpenAiCompatibleAdapterService {
  private readonly logger = new Logger(OpenAiCompatibleAdapterService.name);

  async generate(params: OpenAiCompatibleParams): Promise<string | null> {
    try {
      const client = new OpenAI({
        apiKey: params.apiKey,
        baseURL: params.baseURL,
        timeout: REQUEST_TIMEOUT_MS,
      });
      const response = await client.chat.completions.create({
        model: params.model,
        max_completion_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: COACHING_SYSTEM_PROMPT },
          { role: 'user', content: params.structuredInputJson },
        ],
      });
      const text = response.choices[0]?.message?.content?.trim() ?? '';
      return text.length > 0 ? text : null;
    } catch (err: unknown) {
      this.logger.warn(
        `OpenAI-compatible generation failed, falling back: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
