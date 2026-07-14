import { OpenAiCompatibleAdapterService } from './openai-compatible-adapter.service.js';

const createMock = jest.fn();
let capturedCtorArgs: Record<string, unknown> | undefined;

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((args: Record<string, unknown>) => {
      capturedCtorArgs = args;
      return { chat: { completions: { create: createMock } } };
    }),
  };
});

describe('OpenAiCompatibleAdapterService.generate', () => {
  beforeEach(() => {
    createMock.mockReset();
    capturedCtorArgs = undefined;
  });

  it('returns the trimmed message content on success', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '  Chạy nhẹ nhàng nhé!  ' } }],
    });
    const service = new OpenAiCompatibleAdapterService();
    const result = await service.generate({
      apiKey: 'sk-or-test',
      model: 'google/gemini-2.0-flash-001',
      baseURL: 'https://openrouter.ai/api/v1',
      structuredInputJson: '{"totalMinutes":45}',
    });
    expect(result).toBe('Chạy nhẹ nhàng nhé!');
  });

  it('passes the given baseURL through to the client constructor (OpenRouter)', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
    });
    const service = new OpenAiCompatibleAdapterService();
    await service.generate({
      apiKey: 'sk-or-test',
      model: 'x',
      baseURL: 'https://openrouter.ai/api/v1',
      structuredInputJson: '{}',
    });
    expect(capturedCtorArgs?.baseURL).toBe('https://openrouter.ai/api/v1');
  });

  it('omits baseURL for the default OpenAI endpoint (BYOK-OpenAI)', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
    });
    const service = new OpenAiCompatibleAdapterService();
    await service.generate({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      structuredInputJson: '{}',
    });
    expect(capturedCtorArgs?.baseURL).toBeUndefined();
  });

  it('never forwards anything beyond the given structuredInputJson as the user message', async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    createMock.mockImplementationOnce(
      (args: { messages: { role: string; content: string }[] }) => {
        capturedMessages = args.messages;
        return Promise.resolve({ choices: [{ message: { content: 'ok' } }] });
      },
    );
    const service = new OpenAiCompatibleAdapterService();
    await service.generate({
      apiKey: 'sk-or-test',
      model: 'x',
      structuredInputJson: '{"totalMinutes":45}',
    });
    expect(capturedMessages?.[1]).toEqual({
      role: 'user',
      content: '{"totalMinutes":45}',
    });
  });

  it('returns null and never throws when the SDK call rejects (timeout/network/etc.)', async () => {
    createMock.mockRejectedValue(new Error('timeout'));
    const service = new OpenAiCompatibleAdapterService();
    await expect(
      service.generate({ apiKey: 'k', model: 'x', structuredInputJson: '{}' }),
    ).resolves.toBeNull();
  });

  it('returns null when the response has no message content', async () => {
    createMock.mockResolvedValue({ choices: [{ message: {} }] });
    const service = new OpenAiCompatibleAdapterService();
    const result = await service.generate({
      apiKey: 'k',
      model: 'x',
      structuredInputJson: '{}',
    });
    expect(result).toBeNull();
  });
});
