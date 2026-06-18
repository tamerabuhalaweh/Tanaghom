const REQUIRED_VARS = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'] as const;

const WEAK_JWT_SECRETS = [
  'dev-secret-change-in-production',
  'change-me-to-a-random-secret-at-least-32-chars',
  'secret',
  'jwt-secret',
  'test',
];

export const EXECUTION_KILL_SWITCHES = [
  'EXTERNAL_EXECUTION_ENABLED',
  'M5_WRITE_EXECUTION_ENABLED',
  'POSTIZ_LIVE_ENABLED',
  'CRM_LIVE_ENABLED',
  'WHATSAPP_LIVE_ENABLED',
  'RENDERING_LIVE_ENABLED',
  'RESOURCESPACE_LIVE_ENABLED',
  'PAPERCLIP_SYNC_ENABLED',
  'ANALYTICS_LIVE_ENABLED',
] as const;

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters');
    }
    if (WEAK_JWT_SECRETS.includes(jwtSecret)) {
      errors.push('JWT_SECRET is a known weak/default value. Change it before deployment.');
    }
  }

  // Validate execution kill switches — hard failures in demo mode
  const isDemo = process.env.DEMO_MODE === 'true' || !process.env.DEMO_MODE;
  for (const switchName of EXECUTION_KILL_SWITCHES) {
    const value = process.env[switchName];
    if (value && value !== 'false' && value !== '0') {
      if (isDemo) {
        errors.push(`DEMO MODE VIOLATION: ${switchName} cannot be enabled in demo mode`);
      } else {
        warnings.push(`${switchName} is enabled (${value}). Live execution should be disabled in demo mode.`);
      }
    }
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' && process.env.DEMO_MODE === 'true') {
    warnings.push('DEMO_MODE is enabled in production environment.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';
}

export function isLiveExecutionEnabled(): boolean {
  return process.env.EXTERNAL_EXECUTION_ENABLED === 'true';
}

export function isM5WriteEnabled(): boolean {
  return process.env.M5_WRITE_EXECUTION_ENABLED === 'true';
}

export function assertDemoSafe(): void {
  if (isDemoMode()) {
    if (isLiveExecutionEnabled()) {
      throw new Error('DEMO MODE VIOLATION: External execution cannot be enabled in demo mode');
    }
    if (isM5WriteEnabled()) {
      throw new Error('DEMO MODE VIOLATION: M5 write execution cannot be enabled in demo mode');
    }
  }
}
