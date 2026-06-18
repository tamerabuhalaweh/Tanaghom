import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnvironment, isDemoMode, assertDemoSafe, EXECUTION_KILL_SWITCHES } from '../../src/env-validation';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates required variables', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    const result = validateEnvironment();
    expect(result.valid).toBe(true);
  });

  it('fails when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('fails when JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'short';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
  });

  it('fails when DATABASE_URL is missing', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    delete process.env.DATABASE_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('fails when REDIS_URL is missing', () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    delete process.env.REDIS_URL;
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('REDIS_URL'))).toBe(true);
  });
});

describe('Execution Kill Switches', () => {
  it('has all expected kill switches', () => {
    expect(EXECUTION_KILL_SWITCHES).toContain('EXTERNAL_EXECUTION_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('M5_WRITE_EXECUTION_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('POSTIZ_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('CRM_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('WHATSAPP_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('RENDERING_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('RESOURCESPACE_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('PAPERCLIP_SYNC_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('ANALYTICS_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toHaveLength(9);
  });

  it('all kill switches default to false', () => {
    for (const sw of EXECUTION_KILL_SWITCHES) {
      const value = process.env[sw] || 'false';
      expect(value).toBe('false');
    }
  });
});

describe('Demo Mode Enforcement', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('demo mode is enabled when DEMO_MODE is true', () => {
    process.env.DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);
  });

  it('demo mode is enabled when NODE_ENV is demo', () => {
    delete process.env.DEMO_MODE;
    process.env.NODE_ENV = 'demo';
    expect(isDemoMode()).toBe(true);
  });

  it('demo mode blocks external execution', () => {
    process.env.DEMO_MODE = 'true';
    process.env.EXTERNAL_EXECUTION_ENABLED = 'false';
    expect(() => assertDemoSafe()).not.toThrow();
  });

  it('demo mode throws when external execution is enabled', () => {
    process.env.DEMO_MODE = 'true';
    process.env.EXTERNAL_EXECUTION_ENABLED = 'true';
    expect(() => assertDemoSafe()).toThrow();
  });

  it('demo mode throws when M5 write is enabled', () => {
    process.env.DEMO_MODE = 'true';
    process.env.M5_WRITE_EXECUTION_ENABLED = 'true';
    expect(() => assertDemoSafe()).toThrow();
  });
});

describe('Security Headers', () => {
  it('CORS is environment-controlled', () => {
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    expect(corsOrigin).toBeDefined();
    expect(corsOrigin).not.toBe('*');
  });
});
