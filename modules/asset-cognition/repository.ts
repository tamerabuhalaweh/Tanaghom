import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateAssetInput, UpdateAssetInput, CreateCognitionRecordInput,
  CreateExternalReferenceInput, CreateAssetLineageInput,
  AssetSummary, CognitionRecordSummary, ExternalReferenceSummary, AssetLineageSummary,
  AssetStatus,
} from './types';
import { validateAssetTransition } from './types';

// ============================================================
// Asset
// ============================================================

export async function createAsset(input: CreateAssetInput): Promise<AssetSummary> {
  const asset = await prisma.asset.create({
    data: {
      asset_type: input.assetType,
      title: input.title,
      description: input.description,
      canonical_owner: input.canonicalOwner,
      sensitivity: input.sensitivity,
      classification: input.classification,
      source_object_type: input.sourceObjectType,
      source_object_id: input.sourceObjectId,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
      spine_artifact_id: input.spineArtifactId,
      saif_decision_record_id: input.saifDecisionRecordId,
      approval_id: input.approvalId,
      capability_resolution_id: input.capabilityResolutionId,
      content_hash: input.contentHash,
      version: input.version,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return mapAsset(asset);
}

export async function getAssetById(id: string): Promise<AssetSummary> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError('Asset', id);
  return mapAsset(asset);
}

export async function listAssets(filters?: {
  assetType?: string;
  assetStatus?: string;
  createdByUserId?: string;
  contentHash?: string;
}): Promise<AssetSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.assetType) where.asset_type = filters.assetType;
  if (filters?.assetStatus) where.asset_status = filters.assetStatus;
  if (filters?.createdByUserId) where.created_by_user_id = filters.createdByUserId;
  if (filters?.contentHash) where.content_hash = filters.contentHash;

  const assets = await prisma.asset.findMany({ where, orderBy: { created_at: 'desc' } });
  return assets.map(mapAsset);
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<AssetSummary> {
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Asset', id);

  // Validate status transition if status is being changed
  if (input.assetStatus) {
    validateAssetTransition(existing.asset_status as AssetStatus, input.assetStatus);
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.assetStatus !== undefined) data.asset_status = input.assetStatus;
  if (input.canonicalOwner !== undefined) data.canonical_owner = input.canonicalOwner;
  if (input.sensitivity !== undefined) data.sensitivity = input.sensitivity;
  if (input.classification !== undefined) data.classification = input.classification;
  if (input.contentHash !== undefined) data.content_hash = input.contentHash;
  if (input.version !== undefined) data.version = input.version;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const asset = await prisma.asset.update({ where: { id }, data });
  return mapAsset(asset);
}

// ============================================================
// AssetCognitionRecord
// ============================================================

export async function createCognitionRecord(input: CreateCognitionRecordInput): Promise<CognitionRecordSummary> {
  const record = await prisma.assetCognitionRecord.create({
    data: {
      asset_id: input.assetId,
      cognition_type: input.cognitionType,
      summary: input.summary,
      tags: input.tags,
      detected_topics: input.detectedTopics,
      brand_fit_score: input.brandFitScore,
      compliance_risk: input.complianceRisk,
      usage_guidance: input.usageGuidance,
      platform_fit: input.platformFit as Prisma.InputJsonValue | undefined,
      audience_fit: input.audienceFit as Prisma.InputJsonValue | undefined,
      source_method: input.sourceMethod,
      confidence: input.confidence,
      reviewed_by_user_id: input.reviewedByUserId,
      reviewed_by_agent_rep_id: input.reviewedByAgentRepId,
      reviewed_at: input.reviewedByUserId ? new Date() : undefined,
    },
  });
  return mapCognitionRecord(record);
}

export async function listCognitionRecords(assetId: string): Promise<CognitionRecordSummary[]> {
  const records = await prisma.assetCognitionRecord.findMany({
    where: { asset_id: assetId },
    orderBy: { created_at: 'desc' },
  });
  return records.map(mapCognitionRecord);
}

// ============================================================
// ExternalAssetReference
// ============================================================

export async function createExternalReference(input: CreateExternalReferenceInput): Promise<ExternalReferenceSummary> {
  // Verify asset exists
  const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
  if (!asset) throw new NotFoundError('Asset', input.assetId);

  // Block ResourceSpace from becoming canonical owner
  if (input.externalSystem === 'ResourceSpace' && asset.canonical_owner === 'ResourceSpace') {
    throw new ForbiddenError('ResourceSpace cannot become the canonical owner of an asset');
  }

  const reference = await prisma.externalAssetReference.create({
    data: {
      asset_id: input.assetId,
      external_system: input.externalSystem,
      external_reference_id: input.externalReferenceId,
      external_url_placeholder: input.externalUrlPlaceholder,
      reference_type: input.referenceType,
      sync_status: input.syncStatus,
    },
  });
  return mapExternalReference(reference);
}

export async function listExternalReferences(assetId: string): Promise<ExternalReferenceSummary[]> {
  const references = await prisma.externalAssetReference.findMany({
    where: { asset_id: assetId },
    orderBy: { created_at: 'desc' },
  });
  return references.map(mapExternalReference);
}

// ============================================================
// AssetLineage
// ============================================================

export async function createAssetLineage(input: CreateAssetLineageInput): Promise<AssetLineageSummary> {
  const lineage = await prisma.assetLineage.create({
    data: {
      source_asset_id: input.sourceAssetId,
      target_asset_id: input.targetAssetId,
      relationship_type: input.relationshipType,
      rationale: input.rationale,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapAssetLineage(lineage);
}

export async function getAssetLineage(assetId: string): Promise<AssetLineageSummary[]> {
  const sourceLinks = await prisma.assetLineage.findMany({
    where: { source_asset_id: assetId },
    orderBy: { created_at: 'desc' },
  });
  const targetLinks = await prisma.assetLineage.findMany({
    where: { target_asset_id: assetId },
    orderBy: { created_at: 'desc' },
  });
  return [...sourceLinks.map(mapAssetLineage), ...targetLinks.map(mapAssetLineage)];
}

// ============================================================
// Mappers
// ============================================================

function mapAsset(a: Record<string, unknown>): AssetSummary {
  return {
    id: a.id as string,
    assetType: a.asset_type as AssetSummary['assetType'],
    assetStatus: a.asset_status as AssetSummary['assetStatus'],
    title: a.title as string,
    description: a.description as string | null,
    canonicalOwner: a.canonical_owner as string | null,
    sensitivity: a.sensitivity as string | null,
    classification: a.classification as string | null,
    sourceObjectType: a.source_object_type as string | null,
    sourceObjectId: a.source_object_id as string | null,
    createdByUserId: a.created_by_user_id as string,
    createdByAgentRepId: a.created_by_agent_rep_id as string,
    spineArtifactId: a.spine_artifact_id as string | null,
    saifDecisionRecordId: a.saif_decision_record_id as string | null,
    approvalId: a.approval_id as string | null,
    capabilityResolutionId: a.capability_resolution_id as string | null,
    contentHash: a.content_hash as string | null,
    version: a.version as number,
    metadata: a.metadata as Record<string, unknown> | null,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}

function mapCognitionRecord(r: Record<string, unknown>): CognitionRecordSummary {
  return {
    id: r.id as string,
    assetId: r.asset_id as string,
    cognitionType: r.cognition_type as CognitionRecordSummary['cognitionType'],
    summary: r.summary as string | null,
    tags: r.tags as string[],
    detectedTopics: r.detected_topics as string[],
    brandFitScore: r.brand_fit_score as number | null,
    complianceRisk: r.compliance_risk as string | null,
    usageGuidance: r.usage_guidance as string | null,
    platformFit: r.platform_fit as Record<string, unknown> | null,
    audienceFit: r.audience_fit as Record<string, unknown> | null,
    sourceMethod: r.source_method as string | null,
    confidence: r.confidence as string,
    reviewedByUserId: r.reviewed_by_user_id as string | null,
    reviewedByAgentRepId: r.reviewed_by_agent_rep_id as string | null,
    reviewedAt: r.reviewed_at as Date | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapExternalReference(r: Record<string, unknown>): ExternalReferenceSummary {
  return {
    id: r.id as string,
    assetId: r.asset_id as string,
    externalSystem: r.external_system as string,
    externalReferenceId: r.external_reference_id as string,
    externalUrlPlaceholder: r.external_url_placeholder as string | null,
    referenceType: r.reference_type as ExternalReferenceSummary['referenceType'],
    syncStatus: r.sync_status as ExternalReferenceSummary['syncStatus'],
    lastCheckedAt: r.last_checked_at as Date | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapAssetLineage(l: Record<string, unknown>): AssetLineageSummary {
  return {
    id: l.id as string,
    sourceAssetId: l.source_asset_id as string,
    targetAssetId: l.target_asset_id as string,
    relationshipType: l.relationship_type as AssetLineageSummary['relationshipType'],
    rationale: l.rationale as string | null,
    createdByUserId: l.created_by_user_id as string,
    createdByAgentRepId: l.created_by_agent_rep_id as string,
    createdAt: l.created_at as Date,
  };
}
