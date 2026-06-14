import { describe, it, expect } from 'vitest';
import { validateScoreDraft, validateAddRule } from '../validators';
import { ValidationError } from '@shared/errors';

describe('Algorithm Intelligence Validators', () => {
  describe('scoreDraft', () => {
    it('accepts valid input', () => {
      const result = validateScoreDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        platform: 'linkedin',
        draftText: 'Test draft content',
      });
      expect(result.platform).toBe('linkedin');
    });

    it('accepts with all optional fields', () => {
      const result = validateScoreDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        platform: 'instagram',
        draftText: 'Test content',
        objective: 'Promote',
        audience: 'Professionals',
        cta: 'Learn more',
        hashtags: ['#test'],
        contentType: 'reel',
        riskCategory: 'medium',
      });
      expect(result.riskCategory).toBe('medium');
    });

    it('rejects invalid contentItemId', () => {
      expect(() => validateScoreDraft({
        contentItemId: 'bad',
        platform: 'linkedin',
        draftText: 'Test',
      })).toThrow(ValidationError);
    });

    it('rejects empty platform', () => {
      expect(() => validateScoreDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        platform: '',
        draftText: 'Test',
      })).toThrow(ValidationError);
    });

    it('rejects empty draftText', () => {
      expect(() => validateScoreDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        platform: 'linkedin',
        draftText: '',
      })).toThrow(ValidationError);
    });

    it('rejects invalid riskCategory', () => {
      expect(() => validateScoreDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        platform: 'linkedin',
        draftText: 'Test',
        riskCategory: 'extreme',
      })).toThrow(ValidationError);
    });
  });

  describe('addRule', () => {
    it('accepts valid input', () => {
      const result = validateAddRule({
        platform: 'linkedin',
        ruleType: 'length',
        ruleValue: '1300 chars max',
      });
      expect(result.platform).toBe('linkedin');
    });

    it('accepts with optional fields', () => {
      const result = validateAddRule({
        platform: 'instagram',
        ruleType: 'hashtags',
        ruleValue: '3-5 relevant hashtags',
        sourceUrl: 'https://creators.instagram.com',
        sourceType: 'official_docs',
        confidence: 'high',
        owner: 'marketing',
      });
      expect(result.confidence).toBe('high');
    });

    it('rejects invalid sourceUrl', () => {
      expect(() => validateAddRule({
        platform: 'linkedin',
        ruleType: 'length',
        ruleValue: '1300',
        sourceUrl: 'not-a-url',
      })).toThrow(ValidationError);
    });
  });
});
