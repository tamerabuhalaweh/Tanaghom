import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateProductionRequestInput, CreateCreativeBriefInput, CreateAssetRequirementInput,
  CreateRenderingPackageInput, CreateRenderingTargetInput, CreateReviewChecklistInput,
  ProductionRequestSummary, CreativeBriefSummary, ProductionAssetRequirementSummary,
  RenderingPreparationPackageSummary, RenderingTargetSummary, ProductionReviewChecklistSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['production:create', 'production:read', 'production:update', 'production:render'],
  cco: ['production:create', 'production:read', 'production:update', 'production:render'],
  department_head: ['production:create', 'production:read', 'production:update'],
  specialist: ['production:create', 'production:read'],
  reviewer: ['production:read'],
  viewer: ['production:read'],
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
// ProductionRequest Service
// ============================================================

export async function createProductionRequest(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateProductionRequestInput,
): Promise<ProductionRequestSummary> {
  checkPermission(requesterRole, 'production:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.requestedByUserId, input.requestedByAgentRepId);

  const request = await repo.createProductionRequest(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'production_request_created', object_type: 'production_request', object_id: request.id, result: 'success' },
    `Production request created: ${request.requestType}`,
  );

  createIdentityLineage(
    sessionUserId,
    sessionAgentRepId,
    'human',
    null,
    'create_production_request',
    'production_request',
    request.id,
    'success',
    { requestType: request.requestType, campaignId: request.campaignId },
  );

  return request;
}

export async function getProductionRequest(requesterRole: string, id: string): Promise<ProductionRequestSummary> {
  checkPermission(requesterRole, 'production:read');
  return repo.getProductionRequestById(id);
}

export async function listProductionRequests(requesterRole: string, filters?: {
  requestStatus?: string;
  requestType?: string;
  campaignId?: string;
  requestedByUserId?: string;
}): Promise<ProductionRequestSummary[]> {
  checkPermission(requesterRole, 'production:read');
  return repo.listProductionRequests(filters);
}

// ============================================================
// CreativeBrief Service
// ============================================================

export async function createCreativeBrief(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateCreativeBriefInput,
): Promise<CreativeBriefSummary> {
  checkPermission(requesterRole, 'production:create');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  // Brief is preparation only — cannot approve, render, publish, or upload
  const brief = await repo.createCreativeBrief(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'creative_brief_created', object_type: 'creative_brief', object_id: brief.id, result: 'success' },
    `Creative brief created: ${brief.title}`,
  );

  return brief;
}

export async function getCreativeBrief(requesterRole: string, id: string): Promise<CreativeBriefSummary> {
  checkPermission(requesterRole, 'production:read');
  return repo.getCreativeBriefById(id);
}

// ============================================================
// Asset Requirement Service
// ============================================================

export async function createAssetRequirement(
  requesterRole: string,
  input: CreateAssetRequirementInput,
): Promise<ProductionAssetRequirementSummary> {
  checkPermission(requesterRole, 'production:create');
  const requirement = await repo.createAssetRequirement(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'asset_requirement_created', object_type: 'production_asset_requirement', object_id: requirement.id, result: 'success' },
    `Asset requirement created: ${requirement.requirementType}`,
  );

  return requirement;
}

export async function listAssetRequirements(requesterRole: string, productionRequestId: string): Promise<ProductionAssetRequirementSummary[]> {
  checkPermission(requesterRole, 'production:read');
  return repo.listAssetRequirements(productionRequestId);
}

// ============================================================
// RenderingPreparationPackage Service
// ============================================================

export async function createRenderingPackage(
  requesterRole: string,
  sessionUserId: string,
  sessionAgentRepId: string,
  input: CreateRenderingPackageInput,
): Promise<RenderingPreparationPackageSummary> {
  checkPermission(requesterRole, 'production:render');
  validateSessionContextLock(sessionUserId, sessionAgentRepId, input.createdByUserId, input.createdByAgentRepId);

  // MCP mediation required
  if (!input.mcpMediationRequestId) {
    throw new ForbiddenError('Direct rendering access is blocked. MCP mediation is required.');
  }

  // M5 rendering blocked by default
  // This package is preparation only — not rendered output

  const pkg = await repo.createRenderingPackage(input);

  auditLog(
    { actor: `user:${sessionUserId}`, action: 'rendering_package_created', object_type: 'rendering_preparation_package', object_id: pkg.id, result: 'success' },
    `Rendering preparation package created: ${pkg.id}`,
  );

  return pkg;
}

export async function getRenderingPackage(requesterRole: string, id: string): Promise<RenderingPreparationPackageSummary> {
  checkPermission(requesterRole, 'production:read');
  return repo.getRenderingPackageById(id);
}

export async function listRenderingPackages(requesterRole: string, productionRequestId?: string): Promise<RenderingPreparationPackageSummary[]> {
  checkPermission(requesterRole, 'production:read');
  return repo.listRenderingPackages(productionRequestId);
}

export async function validateRenderingReadiness(
  requesterRole: string,
  packageId: string,
): Promise<{ ready: boolean; blockedReasons: string[]; score: number }> {
  checkPermission(requesterRole, 'production:read');
  return repo.validateRenderingReadiness(packageId);
}

// ============================================================
// RenderingTarget Service
// ============================================================

export async function createRenderingTarget(
  requesterRole: string,
  input: CreateRenderingTargetInput,
): Promise<RenderingTargetSummary> {
  checkPermission(requesterRole, 'production:create');
  const target = await repo.createRenderingTarget(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'rendering_target_created', object_type: 'rendering_target', object_id: target.id, result: 'success' },
    `Rendering target created: ${target.targetType} for ${target.platform}`,
  );

  return target;
}

export async function listRenderingTargets(requesterRole: string, renderingPackageId: string): Promise<RenderingTargetSummary[]> {
  checkPermission(requesterRole, 'production:read');
  return repo.listRenderingTargets(renderingPackageId);
}

// ============================================================
// Review Checklist Service
// ============================================================

export async function createReviewChecklist(
  requesterRole: string,
  input: CreateReviewChecklistInput,
): Promise<ProductionReviewChecklistSummary> {
  checkPermission(requesterRole, 'production:create');
  const checklist = await repo.createReviewChecklist(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'review_checklist_created', object_type: 'production_review_checklist', object_id: checklist.id, result: 'success' },
    `Review checklist created: ${checklist.checkType}`,
  );

  return checklist;
}

export async function listReviewChecklists(requesterRole: string, productionRequestId: string): Promise<ProductionReviewChecklistSummary[]> {
  checkPermission(requesterRole, 'production:read');
  return repo.listReviewChecklists(productionRequestId);
}
