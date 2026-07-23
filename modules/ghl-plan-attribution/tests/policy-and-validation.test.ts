import { describe, expect, it } from 'vitest';
import { checkGhlAttributionPermission } from '../policy';
import { createAttributionMappingSchema, previewAttributionMatchSchema } from '../types';

const planId = '11111111-1111-4111-8111-111111111111';

describe('plan-scoped GHL attribution policy and validation', () => {
  it.each(['cco', 'department_head', 'marketing_manager'])(
    'allows %s to prepare draft plan mappings',
    (role) => {
      expect(() => checkGhlAttributionPermission(role, 'ghl-attribution:create')).not.toThrow();
    },
  );

  it('reserves final mapping approval for the CCO', () => {
    expect(() => checkGhlAttributionPermission('cco', 'ghl-attribution:approve')).not.toThrow();
    expect(() => checkGhlAttributionPermission('admin', 'ghl-attribution:approve')).toThrow();
    expect(() =>
      checkGhlAttributionPermission('department_head', 'ghl-attribution:approve'),
    ).toThrow();
  });

  it('requires a plan-specific pipeline, tag, source, or custom-field rule', () => {
    expect(() =>
      createAttributionMappingSchema.parse({
        commercialPlanId: planId,
        locationId: 'location-1',
      }),
    ).toThrow();
    expect(
      createAttributionMappingSchema.parse({
        commercialPlanId: planId,
        locationId: 'location-1',
        identifyingTags: ['leadership-course-2026'],
      }).identifyingTags,
    ).toEqual(['leadership-course-2026']);
  });

  it('keeps unresolved customer payment and ticket fields optional', () => {
    const mapping = createAttributionMappingSchema.parse({
      commercialPlanId: planId,
      locationId: 'location-1',
      pipelineId: 'pipeline-1',
    });
    expect(mapping.paymentAmountField).toBeUndefined();
    expect(mapping.ticketQuantityField).toBeUndefined();
  });

  it('validates read-only matching candidates', () => {
    expect(
      previewAttributionMatchSchema.parse({
        pipelineId: 'pipeline-1',
        tags: ['buyer'],
        source: 'meta',
      }).tags,
    ).toEqual(['buyer']);
  });
});

