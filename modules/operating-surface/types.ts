import { z } from 'zod';

export const SURFACE_TYPES = ['paperclip', 'internal_web_app', 'future_chat_surface', 'future_dashboard_surface'] as const;
export type SurfaceType = (typeof SURFACE_TYPES)[number];

export const SURFACE_STATUSES = ['active', 'inactive', 'planned'] as const;
export type SurfaceStatus = (typeof SURFACE_STATUSES)[number];

export const SURFACE_DIRECTIONS = ['stitch_to_surface', 'surface_to_stitch', 'bidirectional'] as const;
export type SurfaceDirection = (typeof SURFACE_DIRECTIONS)[number];

export const TASK_TYPES = ['approval', 'review', 'assignment', 'notification', 'status_update'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const RELAY_DIRECTIONS = ['inbound', 'outbound'] as const;
export type RelayDirection = (typeof RELAY_DIRECTIONS)[number];

export const RELAY_EVENT_STATUSES = ['received', 'processed', 'blocked', 'requires_review', 'failed'] as const;
export type RelayEventStatus = (typeof RELAY_EVENT_STATUSES)[number];

export const SYNC_POLICY_TYPES = [
  'stitch_to_surface_read_only', 'surface_to_stitch_review_required',
  'surface_to_stitch_blocked', 'surface_status_projection_only'
] as const;
export type SyncPolicyType = (typeof SYNC_POLICY_TYPES)[number];

export const REFERENCE_SYNC_STATUSES = ['synced', 'pending', 'conflict', 'stale', 'unknown'] as const;
export type ReferenceSyncStatus = (typeof REFERENCE_SYNC_STATUSES)[number];

export const createOperatingSurfaceSchema = z.object({
  name: z.string().min(1).max(200),
  surfaceType: z.enum(SURFACE_TYPES),
  description: z.string().max(5000).optional(),
  isExternal: z.boolean().default(true),
  canonicalAuthority: z.string().default('stitch'),
  allowedDirections: z.array(z.enum(SURFACE_DIRECTIONS)).default(['stitch_to_surface']),
});

export const createSurfaceTaskSchema = z.object({
  operatingSurfaceId: z.string().uuid(),
  externalTaskReference: z.string().max(500).optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  taskType: z.enum(TASK_TYPES).default('assignment'),
  canonicalTargetType: z.string().max(200).optional(),
  canonicalTargetId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  assignedAgentRepId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  spineRunId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createStatusProjectionSchema = z.object({
  operatingSurfaceId: z.string().uuid(),
  canonicalObjectType: z.string().min(1).max(200),
  canonicalObjectId: z.string().uuid(),
  projectedStatus: z.string().min(1).max(200),
  projectedSummary: z.string().max(5000).optional(),
  sourceSubstrate: z.string().max(200).optional(),
});

export const createRelayEventSchema = z.object({
  operatingSurfaceId: z.string().uuid(),
  direction: z.enum(RELAY_DIRECTIONS),
  eventType: z.string().min(1).max(200),
  canonicalObjectType: z.string().max(200).optional(),
  canonicalObjectId: z.string().uuid().optional(),
  externalReference: z.string().max(500).optional(),
  payloadSummary: z.string().max(5000).optional(),
  humanUserId: z.string().uuid().optional(),
  agentRepId: z.string().uuid().optional(),
});

export const createPaperclipReferenceSchema = z.object({
  canonicalObjectType: z.string().min(1).max(200),
  canonicalObjectId: z.string().uuid(),
  paperclipObjectType: z.string().min(1).max(200),
  paperclipReferenceId: z.string().min(1).max(500),
  syncStatus: z.enum(REFERENCE_SYNC_STATUSES).default('unknown'),
});

export const createSyncPolicySchema = z.object({
  operatingSurfaceId: z.string().uuid(),
  canonicalObjectType: z.string().min(1).max(200),
  direction: z.enum(SURFACE_DIRECTIONS),
  policyType: z.enum(SYNC_POLICY_TYPES),
  requiresReview: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  allowedFields: z.array(z.string()).default([]),
  blockedFields: z.array(z.string()).default([]),
});

export type CreateOperatingSurfaceInput = z.infer<typeof createOperatingSurfaceSchema>;
export type CreateSurfaceTaskInput = z.infer<typeof createSurfaceTaskSchema>;
export type CreateStatusProjectionInput = z.infer<typeof createStatusProjectionSchema>;
export type CreateRelayEventInput = z.infer<typeof createRelayEventSchema>;
export type CreatePaperclipReferenceInput = z.infer<typeof createPaperclipReferenceSchema>;
export type CreateSyncPolicyInput = z.infer<typeof createSyncPolicySchema>;

export interface OperatingSurfaceSummary {
  id: string;
  name: string;
  surfaceType: SurfaceType;
  status: SurfaceStatus;
  description: string | null;
  isExternal: boolean;
  canonicalAuthority: string;
  allowedDirections: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SurfaceTaskSummary {
  id: string;
  operatingSurfaceId: string;
  externalTaskReference: string | null;
  title: string;
  description: string | null;
  taskType: TaskType;
  taskStatus: TaskStatus;
  canonicalTargetType: string | null;
  canonicalTargetId: string | null;
  assignedUserId: string | null;
  assignedAgentRepId: string | null;
  approvalId: string | null;
  saifDecisionRecordId: string | null;
  spineRunId: string | null;
  capabilityResolutionId: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusProjectionSummary {
  id: string;
  operatingSurfaceId: string;
  canonicalObjectType: string;
  canonicalObjectId: string;
  projectedStatus: string;
  projectedSummary: string | null;
  sourceSubstrate: string | null;
  lastProjectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelayEventSummary {
  id: string;
  operatingSurfaceId: string;
  direction: RelayDirection;
  eventType: string;
  eventStatus: RelayEventStatus;
  canonicalObjectType: string | null;
  canonicalObjectId: string | null;
  externalReference: string | null;
  payloadSummary: string | null;
  humanUserId: string | null;
  agentRepId: string | null;
  createdAt: Date;
  processedAt: Date | null;
  result: string | null;
}

export interface PaperclipReferenceSummary {
  id: string;
  canonicalObjectType: string;
  canonicalObjectId: string;
  paperclipObjectType: string;
  paperclipReferenceId: string;
  syncStatus: ReferenceSyncStatus;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncPolicySummary {
  id: string;
  operatingSurfaceId: string;
  canonicalObjectType: string;
  direction: SurfaceDirection;
  policyType: SyncPolicyType;
  requiresReview: boolean;
  requiresApproval: boolean;
  allowedFields: string[];
  blockedFields: string[];
  createdAt: Date;
  updatedAt: Date;
}
