export interface LLMProvider {
  name: string;
  type: 'mock' | 'openai' | 'claude' | 'deepseek' | 'gemma';
  generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse>;
  streamGenerate(prompt: string, options?: GenerateOptions): AsyncGenerator<LLMStreamEvent>;
  isConfigured(): boolean;
  getStatus(): LLMProviderStatus;
}

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export type LLMStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; response: LLMResponse };

export interface LLMProviderStatus {
  name: string;
  type: string;
  configured: boolean;
  model: string;
  apiKeyStatus: 'configured' | 'missing';
}

export class LLMProviderError extends Error {
  public readonly isOperational = true;

  constructor(
    message: string,
    public readonly statusCode = 502,
    public readonly code = 'LLM_PROVIDER_ERROR',
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class MockLLMProvider implements LLMProvider {
  name = 'Fallback Content Provider';
  type = 'mock' as const;

  async generate(prompt: string, _options?: GenerateOptions): Promise<LLMResponse> {
    const platform = extractPromptValue(prompt, 'PLATFORM') || 'linkedin';
    const objective = extractPromptValue(prompt, 'Objective') || 'Generate qualified course leads';
    const audience = extractPromptValue(prompt, 'Audience') || 'course buyers and coaching prospects';
    const cta = extractPromptValue(prompt, 'CTA') || 'request the course details';
    const copy = buildFallbackCourseCopy({ platform, objective, audience, cta });
    return {
      text: copy,
      model: 'fallback-course-social-v1',
      provider: 'mock',
    };
  }

  async *streamGenerate(prompt: string, options?: GenerateOptions): AsyncGenerator<LLMStreamEvent> {
    yield* streamStaticResponse(await this.generate(prompt, options));
  }

  isConfigured(): boolean {
    return true;
  }

  getStatus(): LLMProviderStatus {
    return {
      name: this.name,
      type: this.type,
      configured: true,
      model: 'fallback-course-social-v1',
      apiKeyStatus: 'configured',
    };
  }
}

export class OpenAILLMProvider implements LLMProvider {
  name = 'OpenAI';
  type = 'openai' as const;
  private apiKey: string;
  private model: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config?.model || process.env.OPENAI_MODEL || 'gpt-4o';
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured: missing OPENAI_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_output_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }

    const data = await response.json() as OpenAIResponsePayload;
    const text = extractOpenAIText(data);
    if (!text) {
      throw new Error('OpenAI API returned no text output');
    }

    return {
      text,
      model,
      provider: 'openai',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
      } : undefined,
    };
  }

  async *streamGenerate(prompt: string, options?: GenerateOptions): AsyncGenerator<LLMStreamEvent> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured: missing OPENAI_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_output_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }

    yield* streamProviderResponse(response, { model, provider: 'openai' });
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getStatus(): LLMProviderStatus {
    return {
      name: this.name,
      type: this.type,
      configured: this.isConfigured(),
      model: this.model,
      apiKeyStatus: this.apiKey.length > 0 ? 'configured' : 'missing',
    };
  }
}

export class ClaudeLLMProvider implements LLMProvider {
  name = 'Claude';
  type = 'claude' as const;
  private apiKey: string;
  private model: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.CLAUDE_API_KEY || '';
    this.model = config?.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('Claude provider not configured: missing CLAUDE_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': process.env.CLAUDE_API_VERSION || '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        system: options?.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`Claude API returned ${response.status}`);
    }

    const data = await response.json() as ClaudeResponsePayload;
    const text = data.content
      ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
    if (!text) {
      throw new Error('Claude API returned no text output');
    }

    return {
      text,
      model,
      provider: 'claude',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
      } : undefined,
    };
  }

  async *streamGenerate(prompt: string, options?: GenerateOptions): AsyncGenerator<LLMStreamEvent> {
    if (!this.isConfigured()) {
      throw new Error('Claude provider not configured: missing CLAUDE_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': process.env.CLAUDE_API_VERSION || '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        system: options?.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`Claude API returned ${response.status}`);
    }

    yield* streamProviderResponse(response, { model, provider: 'claude' });
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getStatus(): LLMProviderStatus {
    return {
      name: this.name,
      type: this.type,
      configured: this.isConfigured(),
      model: this.model,
      apiKeyStatus: this.apiKey.length > 0 ? 'configured' : 'missing',
    };
  }
}

export class DeepSeekLLMProvider implements LLMProvider {
  name = 'DeepSeek';
  type = 'deepseek' as const;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.model = config?.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    this.baseUrl = (config?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('DeepSeek provider not configured: missing DEEPSEEK_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        stream: false,
        thinking: { type: 'disabled' },
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`DeepSeek API returned ${response.status}`);
    }

    const data = await response.json() as ChatCompletionResponsePayload;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('DeepSeek API returned no text output');
    }

    return {
      text,
      model,
      provider: 'deepseek',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
      } : undefined,
    };
  }

  async *streamGenerate(prompt: string, options?: GenerateOptions): AsyncGenerator<LLMStreamEvent> {
    if (!this.isConfigured()) {
      throw new Error('DeepSeek provider not configured: missing DEEPSEEK_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        stream: true,
        thinking: { type: 'disabled' },
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`DeepSeek API returned ${response.status}`);
    }

    yield* streamProviderResponse(response, { model, provider: 'deepseek' });
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getStatus(): LLMProviderStatus {
    return {
      name: this.name,
      type: this.type,
      configured: this.isConfigured(),
      model: this.model,
      apiKeyStatus: this.apiKey.length > 0 ? 'configured' : 'missing',
    };
  }
}

