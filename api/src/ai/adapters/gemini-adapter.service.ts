/**
 * Gemini adapter — BYOK-Gemini only, thin `fetch`-based REST call (no `@google/genai`
 * dependency — YAGNI, one endpoint is all we need). Returns `null` on ANY
 * error/timeout/non-2xx/empty-response — the caller (AiProviderService) always falls
 * back to the template narrative; this adapter never throws. Never logs prompt/response
 * content (PII/cost — only error messages).
 */

import { Injectable, Logger } from '@nestjs/common';
import { COACHING_SYSTEM_PROMPT } from '../../coaching/coaching-prompt.js';
import type { AiAdapterParams } from '../ai-provider-types.js';

const MAX_TOKENS = 400;
const REQUEST_TIMEOUT_MS = 8000;
const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

@Injectable()
export class GeminiAdapterService {
  private readonly logger = new Logger(GeminiAdapterService.name);

  async generate(params: AiAdapterParams): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const url = `${GEMINI_BASE_URL}/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: COACHING_SYSTEM_PROMPT }] },
          contents: [
            { role: 'user', parts: [{ text: params.structuredInputJson }] },
          ],
          generationConfig: { maxOutputTokens: MAX_TOKENS },
        }),
      });
      if (!res.ok) {
        this.logger.warn(
          `Gemini BYOK generation failed with HTTP ${res.status}, falling back`,
        );
        return null;
      }
      const data = (await res.json()) as GeminiResponse;
      const text = (
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      ).trim();
      return text.length > 0 ? text : null;
    } catch (err: unknown) {
      this.logger.warn(
        `Gemini BYOK generation failed, falling back: ${this.errMessage(err)}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}
