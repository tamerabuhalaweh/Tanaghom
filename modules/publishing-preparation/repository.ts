import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreatePackageInput, CreatePackageItemInput, CreatePublishingTargetInput,
  CreateReadinessCheckInput, GenerateManifestInput,
  PublishingPackageSummary, PackageItemSummary, PublishingTargetSummary,
  ReadinessCheckSummary, PublishingManifestSummary,
  PackageStatus,
} from './types';
import { validatePackageTransition, CRITICAL_READINESS_CHECKS } from './types';
import { createHash } from 'crypto';

// ============================================================
// PublishingPackage
// ============================================================

export async function createPackage(input: CreatePackageInput): Promise<PublishingPackageSummary> {
  const pkg = await prisma.publishingPackage.create({
    data: {
      package_type: input.packageType,
      campaign_id: input.campaignId,
      content_item_id: input.contentItemId,
      draft_version_id: input.draftVersionId,
      saif_decision_record_id: input.saifDecisionRecordId,
      approval_id: input.approvalId,
      capability_resolution_id: input.capabilityResolutionId,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      spine_run_id: input.spineRunId,
      spine_artifact_id: input.spineArtifactId,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapPackage(pkg);
}

export async function getPackageById(id: string): Promise<PublishingPackageSummary> {
  const pkg = await prisma.publishingPackage.findUnique({ where: { id } });
  if (!pkg) throw new NotFoundError('PublishingPackage', id);
  return mapPackage(pkg);
}

export async function listPackages(filters?: {
  packageStatus?: string;
  campaignId?: string;
  contentItemId?: string;
  createdByUserId?: string;
}): Promise<PublishingPackageSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.packageStatus) where.package_status = filters.packageStatus;
  if (filters?.campaignId) where.campaign_id = filters.campaignId;
  if (filters?.contentItemId) where.content_item_id = filters.contentItemId;
  if (filters?.createdByUserId) where.created_by_user_id = filters.createdByUserId;

  const packages = await prisma.publishingPackage.findMany({ where, orderBy: { created_at: 'desc' } });
  return packages.map(mapPackage);
}

export async function updatePackageStatus(id: string, status: PackageStatus): Promise<PublishingPackageSummary> {
  const existing = await prisma.publishingPackage.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('PublishingPackage', id);

  validatePackageTransition(existing.package_status as PackageStatus, status);

  const pkg = await prisma.publishingPackage.update({
    where: { id },
    data: { package_status: status },
  });
  return mapPackage(pkg);
}

// ============================================================
// PublishingPackageItem
// ============================================================

export async function createPackageItem(input: CreatePackageItemInput): Promise<PackageItemSummary> {
  const item = await prisma.publishingPackageItem.create({
    data: {
      publishing_package_id: input.publishingPackageId,
      item_type: input.itemType,
      source_object_type: input.sourceObjectType,
      source_object_id: input.sourceObjectId,
      platform: input.platform,
      content_summary: input.contentSummary,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return mapPackageItem(item);
}

export async function listPackageItems(packageId: string): Promise<PackageItemSummary[]> {
  const items = await prisma.publishingPackageItem.findMany({
    where: { publishing_package_id: packageId },
    orderBy: { created_at: 'desc' },
  });
  return items.map(mapPackageItem);
}

// ============================================================
// PublishingTarget
// ============================================================

export async function createPublishingTarget(input: CreatePublishingTargetInput): Promise<PublishingTargetSummary> {
  const target = await prisma.publishingTarget.create({
    data: {
      publishing_package_id: input.publishingPackageId,
      platform: input.platform,
      account_reference: input.accountReference,
      proposed_publish_at: input.proposedPublishAt ? new Date(input.proposedPublishAt) : null,
      timezone: input.timezone,
      platform_format: input.platformFormat,
      platform_constraints: input.platformConstraints as Prisma.InputJsonValue | undefined,
      requires_mcp: input.requiresMcp,
      future_connector_reference: input.futureConnectorReference,
    },
  });
  return mapPublishingTarget(target);
}

export async function listPublishingTargets(packageId: string): Promise<PublishingTargetSummary[]> {
  const targets = await prisma.publishingTarget.findMany({
    where: { publishing_package_id: packageId },
    orderBy: { created_at: 'desc' },
  });
  return targets.map(mapPublishingTarget);
}

// ============================================================
// PublishingReadinessCheck
// ============================================================

export async function createReadinessCheck(input: CreateReadinessCheckInput): Promise<ReadinessCheckSummary> {
  const check = await prisma.publishingReadinessCheck.create({
    data: {
      publishing_package_id: input.publishingPackageId,
      check_type: input.checkType,
      severity: input.severity,
      message: input.message,
      source_object_type: input.sourceObjectType,
      source_object_id: input.sourceObjectId,
    },
  });
  return mapReadinessCheck(check);
}

export async function listReadinessChecks(packageId: string): Promise<ReadinessCheckSummary[]> {
  const checks = await prisma.publishingReadinessCheck.findMany({
    where: { publishing_package_id: packageId },
    orderBy: { created_at: 'desc' },
  });
  return checks.map(mapReadinessCheck);
}

export async function validatePackageReadiness(packageId: string): Promise<{ ready: boolean; blockedReasons: string[]; score: number }> {
  const checks = await prisma.publishingReadinessCheck.findMany({
    where: { publishing_package_id: packageId },
  });

  const blockedReasons: string[] = [];
  let passedChecks = 0;
  const totalChecks = checks.length;

  for (const check of checks) {
    if (check.check_status === 'failed' || check.check_status === 'blocked') {
      blockedReasons.push(`${check.check_type}: ${check.message || 'failed'}`);
    } else if (check.check_status === 'passed') {
      passedChecks++;
    }
  }

  // Check critical readiness checks
  for (const criticalCheck of CRITICAL_READINESS_CHECKS) {
    const found = checks.find(c => c.check_type === criticalCheck);
    if (!found || found.check_status !== 'passed') {
      if (!blockedReasons.some(b => b.startsWith(criticalCheck))) {
        blockedReasons.push(`${criticalCheck}: missing or not passed`);
      }
    }
  }

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
  const ready = blockedReasons.length === 0 && score >= 80;

  // Update package with readiness info
  await prisma.publishingPackage.update({
    where: { id: packageId },
    data: {
      readiness_score: score,
      readiness_summary: ready ? 'All checks passed' : `${blockedReasons.length} blocking issues`,
      blocked_reasons: blockedReasons,
      package_status: ready ? 'ready_for_future_execution' : 'blocked',
    },
  });

  return { ready, blockedReasons, score };
}

// ============================================================
// PublishingManifest
// ============================================================

export async function generateManifest(input: GenerateManifestInput): Promise<PublishingManifestSummary> {
  const pkg = await prisma.publishingPackage.findUnique({
    where: { id: input.publishingPackageId },
    include: { items: true, targets: true, readiness_checks: true },
  });
  if (!pkg) throw new NotFoundError('PublishingPackage', input.publishingPackageId);

  // Block manifest generation if package is not ready
  if (pkg.package_status !== 'ready_for_future_execution') {
    throw new ForbiddenError('Cannot generate manifest: package is not ready for future execution');
  }

  // Generate deterministic package hash
  const manifestData = {
    packageId: pkg.id,
    items: (pkg.items as Record<string, unknown>[]).map(i => ({ type: i.item_type, platform: i.platform })),
    targets: (pkg.targets as Record<string, unknown>[]).map(t => ({ platform: t.platform, format: t.platform_format })),
    checks: (pkg.readiness_checks as Record<string, unknown>[]).map(c => ({ type: c.check_type, status: c.check_status })),
  };
  const packageHash = createHash('sha256').update(JSON.stringify(manifestData)).digest('hex');

  // Check for existing manifest
  const existingManifest = await prisma.publishingManifest.findUnique({
    where: { publishing_package_id: pkg.id },
  });

  if (existingManifest) {
    // Update existing manifest
    const manifest = await prisma.publishingManifest.update({
      where: { id: existingManifest.id },
      data: {
        manifest_version: existingManifest.manifest_version + 1,
        manifest_status: 'generated',
        package_hash: packageHash,
        manifest_summary: `Package ${pkg.id}: ${pkg.items.length} items, ${pkg.targets.length} targets`,
        generated_at: new Date(),
        generated_by_user_id: input.generatedByUserId,
        generated_by_agent_rep_id: input.generatedByAgentRepId,
      },
    });
    return mapManifest(manifest);
  }

  const manifest = await prisma.publishingManifest.create({
    data: {
      publishing_package_id: pkg.id,
      manifest_status: 'generated',
      package_hash: packageHash,
      manifest_summary: `Package ${pkg.id}: ${pkg.items.length} items, ${pkg.targets.length} targets`,
      generated_by_user_id: input.generatedByUserId,
      generated_by_agent_rep_id: input.generatedByAgentRepId,
    },
  });
  return mapManifest(manifest);
}

export async function getManifest(packageId: string): Promise<PublishingManifestSummary | null> {
  const manifest = await prisma.publishingManifest.findUnique({
    where: { publishing_package_id: packageId },
  });
  return manifest ? mapManifest(manifest) : null;
}

// ============================================================
// Mappers
// ============================================================

function mapPackage(p: Record<string, unknown>): PublishingPackageSummary {
  return {
    id: p.id as string,
    packageStatus: p.package_status as PublishingPackageSummary['packageStatus'],
    packageType: p.package_type as PublishingPackageSummary['packageType'],
    campaignId: p.campaign_id as string | null,
    contentItemId: p.content_item_id as string | null,
    draftVersionId: p.draft_version_id as string | null,
    saifDecisionRecordId: p.saif_decision_record_id as string | null,
    approvalId: p.approval_id as string | null,
    capabilityResolutionId: p.capability_resolution_id as string | null,
    mcpMediationRequestId: p.mcp_mediation_request_id as string | null,
    spineRunId: p.spine_run_id as string | null,
    spineArtifactId: p.spine_artifact_id as string | null,
    createdByUserId: p.created_by_user_id as string,
    createdByAgentRepId: p.created_by_agent_rep_id as string,
    readinessScore: p.readiness_score as number | null,
    readinessSummary: p.readiness_summary as string | null,
    blockedReasons: p.blocked_reasons as string[],
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapPackageItem(i: Record<string, unknown>): PackageItemSummary {
  return {
    id: i.id as string,
    publishingPackageId: i.publishing_package_id as string,
    itemType: i.item_type as PackageItemSummary['itemType'],
    itemStatus: i.item_status as PackageItemSummary['itemStatus'],
    sourceObjectType: i.source_object_type as string | null,
    sourceObjectId: i.source_object_id as string | null,
    platform: i.platform as string | null,
    contentSummary: i.content_summary as string | null,
    metadata: i.metadata as Record<string, unknown> | null,
    createdAt: i.created_at as Date,
    updatedAt: i.updated_at as Date,
  };
}

function mapPublishingTarget(t: Record<string, unknown>): PublishingTargetSummary {
  return {
    id: t.id as string,
    publishingPackageId: t.publishing_package_id as string,
    platform: t.platform as string,
    accountReference: t.account_reference as string | null,
    targetStatus: t.target_status as PublishingTargetSummary['targetStatus'],
    proposedPublishAt: t.proposed_publish_at as Date | null,
    timezone: t.timezone as string | null,
    platformFormat: t.platform_format as string | null,
    platformConstraints: t.platform_constraints as Record<string, unknown> | null,
    requiresMcp: t.requires_mcp as boolean,
    futureConnectorReference: t.future_connector_reference as string | null,
    createdAt: t.created_at as Date,
    updatedAt: t.updated_at as Date,
  };
}

function mapReadinessCheck(c: Record<string, unknown>): ReadinessCheckSummary {
  return {
    id: c.id as string,
    publishingPackageId: c.publishing_package_id as string,
    checkType: c.check_type as string,
    checkStatus: c.check_status as ReadinessCheckSummary['checkStatus'],
    severity: c.severity as ReadinessCheckSummary['severity'],
    message: c.message as string | null,
    sourceObjectType: c.source_object_type as string | null,
    sourceObjectId: c.source_object_id as string | null,
    createdAt: c.created_at as Date,
  };
}

function mapManifest(m: Record<string, unknown>): PublishingManifestSummary {
  return {
    id: m.id as string,
    publishingPackageId: m.publishing_package_id as string,
    manifestVersion: m.manifest_version as number,
    manifestStatus: m.manifest_status as PublishingManifestSummary['manifestStatus'],
    packageHash: m.package_hash as string | null,
    manifestSummary: m.manifest_summary as string | null,
    generatedAt: m.generated_at as Date,
    generatedByUserId: m.generated_by_user_id as string,
    generatedByAgentRepId: m.generated_by_agent_rep_id as string,
    createdAt: m.created_at as Date,
    updatedAt: m.updated_at as Date,
  };
}
