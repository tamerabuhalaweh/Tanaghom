import { describe, it, expect } from 'vitest';
import { validateGenerateDraft, validateReviseDraft, validateSaveEditedDraft } from '../validators';
import { ValidationError } from '@shared/errors';

describe('ai-generation/validators', () => {
  describe('generateDraft', () => {
    it('accepts valid input with campaignRequestId only', () => {
      const result = validateGenerateDraft({
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.campaignRequestId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('accepts with platforms override', () => {
      const result = validateGenerateDraft({
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
        platforms: ['linkedin', 'x'],
      });
      expect(result.platforms).toEqual(['linkedin', 'x']);
    });

    it('accepts with tone override', () => {
      const result = validateGenerateDraft({
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
        tone: 'casual',
      });
      expect(result.tone).toBe('casual');
    });

    it('rejects invalid campaignRequestId', () => {
      expect(() => validateGenerateDraft({ campaignRequestId: 'not-a-uuid' })).toThrow(ValidationError);
    });

    it('rejects invalid platform', () => {
      expect(() =>
        validateGenerateDraft({
          campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
          platforms: ['invalid_platform'],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid tone', () => {
      expect(() =>
        validateGenerateDraft({
          campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
          tone: 'aggressive',
        }),
      ).toThrow(ValidationError);
    });

    it('rejects empty platforms array', () => {
      expect(() =>
        validateGenerateDraft({
          campaignRequestId: '550e8400-e29b-41d4-a716-446655440000',
          platforms: [],
        }),
      ).toThrow(ValidationError);
    });
  });

  describe('reviseDraft', () => {
    it('accepts valid input', () => {
      const result = validateReviseDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        feedback: 'Make the hook stronger',
      });
      expect(result.feedback).toBe('Make the hook stronger');
    });

    it('accepts with tone', () => {
      const result = validateReviseDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        feedback: 'More casual tone',
        tone: 'casual',
      });
      expect(result.tone).toBe('casual');
    });

    it('rejects empty feedback', () => {
      expect(() =>
        validateReviseDraft({
          contentItemId: '550e8400-e29b-41d4-a716-446655440000',
          feedback: '',
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid contentItemId', () => {
      expect(() =>
        validateReviseDraft({
          contentItemId: 'bad',
          feedback: 'Please revise',
        }),
      ).toThrow(ValidationError);
    });
  });

  describe('saveEditedDraft', () => {
    it('accepts valid human-edited draft text', () => {
      const result = validateSaveEditedDraft({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        draftText: 'Approved human-edited LinkedIn copy.',
        editNote: 'Tightened CTA',
      });
      expect(result.draftText).toBe('Approved human-edited LinkedIn copy.');
    });

    it('rejects empty human-edited draft text', () => {
      expect(() =>
        validateSaveEditedDraft({
          contentItemId: '550e8400-e29b-41d4-a716-446655440000',
          draftText: '',
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid content item id', () => {
      expect(() =>
        validateSaveEditedDraft({
          contentItemId: 'bad',
          draftText: 'Copy',
        }),
      ).toThrow(ValidationError);
    });
  });
});
