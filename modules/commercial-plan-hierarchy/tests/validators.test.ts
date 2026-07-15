import { describe, expect, it } from 'vitest';
import {
  assignPlanSchema,
  linkEventSchema,
  linkLearningSchema,
  supersedePlanSchema,
} from '../types';

const id = (suffix: string) => `00000000-0000-0000-0000-${suffix.padStart(12, '0')}`;

describe('commercial hierarchy validation', () => {
  it('accepts a complete parent assignment', () => {
    expect(assignPlanSchema.parse({ annualPlanId: id('1'), monthlyPortfolioItemId: id('2') })).toEqual({
      annualPlanId: id('1'),
      monthlyPortfolioItemId: id('2'),
    });
  });

  it('rejects malformed identifiers', () => {
    expect(() => assignPlanSchema.parse({ annualPlanId: 'annual', monthlyPortfolioItemId: 'month' })).toThrow();
  });

  it('rejects duplicate learning findings', () => {
    expect(() => linkLearningSchema.parse({ learningSetId: id('3'), findingIds: [id('4'), id('4')] })).toThrow();
  });

  it('defaults event links to non-primary without weakening exception text', () => {
    expect(linkEventSchema.parse({ eventId: id('5') })).toEqual({ eventId: id('5'), primary: false });
    expect(() => linkEventSchema.parse({ eventId: id('5'), periodExceptionReason: 'x' })).toThrow();
  });

  it('rejects self-inconsistent supersession requests at schema boundaries', () => {
    expect(supersedePlanSchema.parse({ replacementPlanId: id('6'), reason: 'New approved version' })).toEqual({
      replacementPlanId: id('6'),
      reason: 'New approved version',
    });
    expect(() => supersedePlanSchema.parse({ replacementPlanId: id('6'), reason: '' })).toThrow();
  });
});
