/**
 * Thin Anthropic Messages API wrapper. Returns `null` on ANY error/timeout/missing-key —
 * the caller (coaching.service.ts) always falls back to the template narrative; this
 * service never throws. Never logs prompt/response content (PII/cost — only error
 * messages and byte lengths are safe to log).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { COACHING_SYSTEM_PROMPT } from './coaching-prompt.js';

const MAX_TOKENS = 400;
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  getModel(): string {
    return this.config.get<string>('AI_COACHING_MODEL', DEFAULT_MODEL);
  }

  private getClient(): Anthropic | null {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    if (!apiKey) return null;
    if (!this.client) {
      this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    }
    return this.client;
  }

  /** `structuredInputJson` MUST already exclude any user free text (see coaching-prompt.ts). */
  async generateNarrative(structuredInputJson: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const response = await client.messages.create({
        model: this.getModel(),
        max_tokens: MAX_TOKENS,
        system: COACHING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: structuredInputJson }],
      });
      const block = response.content.find((b) => b.type === 'text');
      const text = block && block.type === 'text' ? block.text.trim() : '';
      return text.length > 0 ? text : null;
    } catch (err: unknown) {
      this.logger.warn(
        `Claude generation failed, falling back to template: ${this.errMessage(err)}`,
      );
      return null;
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
