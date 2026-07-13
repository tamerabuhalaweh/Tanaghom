import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeLLMProvider, DeepSeekLLMProvider, GemmaLLMProvider, LLMProviderError, MockLLMProvider, OpenAILLMProvider, createLLMProvider } from './llm-provider';

const ORIGINAL_ENV = { ...process.env };

describe('LLM provider adapter', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('keeps mock as the default provider', async () => {
    delete process.env.LLM_PROVIDER;

    const provider = createLLMProvider();
    const response = await provider.generate('Write a post');

    expect(provider).toBeInstanceOf(MockLLMProvider);
    expect(response.provider).toBe('mock');
  });

  it('calls OpenAI Responses API when configured', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: 'OpenAI live generated draft',
        usage: { input_tokens: 12, output_tokens: 7 },
      }),
    } as Response);

    const provider = new OpenAILLMProvider();
    const response = await provider.generate('Campaign brief', { model: 'gpt-test', timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-openai-key' }),
      }),
    );
    expect(response.text).toBe('OpenAI live generated draft');
    expect(response.provider).toBe('openai');
    expect(response.usage).toEqual({ promptTokens: 12, completionTokens: 7 });
  });

  it('calls Claude Messages API when configured', async () => {
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Claude live generated draft' }],
        usage: { input_tokens: 9, output_tokens: 6 },
      }),
    } as Response);

    const provider = new ClaudeLLMProvider();
    const response = await provider.generate('Campaign brief', { model: 'claude-test', timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-claude-key' }),
      }),
    );
    expect(response.text).toBe('Claude live generated draft');
    expect(response.provider).toBe('claude');
    expect(response.usage).toEqual({ promptTokens: 9, completionTokens: 6 });
  });

  it('calls DeepSeek Chat Completions API when configured', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'DeepSeek live generated draft' } }],
        usage: { prompt_tokens: 14, completion_tokens: 9 },
      }),
    } as Response);

    const provider = new DeepSeekLLMProvider();
    const response = await provider.generate('Campaign brief', { model: 'deepseek-v4-flash', timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-deepseek-key' }),
      }),
    );
    expect(response.text).toBe('DeepSeek live generated draft');
    expect(response.provider).toBe('deepseek');
    expect(response.usage).toEqual({ promptTokens: 14, completionTokens: 9 });
  });

  it('calls Gemma OpenAI-compatible Chat Completions API when configured', async () => {
    process.env.GEMMA_API_KEY = 'test-gemma-key';
    process.env.GEMMA_BASE_URL = 'https://api.thesmartlabs.net/gemma4/v1';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Gemma live generated draft' } }],
        usage: { prompt_tokens: 10, completion_tokens: 6 },
      }),
    } as Response);

    const provider = new GemmaLLMProvider();
    const response = await provider.generate('Campaign brief', { model: 'gemma4-26b-a4b-canary', timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.thesmartlabs.net/gemma4/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-gemma-key' }),
      }),
    );
    expect(response.text).toBe('Gemma live generated draft');
    expect(response.provider).toBe('gemma');
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 6 });
  });

  it('reports rejected Gemma credentials accurately without exposing provider response data', async () => {
    process.env.GEMMA_API_KEY = 'test-gemma-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);

    const provider = new GemmaLLMProvider();
    const error = await provider.generate('Campaign brief', { timeoutMs: 1000 }).catch(value => value);

    expect(error).toBeInstanceOf(LLMProviderError);
    expect(error).toMatchObject({ code: 'LLM_PROVIDER_UNAVAILABLE', statusCode: 400 });
    expect(error.message).toContain('rejected the configured credential');
    expect(error.message).not.toContain('test-gemma-key');
  });

  it('streams Gemma OpenAI-compatible chat completion tokens', async () => {
    process.env.GEMMA_API_KEY = 'test-gemma-key';
    process.env.GEMMA_BASE_URL = 'https://api.thesmartlabs.net/gemma4/v1';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]));

    const provider = new GemmaLLMProvider();
    const events = [];
    for await (const event of provider.streamGenerate('Campaign brief', { model: 'gemma4-26b-a4b-canary', timeoutMs: 1000 })) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.thesmartlabs.net/gemma4/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stream":true'),
      }),
    );
    expect(events).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'token', text: ' world' },
      { type: 'done', response: { text: 'Hello world', model: 'gemma4-26b-a4b-canary', provider: 'gemma' } },
    ]);
  });

  it('streams OpenAI Responses API output_text delta events', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"A"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"B"}\n\n',
      'data: [DONE]\n\n',
    ]));

    const provider = new OpenAILLMProvider();
    const events = [];
    for await (const event of provider.streamGenerate('Campaign brief', { model: 'gpt-test', timeoutMs: 1000 })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'token', text: 'A' },
      { type: 'token', text: 'B' },
      { type: 'done', response: { text: 'AB', model: 'gpt-test', provider: 'openai' } },
    ]);
  });

  it('retries transient Gemma provider failures before returning content', async () => {
    process.env.GEMMA_API_KEY = 'test-gemma-key';
    process.env.GEMMA_BASE_URL = 'https://api.thesmartlabs.net/gemma4/v1';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: { message: 'temporary upstream error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Gemma retry generated draft' } }],
        }),
      } as Response);

    const provider = new GemmaLLMProvider();
    const response = await provider.generate('Campaign brief', { timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.text).toBe('Gemma retry generated draft');
    expect(response.provider).toBe('gemma');
  });

  it('does not call external providers when credentials are missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(new OpenAILLMProvider().generate('Brief')).rejects.toThrow('missing OPENAI_API_KEY');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}
