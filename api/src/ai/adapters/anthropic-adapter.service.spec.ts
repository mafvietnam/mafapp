import { AnthropicAdapterService } from './anthropic-adapter.service.js';

const createMock = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  };
});

describe('AnthropicAdapterService.generate', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('returns the trimmed text block on success', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '  Chạy nhẹ nhàng nhé!  ' }],
    });
    const service = new AnthropicAdapterService();
    const result = await service.generate({
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
      structuredInputJson: '{"totalMinutes":45}',
    });
    expect(result).toBe('Chạy nhẹ nhàng nhé!');
  });

  it('never forwards anything beyond the given structuredInputJson string as the user message', async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    createMock.mockImplementationOnce(
      (args: { messages: { role: string; content: string }[] }) => {
        capturedMessages = args.messages;
        return Promise.resolve({ content: [{ type: 'text', text: 'ok' }] });
      },
    );
    const service = new AnthropicAdapterService();
    await service.generate({
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
      structuredInputJson: '{"totalMinutes":45}',
    });
    expect(capturedMessages).toEqual([
      { role: 'user', content: '{"totalMinutes":45}' },
    ]);
  });

  it('returns null and never throws when the SDK call rejects (timeout/network/etc.)', async () => {
    createMock.mockRejectedValue(new Error('timeout'));
    const service = new AnthropicAdapterService();
    await expect(
      service.generate({
        apiKey: 'sk-ant-test',
        model: 'claude-haiku-4-5-20251001',
        structuredInputJson: '{}',
      }),
    ).resolves.toBeNull();
  });

  it('returns null when the response has no text content block', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'tool_use' }] });
    const service = new AnthropicAdapterService();
    const result = await service.generate({
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
      structuredInputJson: '{}',
    });
    expect(result).toBeNull();
  });

  it('returns null when the response text is empty after trimming', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '   ' }] });
    const service = new AnthropicAdapterService();
    const result = await service.generate({
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
      structuredInputJson: '{}',
    });
    expect(result).toBeNull();
  });
});
