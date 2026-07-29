import { describe, expect, it } from 'vitest';
import {
  buildOpportunityCustomFields,
  buildOpportunityProviderPayload,
} from '../repository';

const action = {
  type: 'opportunity_upsert' as const,
  leadId: '11111111-1111-4111-8111-111111111111',
  pipelineId: 'pipeline-1',
  stageId: 'stage-sale',
  name: 'Partially paid ticket',
  status: 'won' as const,
  monetaryValue: 1000,
  payment: {
    totalSaleValue: 1000,
    amountPaid: 400,
    outstandingBalance: 600,
    paymentStatus: 'partial' as const,
    paymentDate: '2026-07-27T12:00:00.000Z',
    ticketQuantity: 1,
  },
  customFields: {},
};

const mapping = {
  sale_value_field: null,
  payment_amount_field: 'opportunity.amount_paid_aed',
  ticket_quantity_field: 'opportunity.ticket_quantity',
  payment_status_field: 'opportunity.payment_status',
  payment_date_field: 'opportunity.payment_date',
} as unknown as Parameters<typeof buildOpportunityCustomFields>[1];

const definitions = [
  {
    id: 'amount-id',
    key: 'opportunity.amount_paid_aed',
    name: 'Amount Paid AED',
    dataType: 'MONETORY',
    picklistOptions: [],
  },
  {
    id: 'quantity-id',
    key: 'opportunity.ticket_quantity',
    name: 'Ticket Quantity',
    dataType: 'NUMERICAL',
    picklistOptions: [],
  },
  {
    id: 'status-id',
    key: 'opportunity.payment_status',
    name: 'Payment Status',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['Partial', 'Paid in Full', 'Refunded', 'Cancelled', 'Unknown'],
  },
  {
    id: 'date-id',
    key: 'opportunity.payment_date',
    name: 'Payment Date',
    dataType: 'DATE',
    picklistOptions: [],
  },
];

describe('GHL opportunity custom-field contract', () => {
  it('keeps location and contact only on create payloads', () => {
    expect(
      buildOpportunityProviderPayload(action, 'location-1', 'contact-1', null, []),
    ).toEqual(
      expect.objectContaining({
        locationId: 'location-1',
        contactId: 'contact-1',
        pipelineId: 'pipeline-1',
        pipelineStageId: 'stage-sale',
      }),
    );
  });

  it('removes location and contact from update payloads', () => {
    const payload = buildOpportunityProviderPayload(
      action,
      'location-1',
      'contact-1',
      'opportunity-1',
      [],
    );

    expect(payload).not.toHaveProperty('locationId');
    expect(payload).not.toHaveProperty('contactId');
    expect(payload).toEqual(
      expect.objectContaining({
        pipelineId: 'pipeline-1',
        pipelineStageId: 'stage-sale',
        name: 'Partially paid ticket',
        status: 'won',
        monetaryValue: 1000,
      }),
    );
  });

  it('resolves configured keys to live ids and provider-native values', () => {
    expect(buildOpportunityCustomFields(action, mapping, definitions)).toEqual({
      fields: [
        { id: 'amount-id', fieldValue: '400' },
        { id: 'quantity-id', fieldValue: '1' },
        { id: 'status-id', fieldValue: 'Partial' },
        { id: 'date-id', fieldValue: '2026-07-27' },
      ],
      blockers: [],
    });
  });

  it('blocks approval when a mapped field disappeared from GHL', () => {
    const result = buildOpportunityCustomFields(action, mapping, definitions.slice(0, 3));

    expect(result.fields).not.toContainEqual(expect.objectContaining({ id: 'date-id' }));
    expect(result.blockers).toEqual([
      'Mapped GHL opportunity field no longer exists: opportunity.payment_date',
    ]);
  });

  it('blocks a payment status that is not a live GHL option', () => {
    const incompatible = definitions.map((field) =>
      field.id === 'status-id' ? { ...field, picklistOptions: ['Awaiting payment'] } : field,
    );

    const result = buildOpportunityCustomFields(action, mapping, incompatible);

    expect(result.fields).not.toContainEqual(expect.objectContaining({ id: 'status-id' }));
    expect(result.blockers).toEqual(["Value 'partial' is not valid for GHL field Payment Status"]);
  });

  it('uses the explicit key property when live field definitions are unavailable', () => {
    const result = buildOpportunityCustomFields(action, mapping);

    expect(result.fields).toContainEqual({
      key: 'opportunity.amount_paid_aed',
      fieldValue: '400',
    });
    expect(result.blockers).toEqual([]);
  });
});
