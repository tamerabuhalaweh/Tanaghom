import { describe, it, expect } from 'vitest';
import { ValidationError } from '@shared/errors';
import {
  validateCreateLead,
  validateUpdateLead,
  validateTransitionLead,
  validateUpdateMeeting,
  validateUpdatePurchase,
  validateSetTemperature,
} from '../validators';

describe('lead-lifecycle/validators', () => {
  describe('validateCreateLead', () => {
    it('accepts valid input', () => {
      const result = validateCreateLead({
        leadName: 'Ahmed Al-Rashid',
        leadEmail: 'ahmed@example.com',
        platform: 'instagram',
        audienceSource: 'follower',
        channelAttribution: 'instagram',
      });
      expect(result.leadName).toBe('Ahmed Al-Rashid');
      expect(result.audienceSource).toBe('follower');
    });

    it('accepts minimal input', () => {
      const result = validateCreateLead({});
      expect(result).toBeDefined();
    });

    it('rejects invalid email', () => {
      expect(() => validateCreateLead({ leadEmail: 'not-an-email' })).toThrow(ValidationError);
    });

    it('rejects invalid audienceSource', () => {
      expect(() => validateCreateLead({ audienceSource: 'invalid' })).toThrow(ValidationError);
    });

    it('rejects invalid channelAttribution', () => {
      expect(() => validateCreateLead({ channelAttribution: 'invalid' })).toThrow(ValidationError);
    });
  });

  describe('validateUpdateLead', () => {
    it('accepts partial update', () => {
      const result = validateUpdateLead({ leadName: 'Updated', leadTemperature: 'hot' });
      expect(result.leadName).toBe('Updated');
      expect(result.leadTemperature).toBe('hot');
    });

    it('rejects invalid temperature', () => {
      expect(() => validateUpdateLead({ leadTemperature: 'invalid' })).toThrow(ValidationError);
    });
  });

  describe('validateTransitionLead', () => {
    it('accepts valid transition', () => {
      const result = validateTransitionLead({ toStatus: 'contacted' });
      expect(result.toStatus).toBe('contacted');
    });

    it('accepts with reason', () => {
      const result = validateTransitionLead({ toStatus: 'lost', reason: 'No response' });
      expect(result.reason).toBe('No response');
    });

    it('rejects invalid status', () => {
      expect(() => validateTransitionLead({ toStatus: 'invalid' })).toThrow(ValidationError);
    });
  });

  describe('validateUpdateMeeting', () => {
    it('accepts valid input', () => {
      const result = validateUpdateMeeting({
        meetingDate: '2026-07-22T14:00:00Z',
        meetingType: 'Discovery call',
      });
      expect(result.meetingType).toBe('Discovery call');
    });

    it('rejects missing meetingDate', () => {
      expect(() => validateUpdateMeeting({ meetingType: 'Call' })).toThrow(ValidationError);
    });
  });

  describe('validateUpdatePurchase', () => {
    it('accepts valid input', () => {
      const result = validateUpdatePurchase({
        purchaseDate: '2026-08-15T10:00:00Z',
        purchaseAmount: 1200,
      });
      expect(result.purchaseAmount).toBe(1200);
    });

    it('rejects negative amount', () => {
      expect(() => validateUpdatePurchase({
        purchaseDate: '2026-08-15T10:00:00Z',
        purchaseAmount: -100,
      })).toThrow(ValidationError);
    });
  });

  describe('validateSetTemperature', () => {
    it('accepts valid temperature', () => {
      const result = validateSetTemperature({ temperature: 'hot' });
      expect(result.temperature).toBe('hot');
    });

    it('rejects invalid temperature', () => {
      expect(() => validateSetTemperature({ temperature: 'invalid' })).toThrow(ValidationError);
    });
  });
});
