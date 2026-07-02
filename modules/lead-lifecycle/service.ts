import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { LEAD_LIFECYCLE_EVENTS, type LeadLifecycleEvent } from './events';
import { checkLeadPermission, checkLeadTransitionPermission } from './policy';
import { validateLeadTransition, type LeadStatus } from './types';
import * as repo from './repository';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  LeadSummary,
  TransitionLeadInput,
  UpdateMeetingInput,
  UpdatePurchaseInput,
  SetTemperatureInput,
  EventDashboardSummary,
  LeadStatsSummary,
} from './types';

export async function listLeads(
  role: string,
  tenantKey: string,
  eventId?: string,
  status?: LeadStatus,
  temperature?: LeadSummary['leadTemperature'],
): Promise<LeadSummary[]> {
  checkLeadPermission(role, 'leads:read');
  return repo.listLeads(tenantKey, eventId, status, temperature);
}

export async function getLead(role: string, tenantKey: string, id: string): Promise<LeadSummary> {
  checkLeadPermission(role, 'leads:read');
  return repo.getLeadById(tenantKey, id);
}

export async function createLead(
  role: string,
  tenantKey: string,
  userId: string,
  agentRepId: string,
  input: CreateLeadInput,
): Promise<LeadSummary> {
  checkLeadPermission(role, 'leads:create');
  const lead = await repo.createLead(tenantKey, userId, agentRepId, input);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_created', object_type: 'lead_capture_record', object_id: lead.id, result: 'success' },
    `Lead created: ${lead.leadName || 'unnamed'}`,
  );
  await eventBus.emit(LEAD_LIFECYCLE_EVENTS.LEAD_CREATED, {
    leadId: lead.id,
    tenantKey,
    eventId: input.eventId,
    actorUserId: userId,
    timestamp: new Date(),
  } as LeadLifecycleEvent);
  return lead;
}

export async function updateLead(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateLeadInput,
): Promise<LeadSummary> {
  checkLeadPermission(role, 'leads:update');
  const lead = await repo.updateLead(tenantKey, id, input);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_updated', object_type: 'lead_capture_record', object_id: id, result: 'success' },
    'Lead updated',
  );
  await eventBus.emit(LEAD_LIFECYCLE_EVENTS.LEAD_UPDATED, {
    leadId: id,
    tenantKey,
    actorUserId: userId,
    timestamp: new Date(),
  } as LeadLifecycleEvent);
  return lead;
}

export async function transitionLead(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: TransitionLeadInput,
): Promise<LeadSummary> {
  checkLeadTransitionPermission(role, input.toStatus);
  const current = await repo.getLeadById(tenantKey, id);
  validateLeadTransition(current.leadStatus, input.toStatus);
  const lead = await repo.transitionLead(tenantKey, id, input.toStatus, userId, input.reason);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_status_changed', object_type: 'lead_capture_record', object_id: id, result: 'success' },
    `Lead status: ${current.leadStatus} -> ${input.toStatus}`,
  );
  await eventBus.emit(LEAD_LIFECYCLE_EVENTS.LEAD_STATUS_CHANGED, {
    leadId: id,
    tenantKey,
    fromStatus: current.leadStatus,
    toStatus: input.toStatus,
    actorUserId: userId,
    timestamp: new Date(),
  } as LeadLifecycleEvent);
  return lead;
}

export async function updateMeeting(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateMeetingInput,
): Promise<LeadSummary> {
  checkLeadPermission(role, 'leads:record_meeting');
  const current = await repo.getLeadById(tenantKey, id);
  if (current.leadStatus !== 'meeting_booked') {
    validateLeadTransition(current.leadStatus, 'meeting_booked');
  }
  const lead = await repo.updateMeeting(tenantKey, id, input, userId);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_meeting_recorded', object_type: 'lead_capture_record', object_id: id, result: 'success' },
    `Meeting recorded: ${input.meetingType}`,
  );
  await eventBus.emit(LEAD_LIFECYCLE_EVENTS.LEAD_MEETING_RECORDED, {
    leadId: id,
    tenantKey,
    actorUserId: userId,
    timestamp: new Date(),
  } as LeadLifecycleEvent);
  return lead;
}

export async function updatePurchase(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdatePurchaseInput,
): Promise<LeadSummary> {
  checkLeadPermission(role, 'leads:record_purchase');
  const current = await repo.getLeadById(tenantKey, id);
  validateLeadTransition(current.leadStatus, 'purchased');
  const lead = await repo.updatePurchase(tenantKey, id, input, userId);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_purchase_recorded', object_type: 'lead_capture_record', object_id: id, result: 'success' },
    `Purchase recorded: ${input.purchaseAmount}`,
  );
  await eventBus.emit(LEAD_LIFECYCLE_EVENTS.LEAD_PURCHASE_RECORDED, {
    leadId: id,
    tenantKey,
    actorUserId: userId,
    timestamp: new Date(),
  } as LeadLifecycleEvent);
  return lead;
}

export async function setTemperature(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: SetTemperatureInput,
): Promise<LeadSummary> {
  checkLeadPermission(role, 'leads:set_temperature');
  const lead = await repo.setTemperature(tenantKey, id, input, userId);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_temperature_changed', object_type: 'lead_capture_record', object_id: id, result: 'success' },
    `Temperature set to ${input.temperature}`,
  );
  await eventBus.emit(LEAD_LIFECYCLE_EVENTS.LEAD_TEMPERATURE_CHANGED, {
    leadId: id,
    tenantKey,
    toTemperature: input.temperature,
    actorUserId: userId,
    timestamp: new Date(),
  } as LeadLifecycleEvent);
  return lead;
}

export async function qualifyLead(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
): Promise<{ lead: LeadSummary; qualificationScore: number }> {
  checkLeadPermission(role, 'leads:transition');
  const current = await repo.getLeadById(tenantKey, id);
  const qualificationScore = deriveQualificationScore(current);
  const toStatus: LeadStatus = qualificationScore >= 80 ? 'qualified' : qualificationScore >= 60 ? 'nurturing' : 'lost';
  validateLeadTransition(current.leadStatus, toStatus);
  const lead = await repo.qualifyLead(tenantKey, id, userId, qualificationScore);
  auditLog(
    { actor: `user:${userId}`, action: 'lead_qualified', object_type: 'lead_capture_record', object_id: id, result: 'success' },
    `Lead qualified with score ${qualificationScore}`,
  );
  return { lead, qualificationScore };
}

export async function getLeadStats(role: string, tenantKey: string): Promise<LeadStatsSummary> {
  checkLeadPermission(role, 'leads:read');
  return repo.getLeadStats(tenantKey);
}

export async function getEventDashboard(role: string, tenantKey: string, eventId: string): Promise<EventDashboardSummary> {
  checkLeadPermission(role, 'leads:dashboard');
  return repo.getEventDashboard(tenantKey, eventId);
}

function deriveQualificationScore(lead: LeadSummary): number {
  let score = 50;
  if (lead.leadEmail) score += 15;
  if (lead.leadPhone) score += 15;
  if (lead.consentStatus === 'granted') score += 15;
  if (lead.platform && lead.platform !== 'manual') score += 5;
  return Math.min(score, 100);
}
