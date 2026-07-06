import { z } from 'zod';
import { LEAD_STATUSES, LEAD_TEMPERATURES, type LeadStatus, type LeadTemperature } from '../lead-lifecycle/types';

export const GHL_SYNC_MODES = ['pull_preview', 'pull_sync', 'write_back_preview', 'write_back'] as const;
export type GhlSyncMode = (typeof GHL_SYNC_MODES)[number];

export const GHL_SYNC_STATUSES = ['requires_credentials', 'mapping_required', 'blocked', 'previewed', 'synced', 'failed'] as const;
export type GhlSyncStatus = (typeof GHL_SYNC_STATUSES)[number];

export const ghlPullSchema = z.object({
  eventId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const ghlWriteBackSchema = z.object({
  leadId: z.string().uuid(),
});

export type GhlPullInput = z.infer<typeof ghlPullSchema>;
export type GhlWriteBackInput = z.infer<typeof ghlWriteBackSchema>;

export interface GhlContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags: string[];
}

export interface GhlOpportunity {
  id: string;
  contactId: string;
  pipelineId?: string | null;
  stageId?: string | null;
  status?: string | null;
  monetaryValue?: number | null;
  name?: string | null;
  updatedAt?: string | null;
}

export interface GhlAppointment {
  id: string;
  contactId: string;
  status?: string | null;
  title?: string | null;
  calendarId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export interface GhlPullResult {
  contacts: GhlContact[];
  opportunities: GhlOpportunity[];
  appointments: GhlAppointment[];
  warnings: string[];
  rawReturned: false;
}

export interface GhlMappingSet {
  tagStatus: Map<string, LeadStatus>;
  tagTemperature: Map<string, LeadTemperature>;
  stageStatus: Map<string, LeadStatus>;
  mappedTagIds: Set<string>;
  mappedStageIds: Set<string>;
}

export interface GhlMappedLead {
  ghlContactId: string;
  ghlOpportunityId: string | null;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadSource: string;
  leadStatus: LeadStatus;
  leadTemperature: LeadTemperature;
  pipelineId: string | null;
  stageId: string | null;
  tags: string[];
  purchaseAmount: number | null;
  purchaseReference: string | null;
  meetingDate: Date | null;
  meetingType: string | null;
  meetingOutcome: string | null;
  syncFingerprint: string;
}

export interface GhlSyncRunSummary {
  id: string;
  tenantKey: string;
  eventId: string | null;
  mode: GhlSyncMode;
  status: GhlSyncStatus;
  sourceOfTruth: 'gohighlevel';
  contactsPulled: number;
  opportunitiesPulled: number;
  appointmentsPulled: number;
  leadsUpserted: number;
  tagsMapped: number;
  stagesMapped: number;
  writeBacksPrepared: number;
  errors: string[];
  warnings: string[];
  rawPayloadReturned: false;
  startedAt: Date;
  completedAt: Date | null;
}

export interface GhlSyncStatusSummary {
  tenantKey: string;
  eventId: string | null;
  sourceOfTruth: 'gohighlevel';
  tanaghumRole: 'operating_reporting_layer';
  credentialStatus: 'missing' | 'configured';
  mappingStatus: 'missing' | 'partial' | 'ready';
  readSyncEnabled: boolean;
  writeBackEnabled: boolean;
  ghlLeadCount: number;
  lastSyncAt: Date | null;
  lastRun: GhlSyncRunSummary | null;
  requiredActions: string[];
}

export interface GhlWriteBackPreview {
  leadId: string;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  endpoint: string;
  payload: {
    locationId: string;
    contactId?: string;
    tags: string[];
    customFields: Array<{ key: string; field_value: string }>;
  };
  execution: 'preview_only' | 'blocked' | 'executed';
  reasons: string[];
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isLeadTemperature(value: string): value is LeadTemperature {
  return (LEAD_TEMPERATURES as readonly string[]).includes(value);
}
