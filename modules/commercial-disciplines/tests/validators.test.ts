import { describe, expect, it } from 'vitest';
import { ValidationError } from '@shared/errors';
import {
  validateCreateDisciplineRecord,
  validateListDisciplineRecordsQuery,
  validateUpdateDisciplineRecord,
} from '../validators';

describe('Commercial discipline validators', () => {
  it('validates a Brand & Positioning record using an allowed category', () => {
    expect(validateCreateDisciplineRecord({
      discipline: 'brand_positioning',
      category: 'brand_voice',
      title: 'Voice guardrail for leadership content',
      summary: 'Use motivational language without unrealistic claims.',
      priority: 'high',
    })).toMatchObject({
      discipline: 'brand_positioning',
      category: 'brand_voice',
      priority: 'high',
    });
  });

  it('rejects a category that belongs to a different discipline', () => {
    expect(() => validateCreateDisciplineRecord({
      discipline: 'brand_positioning',
      category: 'approved_script',
      title: 'Wrong category',
    })).toThrow(ValidationError);
  });

  it('validates filters for workspace records', () => {
    expect(validateListDisciplineRecordsQuery({
      discipline: 'conversion_closing',
      status: 'active',
      priority: 'critical',
    })).toMatchObject({
      discipline: 'conversion_closing',
      status: 'active',
      priority: 'critical',
    });
  });

  it('rejects empty updates', () => {
    expect(() => validateUpdateDisciplineRecord({})).toThrow(ValidationError);
  });
});
