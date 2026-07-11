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

  it('requires demo mode to be explicitly disabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SECRET_VAULT_ENCRYPTION_KEY = 'test-vault-key-at-least-32-characters-long';
    delete process.env.DEMO_MODE;

    const result = validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DEMO_MODE must be explicitly set to false in production');
  });

  it('accepts production runtime while every external write gate is disabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SECRET_VAULT_ENCRYPTION_KEY = 'test-vault-key-at-least-32-characters-long';
    for (const switchName of EXECUTION_KILL_SWITCHES) process.env[switchName] = 'false';

    const result = validateEnvironment();

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Production runtime is active with external execution disabled.');
  });

  it('rejects a provider write gate without the global execution gate', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SECRET_VAULT_ENCRYPTION_KEY = 'test-vault-key-at-least-32-characters-long';
    process.env.EXTERNAL_EXECUTION_ENABLED = 'false';
    process.env.POSTIZ_LIVE_ENABLED = 'true';

    const result = validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('POSTIZ_LIVE_ENABLED requires EXTERNAL_EXECUTION_ENABLED=true');
  });
});

describe('Execution Kill Switches', () => {
  it('has all expected kill switches', () => {
    expect(EXECUTION_KILL_SWITCHES).toContain('EXTERNAL_EXECUTION_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('M5_WRITE_EXECUTION_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('POSTIZ_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('POSTIZ_SANDBOX_SCHEDULING_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('CRM_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('GHL_SANDBOX_WRITE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('WHATSAPP_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('TELEGRAM_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('VOICE_CHAT_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('RENDERING_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('RESOURCESPACE_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('PAPERCLIP_SYNC_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('ANALYTICS_LIVE_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('OPENCLAW_ORCHESTRATION_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toContain('AGENTSCOPE_PROCESS_ENABLED');
    expect(EXECUTION_KILL_SWITCHES).toHaveLength(15);
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
