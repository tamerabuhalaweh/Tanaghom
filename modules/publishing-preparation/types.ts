import { z } from 'zod';

export const PACKAGE_STATUSES = ['draft', 'validating', 'ready_for_future_execution', 'blocked', 'superseded', 'cancelled'] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export const PACKAGE_TYPES = ['single_post', 'multi_platform_campaign', 'carousel', 'video_post', 'story', 'thread'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const PACKAGE_ITEM_STATUSES = ['pending', 'validated', 'blocked', 'excluded'] as const;
export type PackageItemStatus = (typeof PACKAGE_ITEM_STATUSES)[number];

export const PACKAGE_ITEM_TYPES = [
  'platform_caption', 'asset_reference', 'hashtag_set', 'cta', 'link_reference',
  'compliance_note', 'approval_evidence', 'saif_evidence', 'asset_cognition_evidence'
] as const;
export type PackageItemType = (typeof PACKAGE_ITEM_TYPES)[number];

export const TARGET_STATUSES = ['pending', 'validated', 'blocked', 'ready'] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const CHECK_STATUSES = ['pending', 'passed', 'failed', 'skipped', 'blocked'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const CHECK_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
export type CheckSeverity = (typeof CHECK_SEVERITIES)[number];

export const MANIFEST_STATUSES = ['draft', 'generated', 'validated', 'superseded'] as const;
export type ManifestStatus = (typeof MANIFEST_STATUSES)[number];

export const createPackageSchema = z.object({
  packageType: z.enum(PACKAGE_TYPES).default('single_post'),
  campaignId: z.string().uuid().optional(),
  contentItemId: z.string().uuid().optional(),
  draftVersionId: z.string().uuid().optional(),
  saifDecisionRecordId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  capabilityResolutionId: z.string().uuid().optional(),
  mcpMediationRequestId: z.string().uuid().optional(),
  spineRunId: z.string().uuid().optional(),
  spineArtifactId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createPackageItemSchema = z.object({
  publishingPackageId: z.string().uuid(),
  itemType: z.enum(PACKAGE_ITEM_TYPES),
  sourceObjectType: z.string().max(200).optional(),
  sourceObjectId: z.string().uuid().optional(),
  platform: z.string().max(100).optional(),
  contentSummary: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createPublishingTargetSchema = z.object({
  publishingPackageId: z.string().uuid(),
  platform: z.string().min(1).max(100),
  accountReference: z.string().max(500).optional(),
  proposedPublishAt: z.string().datetime().optional(),
  timezone: z.string().max(100).optional(),
  platformFormat: z.string().max(200).optional(),
  platformConstraints: z.record(z.unknown()).optional(),
  requiresMcp: z.boolean().default(false),
  futureConnectorReference: z.string().max(500).optional(),
});

export const createReadinessCheckSchema = z.object({
  publishingPackageId: z.string().uuid(),
  checkType: z.string().min(1).max(200),
  severity: z.enum(CHECK_SEVERITIES).default('info'),
  message: z.string().max(5000).optional(),
  sourceObjectType: z.string().max(200).optional(),
  sourceObjectId: z.string().uuid().optional(),
});

export const generateManifestSchema = z.object({
  publishingPackageId: z.string().uuid(),
  generatedByUserId: z.string().uuid(),
  generatedByAgentRepId: z.string().uuid(),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type CreatePackageItemInput = z.infer<typeof createPackageItemSchema>;
export type CreatePublishingTargetInput = z.infer<typeof createPublishingTargetSchema>;
export type CreateReadinessCheckInput = z.infer<typeof createReadinessCheckSchema>;
export type GenerateManifestInput = z.infer<typeof generateManifestSchema>;

export interface PublishingPackageSummary {
  id: string;
  packageStatus: PackageStatus;
  packageType: PackageType;
  campaignId: string | null;
  contentItemId: string | null;
  draftVersionId: string | null;
  saifDecisionRecordId: string | null;
  approvalId: string | null;
  capabilityResolutionId: string | null;
  mcpMediationRequestId: string | null;
  spineRunId: string | null;
  spineArtifactId: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  readinessScore: number | null;
  readinessSummary: string | null;
  blockedReasons: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PackageItemSummary {
  id: string;
  publishingPackageId: string;
  itemType: PackageItemType;
  itemStatus: PackageItemStatus;
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  platform: string | null;
  contentSummary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishingTargetSummary {
  id: string;
  publishingPackageId: string;
  platform: string;
  accountReference: string | null;
  targetStatus: TargetStatus;
  proposedPublishAt: Date | null;
  timezone: string | null;
  platformFormat: string | null;
  platformConstraints: Record<string, unknown> | null;
  requiresMcp: boolean;
  futureConnectorReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadinessCheckSummary {
  id: string;
  publishingPackageId: string;
  checkType: string;
  checkStatus: CheckStatus;
  severity: CheckSeverity;
  message: string | null;
  sourceObjectType: string | null;
  sourceObjectId: string | null;
  createdAt: Date;
}

export interface PublishingManifestSummary {
  id: string;
  publishingPackageId: string;
  manifestVersion: number;
  manifestStatus: ManifestStatus;
  packageHash: string | null;
  manifestSummary: string | null;
  generatedAt: Date;
  generatedByUserId: string;
  generatedByAgentRepId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const VALID_PACKAGE_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  draft: ['validating', 'cancelled'],
  validating: ['ready_for_future_execution', 'blocked', 'cancelled'],
  ready_for_future_execution: ['superseded', 'cancelled'],
  blocked: ['validating', 'cancelled'],
  superseded: [],
  cancelled: [],
};

export const CRITICAL_READINESS_CHECKS = [
  'content_approved',
  'saif_critical_dimensions_resolved',
  'approval_record_exists',
  'capability_resolution_exists',
];

export function isValidPackageTransition(from: PackageStatus, to: PackageStatus): boolean {
  return VALID_PACKAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validatePackageTransition(from: PackageStatus, to: PackageStatus): void {
  if (!isValidPackageTransition(from, to)) {
    throw new Error(`Invalid package status transition: ${from} → ${to}`);
  }
}
