import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateExternalExecution } from './external-execution';

const ORIGINAL_ENV = { ...process.env };

describe('external execution policy', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.DEMO_MODE = 'true';
    process.env.EXTERNAL_EXECUTION_ENABLED = 'false';
    process.env.M5_WRITE_EXECUTION_ENABLED = 'false';
    process.env.CRM_LIVE_ENABLED = 'false';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('allows prepare operations without external write flags', () => {
    const decision = evaluateExternalExecution({ system: 'postiz', action: 'prepare', executionMode: 'sandbox' });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresM5).toBe(false);
    expect(decision.label).toBe('Sandbox Ready');
  });

  it('blocks CRM writes by default', () => {
    const decision = evaluateExternalExecution({
      system: 'gohighlevel',
      action: 'write',
      executionMode: 'sandbox',
      approvalId: 'approval-1',
      capabilityResolutionId: 'capability-1',
      mcpMediationRequestId: 'mcp-1',
      humanApproved: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.label).toBe('M5 Disabled');
    expect(decision.reasons).toContain('External execution kill switch is disabled');
    expect(decision.reasons).toContain('M5 write execution is disabled');
    expect(decision.reasons).toContain('CRM_LIVE_ENABLED is disabled');
  });
});
