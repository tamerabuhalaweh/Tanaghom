import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const authMocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
}));

vi.mock('@shared/auth', () => ({
  verifyToken: authMocks.verifyToken,
}));

import { authenticate, requireRole } from './middleware';

function request(input: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...input,
  } as Request;
}

describe('authentication middleware', () => {
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without a bearer token', () => {
    expect(() => authenticate(request(), {} as Response, next)).toThrow(/Bearer token required/);
    expect(authMocks.verifyToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-bearer authorization schemes', () => {
    expect(() => authenticate(request({ headers: { authorization: 'Basic credential' } }), {} as Response, next)).toThrow(/Bearer token required/);
    expect(authMocks.verifyToken).not.toHaveBeenCalled();
  });

  it('attaches the verified session and continues', () => {
    const session = { sub: 'user-1', email: 'admin@example.com', role: 'admin', tenantKey: 'tenant-a' };
    authMocks.verifyToken.mockReturnValue(session);
    const req = request({ headers: { authorization: 'Bearer signed-token' } });

    authenticate(req, {} as Response, next);

    expect(authMocks.verifyToken).toHaveBeenCalledWith('signed-token');
    expect(req.user).toEqual(session);
    expect(next).toHaveBeenCalledOnce();
  });

  it('requires an authenticated session before checking roles', () => {
    const middleware = requireRole('admin', 'cco');
    expect(() => middleware(request(), {} as Response, next)).toThrow(/Authentication required/);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a role outside the allowed set without leaking credentials', () => {
    const middleware = requireRole('admin', 'cco');
    const req = request({ user: { sub: 'user-1', email: 'viewer@example.com', role: 'viewer' } });

    expect(() => middleware(req, {} as Response, next)).toThrow(/Role 'viewer' is not authorized/);
    expect(next).not.toHaveBeenCalled();
  });

  it('continues when the authenticated role is allowed', () => {
    const middleware = requireRole('admin', 'cco');
    const req = request({ user: { sub: 'user-1', email: 'cco@example.com', role: 'cco' } });

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
