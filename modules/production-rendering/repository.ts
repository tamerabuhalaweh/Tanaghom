import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type {
  CreateProductionRequestInput, CreateCreativeBriefInput, CreateAssetRequirementInput,
  CreateRenderingPackageInput, CreateRenderingTargetInput, CreateReviewChecklistInput,
  ProductionRequestSummary, CreativeBriefSummary, ProductionAssetRequirementSummary,
  RenderingPreparationPackageSummary, RenderingTargetSummary, ProductionReviewChecklistSummary,
  ProductionRequestStatus,
} from './types';
import { validateRequestTransition } from './types';

// ============================================================
// ProductionRequest
// ============================================================

export async function createProductionRequest(input: CreateProductionRequestInput): Promise<ProductionRequestSummary> {
  const request = await prisma.productionRequest.create({
    data: {
      request_type: input.requestType,
      campaign_id: input.campaignId,
      content_item_id: input.contentItemId,
      publishing_package_id: input.publishingPackageId,
      asset_id: input.assetId,
      requested_by_user_id: input.requestedByUserId,
      requested_by_agent_rep_id: input.requestedByAgentRepId,
      assigned_department: input.assignedDepartment,
      priority: input.priority,
      due_date: input.dueDate ? new Date(input.dueDate) : null,
      rationale: input.rationale,
    },
  });
  return mapProductionRequest(request);
}

export async function getProductionRequestById(id: string): Promise<ProductionRequestSummary> {
  const request = await prisma.productionRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError('ProductionRequest', id);
  return mapProductionRequest(request);
}

export async function listProductionRequests(filters?: {
  requestStatus?: string;
  requestType?: string;
  campaignId?: string;
  requestedByUserId?: string;
}): Promise<ProductionRequestSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.requestStatus) where.request_status = filters.requestStatus;
  if (filters?.requestType) where.request_type = filters.requestType;
  if (filters?.campaignId) where.campaign_id = filters.campaignId;
  if (filters?.requestedByUserId) where.requested_by_user_id = filters.requestedByUserId;

  const requests = await prisma.productionRequest.findMany({ where, orderBy: { created_at: 'desc' } });
  return requests.map(mapProductionRequest);
}

export async function updateProductionRequestStatus(id: string, status: ProductionRequestStatus): Promise<ProductionRequestSummary> {
  const existing = await prisma.productionRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ProductionRequest', id);

  validateRequestTransition(existing.request_status as ProductionRequestStatus, status);

  const request = await prisma.productionRequest.update({
    where: { id },
    data: { request_status: status },
  });
  return mapProductionRequest(request);
}

// ============================================================
// CreativeBrief
// ============================================================

