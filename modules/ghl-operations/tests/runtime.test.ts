import { afterEach, describe, expect, it } from 'vitest';
import {
  buildGhlExecutionReadiness,
  GHL_OPERATION_EXECUTION_FLAGS,
  operationRuntimeBlocker,
} from '../runtime';

const MANAGED_FLAGS = [
  'EXTERNAL_EXECUTION_ENABLED',
  'M5_WRITE_EXECUTION_ENABLED',
  'CRM_LIVE_ENABLED',
  'GHL_WRITE_BACK_ENABLED',
  'GHL_OPERATION_WORKER_ENABLED',
  'WHATSAPP_LIVE_ENABLED',
  ...Object.values(GHL_OPERATION_EXECUTION_FLAGS),
];

describe('GHL selective execution readiness', () => {
  afterEach(() => {
    for (const flag of MANAGED_FLAGS) delete process.env[flag];
  });

  it('requires the operation-specific flag in addition to global governance flags', () => {
    process.env.EXTERNAL_EXECUTION_ENABLED = 'true';
    process.env.M5_WRITE_EXECUTION_ENABLED = 'true';
    process.env.CRM_LIVE_ENABLED = 'true';
    process.env.GHL_WRITE_BACK_ENABLED = 'true';
    process.env.GHL_OPERATION_WORKER_ENABLED = 'true';
    process.env.GHL_CONTACT_UPSERT_ENABLED = 'true';

    const readiness = buildGhlExecutionReadiness({
      credentialsReady: true,
      webhookLastVerifiedAt: null,
    });

    expect(readiness.operations.contact_upsert).toMatchObject({
      enabled: true,
      state: 'live',
    });
    expect(readiness.operations.opportunity_upsert).toMatchObject({
      enabled: false,
      state: 'approval_only',
    });
    expect(operationRuntimeBlocker('opportunity_upsert')).toBe(
      'GHL_OPPORTUNITY_UPSERT_ENABLED is not true',
    );
  });

  it('keeps WhatsApp disabled independently of accepted CRM writes', () => {
    for (const flag of [
      'EXTERNAL_EXECUTION_ENABLED',
      'M5_WRITE_EXECUTION_ENABLED',
      'CRM_LIVE_ENABLED',
      'GHL_WRITE_BACK_ENABLED',
      'GHL_OPERATION_WORKER_ENABLED',
      'GHL_CONTACT_UPSERT_ENABLED',
      'GHL_CONTACT_TAGS_UPDATE_ENABLED',
      'GHL_OPPORTUNITY_UPSERT_ENABLED',
      'GHL_APPOINTMENT_UPSERT_ENABLED',
    ]) {
      process.env[flag] = 'true';
    }

    const readiness = buildGhlExecutionReadiness({
      credentialsReady: true,
      webhookLastVerifiedAt: null,
    });

    expect(readiness.operations.contact_upsert.enabled).toBe(true);
    expect(readiness.operations.contact_tags_update.enabled).toBe(true);
    expect(readiness.operations.opportunity_upsert.enabled).toBe(true);
    expect(readiness.operations.appointment_upsert.enabled).toBe(true);
    expect(readiness.operations.whatsapp_send).toMatchObject({
      enabled: false,
      state: 'approval_only',
    });
  });

  it('reports a verified signed callback without claiming registration from configuration alone', () => {
    process.env.GHL_WEBHOOK_ENABLED = 'true';
    const verifiedAt = new Date('2026-07-30T10:00:00.000Z');
    const readiness = buildGhlExecutionReadiness({
      credentialsReady: true,
      webhookLastVerifiedAt: verifiedAt,
    });

    expect(readiness.webhook).toMatchObject({
      enabled: true,
      liveVerified: true,
      state: 'verified',
      signatureMode: 'ed25519',
      lastVerifiedAt: verifiedAt.toISOString(),
    });
  });
});
