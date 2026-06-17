import { z } from 'zod';

export const PRODUCTION_REQUEST_STATUSES = ['draft', 'submitted', 'in_progress', 'review', 'completed', 'cancelled', 'blocked'] as const;
export type ProductionRequestStatus = (typeof PRODUCTION_REQUEST_STATUSES)[number];

export const BRIEF_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'needs_revision'] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const REQUIREMENT_STATUSES = ['pending', 'available', 'missing', 'blocked'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const PACKAGE_READINESS_STATUSES = ['draft', 'validating', 'ready', 'blocked', 'cancelled'] as const;
export type PackageReadinessStatus = (typeof PACKAGE_READINESS_STATUSES)[number];

export const TARGET_STATUSES = ['pending', 'validated', 'blocked', 'ready'] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const CHECKLIST_CHECK_STATUSES = ['pending', 'passed', 'failed', 'skipped', 'blocked'] as const;
export type ChecklistCheckStatus = (typeof CHECKLIST_CHECK_STATUSES)[number];

export const REQUEST_TYPES = [
  'static_design', 'carousel', 'short_video', 'thumbnail',
  'landing_page_visual', 'brand_asset', 'publishing_package_asset'
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const createProductionRequestSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  campaignId: z.string().uuid().optional(),
  contentItemId: z.string().uuid().optional(),
  publishingPackageId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  requestedByUserId: z.string().uuid(),
  requestedByAgentRepId: z.string().uuid(),
  assignedDepartment: z.string().max(200).optional(),
  priority: z.string().default('medium'),
  dueDate: z.string().datetime().optional(),
  rationale: z.string().max(5000).optional(),
});

export const createCreativeBriefSchema = z.object({
  productionRequestId: z.string().uuid(),
  title: z.string().min(1).max(500),
  objective: z.string().max(5000).optional(),
  audience: z.string().max(1000).optional(),
  keyMessage: z.string().max(5000).optional(),
  tone: z.string().max(200).optional(),
  platform: z.string().max(100).optional(),
  format: z.string().max(100).optional(),
  dimensionsPlaceholder: z.string().max(200).optional(),
  brandGuidelinesReference: z.string().max(500).optional(),
  assetCognitionRecordId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createAssetRequirementSchema = z.object({
  productionRequestId: z.string().uuid(),
  requirementType: z.string().min(1).max(200),
  requiredAssetType: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  platform: z.string().max(100).optional(),
  linkedAssetId: z.string().uuid().optional(),
  externalReferenceId: z.string().uuid().optional(),
});

export const createRenderingPackageSchema = z.object({
  productionRequestId: z.string().uuid(),
  creativeBriefId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  mcpMediationRequestId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  spineRunId: z.string().uuid().optional(),
  spineArtifactId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createRenderingTargetSchema = z.object({
  renderingPreparationPackageId: z.string().uuid(),
  targetType: z.string().min(1).max(200),
  platform: z.string().max(100).optional(),
  format: z.string().max(100).optional(),
  dimensionsPlaceholder: z.string().max(200).optional(),
  durationPlaceholder: z.string().max(200).optional(),
  outputAssetType: z.string().max(200).optional(),
  requiresMcp: z.boolean().default(true),
  futureConnectorReference: z.string().max(500).optional(),
});

export const createReviewChecklistSchema = z.object({
  productionRequestId: z.string().uuid(),
  checkType: z.string().min(1).max(200),
  severity: z.string().default('info'),
  message: z.string().max(5000).optional(),
  sourceObjectType: z.string().max(200).optional(),
  sourceObjectId: z.string().uuid().optional(),
});

export type CreateProductionRequestInput = z.infer<typeof createProductionRequestSchema>;
export type CreateCreativeBriefInput = z.infer<typeof createCreativeBriefSchema>;
export type CreateAssetRequirementInput = z.infer<typeof createAssetRequirementSchema>;
export type CreateRenderingPackageInput = z.infer<typeof createRenderingPackageSchema>;
export type CreateRenderingTargetInput = z.infer<typeof createRenderingTargetSchema>;
export type CreateReviewChecklistInput = z.infer<typeof createReviewChecklistSchema>;

export interface ProductionRequestSummary {
  id: string;
  requestStatus: ProductionRequestStatus;
  requestType: string;
  campaignId: string | null;
  contentItemId: string | null;
  publishingPackageId: string | null;
  assetId: string | null;
  requestedByUserId: string;
  requestedByAgentRepId: string;
  assignedDepartment: string | null;
  priority: string;
  dueDate: Date | null;
  rationale: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreativeBriefSummary {
  id: string;
  productionRequestId: string;
  briefStatus: BriefStatus;
  title: string;
  objective: string | null;
  audience: string | null;
  keyMessage: string | null;
  tone: string | null;
  platform: string | null;
  format: string | null;
  dimensionsPlaceholder: string | null;
  brandGuidelinesReference: string | null;
  assetCognitionRecordId: string | null;
  saifDecisionRecordId: string | null;
  approvalId: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionAssetRequirementSummary {
  id: string;
  productionRequestId: string;
  requirementType: string;
  requiredAssetType: string | null;
  description: string | null;
  platform: string | null;
  status: RequirementStatus;
  linkedAssetId: string | null;
  externalReferenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenderingPreparationPackageSummary {
  id: string;
  productionRequestId: string;
  creativeBriefId: string | null;
  packageStatus: PackageReadinessStatus;
  capabilityResolutionId: string | null;
  mcpMediationRequestId: string | null;
  approvalId: string | null;
  spineRunId: string | null;
  spineArtifactId: string | null;
  assetId: string | null;
  readinessScore: number | null;
  blockedReasons: string[];
  packageHash: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenderingTargetSummary {
  id: string;
  renderingPreparationPackageId: string;
  targetType: string;
  platform: string | null;
  format: string | null;
  dimensionsPlaceholder: string | null;
  durationPlaceholder: string | null;
  outputAssetType: string | null;
  targetStatus: TargetStatus;
  requiresMcp: boolean;
  futureConnectorReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionReviewChecklistSummary {
  id: string;
  productionRequestId: string;
  checkType: string;
  checkStatus: ChecklistCheckStatus;
  severity: string;
  message: string | null;
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  createdAt: Date;
}

export const VALID_REQUEST_TRANSITIONS: Record<ProductionRequestStatus, ProductionRequestStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['review', 'blocked', 'cancelled'],
  review: ['completed', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  blocked: ['submitted', 'in_progress', 'cancelled'],
};

export function isValidRequestTransition(from: ProductionRequestStatus, to: ProductionRequestStatus): boolean {
  return VALID_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateRequestTransition(from: ProductionRequestStatus, to: ProductionRequestStatus): void {
  if (!isValidRequestTransition(from, to)) {
    throw new Error(`Invalid production request status transition: ${from} → ${to}`);
  }
}
