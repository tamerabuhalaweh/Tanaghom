import { createHash } from 'node:crypto';
import type { LeadStatus, LeadTemperature } from '../lead-lifecycle/types';
import { isLeadStatus, isLeadTemperature, type GhlContact, type GhlMappedLead, type GhlMappingSet, type GhlOpportunity } from './types';

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
      const stageKeys = [fields.ghlStageId, fields.ghlStageName].map(normalize).filter(Boolean);
      const internalStage = normalize(fields.internalStage);
      for (const key of stageKeys) mappedStageIds.add(key);
      if (isLeadStatus(internalStage)) {
        for (const key of stageKeys) stageStatus.set(key, internalStage);
      }
    }
  }

  return { tagStatus, tagTemperature, stageStatus, mappedTagIds, mappedStageIds };
}

export function mapGhlLead(contact: GhlContact, opportunities: GhlOpportunity[], mappings: GhlMappingSet): GhlMappedLead {
  const contactTags = contact.tags.map(tag => String(tag).trim()).filter(Boolean);
  const normalizedTags = contactTags.map(normalize);
  const primaryOpportunity = opportunities.find(opp => opp.contactId === contact.id) || null;
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
  if (opportunityStatus === 'won') {
    leadStatus = 'purchased';
    leadTemperature = 'buyer';
  } else if (opportunityStatus === 'lost') {
    leadStatus = 'lost';
  } else if (primaryOpportunity && leadStatus === 'new_lead') {
    leadStatus = 'qualified';
    leadTemperature = leadTemperature === 'cold' ? 'hot' : leadTemperature;
  } else if (contactTags.length && leadTemperature === 'cold') {
    leadTemperature = 'warm';
  }

  if (leadStatus === 'purchased') leadTemperature = 'buyer';

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
    meetingOutcome: ['meeting_attended', 'no_show'].includes(leadStatus) ? leadStatus : null,
    syncFingerprint: fingerprint,
  };
}

export function countMappedTags(contact: GhlContact, mappings: GhlMappingSet): number {
  return contact.tags.filter(tag => mappings.mappedTagIds.has(normalize(tag))).length;
}

export function countMappedStages(opportunities: GhlOpportunity[], mappings: GhlMappingSet): number {
  return opportunities.filter(opp => {
    const stageId = normalize(opp.stageId);
    return stageId && mappings.mappedStageIds.has(stageId);
  }).length;
}
