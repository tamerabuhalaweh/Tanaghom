import { describe, it, expect } from 'vitest';
import {
  validateCreateEvent,
  validateUpdateEvent,
  validateUpdateStrategy,
  validateTransitionEvent,
  validateLinkCampaign,
  validateLinkLead,
} from '../validators';
import { ValidationError } from '@shared/errors';

describe('commercial-events/validators', () => {
  const validCreate = {
    name: 'Tagyeer wa Irtaqi — July 2026',
    eventType: 'tagyeer_wa_irtaqi',
    eventDate: '2026-07-15T18:00:00Z',
    location: 'Riyadh, Saudi Arabia',
    campaignStartDate: '2026-06-15T00:00:00Z',
    campaignEndDate: '2026-07-15T23:59:59Z',
    expectedAttendance: 150,
    revenueTarget: 75000,
    plannedBudget: 20000,
    offer: 'Early bird 20% off for first 50 registrants',
    audience: 'Young professionals aged 25-40 interested in career development',
    geography: 'Riyadh, Jeddah, Dammam',
    fomoAngle: 'Only 150 seats available — last event sold out in 3 days',
    upsellPlan: 'VIP package with 1-on-1 coaching session',
    selectedChannels: ['instagram', 'whatsapp', 'email'],
    contentDepartmentRequirements: '3 video testimonials, 10 social posts, 1 landing page',
    salesTeamRequirements: 'Follow up within 24 hours of registration, discovery call script',
  };

  describe('validateCreateEvent', () => {
    it('accepts valid input', () => {
      const result = validateCreateEvent(validCreate);
      expect(result.name).toBe('Tagyeer wa Irtaqi — July 2026');
      expect(result.eventType).toBe('tagyeer_wa_irtaqi');
      expect(result.expectedAttendance).toBe(150);
      expect(result.selectedChannels).toEqual(['instagram', 'whatsapp', 'email']);
    });

    it('accepts minimal input', () => {
      const result = validateCreateEvent({
        name: 'Test Event',
        eventType: 'virtual_event',
        eventDate: '2026-08-01T10:00:00Z',
      });
      expect(result.name).toBe('Test Event');
      expect(result.location).toBeUndefined();
      expect(result.selectedChannels).toBeUndefined();
    });

    it('rejects missing name', () => {
      const noName = { ...validCreate };
      delete (noName as Record<string, unknown>).name;
      expect(() => validateCreateEvent(noName)).toThrow(ValidationError);
    });

    it('rejects empty name', () => {
      expect(() => validateCreateEvent({ ...validCreate, name: '' })).toThrow(ValidationError);
    });

    it('rejects invalid eventType', () => {
      expect(() => validateCreateEvent({ ...validCreate, eventType: 'invalid_type' })).toThrow(ValidationError);
    });

    it('rejects invalid eventDate format', () => {
      expect(() => validateCreateEvent({ ...validCreate, eventDate: 'not-a-date' })).toThrow(ValidationError);
    });

    it('rejects negative expectedAttendance', () => {
      expect(() => validateCreateEvent({ ...validCreate, expectedAttendance: -5 })).toThrow(ValidationError);
    });

    it('rejects negative revenueTarget', () => {
      expect(() => validateCreateEvent({ ...validCreate, revenueTarget: -100 })).toThrow(ValidationError);
    });

    it('accepts campaignStartDate before eventDate', () => {
      const result = validateCreateEvent({
        ...validCreate,
        campaignStartDate: '2026-06-01T00:00:00Z',
        eventDate: '2026-07-15T18:00:00Z',
      });
      expect(result.campaignStartDate).toBe('2026-06-01T00:00:00Z');
    });

    it('accepts campaignEndDate after campaignStartDate', () => {
      const result = validateCreateEvent({
        ...validCreate,
        campaignStartDate: '2026-06-01T00:00:00Z',
        campaignEndDate: '2026-07-15T17:00:00Z',
      });
      expect(result.campaignEndDate).toBe('2026-07-15T17:00:00Z');
    });
  });

  describe('validateUpdateEvent', () => {
    it('accepts partial update', () => {
      const result = validateUpdateEvent({ name: 'Updated Event Name' });
      expect(result.name).toBe('Updated Event Name');
    });

    it('accepts date change', () => {
      const result = validateUpdateEvent({ eventDate: '2026-08-01T10:00:00Z' });
      expect(result.eventDate).toBe('2026-08-01T10:00:00Z');
    });

    it('accepts null location', () => {
      const result = validateUpdateEvent({ location: null });
      expect(result.location).toBeNull();
    });

    it('rejects invalid eventType', () => {
      expect(() => validateUpdateEvent({ eventType: 'bad' })).toThrow(ValidationError);
    });
  });

  describe('validateUpdateStrategy', () => {
    it('accepts partial strategy update', () => {
      const result = validateUpdateStrategy({
        offer: 'New offer: 30% off',
        fomoAngle: 'Last 20 seats remaining',
      });
      expect(result.offer).toBe('New offer: 30% off');
      expect(result.fomoAngle).toBe('Last 20 seats remaining');
    });

    it('accepts channels update', () => {
      const result = validateUpdateStrategy({ selectedChannels: ['linkedin', 'x'] });
      expect(result.selectedChannels).toEqual(['linkedin', 'x']);
    });

    it('accepts empty object', () => {
      const result = validateUpdateStrategy({});
      expect(result).toEqual({});
    });
  });

  describe('validateTransitionEvent', () => {
    it('accepts valid transition', () => {
      const result = validateTransitionEvent({ toStatus: 'planning' });
      expect(result.toStatus).toBe('planning');
    });

    it('accepts with reason', () => {
      const result = validateTransitionEvent({ toStatus: 'cancelled', reason: 'Venue unavailable' });
      expect(result.reason).toBe('Venue unavailable');
    });

    it('rejects invalid status', () => {
      expect(() => validateTransitionEvent({ toStatus: 'invalid_status' })).toThrow(ValidationError);
    });
  });

  describe('validateLinkCampaign', () => {
    it('accepts valid campaign ID', () => {
      const result = validateLinkCampaign({ campaignId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.campaignId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('rejects invalid UUID', () => {
      expect(() => validateLinkCampaign({ campaignId: 'not-a-uuid' })).toThrow(ValidationError);
    });
  });

  describe('validateLinkLead', () => {
    it('accepts valid lead ID', () => {
      const result = validateLinkLead({ leadId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.leadId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('rejects invalid UUID', () => {
      expect(() => validateLinkLead({ leadId: 'not-a-uuid' })).toThrow(ValidationError);
    });
  });
});
