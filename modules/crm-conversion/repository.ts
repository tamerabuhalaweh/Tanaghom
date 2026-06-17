import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateLeadCaptureRecordInput, CreateLeadSourceAttributionInput,
  CreateConversionIntentInput, CreateCrmHandoffRequestInput,
  CreateWhatsAppHandoffRequestInput, CreateConversionSequencePlanInput,
  LeadCaptureRecordSummary, LeadSourceAttributionSummary,
  ConversionIntentSummary, CrmHandoffRequestSummary,
  WhatsAppHandoffRequestSummary, ConversionSequencePlanSummary,
} from './types';

// ============================================================
// LeadCaptureRecord
// ============================================================

export async function createLeadCaptureRecord(input: CreateLeadCaptureRecordInput): Promise<LeadCaptureRecordSummary> {
  const record = await prisma.leadCaptureRecord.create({
    data: {
      lead_source: input.leadSource,
      campaign_id: input.campaignId,
      content_item_id: input.contentItemId,
      publishing_package_id: input.publishingPackageId,
      analytics_snapshot_id: input.analyticsSnapshotId,
      platform: input.platform,
      source_url_placeholder: input.sourceUrlPlaceholder,
      contact_reference_placeholder: input.contactReferencePlaceholder,
      lead_name_placeholder: input.leadNamePlaceholder,
      lead_phone_placeholder: input.leadPhonePlaceholder,
      lead_email_placeholder: input.leadEmailPlaceholder,
      consent_status: input.consentStatus,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapLeadCaptureRecord(record);
}

export async function getLeadCaptureRecordById(id: string): Promise<LeadCaptureRecordSummary> {
  const record = await prisma.leadCaptureRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('LeadCaptureRecord', id);
  return mapLeadCaptureRecord(record);
}

export async function listLeadCaptureRecords(filters?: {
  leadStatus?: string;
  campaignId?: string;
  platform?: string;
  createdByUserId?: string;
}): Promise<LeadCaptureRecordSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.leadStatus) where.lead_status = filters.leadStatus;
  if (filters?.campaignId) where.campaign_id = filters.campaignId;
  if (filters?.platform) where.platform = filters.platform;
  if (filters?.createdByUserId) where.created_by_user_id = filters.createdByUserId;

  const records = await prisma.leadCaptureRecord.findMany({ where, orderBy: { created_at: 'desc' } });
  return records.map(mapLeadCaptureRecord);
}

// ============================================================
// LeadSourceAttribution
// ============================================================

export async function createLeadSourceAttribution(input: CreateLeadSourceAttributionInput): Promise<LeadSourceAttributionSummary> {
  const attribution = await prisma.leadSourceAttribution.create({
    data: {
      lead_capture_record_id: input.leadCaptureRecordId,
      attribution_source: input.attributionSource,
      campaign_id: input.campaignId,
      content_item_id: input.contentItemId,
      publishing_package_id: input.publishingPackageId,
      postiz_publishing_job_id: input.postizPublishingJobId,
      analytics_snapshot_id: input.analyticsSnapshotId,
      platform: input.platform,
      cta_type: input.ctaType,
      attribution_confidence: input.attributionConfidence,
    },
  });
  return mapLeadSourceAttribution(attribution);
}

// ============================================================
// ConversionIntent
// ============================================================

export async function createConversionIntent(input: CreateConversionIntentInput): Promise<ConversionIntentSummary> {
  const intent = await prisma.conversionIntent.create({
    data: {
      lead_capture_record_id: input.leadCaptureRecordId,
      intent_type: input.intentType,
      confidence: input.confidence,
      rationale: input.rationale,
      recommended_next_step: input.recommendedNextStep,
      saif_decision_record_id: input.saifDecisionRecordId,
    },
  });
  return mapConversionIntent(intent);
}

// ============================================================
// CrmHandoffRequest
// ============================================================

export async function createCrmHandoffRequest(input: CreateCrmHandoffRequestInput): Promise<CrmHandoffRequestSummary> {
  // Validate MCP mediation
  if (!input.mcpMediationRequestId) {
    throw new ForbiddenError('Direct CRM access is blocked. MCP mediation is required.');
  }

  const request = await prisma.crmHandoffRequest.create({
    data: {
      lead_capture_record_id: input.leadCaptureRecordId,
      crm_system: input.crmSystem,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      approval_id: input.approvalId,
      capability_resolution_id: input.capabilityResolutionId,
      requested_by_user_id: input.requestedByUserId,
      requested_by_agent_rep_id: input.requestedByAgentRepId,
      handoff_status: 'pending',
    },
  });
  return mapCrmHandoffRequest(request);
}

export async function getCrmHandoffRequestById(id: string): Promise<CrmHandoffRequestSummary> {
  const request = await prisma.crmHandoffRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError('CrmHandoffRequest', id);
  return mapCrmHandoffRequest(request);
}

// ============================================================
// WhatsAppHandoffRequest
// ============================================================

export async function createWhatsAppHandoffRequest(input: CreateWhatsAppHandoffRequestInput): Promise<WhatsAppHandoffRequestSummary> {
  // Validate MCP mediation
  if (!input.mcpMediationRequestId) {
    throw new ForbiddenError('Direct WhatsApp access is blocked. MCP mediation is required.');
  }

  const request = await prisma.whatsAppHandoffRequest.create({
    data: {
      lead_capture_record_id: input.leadCaptureRecordId,
      messaging_system: input.messagingSystem,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      approval_id: input.approvalId,
      capability_resolution_id: input.capabilityResolutionId,
      requested_by_user_id: input.requestedByUserId,
      requested_by_agent_rep_id: input.requestedByAgentRepId,
      handoff_status: 'pending',
      message_template_summary: input.messageTemplateSummary,
    },
  });
  return mapWhatsAppHandoffRequest(request);
}

export async function getWhatsAppHandoffRequestById(id: string): Promise<WhatsAppHandoffRequestSummary> {
  const request = await prisma.whatsAppHandoffRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError('WhatsAppHandoffRequest', id);
  return mapWhatsAppHandoffRequest(request);
}

// ============================================================
// ConversionSequencePlan
// ============================================================

export async function createConversionSequencePlan(input: CreateConversionSequencePlanInput): Promise<ConversionSequencePlanSummary> {
  const plan = await prisma.conversionSequencePlan.create({
    data: {
      lead_capture_record_id: input.leadCaptureRecordId,
      conversion_intent_id: input.conversionIntentId,
      sequence_type: input.sequenceType,
      proposed_steps: input.proposedSteps as Prisma.InputJsonValue | undefined,
      recommended_owner_department: input.recommendedOwnerDepartment,
      required_approval_id: input.requiredApprovalId,
      saif_decision_record_id: input.saifDecisionRecordId,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapConversionSequencePlan(plan);
}

export async function getConversionSequencePlanById(id: string): Promise<ConversionSequencePlanSummary> {
  const plan = await prisma.conversionSequencePlan.findUnique({ where: { id } });
  if (!plan) throw new NotFoundError('ConversionSequencePlan', id);
  return mapConversionSequencePlan(plan);
}

// ============================================================
// Mappers
// ============================================================

function mapLeadCaptureRecord(r: Record<string, unknown>): LeadCaptureRecordSummary {
  return {
    id: r.id as string,
    leadStatus: r.lead_status as LeadCaptureRecordSummary['leadStatus'],
    leadSource: r.lead_source as string | null,
    campaignId: r.campaign_id as string | null,
    contentItemId: r.content_item_id as string | null,
    publishingPackageId: r.publishing_package_id as string | null,
    analyticsSnapshotId: r.analytics_snapshot_id as string | null,
    platform: r.platform as string | null,
    sourceUrlPlaceholder: r.source_url_placeholder as string | null,
    contactReferencePlaceholder: r.contact_reference_placeholder as string | null,
    leadNamePlaceholder: r.lead_name_placeholder as string | null,
    leadPhonePlaceholder: r.lead_phone_placeholder as string | null,
    leadEmailPlaceholder: r.lead_email_placeholder as string | null,
    consentStatus: r.consent_status as LeadCaptureRecordSummary['consentStatus'],
    createdByUserId: r.created_by_user_id as string,
    createdByAgentRepId: r.created_by_agent_rep_id as string,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapLeadSourceAttribution(a: Record<string, unknown>): LeadSourceAttributionSummary {
  return {
    id: a.id as string,
    leadCaptureRecordId: a.lead_capture_record_id as string,
    attributionSource: a.attribution_source as string,
    campaignId: a.campaign_id as string | null,
    contentItemId: a.content_item_id as string | null,
    publishingPackageId: a.publishing_package_id as string | null,
    postizPublishingJobId: a.postiz_publishing_job_id as string | null,
    analyticsSnapshotId: a.analytics_snapshot_id as string | null,
    platform: a.platform as string | null,
    ctaType: a.cta_type as string | null,
    attributionConfidence: a.attribution_confidence as string,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}

function mapConversionIntent(i: Record<string, unknown>): ConversionIntentSummary {
  return {
    id: i.id as string,
    leadCaptureRecordId: i.lead_capture_record_id as string,
    intentType: i.intent_type as string,
    confidence: i.confidence as string,
    rationale: i.rationale as string | null,
    recommendedNextStep: i.recommended_next_step as string | null,
    saifDecisionRecordId: i.saif_decision_record_id as string | null,
    createdAt: i.created_at as Date,
    updatedAt: i.updated_at as Date,
  };
}

function mapCrmHandoffRequest(r: Record<string, unknown>): CrmHandoffRequestSummary {
  return {
    id: r.id as string,
    leadCaptureRecordId: r.lead_capture_record_id as string,
    crmSystem: r.crm_system as string,
    mcpMediationRequestId: r.mcp_mediation_request_id as string | null,
    approvalId: r.approval_id as string | null,
    capabilityResolutionId: r.capability_resolution_id as string | null,
    requestedByUserId: r.requested_by_user_id as string,
    requestedByAgentRepId: r.requested_by_agent_rep_id as string,
    handoffStatus: r.handoff_status as CrmHandoffRequestSummary['handoffStatus'],
    payloadSummary: r.payload_summary as string | null,
    payloadHash: r.payload_hash as string | null,
    blockedReason: r.blocked_reason as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapWhatsAppHandoffRequest(r: Record<string, unknown>): WhatsAppHandoffRequestSummary {
  return {
    id: r.id as string,
    leadCaptureRecordId: r.lead_capture_record_id as string,
    messagingSystem: r.messaging_system as string,
    mcpMediationRequestId: r.mcp_mediation_request_id as string | null,
    approvalId: r.approval_id as string | null,
    capabilityResolutionId: r.capability_resolution_id as string | null,
    requestedByUserId: r.requested_by_user_id as string,
    requestedByAgentRepId: r.requested_by_agent_rep_id as string,
    handoffStatus: r.handoff_status as WhatsAppHandoffRequestSummary['handoffStatus'],
    messageTemplateSummary: r.message_template_summary as string | null,
    payloadHash: r.payload_hash as string | null,
    blockedReason: r.blocked_reason as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapConversionSequencePlan(p: Record<string, unknown>): ConversionSequencePlanSummary {
  return {
    id: p.id as string,
    leadCaptureRecordId: p.lead_capture_record_id as string,
    conversionIntentId: p.conversion_intent_id as string | null,
    planStatus: p.plan_status as ConversionSequencePlanSummary['planStatus'],
    sequenceType: p.sequence_type as string,
    proposedSteps: p.proposed_steps as Record<string, unknown> | null,
    recommendedOwnerDepartment: p.recommended_owner_department as string | null,
    requiredApprovalId: p.required_approval_id as string | null,
    saifDecisionRecordId: p.saif_decision_record_id as string | null,
    createdByUserId: p.created_by_user_id as string,
    createdByAgentRepId: p.created_by_agent_rep_id as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}
