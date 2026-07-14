/**
 * BYOK provider metadata + light client-side key validation (Phase 5). Mirrors the
 * backend's loose "does this look like a real key" sanity check
 * (api/src/ai/user-ai-key.service.ts PREFIX_HINTS) so the user gets instant Vietnamese
 * feedback before hitting the network — the backend remains the source of truth and
 * still re-validates (400 on empty/short/prefix-mismatch), this is UX-only.
 */

export type AiProvider = 'OPENROUTER' | 'ANTHROPIC' | 'OPENAI' | 'GEMINI';

export const AI_PROVIDER_OPTIONS: AiProvider[] = ['OPENROUTER', 'ANTHROPIC', 'OPENAI', 'GEMINI'];

/** Display labels — VN copy per spec. */
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  OPENROUTER: 'OpenRouter',
  ANTHROPIC: 'Anthropic (Claude)',
  OPENAI: 'OpenAI (ChatGPT)',
  GEMINI: 'Google Gemini',
};

/** Prefix hints shown as input placeholder — mirrors backend PREFIX_HINTS regex intent. */
export const AI_PROVIDER_KEY_PREFIX: Record<AiProvider, string> = {
  OPENROUTER: 'sk-or-',
  OPENAI: 'sk-',
  ANTHROPIC: 'sk-ant-',
  GEMINI: 'AIza',
};

const PREFIX_REGEX: Record<AiProvider, RegExp> = {
  OPENROUTER: /^sk-or-/,
  OPENAI: /^sk-/,
  ANTHROPIC: /^sk-ant-/,
  GEMINI: /^AIza/,
};

/** Backend MinLength(10) on the DTO — kept in sync here for early feedback. */
const MIN_KEY_LENGTH = 10;

export interface AiKeyValidationResult {
  valid: boolean;
  error?: string;
}

/** Light client-side pre-check for the BYOK key input. Never a substitute for backend validation. */
export function validateAiKeyInput(provider: AiProvider, rawKey: string): AiKeyValidationResult {
  const key = rawKey.trim();
  if (key.length === 0) {
    return { valid: false, error: 'Vui lòng nhập khóa API.' };
  }
  if (key.length < MIN_KEY_LENGTH) {
    return { valid: false, error: 'Khóa API quá ngắn.' };
  }
  if (!PREFIX_REGEX[provider].test(key)) {
    return {
      valid: false,
      error: `Khóa API ${AI_PROVIDER_LABELS[provider]} thường bắt đầu bằng "${AI_PROVIDER_KEY_PREFIX[provider]}". Vui lòng kiểm tra lại.`,
    };
  }
  return { valid: true };
}
