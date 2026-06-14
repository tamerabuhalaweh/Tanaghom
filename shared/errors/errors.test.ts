import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ConflictError,
  ExternalServiceError,
  StateTransitionError,
} from './index';

describe('shared/errors', () => {
  it('AppError should have correct properties', () => {
    const err = new AppError('test error', 400, 'TEST_ERROR');
    expect(err.message).toBe('test error');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST_ERROR');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('ValidationError should have status 400', () => {
    const err = new ValidationError('invalid', { email: 'bad' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fields).toEqual({ email: 'bad' });
  });

  it('NotFoundError should have status 404', () => {
    const err = new NotFoundError('User', '123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('User');
    expect(err.message).toContain('123');
  });

  it('ForbiddenError should have status 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('UnauthorizedError should have status 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ConflictError should have status 409', () => {
    const err = new ConflictError('duplicate');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('ExternalServiceError should have status 502', () => {
    const err = new ExternalServiceError('Postiz', 'timeout');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(err.message).toContain('Postiz');
  });

  it('StateTransitionError should have status 422', () => {
    const err = new StateTransitionError('drafting', 'published');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('INVALID_STATE_TRANSITION');
    expect(err.message).toContain('drafting');
    expect(err.message).toContain('published');
  });
});
