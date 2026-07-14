import { ClaudeClientService } from './claude-client.service.js';
import type { ConfigService } from '@nestjs/config';

const createMock = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  };
});

function buildService(env: Record<string, string> = {}): ClaudeClientService {
  const config = {
    get: jest.fn((key: string, def?: unknown) => env[key] ?? def),
  } as unknown as ConfigService;
  return new ClaudeClientService(config);
}

describe('ClaudeClientService', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('returns null immediately when ANTHROPIC_API_KEY is missing — never constructs a client', async () => {
    const service = buildService({ ANTHROPIC_API_KEY: '' });
    const result = await service.generateNarrative('{}');
    expect(result).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns the trimmed text block on success', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '  Chạy nhẹ nhàng nhé!  ' }],
    });
    const service = buildService({ ANTHROPIC_API_KEY: 'test-key' });
    const result = await service.generateNarrative('{"totalMinutes":45}');
    expect(result).toBe('Chạy nhẹ nhàng nhé!');
  });

  it('never forwards anything beyond the given structuredInputJson string as the user message', async () => {
    // mockImplementationOnce with an explicitly-typed param captures the call args without
    // indexing into `.mock.calls` (which stays `any[]` on an untyped jest.fn()).
    let capturedMessages: { role: string; content: string }[] | undefined;
    createMock.mockImplementationOnce(
      (args: { messages: { role: string; content: string }[] }) => {
        capturedMessages = args.messages;
        return Promise.resolve({ content: [{ type: 'text', text: 'ok' }] });
      },
    );
    const service = buildService({ ANTHROPIC_API_KEY: 'test-key' });
    await service.generateNarrative('{"totalMinutes":45}');
    expect(capturedMessages).toEqual([
      { role: 'user', content: '{"totalMinutes":45}' },
    ]);
  });

  it('returns null and never throws when the SDK call rejects (timeout/network/etc.)', async () => {
    createMock.mockRejectedValue(new Error('timeout'));
    const service = buildService({ ANTHROPIC_API_KEY: 'test-key' });
    await expect(service.generateNarrative('{}')).resolves.toBeNull();
  });

  it('returns null when the response has no text content block', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'tool_use' }] });
    const service = buildService({ ANTHROPIC_API_KEY: 'test-key' });
    const result = await service.generateNarrative('{}');
    expect(result).toBeNull();
  });

  it('getModel() falls back to the haiku default when AI_COACHING_MODEL is unset', () => {
    const service = buildService({});
    expect(service.getModel()).toBe('claude-haiku-4-5-20251001');
  });
});
