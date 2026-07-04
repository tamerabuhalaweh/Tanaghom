import { z } from 'zod';

export const LEAD_STATUSES = [
  'new_lead', 'contacted', 'meeting_booked', 'meeting_attended',
  'no_show', 'purchased', 'lost', 'follow_up_needed',
  'qualified', 'nurturing', 'converted', 'archived',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TEMPERATURES = ['cold', 'warm', 'hot', 'buyer'] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const AUDIENCE_SOURCES = ['follower', 'non_follower', 'existing_customer', 'referral'] as const;
export type AudienceSource = (typeof AUDIENCE_SOURCES)[number];

export const CHANNEL_ATTRIBUTIONS = [
  'meta', 'instagram', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral', 'manual',
] as const;
export type ChannelAttribution = (typeof CHANNEL_ATTRIBUTIONS)[number];

export const LEAD_TRANSITION_TABLE: Record<LeadStatus, LeadStatus[]> = {
  new_lead: ['contacted', 'qualified', 'nurturing', 'lost'],
  contacted: ['meeting_booked', 'follow_up_needed', 'lost'],
  meeting_booked: ['meeting_attended', 'no_show', 'lost'],
  meeting_attended: ['purchased', 'follow_up_needed', 'lost'],
  no_show: ['follow_up_needed', 'lost'],
  purchased: ['archived'],
  lost: [],
  follow_up_needed: ['contacted', 'meeting_booked', 'lost'],
  qualified: ['meeting_booked', 'nurturing', 'lost'],
  nurturing: ['contacted', 'qualified', 'lost'],
  converted: ['archived'],
  archived: [],
};

export function isValidLeadTransition(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITION_TABLE[from]?.includes(to) ?? false;
}

export function validateLeadTransition(from: LeadStatus, to: LeadStatus): void {
  if (!isValidLeadTransition(from, to)) {
    throw new LeadTransitionError(from, to);
  }
}

export class LeadTransitionError extends Error {
  constructor(public readonly from: LeadStatus, public readonly to: LeadStatus) {
    super(`Invalid lead transition: ${from} -> ${to}`);
    this.name = 'LeadTransitionError';
  }
}

export const createLeadSchema = z.object({
  eventId: z.string().uuid().optional(),
  leadName: z.string().max(500).optional(),
  leadEmail: z.string().email().max(500).optional(),
  leadPhone: z.string().max(50).optional(),
  platform: z.string().max(200).optional(),
  leadSource: z.string().max(500).optional(),
  audienceSource: z.enum(AUDIENCE_SOURCES).optional(),
  channelAttribution: z.enum(CHANNEL_ATTRIBUTIONS).optional(),
  salesNotes: z.string().max(10000).optional(),
});

export const updateLeadSchema = z.object({
  leadName: z.string().max(500).nullable().optional(),
  leadEmail: z.string().email().max(500).nullable().optional(),
  leadPhone: z.string().max(50).nullable().optional(),
  platform: z.string().max(200).nullable().optional(),
  leadSource: z.string().max(500).nullable().optional(),
  audienceSource: z.enum(AUDIENCE_SOURCES).nullable().optional(),
  channelAttribution: z.enum(CHANNEL_ATTRIBUTIONS).nullable().optional(),
  leadTemperature: z.enum(LEAD_TEMPERATURES).optional(),
  salesNotes: z.string().max(10000).nullable().optional(),
  nextAction: z.string().max(5000).nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
});

export const transitionLeadSchema = z.object({
  toStatus: z.enum(LEAD_STATUSES),
  reason: z.string().max(2000).optional(),
});

export const updateMeetingSchema = z.object({
  meetingDate: z.string().datetime(),
  meetingType: z.string().max(200),
  meetingOutcome: z.string().max(5000).optional(),
});

export const updatePurchaseSchema = z.object({
  purchaseDate: z.string().datetime(),
  purchaseAmount: z.number().min(0),
  purchaseReference: z.string().max(500).optional(),
});

export const setTemperatureSchema = z.object({
  temperature: z.enum(LEAD_TEMPERATURES),
  reason: z.string().max(2000).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type TransitionLeadInput = z.infer<typeof transitionLeadSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type SetTemperatureInput = z.infer<typeof setTemperatureSchema>;

export interface LeadSummary {
  id: string;
  tenantKey: string;
  leadStatus: LeadStatus;
  leadTemperature: LeadTemperature;
  audienceSource: AudienceSource | null;
  channelAttribution: ChannelAttribution | null;
  leadSource: string | null;
  eventId: string | null;
  platform: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  consentStatus: string;
  salesNotes: string | null;
  nextAction: string | null;
  followUpDate: Date | null;
  meetingDate: Date | null;
  meetingType: string | null;
  meetingOutcome: string | null;
  purchaseDate: Date | null;
  purchaseAmount: number | null;
  purchaseReference: string | null;
  sourceOfTruth: 'tanaghum' | 'gohighlevel';
  externalSourceProvider: string | null;
  externalSourceId: string | null;
  externalOpportunityId: string | null;
  externalPipelineId: string | null;
  externalStageId: string | null;
  externalTags: string[];
  externalLastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventDashboardSummary {
  eventId: string;
  totalLeads: number;
  byStatus: Record<LeadStatus, number>;
  byTemperature: Record<LeadTemperature, number>;
  byAudienceSource: Record<string, number>;
  byChannelAttribution: Record<string, number>;
  upcomingFollowUps: number;
  meetingsScheduled: number;
  purchases: number;
  totalRevenue: number;
}

export interface LeadStatsSummary {
  total: number;
  qualified: number;
  nurturing: number;
  newLeads: number;
}