export class GemmaLLMProvider implements LLMProvider {
  name = 'Gemma';
  type = 'gemma' as const;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.GEMMA_API_KEY || '';
    this.model = config?.model || process.env.GEMMA_MODEL || 'gemma4-26b-a4b-canary';
    this.baseUrl = (config?.baseUrl || process.env.GEMMA_BASE_URL || 'https://api.thesmartlabs.net/gemma4/v1').replace(/\/$/, '');
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('Gemma provider not configured: missing GEMMA_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        top_p: 0.9,
        stream: false,
      }),
    }, {
      timeoutMs: options?.timeoutMs,
      retryStatuses: [429, 502, 503, 504],
      maxAttempts: 3,
      retryDelayMs: 350,
    });

    if (!response.ok) {
      throw new LLMProviderError(
        `Gemma API returned ${response.status}. The provider may be busy; please try again.`,
        response.status >= 500 || response.status === 429 ? 502 : 400,
        'LLM_PROVIDER_UNAVAILABLE',
      );
    }

    const data = await response.json() as ChatCompletionResponsePayload;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Gemma API returned no text output');
    }

    return {
      text,
      model,
      provider: 'gemma',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
      } : undefined,
    };
  }

  async *streamGenerate(prompt: string, options?: GenerateOptions): AsyncGenerator<LLMStreamEvent> {
    if (!this.isConfigured()) {
      throw new Error('Gemma provider not configured: missing GEMMA_API_KEY');
    }
    const model = options?.model || this.model;
    const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: options?.maxTokens || 700,
        temperature: options?.temperature ?? 0.7,
        top_p: 0.9,
        stream: true,
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new LLMProviderError(
        `Gemma API returned ${response.status}. The provider may be busy; please try again.`,
        response.status >= 500 || response.status === 429 ? 502 : 400,
        'LLM_PROVIDER_UNAVAILABLE',
      );
    }

    yield* streamProviderResponse(response, { model, provider: 'gemma' });
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getStatus(): LLMProviderStatus {
    return {
      name: this.name,
      type: this.type,
      configured: this.isConfigured(),
      model: this.model,
      apiKeyStatus: this.apiKey.length > 0 ? 'configured' : 'missing',
    };
  }
}

export function createLLMProvider(): LLMProvider {
  const providerType = process.env.LLM_PROVIDER || 'mock';
  switch (providerType) {
    case 'openai':
      return new OpenAILLMProvider();
    case 'claude':
      return new ClaudeLLMProvider();
    case 'deepseek':
      return new DeepSeekLLMProvider();
    case 'gemma':
      return new GemmaLLMProvider();
    default:
      return new MockLLMProvider();
  }
}

export function createConfiguredLLMProvider(config: {
  provider?: string | null;
  apiKey?: string | null;
  model?: string | null;
}): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLMProvider({ apiKey: config.apiKey || undefined, model: config.model || undefined });
    case 'claude':
      return new ClaudeLLMProvider({ apiKey: config.apiKey || undefined, model: config.model || undefined });
    case 'deepseek':
      return new DeepSeekLLMProvider({ apiKey: config.apiKey || undefined, model: config.model || undefined });
    case 'gemma':
      return new GemmaLLMProvider({ apiKey: config.apiKey || undefined, model: config.model || undefined });
    default:
      return createLLMProvider();
  }
}

