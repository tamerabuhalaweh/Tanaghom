import { z } from 'zod';

export const ASSET_TYPES = ['image', 'video', 'document', 'audio', 'template', 'carousel', 'thumbnail', 'brand_guideline', 'creative_brief', 'publishing_package', 'other'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'archived', 'superseded'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const COGNITION_TYPES = ['brand_alignment', 'compliance_status', 'usage_context', 'performance_data', 'platform_fit', 'audience_fit', 'quality_assessment'] as const;
export type CognitionType = (typeof COGNITION_TYPES)[number];

export const EXTERNAL_REFERENCE_TYPES = ['resourcespace_asset', 'rendering_output', 'design_tool_link', 'storage_object', 'dam_reference'] as const;
export type ExternalReferenceType = (typeof EXTERNAL_REFERENCE_TYPES)[number];

export const EXTERNAL_SYNC_STATUSES = ['synced', 'pending', 'conflict', 'stale', 'unknown'] as const;
export type ExternalSyncStatus = (typeof EXTERNAL_SYNC_STATUSES)[number];

export const ASSET_LINEAGE_TYPES = ['derived_from', 'variant_of', 'approved_version_of', 'rendered_from', 'used_in', 'supports', 'replaces', 'references'] as const;
export type AssetLineageType = (typeof ASSET_LINEAGE_TYPES)[number];

export const createAssetSchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  canonicalOwner: z.string().max(200).optional(),
  sensitivity: z.string().max(100).optional(),
  classification: z.string().max(100).optional(),
  sourceObjectType: z.string().max(200).optional(),
  sourceObjectId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
  spineArtifactId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  contentHash: z.string().max(200).optional(),
  version: z.number().int().default(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAssetSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  assetStatus: z.enum(ASSET_STATUSES).optional(),
  canonicalOwner: z.string().max(200).optional(),
  sensitivity: z.string().max(100).optional(),
  classification: z.string().max(100).optional(),
  contentHash: z.string().max(200).optional(),
  version: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createCognitionRecordSchema = z.object({
  assetId: z.string().uuid(),
  cognitionType: z.enum(COGNITION_TYPES),
  summary: z.string().max(5000).optional(),
  tags: z.array(z.string()).default([]),
  detectedTopics: z.array(z.string()).default([]),
  brandFitScore: z.number().min(0).max(1).optional(),
  complianceRisk: z.string().max(200).optional(),
  usageGuidance: z.string().max(5000).optional(),
  platformFit: z.record(z.unknown()).optional(),
  audienceFit: z.record(z.unknown()).optional(),
  sourceMethod: z.string().max(200).optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
  reviewedByUserId: z.string().uuid().optional(),
  reviewedByAgentRepId: z.string().uuid().optional(),
});

export const createExternalReferenceSchema = z.object({
  assetId: z.string().uuid(),
  externalSystem: z.string().min(1).max(200),
  externalReferenceId: z.string().min(1).max(500),
  externalUrlPlaceholder: z.string().max(1000).optional(),
  referenceType: z.enum(EXTERNAL_REFERENCE_TYPES),
  syncStatus: z.enum(EXTERNAL_SYNC_STATUSES).default('unknown'),
});

export const createAssetLineageSchema = z.object({
  sourceAssetId: z.string().uuid(),
  targetAssetId: z.string().uuid(),
  relationshipType: z.enum(ASSET_LINEAGE_TYPES),
  rationale: z.string().max(5000).optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type CreateCognitionRecordInput = z.infer<typeof createCognitionRecordSchema>;
export type CreateExternalReferenceInput = z.infer<typeof createExternalReferenceSchema>;
export type CreateAssetLineageInput = z.infer<typeof createAssetLineageSchema>;

export interface AssetSummary {
  id: string;
  assetType: AssetType;
  assetStatus: AssetStatus;
  title: string;
  description: string | null;
  canonicalOwner: string | null;
  sensitivity: string | null;
  classification: string | null;
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  spineArtifactId: string | null;
  saifDecisionRecordId: string | null;
  approvalId: string | null;
  capabilityResolutionId: string | null;
  contentHash: string | null;
  version: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CognitionRecordSummary {
  id: string;
  assetId: string;
  cognitionType: CognitionType;
  summary: string | null;
  tags: string[];
  detectedTopics: string[];
  brandFitScore: number | null;
  complianceRisk: string | null;
  usageGuidance: string | null;
  platformFit: Record<string, unknown> | null;
  audienceFit: Record<string, unknown> | null;
  sourceMethod: string | null;
  confidence: string;
  reviewedByUserId: string | null;
  reviewedByAgentRepId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalReferenceSummary {
  id: string;
  assetId: string;
  externalSystem: string;
  externalReferenceId: string;
  externalUrlPlaceholder: string | null;
  referenceType: ExternalReferenceType;
  syncStatus: ExternalSyncStatus;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetLineageSummary {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: AssetLineageType;
  rationale: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  createdAt: Date;
}

export const VALID_ASSET_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['approved', 'rejected', 'archived'],
  approved: ['archived', 'superseded'],
  rejected: ['draft', 'archived'],
  archived: [],
  superseded: ['archived'],
};

export function isValidAssetTransition(from: AssetStatus, to: AssetStatus): boolean {
  return VALID_ASSET_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateAssetTransition(from: AssetStatus, to: AssetStatus): void {
  if (!isValidAssetTransition(from, to)) {
    throw new Error(`Invalid asset status transition: ${from} → ${to}`);
  }
}
