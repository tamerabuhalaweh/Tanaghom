import { createHash } from 'node:crypto';
import type { LeadStatus, LeadTemperature } from '../lead-lifecycle/types';
import {
  isLeadStatus,
  isLeadTemperature,
  type GhlAppointment,
  type GhlContact,
  type GhlMappedLead,
  type GhlMappingSet,
  type GhlOpportunity,
} from './types';

type MappingRecord = {
  field_mappings: unknown;
  validation_status: string;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function truthyString(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

export function buildGhlMappingSet(records: MappingRecord[]): GhlMappingSet {
  const tagStatus = new Map<string, LeadStatus>();
  const tagTemperature = new Map<string, LeadTemperature>();
  const stageStatus = new Map<string, LeadStatus>();
  const mappedTagIds = new Set<string>();
  const mappedStageIds = new Set<string>();

  for (const record of records) {
    if (record.validation_status !== 'valid') continue;
    if (!record.field_mappings || typeof record.field_mappings !== 'object' || Array.isArray(record.field_mappings)) continue;
    const fields = record.field_mappings as Record<string, unknown>;
    const mappingType = String(fields.mappingType || '');

    if (mappingType === 'tag') {
      const tagKeys = [fields.ghlTagId, fields.ghlTagName].map(normalize).filter(Boolean);
      const internalTag = normalize(fields.internalTag);
      for (const key of tagKeys) mappedTagIds.add(key);
      if (isLeadStatus(internalTag)) {
        for (const key of tagKeys) tagStatus.set(key, internalTag);
      }
      if (isLeadTemperature(internalTag)) {
        for (const key of tagKeys) tagTemperature.set(key, internalTag);
      }
      if (internalTag === 'customer' || internalTag === 'buyer') {
        for (const key of tagKeys) {
          tagStatus.set(key, 'purchased');
          tagTemperature.set(key, 'buyer');
        }
      }
    }

    if (mappingType === 'pipeline') {
      const pipelineId = normalize(fields.ghlPipelineId);
      const stageKeys = [fields.ghlStageId, fields.ghlStageName].map(normalize).filter(Boolean);
      if (pipelineId) {
        const stageId = normalize(fields.ghlStageId);
        if (stageId) stageKeys.push(`${pipelineId}:${stageId}`);
      }
      const internalStage = normalize(fields.internalStage);
      for (const key of stageKeys) mappedStageIds.add(key);
      if (isLeadStatus(internalStage)) {
        for (const key of stageKeys) stageStatus.set(key, internalStage);
      }
    }
  }

  return { tagStatus, tagTemperature, stageStatus, mappedTagIds, mappedStageIds };
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectPrimaryAppointment(appointments: GhlAppointment[]): GhlAppointment | null {
  if (!appointments.length) return null;
  return [...appointments].sort((a, b) => {
    const aTime = parseDate(a.startTime)?.getTime() ?? 0;
    const bTime = parseDate(b.startTime)?.getTime() ?? 0;
    return bTime - aTime;
  })[0] || null;
}

function appointmentOutcome(status: string): 'booked' | 'attended' | 'no_show' | null {
  const normalized = normalize(status).replace(/[\s-]+/g, '_');
  if (!normalized) return 'booked';
  if (normalized.includes('no_show') || normalized.includes('noshow')) return 'no_show';
  if (normalized.includes('attended') || normalized.includes('showed') || normalized.includes('completed') || normalized.includes('complete')) return 'attended';
  if (normalized.includes('cancel')) return null;
  return 'booked';
}

function applyAppointmentStatus(
  currentStatus: LeadStatus,
  currentTemperature: LeadTemperature,
  appointment: GhlAppointment | null,
): { status: LeadStatus; temperature: LeadTemperature; meetingOutcome: string | null; meetingDate: Date | null; meetingType: string | null } {
  if (!appointment || currentStatus === 'purchased' || currentStatus === 'lost') {
    return {
      status: currentStatus,
      temperature: currentTemperature,
      meetingOutcome: ['meeting_attended', 'no_show'].includes(currentStatus) ? currentStatus : null,
      meetingDate: appointment ? parseDate(appointment.startTime) : null,
      meetingType: truthyString(appointment?.title),
    };
  }

  const outcome = appointmentOutcome(appointment.status || '');
  const meetingDate = parseDate(appointment.startTime);
  const meetingType = truthyString(appointment.title) || truthyString(appointment.calendarId);
  if (outcome === 'no_show') {
    return { status: 'no_show', temperature: currentTemperature === 'cold' ? 'warm' : currentTemperature, meetingOutcome: 'no_show', meetingDate, meetingType };
  }
  if (outcome === 'attended') {
    return { status: 'meeting_attended', temperature: currentTemperature === 'cold' ? 'hot' : currentTemperature, meetingOutcome: 'meeting_attended', meetingDate, meetingType };
  }
  if (outcome === 'booked' && ['new_lead', 'qualified', 'contacted', 'follow_up_needed'].includes(currentStatus)) {
    return { status: 'meeting_booked', temperature: currentTemperature === 'cold' ? 'warm' : currentTemperature, meetingOutcome: null, meetingDate, meetingType };
  }
  return { status: currentStatus, temperature: currentTemperature, meetingOutcome: ['meeting_attended', 'no_show'].includes(currentStatus) ? currentStatus : null, meetingDate, meetingType };
}

export function mapGhlLead(contact: GhlContact, opportunities: GhlOpportunity[], appointments: GhlAppointment[], mappings: GhlMappingSet): GhlMappedLead {
  const contactTags = contact.tags.map(tag => String(tag).trim()).filter(Boolean);
  const normalizedTags = contactTags.map(normalize);
  const primaryOpportunity = opportunities.find(opp => opp.contactId === contact.id) || null;
  const primaryAppointment = selectPrimaryAppointment(appointments.filter(appointment => appointment.contactId === contact.id));
  const stageKeys = [
    primaryOpportunity?.stageId,
    primaryOpportunity?.pipelineId ? `${primaryOpportunity.pipelineId}:${primaryOpportunity.stageId || ''}` : '',
  ].map(normalize).filter(Boolean);

  let leadStatus: LeadStatus = 'new_lead';
  let leadTemperature: LeadTemperature = 'cold';

  for (const tag of normalizedTags) {
    const mappedStatus = mappings.tagStatus.get(tag);
    const mappedTemperature = mappings.tagTemperature.get(tag);
    if (mappedStatus) leadStatus = mappedStatus;
    if (mappedTemperature) leadTemperature = mappedTemperature;
  }

  for (const stage of stageKeys) {
    const mappedStage = mappings.stageStatus.get(stage);
    if (mappedStage) leadStatus = mappedStage;
  }

  const opportunityStatus = normalize(primaryOpportunity?.status);
  if (opportunityStatus === 'won' || opportunityStatus === 'closed_won' || opportunityStatus === 'purchased') {
    leadStatus = 'purchased';
    leadTemperature = 'buyer';
  } else if (opportunityStatus === 'lost' || opportunityStatus === 'closed_lost') {
    leadStatus = 'lost';
  } else if (primaryOpportunity && leadStatus === 'new_lead') {
    leadStatus = 'qualified';
    leadTemperature = leadTemperature === 'cold' ? 'hot' : leadTemperature;
  } else if (contactTags.length && leadTemperature === 'cold') {
    leadTemperature = 'warm';
  }

  if (leadStatus === 'purchased') leadTemperature = 'buyer';
  const appointmentState = applyAppointmentStatus(leadStatus, leadTemperature, primaryAppointment);
  leadStatus = appointmentState.status;
  leadTemperature = leadStatus === 'purchased' ? 'buyer' : appointmentState.temperature;

  const name = truthyString(contact.name)
    || [contact.firstName, contact.lastName].map(value => String(value || '').trim()).filter(Boolean).join(' ')
    || null;
  const purchaseAmount = leadStatus === 'purchased' && primaryOpportunity?.monetaryValue != null
    ? Number(primaryOpportunity.monetaryValue)
    : null;

  const fingerprint = createHash('sha256').update(JSON.stringify({
    contactId: contact.id,
    opportunityId: primaryOpportunity?.id || null,
    email: contact.email || null,
    phone: contact.phone || null,
    tags: contactTags,
    status: leadStatus,
    temperature: leadTemperature,
    stageId: primaryOpportunity?.stageId || null,
    appointmentId: primaryAppointment?.id || null,
    appointmentStatus: primaryAppointment?.status || null,
    appointmentStart: primaryAppointment?.startTime || null,
    value: purchaseAmount,
  })).digest('hex');

  return {
    ghlContactId: contact.id,
    ghlOpportunityId: primaryOpportunity?.id || null,
    leadName: name,
    leadEmail: truthyString(contact.email),
    leadPhone: truthyString(contact.phone),
    leadSource: truthyString(contact.source) || 'GoHighLevel',
    leadStatus,
    leadTemperature,
    pipelineId: truthyString(primaryOpportunity?.pipelineId),
    stageId: truthyString(primaryOpportunity?.stageId),
    tags: contactTags,
    purchaseAmount,
    purchaseReference: primaryOpportunity?.id || null,
    meetingDate: appointmentState.meetingDate,
    meetingType: appointmentState.meetingType,
    meetingOutcome: appointmentState.meetingOutcome,
    syncFingerprint: fingerprint,
  };
}

export function countMappedTags(contact: GhlContact, mappings: GhlMappingSet): number {
  return contact.tags.filter(tag => mappings.mappedTagIds.has(normalize(tag))).length;
}

export function countMappedStages(opportunities: GhlOpportunity[], mappings: GhlMappingSet): number {
  return opportunities.filter(opp => {
    const stageId = normalize(opp.stageId);
    const pipelineStageId = normalize(opp.pipelineId) && stageId ? `${normalize(opp.pipelineId)}:${stageId}` : '';
    return Boolean((stageId && mappings.mappedStageIds.has(stageId)) || (pipelineStageId && mappings.mappedStageIds.has(pipelineStageId)));
  }).length;
}
