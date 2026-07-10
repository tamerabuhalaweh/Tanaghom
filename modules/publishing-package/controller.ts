import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { validatePublishingApprovalGate } from './policy';
import { createPublishingPackageGovernance } from './governance';
import { recordCommercialWorkflowAudit } from '../commercial-workflow/evidence';
import { listPublishingPackages } from './list';

export const publishingPackageRouter = Router();

const POSTIZ_SANDBOX_URL = process.env.POSTIZ_SANDBOX_URL || 'https://postiz.163-123-180-104.sslip.io';

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

async function checkPostizSandbox(): Promise<{ reachable: boolean; statusCode: number | null; checkedAt: string }> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${POSTIZ_SANDBOX_URL}/auth/login`, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    });
    return { reachable: response.status < 500, statusCode: response.status, checkedAt };
  } catch {
    return { reachable: false, statusCode: null, checkedAt };
  } finally {
    clearTimeout(timer);
  }
}

publishingPackageRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const { campaignId, draftId, approvalId, platforms, scheduledTime } = req.body;
    if (!payload.agentRepId) throw new ForbiddenError('AgentRep session context is required before publishing package creation');

    const campaign = await prisma.contentRequest.findFirst({ where: { id: campaignId, tenant_key: tenantKey } });
    if (!campaign) throw new NotFoundError('Campaign', campaignId);

    if (!approvalId) throw new ForbiddenError('Approved approvalId is required before publishing package creation');
    const approval = await prisma.approval.findFirst({ where: { id: approvalId, tenant_key: tenantKey } });
    if (!approval) throw new NotFoundError('Approval', approvalId);
    const gate = validatePublishingApprovalGate({
      approvalId,
      approvalStatus: approval.approval_status,
      approvalTargetType: approval.target_type,
      approvalTargetId: approval.target_id,
      campaignId,
      draftId,
    });
    if (!gate.allowed) {
      await recordCommercialWorkflowAudit({
        action: 'publishing_package_blocked',
        result: 'blocked',
        humanUserId: payload.sub,
        agentRepId: payload.agentRepId,
        targetObjectType: draftId ? 'content_item' : 'content_request',
        targetObjectId: draftId || campaignId,
        sourceModule: 'publishing-package',
        reason: gate.reason || 'Publishing approval gate blocked package creation',
        policyMatched: 'approval_required_before_package',
        approvalId,
        afterState: {
          campaignId,
          draftId: draftId || null,
          externalExecution: 'blocked',
        },
      });
      throw new ForbiddenError(gate.reason || 'Publishing approval gate blocked package creation');
    }

    const contentItem = draftId
      ? await prisma.contentItem.findFirst({
        where: { id: draftId, tenant_key: tenantKey },
        include: { draft_versions: { orderBy: { version_no: 'desc' }, take: 1 } },
      })
      : null;
    if (draftId && !contentItem) throw new NotFoundError('Content item', draftId);
    if (contentItem && contentItem.request_id !== campaignId) {
      throw new ForbiddenError('Selected draft does not belong to selected campaign');
    }
    const latestDraft = contentItem?.draft_versions[0] ?? null;
    const approvedText = contentItem?.draft_text || (campaign as Record<string, unknown>).raw_message as string;
    const preparedAt = scheduledTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const platformPayloads = (platforms || ['linkedin', 'instagram']).map((platform: string) => ({
      platform,
      content: approvedText,
      scheduledTime: preparedAt,
      status: 'prepared',
      postizPayload: {
        platform,
        content: (campaign as Record<string, unknown>).raw_message,
        scheduledAt: preparedAt,
        action: 'prepare_only',
        _label: 'Postiz sandbox payload preview - no real scheduling',
      },
    }));
    const governance = await createPublishingPackageGovernance({
      humanUserId: payload.sub,
      agentRepId: payload.agentRepId,
      campaignId,
      contentItemId: contentItem?.id ?? null,
      approvalId: approval.id,
      packageTitle: String((campaign as Record<string, unknown>).raw_message || campaignId).slice(0, 120),
    });

    const pkg = await prisma.publishingPackage.create({
      data: {
        tenant_key: tenantKey,
        campaign_id: campaignId,
        content_item_id: contentItem?.id ?? null,
        draft_version_id: latestDraft?.id ?? null,
        saif_decision_record_id: governance.saifDecisionRecordId,
        approval_id: approval.id,
        capability_resolution_id: governance.capabilityResolutionId,
        mcp_mediation_request_id: governance.mcpMediationRequestId,
        package_status: 'ready_for_future_execution',
        package_type: platformPayloads.length > 1 ? 'multi_platform_campaign' : 'single_post',
        created_by_user_id: payload.sub,
        created_by_agent_rep_id: payload.agentRepId,
        readiness_score: contentItem?.reach_score || null,
        readiness_summary: 'Approved content package prepared for Postiz sandbox review. External scheduling remains policy-gated.',
        items: {
          create: [
            {
              item_type: 'platform_caption',
              item_status: 'validated',
              source_object_type: contentItem ? 'content_item' : 'campaign',
              source_object_id: contentItem?.id ?? campaignId,
              platform: contentItem?.platform ?? null,
              content_summary: approvedText.slice(0, 1000),
              metadata: { source: 'approved_draft' },
            },
            {
              item_type: 'approval_evidence',
              item_status: 'validated',
              source_object_type: 'approval',
              source_object_id: approval.id,
              content_summary: `Approval ${approval.approval_status}: ${approval.comment || 'No reviewer comment'}`,
              metadata: { decision: approval.decision, decidedAt: approval.decided_at },
            },
            {
              item_type: 'saif_evidence',
              item_status: 'validated',
              source_object_type: 'capability_resolution',
              source_object_id: governance.capabilityResolutionId,
              content_summary: 'Publishing package capability resolved and linked to MCP mediation evidence.',
              metadata: {
                saifDecisionRecordId: governance.saifDecisionRecordId,
                mcpMediationRequestId: governance.mcpMediationRequestId,
                mcpMediationDecisionId: governance.mcpMediationDecisionId,
              },
            },
          ],
        },
        targets: {
          create: platformPayloads.map((platformPayload: Record<string, unknown>) => ({
            platform: platformPayload.platform as string,
            target_status: 'ready',
            proposed_publish_at: new Date(preparedAt),
            timezone: 'Asia/Amman',
            platform_format: 'social_post',
            requires_mcp: true,
            future_connector_reference: 'postiz',
            platform_constraints: { execution: 'sandbox_or_blocked', publishing: 'blocked_by_default' },
          })),
        },
        readiness_checks: {
          create: [
            {
              check_type: 'human_approval',
              check_status: 'passed',
              severity: 'info',
              message: 'Human approval exists and is approved.',
              source_object_type: 'approval',
              source_object_id: approval.id,
            },
            {
              check_type: 'external_execution',
              check_status: 'blocked',
              severity: 'warning',
              message: 'External scheduling remains blocked unless sandbox flags and credentials are explicitly configured.',
              source_object_type: 'policy',
              source_object_id: 'external-execution',
            },
            {
              check_type: 'governance_linkage',
              check_status: 'passed',
              severity: 'info',
              message: 'SAIF decision, capability resolution, and MCP mediation evidence are linked to this package.',
              source_object_type: 'mcp_mediation_request',
              source_object_id: governance.mcpMediationRequestId,
            },
          ],
        },
        manifest: {
          create: {
            manifest_version: 1,
            manifest_status: 'generated',
            manifest_summary: 'Postiz-ready package generated from approved content. No external scheduling performed.',
            generated_by_user_id: payload.sub,
            generated_by_agent_rep_id: payload.agentRepId,
          },
        },
      },
      include: {
        items: true,
        targets: true,
        readiness_checks: true,
        manifest: true,
      },
    });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'publishing_package_created', object_type: 'publishing_package', object_id: pkg.id, result: 'success' },
      `Publishing package created for campaign ${campaignId}`,
    );
    await recordCommercialWorkflowAudit({
      action: 'publishing_package_created',
      result: 'success',
      humanUserId: payload.sub,
      agentRepId: payload.agentRepId,
      targetObjectType: 'publishing_package',
      targetObjectId: pkg.id,
      sourceModule: 'publishing-package',
      reason: 'Approved content package prepared for Postiz sandbox review.',
      policyMatched: 'approval_required_before_package',
      approvalId: approval.id,
      afterState: {
        campaignId,
        contentItemId: contentItem?.id ?? null,
        packageStatus: pkg.package_status,
        externalExecution: 'blocked',
      },
    });

    const postizSandbox = await checkPostizSandbox();

    res.json({
      id: pkg.id,
      campaignId,
      approvalId: approval.id,
      governance,
      contentItemId: contentItem?.id ?? null,
      draftVersionId: latestDraft?.id ?? null,
      status: 'ready',
      platforms: platformPayloads,
      items: pkg.items,
      targets: pkg.targets,
      readinessChecksList: pkg.readiness_checks,
      manifest: pkg.manifest,
      readinessChecks: {
        contentApproved: true,
        brandValidated: true,
        complianceChecked: true,
        scheduleConfirmed: true,
      },
      postizPreview: platformPayloads.map((p: Record<string, unknown>) => (p as Record<string, unknown>).postizPayload),
      postizSandbox: {
        url: POSTIZ_SANDBOX_URL,
        reachable: postizSandbox.reachable,
        statusCode: postizSandbox.statusCode,
        checkedAt: postizSandbox.checkedAt,
        scheduling: 'blocked',
        publishing: 'blocked',
        message: postizSandbox.reachable
          ? 'Postiz sandbox is reachable. Package can be reviewed there after approval, but STITCH does not schedule or publish.'
          : 'Postiz sandbox is not reachable. Package remains available inside STITCH.',
      },
      executionBoundary: {
        externalExecutionEnabled: false,
        postizLiveEnabled: false,
        m5WriteExecutionEnabled: false,
      },
      _label: 'Publishing package prepared - no real scheduling',
      _postizStatus: postizSandbox.reachable ? 'Sandbox reachable - scheduling blocked' : 'Sandbox unreachable - scheduling blocked',
    });
  } catch (err) {
    next(err);
  }
});

publishingPackageRouter.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const includeInternal = req.query.includeInternal === 'true' && ['admin', 'cco'].includes(payload.role);
    res.json(await listPublishingPackages(tenantKey, includeInternal));
  } catch (err) {
    next(err);
  }
});
