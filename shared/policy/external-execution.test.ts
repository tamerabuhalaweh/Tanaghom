import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { assertExternalExecutionAllowed, evaluateExternalExecution } from './external-execution';

const ORIGINAL_ENV = { ...process.env };

describe('external execution policy', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.DEMO_MODE = 'true';
    process.env.EXTERNAL_EXECUTION_ENABLED = 'false';
    process.env.M5_WRITE_EXECUTION_ENABLED = 'false';
    process.env.POSTIZ_LIVE_ENABLED = 'false';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('allows prepare/read style actions without M5', () => {
    const decision = evaluateExternalExecution({ system: 'postiz', action: 'prepare', executionMode: 'sandbox' });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresM5).toBe(false);
    expect(decision.label).toBe('Sandbox Ready');
  });

  it('blocks external writes when kill switches are disabled', () => {
    const decision = evaluateExternalExecution({
      system: 'postiz',
      action: 'schedule',
      executionMode: 'sandbox',
      approvalId: 'approval-1',
      capabilityResolutionId: 'capability-1',
      mcpMediationRequestId: 'mcp-1',
      humanApproved: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresM5).toBe(true);
    expect(decision.reasons).toContain('External execution kill switch is disabled');
    expect(decision.reasons).toContain('M5 write execution is disabled');
    expect(decision.reasons).toContain('POSTIZ_LIVE_ENABLED is disabled');
  });

  it('requires approval, capability resolution, and MCP mediation for writes', () => {
    process.env.EXTERNAL_EXECUTION_ENABLED = 'true';
    process.env.M5_WRITE_EXECUTION_ENABLED = 'true';
    process.env.POSTIZ_LIVE_ENABLED = 'true';

    const decision = evaluateExternalExecution({ system: 'postiz', action: 'schedule', executionMode: 'sandbox' });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('Human approval is required');
    expect(decision.reasons).toContain('Capability resolution is required');
    expect(decision.reasons).toContain('MCP mediation is required');
  });

  it('throws a ForbiddenError for blocked external writes', () => {
    expect(() => assertExternalExecutionAllowed({ system: 'whatsapp', action: 'send_message' })).toThrow(
      /External execution blocked/,
    );
  });
});