export async function createCreativeBrief(input: CreateCreativeBriefInput): Promise<CreativeBriefSummary> {
  const brief = await prisma.creativeBrief.create({
    data: {
      production_request_id: input.productionRequestId,
      title: input.title,
      objective: input.objective,
      audience: input.audience,
      key_message: input.keyMessage,
      tone: input.tone,
      platform: input.platform,
      format: input.format,
      dimensions_placeholder: input.dimensionsPlaceholder,
      brand_guidelines_reference: input.brandGuidelinesReference,
      asset_cognition_record_id: input.assetCognitionRecordId,
      saif_decision_record_id: input.saifDecisionRecordId,
      approval_id: input.approvalId,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapCreativeBrief(brief);
}

export async function getCreativeBriefById(id: string): Promise<CreativeBriefSummary> {
  const brief = await prisma.creativeBrief.findUnique({ where: { id } });
  if (!brief) throw new NotFoundError('CreativeBrief', id);
  return mapCreativeBrief(brief);
}

export async function getCreativeBriefByProductionRequest(productionRequestId: string): Promise<CreativeBriefSummary | null> {
  const brief = await prisma.creativeBrief.findUnique({ where: { production_request_id: productionRequestId } });
  return brief ? mapCreativeBrief(brief) : null;
}

// ============================================================
// ProductionAssetRequirement
// ============================================================

export async function createAssetRequirement(input: CreateAssetRequirementInput): Promise<ProductionAssetRequirementSummary> {
  const requirement = await prisma.productionAssetRequirement.create({
    data: {
      production_request_id: input.productionRequestId,
      requirement_type: input.requirementType,
      required_asset_type: input.requiredAssetType,
      description: input.description,
      platform: input.platform,
      linked_asset_id: input.linkedAssetId,
      external_reference_id: input.externalReferenceId,
    },
  });
  return mapProductionAssetRequirement(requirement);
}

export async function listAssetRequirements(productionRequestId: string): Promise<ProductionAssetRequirementSummary[]> {
  const requirements = await prisma.productionAssetRequirement.findMany({
    where: { production_request_id: productionRequestId },
    orderBy: { created_at: 'desc' },
  });
  return requirements.map(mapProductionAssetRequirement);
}

// ============================================================
// RenderingPreparationPackage
// ============================================================

export async function createRenderingPackage(input: CreateRenderingPackageInput): Promise<RenderingPreparationPackageSummary> {
  const pkg = await prisma.renderingPreparationPackage.create({
    data: {
      production_request_id: input.productionRequestId,
      creative_brief_id: input.creativeBriefId,
      capability_resolution_id: input.capabilityResolutionId,
      mcp_mediation_request_id: input.mcpMediationRequestId,
      approval_id: input.approvalId,
      spine_run_id: input.spineRunId,
      spine_artifact_id: input.spineArtifactId,
      asset_id: input.assetId,
      created_by_user_id: input.createdByUserId,
      created_by_agent_rep_id: input.createdByAgentRepId,
    },
  });
  return mapRenderingPreparationPackage(pkg);
}

export async function getRenderingPackageById(id: string): Promise<RenderingPreparationPackageSummary> {
  const pkg = await prisma.renderingPreparationPackage.findUnique({ where: { id } });
  if (!pkg) throw new NotFoundError('RenderingPreparationPackage', id);
  return mapRenderingPreparationPackage(pkg);
}

export async function listRenderingPackages(productionRequestId?: string): Promise<RenderingPreparationPackageSummary[]> {
  const where: Record<string, unknown> = {};
  if (productionRequestId) where.production_request_id = productionRequestId;

  const packages = await prisma.renderingPreparationPackage.findMany({ where, orderBy: { created_at: 'desc' } });
  return packages.map(mapRenderingPreparationPackage);
}

export async function validateRenderingReadiness(packageId: string): Promise<{ ready: boolean; blockedReasons: string[]; score: number }> {
  const pkg = await prisma.renderingPreparationPackage.findUnique({ where: { id: packageId } });
  if (!pkg) throw new NotFoundError('RenderingPreparationPackage', packageId);

  const blockedReasons: string[] = [];
  let score = 100;

  // Check MCP mediation
  if (!pkg.mcp_mediation_request_id) {
    blockedReasons.push('MCP mediation is required for rendering');
    score -= 25;
  }

  // Check creative brief exists
  if (!pkg.creative_brief_id) {
    blockedReasons.push('Creative brief is required');
    score -= 25;
  }

  // Check approval if needed
  if (!pkg.approval_id) {
    blockedReasons.push('Approval is required for rendering preparation');
    score -= 25;
  }

  const ready = blockedReasons.length === 0;

  // Update package status
  await prisma.renderingPreparationPackage.update({
    where: { id: packageId },
    data: {
      package_status: ready ? 'ready' : 'blocked',
      readiness_score: score,
      blocked_reasons: blockedReasons,
    },
  });

  return { ready, blockedReasons, score };
}

// ============================================================
// RenderingTarget
// ============================================================

export async function createRenderingTarget(input: CreateRenderingTargetInput): Promise<RenderingTargetSummary> {
  const target = await prisma.renderingTarget.create({
    data: {
      rendering_preparation_package_id: input.renderingPreparationPackageId,
      target_type: input.targetType,
      platform: input.platform,
      format: input.format,
      dimensions_placeholder: input.dimensionsPlaceholder,
      duration_placeholder: input.durationPlaceholder,
      output_asset_type: input.outputAssetType,
      requires_mcp: input.requiresMcp,
      future_connector_reference: input.futureConnectorReference,
    },
  });
  return mapRenderingTarget(target);
}

export async function listRenderingTargets(renderingPackageId: string): Promise<RenderingTargetSummary[]> {
  const targets = await prisma.renderingTarget.findMany({
    where: { rendering_preparation_package_id: renderingPackageId },
    orderBy: { created_at: 'desc' },
  });
  return targets.map(mapRenderingTarget);
}

// ============================================================
// ProductionReviewChecklist
// ============================================================

export async function createReviewChecklist(input: CreateReviewChecklistInput): Promise<ProductionReviewChecklistSummary> {
  const checklist = await prisma.productionReviewChecklist.create({
    data: {
      production_request_id: input.productionRequestId,
      check_type: input.checkType,
      severity: input.severity,
      message: input.message,
      source_object_type: input.sourceObjectType,
      source_object_id: input.sourceObjectId,
    },
  });
  return mapProductionReviewChecklist(checklist);
}

export async function listReviewChecklists(productionRequestId: string): Promise<ProductionReviewChecklistSummary[]> {
  const checklists = await prisma.productionReviewChecklist.findMany({
    where: { production_request_id: productionRequestId },
    orderBy: { created_at: 'desc' },
  });
  return checklists.map(mapProductionReviewChecklist);
}

// ============================================================
// Mappers
// ============================================================

function mapProductionRequest(r: Record<string, unknown>): ProductionRequestSummary {
  return {
    id: r.id as string,
    requestStatus: r.request_status as ProductionRequestSummary['requestStatus'],
    requestType: r.request_type as string,
    campaignId: r.campaign_id as string | null,
    contentItemId: r.content_item_id as string | null,
    publishingPackageId: r.publishing_package_id as string | null,
    assetId: r.asset_id as string | null,
    requestedByUserId: r.requested_by_user_id as string,
    requestedByAgentRepId: r.requested_by_agent_rep_id as string,
    assignedDepartment: r.assigned_department as string | null,
    priority: r.priority as string,
    dueDate: r.due_date as Date | null,
    rationale: r.rationale as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapCreativeBrief(b: Record<string, unknown>): CreativeBriefSummary {
  return {
    id: b.id as string,
    productionRequestId: b.production_request_id as string,
    briefStatus: b.brief_status as CreativeBriefSummary['briefStatus'],
    title: b.title as string,
    objective: b.objective as string | null,
    audience: b.audience as string | null,
    keyMessage: b.key_message as string | null,
    tone: b.tone as string | null,
    platform: b.platform as string | null,
    format: b.format as string | null,
    dimensionsPlaceholder: b.dimensions_placeholder as string | null,
    brandGuidelinesReference: b.brand_guidelines_reference as string | null,
    assetCognitionRecordId: b.asset_cognition_record_id as string | null,
    saifDecisionRecordId: b.saif_decision_record_id as string | null,
    approvalId: b.approval_id as string | null,
    createdByUserId: b.created_by_user_id as string,
    createdByAgentRepId: b.created_by_agent_rep_id as string,
    createdAt: b.created_at as Date,
    updatedAt: b.updated_at as Date,
  };
}

function mapProductionAssetRequirement(r: Record<string, unknown>): ProductionAssetRequirementSummary {
  return {
    id: r.id as string,
    productionRequestId: r.production_request_id as string,
    requirementType: r.requirement_type as string,
    requiredAssetType: r.required_asset_type as string | null,
    description: r.description as string | null,
    platform: r.platform as string | null,
    status: r.status as ProductionAssetRequirementSummary['status'],
    linkedAssetId: r.linked_asset_id as string | null,
    externalReferenceId: r.external_reference_id as string | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

function mapRenderingPreparationPackage(p: Record<string, unknown>): RenderingPreparationPackageSummary {
  return {
    id: p.id as string,
    productionRequestId: p.production_request_id as string,
    creativeBriefId: p.creative_brief_id as string | null,
    packageStatus: p.package_status as RenderingPreparationPackageSummary['packageStatus'],
    capabilityResolutionId: p.capability_resolution_id as string | null,
    mcpMediationRequestId: p.mcp_mediation_request_id as string | null,
    approvalId: p.approval_id as string | null,
    spineRunId: p.spine_run_id as string | null,
    spineArtifactId: p.spine_artifact_id as string | null,
    assetId: p.asset_id as string | null,
    readinessScore: p.readiness_score as number | null,
    blockedReasons: p.blocked_reasons as string[],
    packageHash: p.package_hash as string | null,
    createdByUserId: p.created_by_user_id as string,
    createdByAgentRepId: p.created_by_agent_rep_id as string,
    createdAt: p.created_at as Date,
    updatedAt: p.updated_at as Date,
  };
}

function mapRenderingTarget(t: Record<string, unknown>): RenderingTargetSummary {
  return {
    id: t.id as string,
    renderingPreparationPackageId: t.rendering_preparation_package_id as string,
    targetType: t.target_type as string,
    platform: t.platform as string | null,
    format: t.format as string | null,
    dimensionsPlaceholder: t.dimensions_placeholder as string | null,
    durationPlaceholder: t.duration_placeholder as string | null,
    outputAssetType: t.output_asset_type as string | null,
    targetStatus: t.target_status as RenderingTargetSummary['targetStatus'],
    requiresMcp: t.requires_mcp as boolean,
    futureConnectorReference: t.future_connector_reference as string | null,
    createdAt: t.created_at as Date,
    updatedAt: t.updated_at as Date,
  };
}

function mapProductionReviewChecklist(c: Record<string, unknown>): ProductionReviewChecklistSummary {
  return {
    id: c.id as string,
    productionRequestId: c.production_request_id as string,
    checkType: c.check_type as string,
    checkStatus: c.check_status as ProductionReviewChecklistSummary['checkStatus'],
    severity: c.severity as string,
    message: c.message as string | null,
    sourceObjectType: c.source_object_type as string | null,
    sourceObjectId: c.source_object_id as string | null,
    createdAt: c.created_at as Date,
  };
}
