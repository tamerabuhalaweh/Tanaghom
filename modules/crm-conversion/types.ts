import { z } from 'zod';

export const LEAD_STATUSES = ['new_lead', 'contacted', 'qualified', 'nurturing', 'converted', 'lost', 'archived'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const CONSENT_STATUSES = ['pending', 'granted', 'denied', 'withdrawn'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const HANDOFF_STATUSES = ['pending', 'validating', 'ready', 'executing', 'completed', 'blocked', 'failed', 'cancelled'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const PLAN_STATUSES = ['draft', 'proposed', 'approved', 'rejected', 'executing', 'completed', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const createLeadCaptureRecordSchema = z.object({
  leadSource: z.string().max(200).optional(),
  campaignId: z.string().uuid().optional(),
  contentItemId: z.string().uuid().optional(),
  publishingPackageId: z.string().uuid().optional(),
  analyticsSnapshotId: z.string().uuid().optional(),
  platform: z.string().max(100).optional(),
  sourceUrlPlaceholder: z.string().max(500).optional(),
  contactReferencePlaceholder: z.string().max(500).optional(),
  leadNamePlaceholder: z.string().max(200).optional(),
  leadPhonePlaceholder: z.string().max(100).optional(),
  leadEmailPlaceholder: z.string().max(200).optional(),
  consentStatus: z.enum(CONSENT_STATUSES).default('pending'),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createLeadSourceAttributionSchema = z.object({
  leadCaptureRecordId: z.string().uuid(),
  attributionSource: z.string().min(1).max(200),
  campaignId: z.string().uuid().optional(),
  contentItemId: z.string().uuid().optional(),
  publishingPackageId: z.string().uuid().optional(),
  postizPublishingJobId: z.string().uuid().optional(),
  analyticsSnapshotId: z.string().uuid().optional(),
  platform: z.string().max(100).optional(),
  ctaType: z.string().max(200).optional(),
  attributionConfidence: z.string().default('low'),
});

export const createConversionIntentSchema = z.object({
  leadCaptureRecordId: z.string().uuid(),
  intentType: z.string().min(1).max(200),
  confidence: z.string().default('low'),
  rationale: z.string().max(5000).optional(),
  recommendedNextStep: z.string().max(5000).optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
});

export const createCrmHandoffRequestSchema = z.object({
  leadCaptureRecordId: z.string().uuid(),
  crmSystem: z.string().min(1).max(200),
  mcpMediationRequestId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  requestedByUserId: z.string().uuid(),
  requestedByAgentRepId: z.string().uuid(),
});

export const createWhatsAppHandoffRequestSchema = z.object({
  leadCaptureRecordId: z.string().uuid(),
  messagingSystem: z.string().min(1).max(200),
  mcpMediationRequestId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  requestedByUserId: z.string().uuid(),
  requestedByAgentRepId: z.string().uuid(),
  messageTemplateSummary: z.string().max(5000).optional(),
});

export const createConversionSequencePlanSchema = z.object({
  leadCaptureRecordId: z.string().uuid(),
  conversionIntentId: z.string().uuid().optional(),
  sequenceType: z.string().min(1).max(200),
  proposedSteps: z.record(z.unknown()).optional(),
  recommendedOwnerDepartment: z.string().max(200).optional(),
  requiredApprovalId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export type CreateLeadCaptureRecordInput = z.infer<typeof createLeadCaptureRecordSchema>;
export type CreateLeadSourceAttributionInput = z.infer<typeof createLeadSourceAttributionSchema>;
export type CreateConversionIntentInput = z.infer<typeof createConversionIntentSchema>;
export type CreateCrmHandoffRequestInput = z.infer<typeof createCrmHandoffRequestSchema>;
export type CreateWhatsAppHandoffRequestInput = z.infer<typeof createWhatsAppHandoffRequestSchema>;
export type CreateConversionSequencePlanInput = z.infer<typeof createConversionSequencePlanSchema>;

export interface LeadCaptureRecordSummary {
  id: string;
  leadStatus: LeadStatus;
  leadSource: string | null;
  campaignId: string | null;
  contentItemId: string | null;
  publishingPackageId: string | null;
  analyticsSnapshotId: string | null;
  platform: string | null;
  sourceUrlPlaceholder: string | null;
  contactReferencePlaceholder: string | null;
  leadNamePlaceholder: string | null;
  leadPhonePlaceholder: string | null;
  leadEmailPlaceholder: string | null;
  consentStatus: ConsentStatus;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadSourceAttributionSummary {
  id: string;
  leadCaptureRecordId: string;
  attributionSource: string;
  campaignId: string | null;
  contentItemId: string | null;
  publishingPackageId: string | null;
  postizPublishingJobId: string | null;
  analyticsSnapshotId: string | null;
  platform: string | null;
  ctaType: string | null;
  attributionConfidence: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversionIntentSummary {
  id: string;
  leadCaptureRecordId: string;
  intentType: string;
  confidence: string;
  rationale: string | null;
  recommendedNextStep: string | null;
  saifDecisionRecordId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmHandoffRequestSummary {
  id: string;
  leadCaptureRecordId: string;
  crmSystem: string;
  mcpMediationRequestId: string | null;
  approvalId: string | null;
  capabilityResolutionId: string | null;
  requestedByUserId: string;
  requestedByAgentRepId: string;
  handoffStatus: HandoffStatus;
  payloadSummary: string | null;
  payloadHash: string | null;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppHandoffRequestSummary {
  id: string;
  leadCaptureRecordId: string;
  messagingSystem: string;
  mcpMediationRequestId: string | null;
  approvalId: string | null;
  capabilityResolutionId: string | null;
  requestedByUserId: string;
  requestedByAgentRepId: string;
  handoffStatus: HandoffStatus;
  messageTemplateSummary: string | null;
  payloadHash: string | null;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversionSequencePlanSummary {
  id: string;
  leadCaptureRecordId: string;
  conversionIntentId: string | null;
  planStatus: PlanStatus;
  sequenceType: string;
  proposedSteps: Record<string, unknown> | null;
  recommendedOwnerDepartment: string | null;
  requiredApprovalId: string | null;
  saifDecisionRecordId: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}
