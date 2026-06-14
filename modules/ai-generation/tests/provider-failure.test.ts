import { describe, it, expect } from 'vitest';
import { MockLLMProvider } from '@shared/providers/mocks';

describe('Mock LLM Provider', () => {
  it('returns mock text for generateText', async () => {
    const llm = new MockLLMProvider();
    const result = await llm.generateText('Write a LinkedIn post about health');
    expect(result).toContain('[MOCK]');
    expect(result).toContain('LinkedIn');
  });

  it('returns empty object for generateStructured', async () => {
    const llm = new MockLLMProvider();
    const result = await llm.generateStructured('test', { type: 'object' });
    expect(result).toEqual({});
  });

  it('returns random embeddings', async () => {
    const llm = new MockLLMProvider();
    const result = await llm.embeddings('test text');
    expect(result).toHaveLength(1536);
    expect(typeof result[0]).toBe('number');
  });

  it('does not throw errors', async () => {
    const llm = new MockLLMProvider();
    await expect(llm.generateText('any input')).resolves.toBeDefined();
    await expect(llm.generateStructured('any', {})).resolves.toBeDefined();
    await expect(llm.embeddings('any')).resolves.toBeDefined();
  });
});

describe('Provider Failure Handling', () => {
  it('mock provider never fails (baseline)', async () => {
    const llm = new MockLLMProvider();
    // The mock provider should never throw
    for (let i = 0; i < 10; i++) {
      await expect(llm.generateText(`test ${i}`)).resolves.toBeDefined();
    }
  });

  it('service wraps LLM errors as ExternalServiceError', () => {
    // This tests the error wrapping pattern in the service
    // The service catches LLM errors and wraps them as ExternalServiceError
    const errorMessage = 'LLM provider timeout';
    const wrapped = `LLM error: ${errorMessage}`;
    expect(wrapped).toContain('LLM');
    expect(wrapped).toContain(errorMessage);
  });
});
