import { createSign, generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { ValidationError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { checkGhlOperationPermission } from '../policy';
import { assertGhlOperationTransition, isTerminalGhlOperationStatus } from '../state-machine';
import {
  assertValidLegacyGhlWebhookSignature,
  assertValidGhlWebhookSignature,
  sha256,
} from '../signature';
import { ghlOperationActionSchema, prepareGhlOperationSchema } from '../types';

const leadId = '11111111-1111-4111-8111-111111111111';

describe('GHL commercial operation contracts', () => {
  afterEach(() => {
    delete process.env.GHL_WEBHOOK_PUBLIC_KEY;
    delete process.env.GHL_LEGACY_WEBHOOK_PUBLIC_KEY;
  });

  it('accepts an event-scoped opportunity and payment command', () => {
    const result = prepareGhlOperationSchema.parse({
      idempotencyKey: 'uat:opportunity:20260729',
      eventId: '22222222-2222-4222-8222-222222222222',
      action: {
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Leadership course sale',
        status: 'won',
        monetaryValue: 2000,
        payment: {
          totalSaleValue: 2000,
          amountPaid: 1000,
          outstandingBalance: 1000,
          paymentStatus: 'partial',
          paymentDate: '2026-07-29T12:00:00.000Z',
          ticketQuantity: 2,
        },
      },
    });

    expect(result.action).toMatchObject({
      type: 'opportunity_upsert',
      status: 'won',
      payment: {
        amountPaid: 1000,
        ticketQuantity: 2,
      },
    });
  });

  it('rejects payment greater than the total sale value', () => {
    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Invalid sale',
        payment: {
          totalSaleValue: 1000,
          amountPaid: 1001,
        },
      }),
    ).toThrow('Amount paid cannot exceed total sale value');
  });

  it('enforces complete and internally consistent payment evidence', () => {
    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Invalid outstanding balance',
        status: 'won',
        payment: {
          totalSaleValue: 2000,
          amountPaid: 1000,
          outstandingBalance: 500,
          paymentStatus: 'partial',
          paymentDate: '2026-07-29T12:00:00.000Z',
        },
      }),
    ).toThrow('Outstanding balance must equal total sale value minus amount paid');

    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Missing payment date',
        status: 'won',
        payment: {
          totalSaleValue: 2000,
          amountPaid: 2000,
          outstandingBalance: 0,
          paymentStatus: 'paid_in_full',
        },
      }),
    ).toThrow('Paid in full requires a payment date');
  });

  it('converts a missing payment date into a field-level application validation error', () => {
    expect.assertions(3);
    try {
      validateOrThrow(prepareGhlOperationSchema, {
        eventId: '22222222-2222-4222-8222-222222222222',
        action: {
          type: 'opportunity_upsert',
          leadId,
          pipelineId: 'pipeline-1',
          stageId: 'stage-sale',
          name: 'Partial payment without date',
          status: 'won',
          payment: {
            totalSaleValue: 1000,
            amountPaid: 400,
            outstandingBalance: 600,
            paymentStatus: 'partial',
          },
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
      expect((error as ValidationError).fields).toEqual({
        'action.payment.paymentDate': 'Partial payment requires a payment date',
      });
    }
  });

  it('requires Won status when a ticket is partially or fully paid', () => {
    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Partially paid ticket',
        status: 'open',
        monetaryValue: 1000,
        payment: {
          totalSaleValue: 1000,
          amountPaid: 400,
          outstandingBalance: 600,
          paymentStatus: 'partial',
          paymentDate: '2026-07-29T12:00:00.000Z',
          ticketQuantity: 1,
        },
      }),
    ).toThrow('A partial or fully paid sale must use Won opportunity status');

    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Fully paid ticket',
        status: 'open',
        monetaryValue: 1000,
        payment: {
          totalSaleValue: 1000,
          amountPaid: 1000,
          outstandingBalance: 0,
          paymentStatus: 'paid_in_full',
          paymentDate: '2026-07-29T12:00:00.000Z',
          ticketQuantity: 1,
        },
      }),
    ).toThrow('A partial or fully paid sale must use Won opportunity status');
  });

  it('requires an explicit payment status whenever money was received', () => {
    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'opportunity_upsert',
        leadId,
        pipelineId: 'pipeline-1',
        stageId: 'stage-sale',
        name: 'Unclassified payment',
        status: 'won',
        monetaryValue: 1000,
        payment: {
          totalSaleValue: 1000,
          amountPaid: 400,
          outstandingBalance: 600,
          paymentStatus: 'unknown',
          paymentDate: '2026-07-29T12:00:00.000Z',
          ticketQuantity: 1,
        },
      }),
    ).toThrow('A received payment requires an explicit payment status');
  });

  it('rejects empty or contradictory tag updates', () => {
    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'contact_tags_update',
        leadId,
        addTags: [],
        removeTags: [],
      }),
    ).toThrow('Add or remove at least one tag');

    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'contact_tags_update',
        leadId,
        addTags: ['buyer'],
        removeTags: ['buyer'],
      }),
    ).toThrow('The same tag cannot be added and removed in one operation');

    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'contact_tags_update',
        leadId,
        addTags: ['buyer'],
        removeTags: ['cold'],
      }),
    ).toThrow('Additions and removals must be prepared as separate CRM actions');
  });

  it('requires the meeting to end after it starts', () => {
    expect(() =>
      ghlOperationActionSchema.parse({
        type: 'appointment_upsert',
        leadId,
        calendarId: 'calendar-1',
        title: 'Sales consultation',
        startTime: '2026-07-30T10:00:00.000Z',
        endTime: '2026-07-30T09:30:00.000Z',
      }),
    ).toThrow('Meeting end time must be after the start time');
  });

  it('separates preparation from approval and execution roles', () => {
    expect(() =>
      checkGhlOperationPermission('marketing_manager', 'ghl-operations:prepare'),
    ).not.toThrow();
    expect(() =>
      checkGhlOperationPermission('sales_manager', 'ghl-operations:send-whatsapp'),
    ).not.toThrow();
    expect(() =>
      checkGhlOperationPermission('marketing_manager', 'ghl-operations:approve'),
    ).toThrow();
    expect(() => checkGhlOperationPermission('sales_manager', 'ghl-operations:execute')).toThrow();
    expect(() => checkGhlOperationPermission('cco', 'ghl-operations:execute')).not.toThrow();
  });

  it('enforces the approval and reconciliation state machine', () => {
    expect(() => assertGhlOperationTransition('previewed', 'pending_approval')).not.toThrow();
    expect(() => assertGhlOperationTransition('pending_approval', 'approved')).not.toThrow();
    expect(() => assertGhlOperationTransition('provider_accepted', 'reconciled')).not.toThrow();
    expect(() => assertGhlOperationTransition('previewed', 'provider_accepted')).toThrow();
    expect(isTerminalGhlOperationStatus('reconciled')).toBe(true);
    expect(isTerminalGhlOperationStatus('approved')).toBe(false);
  });

  it('verifies the exact raw webhook body with an Ed25519 signature', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    process.env.GHL_WEBHOOK_PUBLIC_KEY = publicKey
      .export({
        type: 'spki',
        format: 'pem',
      })
      .toString();
    const rawBody = Buffer.from(
      JSON.stringify({ type: 'OpportunityUpdate', locationId: 'location-1' }),
    );
    const signature = sign(null, rawBody, privateKey).toString('base64');

    expect(() => assertValidGhlWebhookSignature(rawBody, signature)).not.toThrow();
    expect(() => assertValidGhlWebhookSignature(Buffer.from('changed'), signature)).toThrow(
      'Invalid GoHighLevel webhook signature',
    );
    expect(sha256(rawBody)).toHaveLength(64);
  });

  it('supports the documented legacy RSA webhook signature only when configured', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const rawBody = Buffer.from(
      JSON.stringify({ type: 'OpportunityUpdate', locationId: 'location-1' }),
    );
    const signer = createSign('SHA256');
    signer.update(rawBody);
    signer.end();
    const signature = signer.sign(privateKey).toString('base64');

    expect(() => assertValidLegacyGhlWebhookSignature(rawBody, signature)).toThrow(
      'Legacy GoHighLevel webhook verification is not configured',
    );

    process.env.GHL_LEGACY_WEBHOOK_PUBLIC_KEY = publicKey
      .export({
        type: 'spki',
        format: 'pem',
      })
      .toString();
    expect(() => assertValidLegacyGhlWebhookSignature(rawBody, signature)).not.toThrow();
    expect(() => assertValidLegacyGhlWebhookSignature(Buffer.from('changed'), signature)).toThrow(
      'Invalid legacy GoHighLevel webhook signature',
    );
  });
});
