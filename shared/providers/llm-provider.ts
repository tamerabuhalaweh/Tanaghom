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

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  async generate(prompt: string, _options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured: missing OPENAI_API_KEY');
    }
    // Real implementation would call OpenAI API here
    // For now, return mock response
    return {
      text: `[OpenAI ${this.model}] Generated content for: ${prompt.substring(0, 50)}...`,
      model: this.model,
      provider: 'openai',
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

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  }

  async generate(prompt: string, _options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('Claude provider not configured: missing CLAUDE_API_KEY');
    }
    // Real implementation would call Claude API here
    // For now, return mock response
    return {
      text: `[Claude ${this.model}] Generated content for: ${prompt.substring(0, 50)}...`,
      model: this.model,
      provider: 'claude',
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

export function getProviderStatus(): LLMProviderStatus {
  return createLLMProvider().getStatus();
}
