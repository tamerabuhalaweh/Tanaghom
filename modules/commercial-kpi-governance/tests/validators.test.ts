import { describe, expect, it } from 'vitest';
import {
  createKpiTargetSchema,
  eventCapacitySchema,
  transitionKpiTargetSchema,
} from '../types';

const eventId = '11111111-1111-4111-8111-111111111111';

describe('commercial KPI governance validation', () => {
  it('accepts a properly scoped adjustable event KPI', () => {
    const result = createKpiTargetSchema.parse({
      metricKey: 'ticket_sales',
      label: 'Ticket sales',
      unit: 'count',
      direction: 'target',
      scope: 'event',
      controlMode: 'adjustable',
      targetValue: 500,
      eventId,
    });
    expect(result.eventId).toBe(eventId);
  });

  it('rejects ambiguous or mismatched business scope references', () => {
    expect(() =>
      createKpiTargetSchema.parse({
        metricKey: 'ticket_sales',
        label: 'Ticket sales',
        unit: 'count',
        direction: 'target',
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: 500,
        eventId,
        annualPlanId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toThrow();
    expect(() =>
      createKpiTargetSchema.parse({
        metricKey: 'ticket_sales',
        label: 'Ticket sales',
        unit: 'count',
        direction: 'target',
        scope: 'annual_strategy',
        controlMode: 'locked',
        targetValue: 500,
        eventId,
      }),
    ).toThrow();
  });

  it('requires currency for currency targets and bounds for target ranges', () => {
    expect(() =>
      createKpiTargetSchema.parse({
        metricKey: 'event_budget',
        label: 'Event budget',
        unit: 'currency',
        direction: 'target',
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: 5000,
        eventId,
      }),
    ).toThrow();
    expect(() =>
      createKpiTargetSchema.parse({
        metricKey: 'daily_cpl',
        label: 'Daily cost per lead',
        unit: 'currency',
        currency: 'AED',
        direction: 'target_range',
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: 50,
        eventId,
      }),
    ).toThrow();
  });

  it('enforces absolute sellable venue capacity', () => {
    expect(
      eventCapacitySchema.parse({
        venueCapacity: 500,
        sellableTicketCapacity: 480,
        source: 'Signed venue agreement',
      }).sellableTicketCapacity,
    ).toBe(480);
    expect(() =>
      eventCapacitySchema.parse({
        venueCapacity: 500,
        sellableTicketCapacity: 501,
        source: 'Signed venue agreement',
      }),
    ).toThrow();
  });

  it('accepts complete operating thresholds and rejects unsafe threshold order', () => {
    expect(
      createKpiTargetSchema.parse({
        metricKey: 'cost_per_lead',
        label: 'Maximum cost per lead',
        unit: 'currency',
        currency: 'AED',
        direction: 'maximum',
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: 40,
        warningValue: 45,
        criticalValue: 60,
        eventId,
      }).criticalValue,
    ).toBe(60);
    expect(() =>
      createKpiTargetSchema.parse({
        metricKey: 'cost_per_lead',
        label: 'Maximum cost per lead',
        unit: 'currency',
        currency: 'AED',
        direction: 'maximum',
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: 40,
        warningValue: 35,
        criticalValue: 60,
        eventId,
      }),
    ).toThrow(/warning threshold cannot be below/i);
    expect(() =>
      createKpiTargetSchema.parse({
        metricKey: 'interaction_rate',
        label: 'Minimum interaction rate',
        unit: 'percentage',
        direction: 'minimum',
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: 8,
        warningValue: 7,
        eventId,
      }),
    ).toThrow(/configured together/i);
  });

  it('requires optimistic revision for state changes', () => {
    expect(
      transitionKpiTargetSchema.parse({ expectedRevision: 1, action: 'approve' }).action,
    ).toBe('approve');
    expect(() => transitionKpiTargetSchema.parse({ action: 'approve' })).toThrow();
  });
});
