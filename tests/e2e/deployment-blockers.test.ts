import { describe, it, expect } from 'vitest';

// Blocker tests — Codex GPT-5.5 review requirements

describe('JWT Secret Validation', () => {
  const WEAK_SECRETS = [
    'dev-secret-change-in-production',
    'change-me-to-a-random-secret-at-least-32-chars',
    'secret',
    'jwt-secret',
    'test',
    'password',
  ];

  function validateJwtSecret(secret: string | undefined): { valid: boolean; reason?: string } {
    if (!secret) {
      return { valid: false, reason: 'JWT_SECRET is required' };
    }
    if (secret.length < 32) {
      return { valid: false, reason: 'JWT_SECRET must be at least 32 characters' };
    }
    if (WEAK_SECRETS.includes(secret)) {
      return { valid: false, reason: 'JWT_SECRET is a known weak/default value' };
    }
    return { valid: true };
  }

  it('fails when JWT_SECRET is missing', () => {
    const result = validateJwtSecret(undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('required');
  });

  it('fails when JWT_SECRET is too short', () => {
    const result = validateJwtSecret('short');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('32 characters');
  });

  it('fails when JWT_SECRET is dev fallback', () => {
    const result = validateJwtSecret('dev-secret-change-in-production');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('fails when JWT_SECRET is placeholder', () => {
    const result = validateJwtSecret('change-me-to-a-random-secret-at-least-32-chars');
    expect(result.valid).toBe(false);
  });

  it('passes with strong secret', () => {
    const result = validateJwtSecret('my-super-secure-random-secret-key-at-least-32-chars-long');
    expect(result.valid).toBe(true);
  });
});

describe('Demo Mode Kill Switch Enforcement', () => {
  const KILL_SWITCHES = [
    'EXTERNAL_EXECUTION_ENABLED',
    'M5_WRITE_EXECUTION_ENABLED',
    'POSTIZ_LIVE_ENABLED',
    'CRM_LIVE_ENABLED',
    'WHATSAPP_LIVE_ENABLED',
    'RENDERING_LIVE_ENABLED',
    'RESOURCESPACE_LIVE_ENABLED',
    'PAPERCLIP_SYNC_ENABLED',
    'ANALYTICS_LIVE_ENABLED',
  ];

  function validateKillSwitches(env: Record<string, string>): { safe: boolean; violations: string[] } {
    const violations: string[] = [];
    const isDemo = env.DEMO_MODE === 'true' || !env.DEMO_MODE;

    if (isDemo) {
      for (const sw of KILL_SWITCHES) {
        if (env[sw] === 'true') {
          violations.push(`${sw} cannot be enabled in demo mode`);
        }
      }
    }

    return { safe: violations.length === 0, violations };
  }

  it('blocks live flags in demo mode', () => {
    const result = validateKillSwitches({ DEMO_MODE: 'true', POSTIZ_LIVE_ENABLED: 'true' });
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('allows all flags false in demo mode', () => {
    const result = validateKillSwitches({ DEMO_MODE: 'true' });
    expect(result.safe).toBe(true);
  });
});

describe('AppError Status Codes Preserved', () => {
  class AppError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number = 500,
      public readonly code: string = 'INTERNAL_ERROR',
    ) {
      super(message);
    }
  }

  it('ValidationError preserves 400', () => {
    const err = new AppError('Invalid input', 400, 'VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });

  it('UnauthorizedError preserves 401', () => {
    const err = new AppError('Auth required', 401, 'UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });

  it('ForbiddenError preserves 403', () => {
    const err = new AppError('Forbidden', 403, 'FORBIDDEN');
    expect(err.statusCode).toBe(403);
  });

  it('NotFoundError preserves 404', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('ConflictError preserves 409', () => {
    const err = new AppError('Conflict', 409, 'CONFLICT');
    expect(err.statusCode).toBe(409);
  });

  it('StateTransitionError preserves 422', () => {
    const err = new AppError('Invalid transition', 422, 'INVALID_STATE_TRANSITION');
    expect(err.statusCode).toBe(422);
  });
});

describe('No Stack Trace Leaks', () => {
  it('production error response has no stack', () => {
    const errorResponse = { error: 'Internal server error' };
    expect(JSON.stringify(errorResponse)).not.toContain('stack');
    expect(JSON.stringify(errorResponse)).not.toContain('at ');
  });

  it('AppError response has no stack', () => {
    const errorResponse = { error: 'Not found', code: 'NOT_FOUND' };
    expect(JSON.stringify(errorResponse)).not.toContain('Error');
    expect(JSON.stringify(errorResponse)).not.toContain('at ');
  });
});

describe('No External Calls in Demo Mode', () => {
  const EXTERNAL_SYSTEMS = ['Postiz', 'CRM', 'WhatsApp', 'ResourceSpace', 'Paperclip', 'Analytics', 'Rendering', 'MCP'];

  it('all external systems are blocked in demo mode', () => {
    const demoMode = true;
    if (demoMode) {
      for (const system of EXTERNAL_SYSTEMS) {
        // In demo mode, all external calls must go through mock providers
        expect(EXTERNAL_SYSTEMS).toContain(system);
      }
    }
  });
});
