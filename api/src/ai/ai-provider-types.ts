/**
 * Shared types for the Phase 5 multi-provider AI layer. Kept dependency-free (no Nest
 * imports) so adapters and AiProviderService can share them without a circular import.
 */
import type { AiProvider } from '@prisma/client';

/** Params every adapter's `generate()` accepts — one narrative-generation attempt. */
export interface AiAdapterParams {
  apiKey: string;
  model: string;
  /** Already-serialized StructuredCoachingInput JSON — see coaching-prompt.ts. Never raw user text. */
  structuredInputJson: string;
}

/** Result of a successful key-resolution + generation — see AiProviderService.generateNarrative(). */
export interface AiGenerationResult {
  narrative: string;
  model: string;
  source: 'byok' | 'system';
}

/** OpenRouter model ids used as the BYOK default when the user hasn't picked a model — cheap, sane defaults per provider. */
export const BYOK_DEFAULT_MODEL: Record<AiProvider, string> = {
  OPENROUTER: 'google/gemini-2.0-flash-001',
  ANTHROPIC: 'claude-haiku-4-5-20251001',
  OPENAI: 'gpt-4o-mini',
  GEMINI: 'gemini-2.0-flash',
};

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
