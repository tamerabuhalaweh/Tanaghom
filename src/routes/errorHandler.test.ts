import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ValidationError } from '@shared/errors';

const loggingMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@shared/logging', () => ({ logger: loggingMocks }));

import { errorHandler } from './errorHandler';

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('HTTP error handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns structured validation details for expected application errors', () => {
    const res = response();
    const error = new ValidationError('Invalid request', { email: 'Email is required' });

    errorHandler(error, {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        fields: { email: 'Email is required' },
      },
    });
    expect(loggingMocks.warn).toHaveBeenCalledOnce();
    expect(loggingMocks.error).not.toHaveBeenCalled();
  });

  it('does not expose unexpected exception messages to the client', () => {
    const res = response();

    errorHandler(new Error('database password is secret-value'), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret-value');
    expect(loggingMocks.error).toHaveBeenCalledOnce();
  });
});
