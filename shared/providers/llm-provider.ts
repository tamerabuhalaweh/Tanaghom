export interface LLMProvider {
  name: string;
  type: 'mock' | 'openai' | 'claude' | 'deepseek' | 'gemma';
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
        stream: false,
      }),
    }, options?.timeoutMs);

    if (!response.ok) {
      throw new Error(`Gemma API returned ${response.status}`);
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

function extractOpenAIText(data: OpenAIResponsePayload): string {
  if (data.output_text) return data.output_text.trim();
  return data.output
    ?.flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' || part.type === 'text')
    .map((part) => part.text || '')
    .join('\n')
    .trim() || '';
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
