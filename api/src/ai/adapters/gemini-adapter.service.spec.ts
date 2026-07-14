import { GeminiAdapterService } from './gemini-adapter.service.js';

describe('GeminiAdapterService.generate', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the trimmed text on a successful 200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            { content: { parts: [{ text: '  Chạy nhẹ nhàng nhé!  ' }] } },
          ],
        }),
    }) as unknown as typeof fetch;
    const service = new GeminiAdapterService();
    const result = await service.generate({
      apiKey: 'AIzaTest',
      model: 'gemini-2.0-flash',
      structuredInputJson: '{"totalMinutes":45}',
    });
    expect(result).toBe('Chạy nhẹ nhàng nhé!');
  });

  it('includes the api key + model in the request URL, and the structured input as the only user content', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new GeminiAdapterService();
    await service.generate({
      apiKey: 'AIzaTest',
      model: 'gemini-2.0-flash',
      structuredInputJson: '{"totalMinutes":45}',
    });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('models/gemini-2.0-flash:generateContent');
    expect(url).toContain('key=AIzaTest');
    const body = JSON.parse(options.body as string) as {
      contents: { parts: { text: string }[] }[];
    };
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: '{"totalMinutes":45}' }] },
    ]);
  });

  it('returns null (never throws) on a non-2xx HTTP response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;
    const service = new GeminiAdapterService();
    const result = await service.generate({
      apiKey: 'bad-key',
      model: 'gemini-2.0-flash',
      structuredInputJson: '{}',
    });
    expect(result).toBeNull();
  });

  it('returns null (never throws) when fetch itself rejects (timeout/network/etc.)', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network error')) as unknown as typeof fetch;
    const service = new GeminiAdapterService();
    const result = await service.generate({
      apiKey: 'AIzaTest',
      model: 'gemini-2.0-flash',
      structuredInputJson: '{}',
    });
    expect(result).toBeNull();
  });

  it('returns null when the response has no candidate text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [] }),
    }) as unknown as typeof fetch;
    const service = new GeminiAdapterService();
    const result = await service.generate({
      apiKey: 'AIzaTest',
      model: 'gemini-2.0-flash',
      structuredInputJson: '{}',
    });
    expect(result).toBeNull();
  });
});
