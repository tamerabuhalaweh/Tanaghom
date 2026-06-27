export interface LLMProvider {
  name: string;
  type: 'mock' | 'openai' | 'claude';
  generate(prompt: string, options?: GenerateOptions): Promise<LLMResponse>;
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

export interface LLMProviderStatus {
  name: string;
  type: string;
  configured: boolean;
  model: string;
  apiKeyStatus: 'configured' | 'missing';
}

export class MockLLMProvider implements LLMProvider {
  name = 'Mock LLM';
  type = 'mock' as const;

  async generate(prompt: string, _options?: GenerateOptions): Promise<LLMResponse> {
    return {
      text: `[Mock LLM] Generated content for: ${prompt.substring(0, 50)}...`,
      model: 'mock-v1',
      provider: 'mock',
    };
  }

  isConfigured(): boolean {
    return true;
  }

  getStatus(): LLMProviderStatus {
    return {
      name: this.name,
      type: this.type,
      configured: true,
      model: 'mock-v1',
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
