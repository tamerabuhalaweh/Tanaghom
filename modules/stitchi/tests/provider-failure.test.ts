import { describe, expect, it } from 'vitest';
import { AppError } from '@shared/errors';
import { LLMProviderError } from '@shared/providers/llm-provider';
import { classifyStitchiProviderFailure } from '../provider-failure';

describe('Stitchi provider failure classification', () => {
  it('distinguishes a missing provider from a configured provider outage', () => {
    expect(classifyStitchiProviderFailure(
      new AppError('No provider configured.', 424, 'LLM_PROVIDER_REQUIRED'),
    )).toBe('required');
    expect(classifyStitchiProviderFailure(
      new LLMProviderError('Provider rejected credential.', 400, 'LLM_PROVIDER_UNAVAILABLE'),
    )).toBe('unavailable');
  });

  it('recognizes provider transport and empty-output failures', () => {
    expect(classifyStitchiProviderFailure(new TypeError('fetch failed'))).toBe('unavailable');
    expect(classifyStitchiProviderFailure(new Error('Gemma API returned no text output'))).toBe('unavailable');
  });

  it('does not hide unrelated programming or database failures', () => {
    expect(classifyStitchiProviderFailure(new Error('Cannot read properties of undefined'))).toBeNull();
    expect(classifyStitchiProviderFailure(new Error('Database connection failed'))).toBeNull();
  });
});
