import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateLeadInput, UpdateLeadInput, LeadSummary,
  UpdateMeetingInput, UpdatePurchaseInput,
  SetTemperatureInput, LeadStatus, LeadTemperature,
  EventDashboardSummary,
} from './types';

export async function listLeads(
  tenantKey: string,
  eventId?: string,
  status?: LeadStatus,
  temperature?: LeadTemperature,
): Promise<LeadSummary[]> {
  const where: Prisma.LeadCaptureRecordWhereInput = { tenant_key: tenantKey };
  if (eventId) where.event_id = eventId;
  if (status) where.lead_status = status;
  if (temperature) where.lead_temperature = temperature;

  const leads = await prisma.leadCaptureRecord.findMany({
    where,
    orderBy: { updated_at: 'desc' },
  });
  return leads.map(mapLead);
}

export async function getLeadById(tenantKey: string, id: string): Promise<LeadSummary> {
  const lead = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!lead) throw new NotFoundError('LeadCaptureRecord', id);
  return mapLead(lead);
}

export async function createLead(tenantKey: string, userId: string, agentRepId: string, input: CreateLeadInput): Promise<LeadSummary> {
  const lead = await prisma.leadCaptureRecord.create({
    data: {
      tenant_key: tenantKey,
      event_id: input.eventId,
      lead_name_placeholder: input.leadName,
      lead_email_placeholder: input.leadEmail,
      lead_phone_placeholder: input.leadPhone,
      platform: input.platform,
      lead_source: input.leadSource,
      audience_source: input.audienceSource,
      channel_attribution: input.channelAttribution,
      sales_notes: input.salesNotes,
      lead_status: 'new_lead',
      lead_temperature: 'cold',
      consent_status: 'pending',
      created_by_user_id: userId,
      created_by_agent_rep_id: agentRepId,
    },
  });

  await prisma.leadLifecycleEvent.create({
    data: {
      tenant_key: tenantKey,
      lead_id: lead.id,
      to_status: 'new_lead',
      actor_user_id: userId,
      reason: 'Lead created',
    },
  });

  return mapLead(lead);
}

export async function updateLead(tenantKey: string, id: string, input: UpdateLeadInput): Promise<LeadSummary> {
  const existing = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('LeadCaptureRecord', id);

  const data: Prisma.LeadCaptureRecordUpdateInput = {};
  if (input.leadName !== undefined) data.lead_name_placeholder = input.leadName;
  if (input.leadEmail !== undefined) data.lead_email_placeholder = input.leadEmail;
  if (input.leadPhone !== undefined) data.lead_phone_placeholder = input.leadPhone;
  if (input.platform !== undefined) data.platform = input.platform;
  if (input.leadSource !== undefined) data.lead_source = input.leadSource;
  if (input.audienceSource !== undefined) data.audience_source = input.audienceSource;
  if (input.channelAttribution !== undefined) data.channel_attribution = input.channelAttribution;
  if (input.leadTemperature !== undefined) data.lead_temperature = input.leadTemperature;
  if (input.salesNotes !== undefined) data.sales_notes = input.salesNotes;
  if (input.nextAction !== undefined) data.next_action = input.nextAction;
  if (input.followUpDate !== undefined) data.follow_up_date = input.followUpDate ? new Date(input.followUpDate) : null;

  const lead = await prisma.leadCaptureRecord.update({ where: { id }, data });
  return mapLead(lead);
}

export async function transitionLead(tenantKey: string, id: string, toStatus: LeadStatus, userId: string, reason?: string): Promise<LeadSummary> {
  const existing = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('LeadCaptureRecord', id);

  const lead = await prisma.leadCaptureRecord.update({
    where: { id },
    data: { lead_status: toStatus },
  });

  await prisma.leadLifecycleEvent.create({
    data: {
      tenant_key: tenantKey,
      lead_id: id,
      from_status: existing.lead_status,
      to_status: toStatus,
      actor_user_id: userId,
      reason,
    },
  });

  return mapLead(lead);
}

export async function updateMeeting(tenantKey: string, id: string, input: UpdateMeetingInput): Promise<LeadSummary> {
  const existing = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('LeadCaptureRecord', id);

  const lead = await prisma.leadCaptureRecord.update({
    where: { id },
    data: {
      meeting_date: new Date(input.meetingDate),
      meeting_type: input.meetingType,
      meeting_outcome: input.meetingOutcome,
      lead_status: 'meeting_booked',
    },
  });

  await prisma.leadLifecycleEvent.create({
    data: {
      tenant_key: tenantKey,
      lead_id: id,
      from_status: existing.lead_status,
      to_status: 'meeting_booked',
      reason: `Meeting scheduled: ${input.meetingType}`,
      metadata: { meetingDate: input.meetingDate, meetingType: input.meetingType },
    },
  });

  return mapLead(lead);
}

