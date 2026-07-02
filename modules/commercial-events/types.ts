import { z } from 'zod';

export const COMMERCIAL_EVENT_TYPES = [
  'tagyeer_wa_irtaqi',
  'moaaskar_al_tamayoz',
  'business_camp',
  'virtual_event',
] as const;

export type CommercialEventType = (typeof COMMERCIAL_EVENT_TYPES)[number];

export const COMMERCIAL_EVENT_STATUSES = [
  'draft',
  'planning',
  'active',
  'completed',
  'cancelled',
] as const;

export type CommercialEventStatus = (typeof COMMERCIAL_EVENT_STATUSES)[number];

export const EVENT_TRANSITION_TABLE: Record<CommercialEventStatus, CommercialEventStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isValidEventTransition(from: CommercialEventStatus, to: CommercialEventStatus): boolean {
  return EVENT_TRANSITION_TABLE[from]?.includes(to) ?? false;
}

export function validateEventTransition(from: CommercialEventStatus, to: CommercialEventStatus): void {
  if (!isValidEventTransition(from, to)) {
    throw new EventTransitionError(from, to);
  }
}

export class EventTransitionError extends Error {
  constructor(
    public readonly from: CommercialEventStatus,
    public readonly to: CommercialEventStatus,
  ) {
    super(`Invalid event state transition: ${from} → ${to}`);
    this.name = 'EventTransitionError';
  }
}

export const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(500),
  eventType: z.enum(COMMERCIAL_EVENT_TYPES),
  eventDate: z.string().datetime('Invalid event date'),
  location: z.string().max(500).optional(),
  campaignStartDate: z.string().datetime().optional(),
  campaignEndDate: z.string().datetime().optional(),
  expectedAttendance: z.number().int().min(0).optional(),
  revenueTarget: z.number().min(0).optional(),
  plannedBudget: z.number().min(0).optional(),
  offer: z.string().max(5000).optional(),
  audience: z.string().max(5000).optional(),
  geography: z.string().max(2000).optional(),
  fomoAngle: z.string().max(5000).optional(),
  upsellPlan: z.string().max(5000).optional(),
  selectedChannels: z.array(z.string()).optional(),
  contentDepartmentRequirements: z.string().max(5000).optional(),
  salesTeamRequirements: z.string().max(5000).optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  eventType: z.enum(COMMERCIAL_EVENT_TYPES).optional(),
  eventDate: z.string().datetime().optional(),
  location: z.string().max(500).nullable().optional(),
  campaignStartDate: z.string().datetime().nullable().optional(),
  campaignEndDate: z.string().datetime().nullable().optional(),
  expectedAttendance: z.number().int().min(0).nullable().optional(),
  revenueTarget: z.number().min(0).nullable().optional(),
  plannedBudget: z.number().min(0).nullable().optional(),
  offer: z.string().max(5000).nullable().optional(),
  audience: z.string().max(5000).nullable().optional(),
  geography: z.string().max(2000).nullable().optional(),
  fomoAngle: z.string().max(5000).nullable().optional(),
  upsellPlan: z.string().max(5000).nullable().optional(),
  selectedChannels: z.array(z.string()).optional(),
  contentDepartmentRequirements: z.string().max(5000).nullable().optional(),
  salesTeamRequirements: z.string().max(5000).nullable().optional(),
});

export const updateStrategySchema = z.object({
  offer: z.string().max(5000).nullable().optional(),
  audience: z.string().max(5000).nullable().optional(),
  geography: z.string().max(2000).nullable().optional(),
  fomoAngle: z.string().max(5000).nullable().optional(),
  upsellPlan: z.string().max(5000).nullable().optional(),
  selectedChannels: z.array(z.string()).optional(),
  contentDepartmentRequirements: z.string().max(5000).nullable().optional(),
  salesTeamRequirements: z.string().max(5000).nullable().optional(),
});

export const transitionEventSchema = z.object({
  toStatus: z.enum(COMMERCIAL_EVENT_STATUSES),
  reason: z.string().max(1000).optional(),
});

export const linkCampaignSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
});

export const linkLeadSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type UpdateStrategyInput = z.infer<typeof updateStrategySchema>;
export type TransitionEventInput = z.infer<typeof transitionEventSchema>;
export type LinkCampaignInput = z.infer<typeof linkCampaignSchema>;
export type LinkLeadInput = z.infer<typeof linkLeadSchema>;

export interface CommercialEventSummary {
  id: string;
  tenantKey: string;
  name: string;
  eventType: CommercialEventType;
  eventDate: Date;
  location: string | null;
  campaignStartDate: Date | null;
  campaignEndDate: Date | null;
  expectedAttendance: number | null;
  revenueTarget: number | null;
  plannedBudget: number | null;
  ownerUserId: string;
  ownerUserName: string | null;
  status: CommercialEventStatus;
  offer: string | null;
  audience: string | null;
  geography: string | null;
  fomoAngle: string | null;
  upsellPlan: string | null;
  selectedChannels: string[];
  contentDepartmentRequirements: string | null;
  salesTeamRequirements: string | null;
  campaignCount: number;
  leadCount: number;
  createdAt: Date;
  updatedAt: Date;
}
