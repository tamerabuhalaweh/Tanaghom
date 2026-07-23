import { describe, expect, it } from 'vitest';
import { evaluateGhlAttribution, readGhlCustomField } from '../matcher';

const baseMapping = {
  pipeline_id: 'pipeline-live-events',
  identifying_tags: ['event-2026'],
  source_values: ['registration-form'],
  match_mode: 'any' as const,
  custom_field_rules: [],
};

describe('GHL plan attribution matcher', () => {
  it('matches pipeline, tags, and source without case-sensitive failures', () => {
    const result = evaluateGhlAttribution(baseMapping, {
      pipelineIds: ['PIPELINE-LIVE-EVENTS'],
      tags: ['Event-2026'],
      source: 'Registration-Form',
      customFields: {},
    });

    expect(result.matched).toBe(true);
    expect(result.checks).toEqual([
      { rule: 'pipeline', matched: true },
      { rule: 'tags', matched: true },
      { rule: 'source', matched: true },
    ]);
  });

  it('requires every configured rule in all mode', () => {
    const result = evaluateGhlAttribution(
      { ...baseMapping, match_mode: 'all' },
      {
        pipelineIds: ['pipeline-live-events'],
        tags: ['different-tag'],
        source: 'registration-form',
        customFields: {},
      },
    );

    expect(result.matched).toBe(false);
  });

  it('does not fabricate a custom-field match when GHL omitted the field', () => {
    const result = evaluateGhlAttribution(
      {
        pipeline_id: null,
        identifying_tags: [],
        source_values: [],
        match_mode: 'any',
        custom_field_rules: [
          { field: 'product_code', operator: 'equals', value: 'course-2026' },
        ],
      },
      {
        pipelineIds: [],
        tags: [],
        source: null,
        customFields: {},
      },
    );

    expect(result.matched).toBe(false);
    expect(result.missingCustomFields).toEqual(['product_code']);
  });

  it('reads customer-configured GHL field names case-insensitively', () => {
    expect(readGhlCustomField({ Amount_Paid: '750' }, 'amount_paid')).toBe('750');
    expect(readGhlCustomField({ Amount_Paid: '750' }, null)).toBeUndefined();
  });
});
