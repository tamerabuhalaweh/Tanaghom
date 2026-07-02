import { describe, it, expect } from 'vitest';
import { validateFieldMappings } from '../repository';
import { REQUIRED_KPI_FIELDS, KPI_FIELD_NAMES } from '../types';

describe('Field Mapping validation', () => {
  it('accepts valid mapping with all required fields', () => {
    const result = validateFieldMappings([
      { sourceField: 'Date', targetField: 'metricDate' },
      { sourceField: 'Platform', targetField: 'channel' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects mapping missing required metricDate', () => {
    const result = validateFieldMappings([
      { sourceField: 'Platform', targetField: 'channel' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain('metricDate');
  });

  it('rejects mapping missing required channel', () => {
    const result = validateFieldMappings([
      { sourceField: 'Date', targetField: 'metricDate' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain('channel');
  });

  it('rejects unknown target fields', () => {
    const result = validateFieldMappings([
      { sourceField: 'Date', targetField: 'metricDate' },
      { sourceField: 'Platform', targetField: 'channel' },
      { sourceField: 'Foo', targetField: 'unknownField' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.unknownTargetFields).toContain('unknownField');
  });

  it('accepts mapping with optional numeric fields', () => {
    const result = validateFieldMappings([
      { sourceField: 'Date', targetField: 'metricDate' },
      { sourceField: 'Platform', targetField: 'channel' },
      { sourceField: 'Views', targetField: 'reach' },
      { sourceField: 'Likes', targetField: 'interactions' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('validates all KPI field names are recognized', () => {
    expect(KPI_FIELD_NAMES).toContain('metricDate');
    expect(KPI_FIELD_NAMES).toContain('channel');
    expect(KPI_FIELD_NAMES).toContain('reach');
    expect(KPI_FIELD_NAMES).toContain('spend');
    expect(REQUIRED_KPI_FIELDS).toContain('metricDate');
    expect(REQUIRED_KPI_FIELDS).toContain('channel');
  });
});
