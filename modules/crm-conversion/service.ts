import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateLeadCaptureRecordInput, CreateLeadSourceAttributionInput,
  CreateConversionIntentInput, CreateCrmHandoffRequestInput,
  CreateWhatsAppHandoffRequestInput, CreateConversionSequencePlanInput,
  LeadCaptureRecordSummary, LeadSourceAttributionSummary,
  ConversionIntentSummary, CrmHandoffRequestSummary,
  WhatsAppHandoffRequestSummary, ConversionSequencePlanSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['conversion:create', 'conversion:read', 'conversion:handoff'],
  cco: ['conversion:create', 'conversion:read', 'conversion:handoff'],
  department_head: ['conversion:create', 'conversion:read', 'conversion:handoff'],
  specialist: ['conversion:create', 'conversion:read'],
  reviewer: ['conversion:read'],
  viewer: ['conversion:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

function validateSessionContextLock(
  sessionUserId: string,
  sessionAgentRepId: string,
  actionUserId: string,
  actionAgentRepId: string,
): void {
  if (sessionUserId !== actionUserId) {
    throw new ForbiddenError('Session Context Lock: Cannot act on behalf of another user');
  }
  if (sessionAgentRepId !== actionAgentRepId) {
    throw new ForbiddenError('Session Context Lock: Cannot use another user\'s AgentRep');
  }
}

// ============================================================
// LeadCaptureRecord Service
// ============================================================

export async function createLeadCaptureRecord(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateLeadCaptureRecordInput,
): Promise<LeadCaptureRecordSummary> {
  checkPermission(requesterRole, 'conversion:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  const record = await repo.createLeadCaptureRecord(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'lead_captured', object_type: 'lead_capture_record', object_id: record.id, result: 'success' },
    `Lead captured: ${record.leadNamePlaceholder || 'unnamed'} from ${record.platform || 'unknown'}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'capture_lead',
    'lead_capture_record',
    record.id,
    'success',
    { platform: record.platform, source: record.leadSource },
  );

  return record;
}

export async function getLeadCaptureRecord(requesterRole: string, id: string): Promise<LeadCaptureRecordSummary> {
  checkPermission(requesterRole, 'conversion:read');
  return repo.getLeadCaptureRecordById(id);
}

export async function listLeadCaptureRecords(requesterRole: string, filters?: {
  leadStatus?: string;
  campaignId?: string;
  platform?: string;
  createdByUserId?: string;
}): Promise<LeadCaptureRecordSummary[]> {
  checkPermission(requesterRole, 'conversion:read');
  return repo.listLeadCaptureRecords(filters);
}

// ============================================================
// LeadSourceAttribution Service
// ============================================================

export async function createLeadSourceAttribution(
  requesterRole: string,
  input: CreateLeadSourceAttributionInput,
): Promise<LeadSourceAttributionSummary> {
  checkPermission(requesterRole, 'conversion:create');
  const attribution = await repo.createLeadSourceAttribution(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'lead_attribution_created', object_type: 'lead_source_attribution', object_id: attribution.id, result: 'success' },
    `Lead attribution: ${attribution.attributionSource}`,
  );

  return attribution;
}

// ============================================================
// ConversionIntent Service
// ============================================================

export async function createConversionIntent(
  requesterRole: string,
  input: CreateConversionIntentInput,
): Promise<ConversionIntentSummary> {
  checkPermission(requesterRole, 'conversion:create');
  const intent = await repo.createConversionIntent(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'conversion_intent_created', object_type: 'conversion_intent', object_id: intent.id, result: 'success' },
    `Conversion intent: ${intent.intentType}`,
  );

  return intent;
}

// ============================================================
// CrmHandoffRequest Service
// ============================================================

export async function createCrmHandoffRequest(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateCrmHandoffRequestInput,
): Promise<CrmHandoffRequestSummary> {
  checkPermission(requesterRole, 'conversion:handoff');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.requestedByUserId, input.requestedByAgentRepId);

  // MCP mediation required
  if (!input.mcpMediationRequestId) {
    throw new ForbiddenError('Direct CRM access is blocked. MCP mediation is required.');
  }

  // M5 write-enabled blocked by default
  // This is a write operation to external CRM

  const request = await repo.createCrmHandoffRequest(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'crm_handoff_requested', object_type: 'crm_handoff_request', object_id: request.id, result: 'success' },
    `CRM handoff requested: ${request.crmSystem} (${request.handoffStatus})`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'request_crm_handoff',
    'crm_handoff_request',
    request.id,
    'success',
    { crmSystem: request.crmSystem, leadId: request.leadCaptureRecordId },
  );

  return request;
}

export async function getCrmHandoffRequest(requesterRole: string, id: string): Promise<CrmHandoffRequestSummary> {
  checkPermission(requesterRole, 'conversion:read');
  return repo.getCrmHandoffRequestById(id);
}

// ============================================================
// WhatsAppHandoffRequest Service
// ============================================================

export async function createWhatsAppHandoffRequest(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateWhatsAppHandoffRequestInput,
): Promise<WhatsAppHandoffRequestSummary> {
  checkPermission(requesterRole, 'conversion:handoff');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.requestedByUserId, input.requestedByAgentRepId);

  // MCP mediation required
  if (!input.mcpMediationRequestId) {
    throw new ForbiddenError('Direct WhatsApp access is blocked. MCP mediation is required.');
  }

  // M5 write-enabled blocked by default
  // No real messages sent

  const request = await repo.createWhatsAppHandoffRequest(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'whatsapp_handoff_requested', object_type: 'whatsapp_handoff_request', object_id: request.id, result: 'success' },
    `WhatsApp handoff requested: ${request.messagingSystem} (${request.handoffStatus})`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'request_whatsapp_handoff',
    'whatsapp_handoff_request',
    request.id,
    'success',
    { messagingSystem: request.messagingSystem, leadId: request.leadCaptureRecordId },
  );

  return request;
}

export async function getWhatsAppHandoffRequest(requesterRole: string, id: string): Promise<WhatsAppHandoffRequestSummary> {
  checkPermission(requesterRole, 'conversion:read');
  return repo.getWhatsAppHandoffRequestById(id);
}

// ============================================================
// ConversionSequencePlan Service
// ============================================================

export async function createConversionSequencePlan(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateConversionSequencePlanInput,
): Promise<ConversionSequencePlanSummary> {
  checkPermission(requesterRole, 'conversion:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  // Advisory/planning only - does not send messages or execute follow-up
  const plan = await repo.createConversionSequencePlan(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'conversion_plan_created', object_type: 'conversion_sequence_plan', object_id: plan.id, result: 'success' },
    `Conversion plan created: ${plan.sequenceType} for lead ${plan.leadCaptureRecordId}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_conversion_plan',
    'conversion_sequence_plan',
    plan.id,
    'success',
    { sequenceType: plan.sequenceType, leadId: plan.leadCaptureRecordId },
  );

  return plan;
}

export async function getConversionSequencePlan(requesterRole: string, id: string): Promise<ConversionSequencePlanSummary> {
  checkPermission(requesterRole, 'conversion:read');
  return repo.getConversionSequencePlanById(id);
}