export function getProviderStatus(): LLMProviderStatus {
  return createLLMProvider().getStatus();
}

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface ClaudeResponsePayload {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface ChatCompletionResponsePayload {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: {
    timeoutMs?: number;
    retryStatuses?: number[];
    maxAttempts?: number;
    retryDelayMs?: number;
  } = {},
): Promise<Response> {
  const maxAttempts = Math.max(1, options.maxAttempts || 1);
  const retryStatuses = new Set(options.retryStatuses || []);
  let lastResponse: Response | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, options.timeoutMs);
      if (!retryStatuses.has(response.status) || attempt === maxAttempts) {
        return response;
      }
      lastResponse = response;
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) throw err;
    }
    await delay((options.retryDelayMs || 250) * attempt);
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error('Provider request failed');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOpenAIText(data: OpenAIResponsePayload): string {
  if (data.output_text) return data.output_text.trim();
  return data.output
    ?.flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' || part.type === 'text')
    .map((part) => part.text || '')
    .join('\n')
    .trim() || '';
}

async function* streamStaticResponse(response: LLMResponse): AsyncGenerator<LLMStreamEvent> {
  for (const chunk of chunkText(response.text)) {
    yield { type: 'token', text: chunk };
  }
  yield { type: 'done', response };
}

async function* streamProviderResponse(
  response: Response,
  output: { model: string; provider: string },
): AsyncGenerator<LLMStreamEvent> {
  let text = '';
  for await (const payload of iterateSseJson(response)) {
    const delta = extractStreamingText(payload);
    if (delta) {
      text += delta;
      yield { type: 'token', text: delta };
    }
  }

  const normalized = text.trim();
  if (!normalized) {
    throw new Error(`${output.provider} API returned no streamed text output`);
  }

  yield {
    type: 'done',
    response: {
      text: normalized,
      model: output.model,
      provider: output.provider,
    },
  };
}

async function* iterateSseJson(response: Response): AsyncGenerator<unknown> {
  if (!response.body) {
    throw new Error('Provider streaming response did not include a readable body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const event of events) {
        yield* parseSseEvent(event);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      yield* parseSseEvent(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

function* parseSseEvent(rawEvent: string): Generator<unknown> {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (const data of dataLines) {
    if (data === '[DONE]') continue;
    try {
      yield JSON.parse(data);
    } catch {
      continue;
    }
  }
}

function extractStreamingText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;

  if (typeof record.delta === 'string') return record.delta;
  if (record.delta && typeof record.delta === 'object') {
    const delta = record.delta as Record<string, unknown>;
    if (typeof delta.text === 'string') return delta.text;
    if (typeof delta.content === 'string') return delta.content;
  }

  if (typeof record.text === 'string' && record.type === 'response.output_text.delta') return record.text;
  if (typeof record.content === 'string') return record.content;

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const delta = first.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta.content === 'string') return delta.content;
    const message = first.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') return message.content;
  }

  const contentBlock = record.content_block as Record<string, unknown> | undefined;
  if (contentBlock && typeof contentBlock.text === 'string') return contentBlock.text;

  return '';
}

function chunkText(text: string): string[] {
  const chunks = text.match(/.{1,48}(\s|$)/g)?.map((chunk) => chunk) || [text];
  return chunks.filter((chunk) => chunk.length > 0);
}

function extractPromptValue(prompt: string, label: string): string {
  const match = prompt.match(new RegExp(`- ${label}:\\s*(.+)`, 'i'))
    || prompt.match(new RegExp(`${label}:\\s*(.+)`, 'i'));
  return match?.[1]?.trim() || '';
}

function buildFallbackCourseCopy(input: {
  platform: string;
  objective: string;
  audience: string;
  cta: string;
}): string {
  const platform = input.platform.toLowerCase();
  if (platform.includes('instagram')) {
    return [
      'Most course posts fail because they explain the offer before they make the problem feel real.',
      '',
      `For ${input.audience}, start with the moment they already recognize: the decision they keep delaying, the result they want, or the question they are afraid to ask.`,
      '',
      'Then give one useful step they can try today.',
      '',
      `CTA: ${input.cta}.`,
      '',
      'Visual idea: 5-slide carousel or Reel with a strong first frame, one practical lesson, and a final registration prompt.',
      '',
      '#Coaching #OnlineCourses #PersonalGrowth #CourseCreation',
    ].join('\n');
  }
  if (platform === 'x' || platform.includes('twitter')) {
    return [
      'A strong course post does not start with the course.',
      '',
      'It starts with the exact problem your follower is trying to solve today.',
      '',
      `For ${input.audience}: name the problem, give one practical step, then invite them to ${input.cta}.`,
    ].join('\n');
  }
  return [
    `If the goal is "${input.objective}", the content needs to earn trust before it asks for action.`,
    '',
    `For ${input.audience}, lead with a practical lesson from the course or coaching method:`,
    '',
    '1. Name the problem in plain language.',
    '2. Share one useful step or mindset shift.',
    '3. Explain what changes when they apply it.',
    `4. Invite the right people to ${input.cta}.`,
    '',
    'This keeps the post valuable, credible, and ready for human review before scheduling.',
  ].join('\n');
}
