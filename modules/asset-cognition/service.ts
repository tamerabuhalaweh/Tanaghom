import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateAssetInput, UpdateAssetInput, CreateCognitionRecordInput,
  CreateExternalReferenceInput, CreateAssetLineageInput,
  AssetSummary, CognitionRecordSummary, ExternalReferenceSummary, AssetLineageSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['assets:create', 'assets:read', 'assets:update', 'assets:cognize', 'assets:reference'],
  cco: ['assets:create', 'assets:read', 'assets:update', 'assets:cognize', 'assets:reference'],
  department_head: ['assets:create', 'assets:read', 'assets:update', 'assets:cognize'],
  specialist: ['assets:create', 'assets:read', 'assets:cognize'],
  reviewer: ['assets:read'],
  viewer: ['assets:read'],
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
// Asset Service
// ============================================================

export async function createAsset(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateAssetInput,
): Promise<AssetSummary> {
  checkPermission(requesterRole, 'assets:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  const asset = await repo.createAsset(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'asset_created', object_type: 'asset', object_id: asset.id, result: 'success' },
    `Asset created: ${asset.title} (${asset.assetType})`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_asset',
    'asset',
    asset.id,
    'success',
    { assetType: asset.assetType, title: asset.title },
  );

  return asset;
}

export async function getAsset(requesterRole: string, id: string): Promise<AssetSummary> {
  checkPermission(requesterRole, 'assets:read');
  return repo.getAssetById(id);
}

export async function listAssets(requesterRole: string, filters?: {
  assetType?: string;
  assetStatus?: string;
  createdByUserId?: string;
  contentHash?: string;
}): Promise<AssetSummary[]> {
  checkPermission(requesterRole, 'assets:read');
  return repo.listAssets(filters);
}

export async function updateAsset(
  requesterRole: string,
  id: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: UpdateAssetInput,
): Promise<AssetSummary> {
  checkPermission(requesterRole, 'assets:update');

  const asset = await repo.updateAsset(id, input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'asset_updated', object_type: 'asset', object_id: id, result: 'success' },
    `Asset updated: ${asset.title} -> ${asset.assetStatus}`,
  );

  return asset;
}

// ============================================================
// Cognition Record Service
// ============================================================

export async function createCognitionRecord(
  requesterRole: string,
  input: CreateCognitionRecordInput,
): Promise<CognitionRecordSummary> {
  checkPermission(requesterRole, 'assets:cognize');

  // Cognition records cannot approve or publish
  if (input.summary?.toLowerCase().includes('approve') || input.summary?.toLowerCase().includes('publish')) {
    throw new ForbiddenError('Cognition records cannot approve or publish assets');
  }

  const record = await repo.createCognitionRecord(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'cognition_record_created', object_type: 'asset_cognition', object_id: record.id, result: 'success' },
    `Cognition record created: ${record.cognitionType} for asset ${record.assetId}`,
  );

  return record;
}

export async function listCognitionRecords(requesterRole: string, assetId: string): Promise<CognitionRecordSummary[]> {
  checkPermission(requesterRole, 'assets:read');
  return repo.listCognitionRecords(assetId);
}

// ============================================================
// External Reference Service
// ============================================================

export async function createExternalReference(
  requesterRole: string,
  input: CreateExternalReferenceInput,
): Promise<ExternalReferenceSummary> {
  checkPermission(requesterRole, 'assets:reference');

  // ResourceSpace boundary enforcement
  if (input.externalSystem === 'ResourceSpace') {
    // ResourceSpace cannot overwrite canonical asset identity
    const asset = await repo.getAssetById(input.assetId);
    if (asset.canonicalOwner === 'ResourceSpace') {
      throw new ForbiddenError('ResourceSpace cannot become the canonical owner of an asset');
    }
  }

  const reference = await repo.createExternalReference(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'external_reference_created', object_type: 'external_asset_reference', object_id: reference.id, result: 'success' },
    `External reference created: ${reference.externalSystem} -> ${reference.externalReferenceId}`,
  );

  return reference;
}

export async function listExternalReferences(requesterRole: string, assetId: string): Promise<ExternalReferenceSummary[]> {
  checkPermission(requesterRole, 'assets:read');
  return repo.listExternalReferences(assetId);
}

// ============================================================
// Asset Lineage Service
// ============================================================

export async function createAssetLineage(
  requesterRole: string,
  input: CreateAssetLineageInput,
): Promise<AssetLineageSummary> {
  checkPermission(requesterRole, 'assets:create');

  const lineage = await repo.createAssetLineage(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'asset_lineage_created', object_type: 'asset_lineage', object_id: lineage.id, result: 'success' },
    `Asset lineage created: ${lineage.relationshipType}`,
  );

  return lineage;
}

export async function getAssetLineage(requesterRole: string, assetId: string): Promise<AssetLineageSummary[]> {
  checkPermission(requesterRole, 'assets:read');
  return repo.getAssetLineage(assetId);
}
