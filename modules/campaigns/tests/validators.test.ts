import { describe, it, expect } from 'vitest';
import { validateCreateCampaign, validateUpdateCampaign, validateTransition } from '../validators';
import { ValidationError } from '@shared/errors';

describe('campaigns/validators', () => {
  const validCreate = {
    topic: 'New blood test package launch',
    objective: 'Announce new comprehensive blood test package',
    audience: 'Health-conscious professionals aged 25-55',
    targetPlatforms: ['linkedin', 'instagram'],
    ownerDepartmentId: '550e8400-e29b-41d4-a716-446655440000',
    contentType: 'campaign',
    riskCategory: 'medium',
  };

  describe('createCampaign', () => {
    it('accepts valid input', () => {
      const result = validateCreateCampaign(validCreate);
      expect(result.topic).toBe('New blood test package launch');
      expect(result.targetPlatforms).toEqual(['linkedin', 'instagram']);
      expect(result.contentType).toBe('campaign');
      expect(result.riskCategory).toBe('medium');
    });

    it('accepts with optional fields', () => {
      const result = validateCreateCampaign({
        ...validCreate,
        deadline: '2026-07-01T10:00:00Z',
        cta: 'Book your screening today',
        mediaRequirements: 'Carousel with 5 slides',
      });
      expect(result.deadline).toBe('2026-07-01T10:00:00Z');
      expect(result.cta).toBe('Book your screening today');
    });

    it('rejects missing topic', () => {
      const noTopic = { ...validCreate };
      delete (noTopic as Record<string, unknown>).topic;
      expect(() => validateCreateCampaign(noTopic)).toThrow(ValidationError);
    });

    it('rejects empty objective', () => {
      expect(() => validateCreateCampaign({ ...validCreate, objective: '' })).toThrow(ValidationError);
    });

    it('rejects empty targetPlatforms', () => {
      expect(() => validateCreateCampaign({ ...validCreate, targetPlatforms: [] })).toThrow(ValidationError);
    });

    it('rejects invalid contentType', () => {
      expect(() => validateCreateCampaign({ ...validCreate, contentType: 'invalid' })).toThrow(ValidationError);
    });

    it('rejects invalid riskCategory', () => {
      expect(() => validateCreateCampaign({ ...validCreate, riskCategory: 'extreme' })).toThrow(ValidationError);
    });

    it('rejects invalid ownerDepartmentId', () => {
      expect(() => validateCreateCampaign({ ...validCreate, ownerDepartmentId: 'not-a-uuid' })).toThrow(ValidationError);
    });

    it('rejects invalid deadline format', () => {
      expect(() => validateCreateCampaign({ ...validCreate, deadline: 'not-a-date' })).toThrow(ValidationError);
    });
  });

  describe('updateCampaign', () => {
    it('accepts partial update', () => {
      const result = validateUpdateCampaign({ topic: 'Updated topic' });
      expect(result.topic).toBe('Updated topic');
    });

    it('accepts platform change', () => {
      const result = validateUpdateCampaign({ targetPlatforms: ['x'] });
      expect(result.targetPlatforms).toEqual(['x']);
    });

    it('accepts risk category change', () => {
      const result = validateUpdateCampaign({ riskCategory: 'high' });
      expect(result.riskCategory).toBe('high');
    });

    it('rejects invalid contentType', () => {
      expect(() => validateUpdateCampaign({ contentType: 'bad' })).toThrow(ValidationError);
    });
  });

  describe('transition', () => {
    it('accepts valid transition', () => {
      const result = validateTransition({ toState: 'drafting' });
      expect(result.toState).toBe('drafting');
    });

    it('accepts with reason', () => {
      const result = validateTransition({ toState: 'rejected', reason: 'Duplicate campaign' });
      expect(result.reason).toBe('Duplicate campaign');
    });

    it('rejects invalid state', () => {
      expect(() => validateTransition({ toState: 'invalid_state' })).toThrow(ValidationError);
    });
  });
});
