import { AppError } from '@shared/errors';
import { LLMProviderError } from '@shared/providers/llm-provider';

export type StitchiProviderFailure = 'required' | 'unavailable';

const PROVIDER_FAILURE_MESSAGE =
  'Your AI connection is configured, but the provider rejected or could not complete this request. Open AI Settings, test the connection, and replace the credential if the test fails. No system data was changed.';

export function classifyStitchiProviderFailure(error: unknown): StitchiProviderFailure | null {
  if (error instanceof AppError && error.code === 'LLM_PROVIDER_REQUIRED') return 'required';
  if (error instanceof LLMProviderError) return 'unavailable';
  if (!(error instanceof Error)) return null;

  if (error.name === 'AbortError' || error instanceof TypeError) return 'unavailable';

  const message = error.message.toLowerCase();
  if (
    /\b(openai|claude|deepseek|gemma|llm)\b/.test(message)
    && /(api|provider|credential|configured|response|output|fetch|network|timeout|timed out)/.test(message)
  ) {
    return 'unavailable';
  }

  return null;
}

export function stitchiProviderUnavailableMessage(): string {
  return PROVIDER_FAILURE_MESSAGE;
}
