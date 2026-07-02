import { describe, it, expect } from 'vitest';
import { ValidationError } from '@shared/errors';
import {
  validateCreateEmailPlan,
  validateUpdateEmailPlan,
  validateCreateWhatsappPlan,
  validateCreateUpsellPlan,
  validateCreateContentRequirement,
  validateCreateSalesTask,
} from '../validators';

const validEventId = '550e8400-e29b-41d4-a716-446655440000';

describe('event-campaign-planner/validators', () => {
  describe('validateCreateEmailPlan', () => {
    it('accepts valid input', () => {
      const result = validateCreateEmailPlan({
        eventId: validEventId,
        sequenceName: 'Awareness Sequence',
        audienceSegment: 'Young professionals',
        emailCount: 3,
        contentType: 'html',
      });
      expect(result.sequenceName).toBe('Awareness Sequence');
      expect(result.emailCount).toBe(3);
    });

    it('rejects missing eventId', () => {
      expect(() => validateCreateEmailPlan({ sequenceName: 'Test' })).toThrow(ValidationError);
    });

    it('rejects empty sequenceName', () => {
      expect(() => validateCreateEmailPlan({ eventId: validEventId, sequenceName: '' })).toThrow(ValidationError);
    });

    it('rejects invalid emailCount', () => {
      expect(() => validateCreateEmailPlan({ eventId: validEventId, sequenceName: 'Test', emailCount: 0 })).toThrow(ValidationError);
    });
  });

  describe('validateUpdateEmailPlan', () => {
    it('accepts partial update', () => {
      const result = validateUpdateEmailPlan({ sequenceName: 'Updated' });
      expect(result.sequenceName).toBe('Updated');
    });

    it('accepts approval status change', () => {
      const result = validateUpdateEmailPlan({ approvalStatus: 'approved' });
      expect(result.approvalStatus).toBe('approved');
    });
  });

  describe('validateCreateWhatsappPlan', () => {
    it('accepts valid input', () => {
      const result = validateCreateWhatsappPlan({
        eventId: validEventId,
        audienceSegment: 'Registered attendees',
        frequency: 'Weekly',
        contentType: 'text',
      });
      expect(result.eventId).toBe(validEventId);
    });

    it('rejects invalid contentType', () => {
      expect(() => validateCreateWhatsappPlan({ eventId: validEventId, contentType: 'audio' })).toThrow(ValidationError);
    });
  });

  describe('validateCreateUpsellPlan', () => {
    it('accepts valid input', () => {
      const result = validateCreateUpsellPlan({
        eventId: validEventId,
        targetSegment: 'Early bird registrants',
        offer: 'VIP upgrade',
      });
      expect(result.targetSegment).toBe('Early bird registrants');
    });
  });

  describe('validateCreateContentRequirement', () => {
    it('accepts valid input', () => {
      const result = validateCreateContentRequirement({
        eventId: validEventId,
        assetType: 'video',
        description: '3 testimonial videos',
        platform: 'instagram',
      });
      expect(result.assetType).toBe('video');
    });

    it('rejects invalid assetType', () => {
      expect(() => validateCreateContentRequirement({ eventId: validEventId, assetType: 'invalid' })).toThrow(ValidationError);
    });
  });

  describe('validateCreateSalesTask', () => {
    it('accepts valid input', () => {
      const result = validateCreateSalesTask({
        eventId: validEventId,
        taskType: 'follow_up',
        ownerRole: 'sales_manager',
        description: 'Follow up within 2 hours',
      });
      expect(result.taskType).toBe('follow_up');
    });

    it('rejects invalid taskType', () => {
      expect(() => validateCreateSalesTask({ eventId: validEventId, taskType: 'invalid' })).toThrow(ValidationError);
    });
  });
});