export async function updatePurchase(tenantKey: string, id: string, input: UpdatePurchaseInput): Promise<LeadSummary> {
  const existing = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('LeadCaptureRecord', id);

  const lead = await prisma.leadCaptureRecord.update({
    where: { id },
    data: {
      purchase_date: new Date(input.purchaseDate),
      purchase_amount: new Prisma.Decimal(input.purchaseAmount),
      purchase_reference: input.purchaseReference,
      lead_status: 'purchased',
    },
  });

  await prisma.leadLifecycleEvent.create({
    data: {
      tenant_key: tenantKey,
      lead_id: id,
      from_status: existing.lead_status,
      to_status: 'purchased',
      reason: 'Purchase recorded',
      metadata: { purchaseDate: input.purchaseDate, purchaseAmount: input.purchaseAmount },
    },
  });

  return mapLead(lead);
}

export async function setTemperature(tenantKey: string, id: string, input: SetTemperatureInput, userId: string): Promise<LeadSummary> {
  const existing = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('LeadCaptureRecord', id);

  const lead = await prisma.leadCaptureRecord.update({
    where: { id },
    data: { lead_temperature: input.temperature },
  });

  await prisma.leadLifecycleEvent.create({
    data: {
      tenant_key: tenantKey,
      lead_id: id,
      to_status: existing.lead_status,
      from_temperature: existing.lead_temperature,
      to_temperature: input.temperature,
      actor_user_id: userId,
      reason: input.reason,
    },
  });

  return mapLead(lead);
}

export async function getEventDashboard(tenantKey: string, eventId: string): Promise<EventDashboardSummary> {
  const leads = await prisma.leadCaptureRecord.findMany({
    where: { tenant_key: tenantKey, event_id: eventId },
  });

  const byStatus: Record<string, number> = {};
  const byTemperature: Record<string, number> = {};
  const byAudienceSource: Record<string, number> = {};
  const byChannelAttribution: Record<string, number> = {};
  let upcomingFollowUps = 0;
  let meetingsScheduled = 0;
  let purchases = 0;
  let totalRevenue = 0;

  for (const lead of leads) {
    byStatus[lead.lead_status] = (byStatus[lead.lead_status] || 0) + 1;
    byTemperature[lead.lead_temperature] = (byTemperature[lead.lead_temperature] || 0) + 1;
    if (lead.audience_source) byAudienceSource[lead.audience_source] = (byAudienceSource[lead.audience_source] || 0) + 1;
    if (lead.channel_attribution) byChannelAttribution[lead.channel_attribution] = (byChannelAttribution[lead.channel_attribution] || 0) + 1;
    if (lead.follow_up_date && lead.follow_up_date > new Date()) upcomingFollowUps++;
    if (lead.meeting_date && !lead.purchase_date) meetingsScheduled++;
    if (lead.purchase_date) {
      purchases++;
      if (lead.purchase_amount) totalRevenue += Number(lead.purchase_amount);
    }
  }

  return {
    eventId,
    totalLeads: leads.length,
    byStatus: byStatus as Record<LeadStatus, number>,
    byTemperature: byTemperature as Record<LeadTemperature, number>,
    byAudienceSource,
    byChannelAttribution,
    upcomingFollowUps,
    meetingsScheduled,
    purchases,
    totalRevenue,
  };
}

function mapLead(l: Record<string, unknown>): LeadSummary {
  return {
    id: l.id as string,
    tenantKey: l.tenant_key as string,
    leadStatus: l.lead_status as LeadSummary['leadStatus'],
    leadTemperature: l.lead_temperature as LeadSummary['leadTemperature'],
    audienceSource: l.audience_source as LeadSummary['audienceSource'],
    channelAttribution: l.channel_attribution as LeadSummary['channelAttribution'],
    leadSource: l.lead_source as string | null,
    eventId: l.event_id as string | null,
    platform: l.platform as string | null,
    leadName: l.lead_name_placeholder as string | null,
    leadPhone: l.lead_phone_placeholder as string | null,
    leadEmail: l.lead_email_placeholder as string | null,
    consentStatus: l.consent_status as string,
    salesNotes: l.sales_notes as string | null,
    nextAction: l.next_action as string | null,
    followUpDate: l.follow_up_date as Date | null,
    meetingDate: l.meeting_date as Date | null,
    meetingType: l.meeting_type as string | null,
    meetingOutcome: l.meeting_outcome as string | null,
    purchaseDate: l.purchase_date as Date | null,
    purchaseAmount: l.purchase_amount != null ? Number(l.purchase_amount) : null,
    purchaseReference: l.purchase_reference as string | null,
    createdAt: l.created_at as Date,
    updatedAt: l.updated_at as Date,
  };
}
