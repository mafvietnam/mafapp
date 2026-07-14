import { describe, it, expect } from 'vitest';
import { validateAiKeyInput } from '../ai-provider-validation';

describe('validateAiKeyInput', () => {
  it('rejects an empty key', () => {
    const result = validateAiKeyInput('OPENROUTER', '');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/nhập khóa/i);
  });

  it('rejects a key that is only whitespace', () => {
    const result = validateAiKeyInput('OPENAI', '   ');
    expect(result.valid).toBe(false);
  });

  it('rejects a key shorter than the backend MinLength(10)', () => {
    const result = validateAiKeyInput('GEMINI', 'AIza123');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ngắn/i);
  });

  it('rejects a key whose prefix does not match the provider', () => {
    const result = validateAiKeyInput('ANTHROPIC', 'sk-or-not-anthropic-key');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/sk-ant-/);
  });

  it('accepts a valid OpenRouter key (sk-or- prefix)', () => {
    expect(validateAiKeyInput('OPENROUTER', 'sk-or-v1-abcdef1234567890').valid).toBe(true);
  });

  it('accepts a valid Anthropic key (sk-ant- prefix)', () => {
    expect(validateAiKeyInput('ANTHROPIC', 'sk-ant-api03-abcdef1234567890').valid).toBe(true);
  });

  it('accepts a valid OpenAI key (sk- prefix, not sk-or- or sk-ant-)', () => {
    expect(validateAiKeyInput('OPENAI', 'sk-proj-abcdef1234567890').valid).toBe(true);
  });

  it('accepts a valid Gemini key (AIza prefix)', () => {
    expect(validateAiKeyInput('GEMINI', 'AIzaSyAbcdef1234567890').valid).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateAiKeyInput('OPENROUTER', '  sk-or-v1-abcdef1234567890  ').valid).toBe(true);
  });
});
