import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreatePackageInput, CreatePackageItemInput, CreatePublishingTargetInput,
  CreateReadinessCheckInput, GenerateManifestInput,
  PublishingPackageSummary, PackageItemSummary, PublishingTargetSummary,
  ReadinessCheckSummary, PublishingManifestSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['publishing:create', 'publishing:read', 'publishing:validate', 'publishing:manifest'],
  cco: ['publishing:create', 'publishing:read', 'publishing:validate', 'publishing:manifest'],
  department_head: ['publishing:create', 'publishing:read', 'publishing:validate'],
  specialist: ['publishing:create', 'publishing:read'],
  reviewer: ['publishing:read'],
  viewer: ['publishing:read'],
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
// PublishingPackage Service
// ============================================================

export async function createPackage(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreatePackageInput,
): Promise<PublishingPackageSummary> {
  checkPermission(requesterRole, 'publishing:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  // M5 execution remains blocked
  // Package creation is allowed — it's preparation only

  const pkg = await repo.createPackage(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'publishing_package_created', object_type: 'publishing_package', object_id: pkg.id, result: 'success' },
    `Publishing package created: ${pkg.packageType}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_publishing_package',
    'publishing_package',
    pkg.id,
    'success',
    { packageType: pkg.packageType },
  );

  return pkg;
}

export async function getPackage(requesterRole: string, id: string): Promise<PublishingPackageSummary> {
  checkPermission(requesterRole, 'publishing:read');
  return repo.getPackageById(id);
}

export async function listPackages(requesterRole: string, filters?: {
  packageStatus?: string;
  campaignId?: string;
  contentItemId?: string;
  createdByUserId?: string;
}): Promise<PublishingPackageSummary[]> {
  checkPermission(requesterRole, 'publishing:read');
  return repo.listPackages(filters);
}

// ============================================================
// PackageItem Service
// ============================================================

export async function createPackageItem(
  requesterRole: string,
  input: CreatePackageItemInput,
): Promise<PackageItemSummary> {
  checkPermission(requesterRole, 'publishing:create');
  const item = await repo.createPackageItem(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'package_item_created', object_type: 'publishing_package_item', object_id: item.id, result: 'success' },
    `Package item created: ${item.itemType}`,
  );

  return item;
}

export async function listPackageItems(requesterRole: string, packageId: string): Promise<PackageItemSummary[]> {
  checkPermission(requesterRole, 'publishing:read');
  return repo.listPackageItems(packageId);
}

// ============================================================
// PublishingTarget Service
// ============================================================

export async function createPublishingTarget(
  requesterRole: string,
  input: CreatePublishingTargetInput,
): Promise<PublishingTargetSummary> {
  checkPermission(requesterRole, 'publishing:create');

  // No real platform account connection
  // Account references are placeholders only

  const target = await repo.createPublishingTarget(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'publishing_target_created', object_type: 'publishing_target', object_id: target.id, result: 'success' },
    `Publishing target created: ${target.platform}`,
  );

  return target;
}

export async function listPublishingTargets(requesterRole: string, packageId: string): Promise<PublishingTargetSummary[]> {
  checkPermission(requesterRole, 'publishing:read');
  return repo.listPublishingTargets(packageId);
}

// ============================================================
// ReadinessCheck Service
// ============================================================

export async function createReadinessCheck(
  requesterRole: string,
  input: CreateReadinessCheckInput,
): Promise<ReadinessCheckSummary> {
  checkPermission(requesterRole, 'publishing:create');
  const check = await repo.createReadinessCheck(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'readiness_check_created', object_type: 'publishing_readiness_check', object_id: check.id, result: 'success' },
    `Readiness check created: ${check.checkType} (${check.checkStatus})`,
  );

  return check;
}

export async function listReadinessChecks(requesterRole: string, packageId: string): Promise<ReadinessCheckSummary[]> {
  checkPermission(requesterRole, 'publishing:read');
  return repo.listReadinessChecks(packageId);
}

export async function validateReadiness(
  requesterRole: string,
  packageId: string,
): Promise<{ ready: boolean; blockedReasons: string[]; score: number }> {
  checkPermission(requesterRole, 'publishing:validate');

  const result = await repo.validatePackageReadiness(packageId);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'readiness_validated', object_type: 'publishing_package', object_id: packageId, result: result.ready ? 'success' : 'blocked' },
    `Readiness validated: ${result.ready ? 'ready' : 'blocked'} (score: ${result.score})`,
  );

  return result;
}

// ============================================================
// Manifest Service
// ============================================================

export async function generateManifest(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: GenerateManifestInput,
): Promise<PublishingManifestSummary> {
  checkPermission(requesterRole, 'publishing:manifest');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.generatedByUserId, input.generatedByAgentRepId);

  // Manifest is preview/preparation only — must not trigger publishing
  const manifest = await repo.generateManifest(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'manifest_generated', object_type: 'publishing_manifest', object_id: manifest.id, result: 'success' },
    `Manifest generated: v${manifest.manifestVersion} (hash: ${manifest.packageHash?.substring(0, 8)}...)`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'generate_manifest',
    'publishing_manifest',
    manifest.id,
    'success',
    { manifestVersion: manifest.manifestVersion, packageHash: manifest.packageHash },
  );

  return manifest;
}

export async function getManifest(requesterRole: string, packageId: string): Promise<PublishingManifestSummary | null> {
  checkPermission(requesterRole, 'publishing:read');
  return repo.getManifest(packageId);
}
