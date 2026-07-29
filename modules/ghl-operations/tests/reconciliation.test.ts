import { describe, expect, it } from 'vitest';
import { compareReadBack } from '../repository';

const leadId = '11111111-1111-4111-8111-111111111111';

describe('GHL operation read-back reconciliation', () => {
  it('confirms only an opportunity that matches the approved provider payload', () => {
    const action = {
      type: 'opportunity_upsert' as const,
      leadId,
      pipelineId: 'pipeline-1',
      stageId: 'stage-sale',
      name: 'Leadership course sale',
      status: 'won' as const,
      monetaryValue: 2000,
      payment: {
        totalSaleValue: 2000,
        amountPaid: 2000,
        outstandingBalance: 0,
        paymentStatus: 'paid_in_full' as const,
        paymentDate: '2026-07-29T12:00:00.000Z',
        ticketQuantity: 2,
      },
      customFields: {},
    };
    const record = {
      preview_payload: {
        providerPayload: {
          pipelineId: 'pipeline-1',
          pipelineStageId: 'stage-sale',
          status: 'won',
          monetaryValue: 2000,
          customFields: [
            { id: 'amount-paid', fieldValue: 2000 },
            { id: 'ticket-quantity', fieldValue: 2 },
          ],
        },
      },
    };

    expect(
      compareReadBack(record as never, action, {
        opportunity: {
          pipelineId: 'pipeline-1',
          pipelineStageId: 'stage-sale',
          status: 'won',
          monetaryValue: 2000,
          customFields: [
            { id: 'amount-paid', fieldValue: 2000 },
            { id: 'ticket-quantity', fieldValue: 2 },
          ],
        },
      }),
    ).toEqual({ matches: true, reasons: [] });

    const mismatch = compareReadBack(record as never, action, {
      opportunity: {
        pipelineId: 'pipeline-1',
        pipelineStageId: 'stage-new-lead',
        status: 'open',
        monetaryValue: 0,
        customFields: [],
      },
    });
    expect(mismatch.matches).toBe(false);
    expect(mismatch.reasons).toEqual(
      expect.arrayContaining([
        'Pipeline stage was not confirmed by GHL',
        'Opportunity status was not confirmed by GHL',
        'Opportunity value was not confirmed by GHL',
        'Opportunity field amount-paid was not confirmed by GHL',
      ]),
    );
  });

  it('confirms tag removal only after the provider no longer returns the tag', () => {
    const action = {
      type: 'contact_tags_update' as const,
      leadId,
      addTags: [],
      removeTags: ['cold'],
    };
    const record = { preview_payload: { providerPayload: {} } };

    expect(
      compareReadBack(record as never, action, {
        contact: { tags: ['buyer'] },
      }),
    ).toEqual({ matches: true, reasons: [] });
    expect(
      compareReadBack(record as never, action, {
        contact: { tags: ['buyer', 'cold'] },
      }),
    ).toEqual({
      matches: false,
      reasons: ["Removed tag 'cold' is still present in GHL"],
    });
  });
});
