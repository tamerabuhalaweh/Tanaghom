import { z } from 'zod';

export const POSTIZ_CONNECTOR_STATUSES = ['active', 'inactive', 'planned', 'suspended'] as const;
export type PostizConnectorStatus = (typeof POSTIZ_CONNECTOR_STATUSES)[number];

export const ACCOUNT_STATUSES = ['active', 'inactive', 'disconnected', 'placeholder'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const EXECUTION_REQUEST_STATUSES = ['pending', 'validating', 'ready', 'executing', 'completed', 'blocked', 'failed', 'cancelled'] as const;
export type ExecutionRequestStatus = (typeof EXECUTION_REQUEST_STATUSES)[number];

export const EXECUTION_MODES = ['mock', 'simulated', 'live'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const REQUESTED_ACTIONS = ['prepare_draft', 'prepare_schedule', 'publish'] as const;
export type RequestedAction = (typeof REQUESTED_ACTIONS)[number];

export const POSTIZ_JOB_STATUSES = ['pending', 'preparing', 'prepared', 'scheduled', 'published', 'failed', 'cancelled', 'blocked'] as const;
export type PostizJobStatus = (typeof POSTIZ_JOB_STATUSES)[number];

export const createPostizConnectorSchema = z.object({
  connectorName: z.string().min(1).max(200),
  mcpConnectorId: z.string().uuid().optional(),
  implementationId: z.string().uuid().optional(),
  targetSystem: z.string().default('Postiz'),
  baseUrlPlaceholder: z.string().max(500).optional(),
  credentialBindingId: z.string().uuid().optional(),
  supportsDraft: z.boolean().default(true),
  supportsSchedule: z.boolean().default(true),
  supportsPublish: z.boolean().default(false),
  m4Allowed: z.boolean().default(true),
  m5Allowed: z.boolean().default(false),
});

export const createAccountReferenceSchema = z.object({
  postizConnectorId: z.string().uuid(),
  platform: z.string().min(1).max(100),
  accountReferencePlaceholder: z.string().max(500).optional(),
  accountDisplayName: z.string().max(200).optional(),
});

export const createExecutionRequestSchema = z.object({
  publishingPackageId: z.string().uuid(),
  publishingManifestId: z.string().uuid().optional(),
  postizConnectorId: z.string().uuid(),
  capabilityResolutionId: z.string().uuid().optional(),
  mcpMediationRequestId: z.string().uuid().optional(),
  mcpMediationDecisionId: z.string().uuid().optional(),
  spineRunId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  requestedByUserId: z.string().uuid(),
  requestedByAgentRepId: z.string().uuid(),
  executionMode: z.enum(EXECUTION_MODES).default('mock'),
  requestedAction: z.enum(REQUESTED_ACTIONS).default('prepare_draft'),
});

export type CreatePostizConnectorInput = z.infer<typeof createPostizConnectorSchema>;
export type CreateAccountReferenceInput = z.infer<typeof createAccountReferenceSchema>;
export type CreateExecutionRequestInput = z.infer<typeof createExecutionRequestSchema>;

export interface PostizConnectorSummary {
  id: string;
  connectorName: string;
  connectorStatus: PostizConnectorStatus;
  mcpConnectorId: string | null;
  implementationId: string | null;
  targetSystem: string;
  baseUrlPlaceholder: string | null;
  credentialBindingId: string | null;
  supportsDraft: boolean;
  supportsSchedule: boolean;
  supportsPublish: boolean;
  m4Allowed: boolean;
  m5Allowed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountReferenceSummary {
  id: string;
  postizConnectorId: string;
  platform: string;
  accountReferencePlaceholder: string | null;
  accountDisplayName: string | null;
  accountStatus: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionRequestSummary {
  id: string;
  publishingPackageId: string;
  publishingManifestId: string | null;
  postizConnectorId: string;
  capabilityResolutionId: string | null;
  mcpMediationRequestId: string | null;
  mcpMediationDecisionId: string | null;
  spineRunId: string | null;
  approvalId: string | null;
  saifDecisionRecordId: string | null;
  requestedByUserId: string;
  requestedByAgentRepId: string;
  requestStatus: ExecutionRequestStatus;
  executionMode: ExecutionMode;
  requestedAction: RequestedAction;
  blockedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishingJobSummary {
  id: string;
  publishingExecutionRequestId: string;
  publishingPackageId: string;
  platform: string;
  accountReferenceId: string | null;
  jobStatus: PostizJobStatus;
  postizExternalReferencePlaceholder: string | null;
  scheduledAt: Date | null;
  timezone: string | null;
  payloadHash: string | null;
  payloadSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadinessValidation {
  valid: boolean;
  blockedReasons: string[];
}
