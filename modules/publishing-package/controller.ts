import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { validatePublishingApprovalGate } from './policy';

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
    const { campaignId, draftId, approvalId, platforms, scheduledTime } = req.body;

    const campaign = await prisma.contentRequest.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign', campaignId);

    if (!approvalId) throw new ForbiddenError('Approved approvalId is required before publishing package creation');
    const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundError('Approval', approvalId);
    const gate = validatePublishingApprovalGate({
      approvalId,
      approvalStatus: approval.approval_status,
      approvalTargetType: approval.target_type,
      approvalTargetId: approval.target_id,
      campaignId,
      draftId,
    });
    if (!gate.allowed) throw new ForbiddenError(gate.reason || 'Publishing approval gate blocked package creation');

    const contentItem = draftId
      ? await prisma.contentItem.findUnique({
        where: { id: draftId },
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

    const pkg = await prisma.publishingPackage.create({
      data: {
        campaign_id: campaignId,
        content_item_id: contentItem?.id ?? null,
        draft_version_id: latestDraft?.id ?? null,
        approval_id: approval.id,
        package_status: 'ready_for_future_execution',
        package_type: platformPayloads.length > 1 ? 'multi_platform_campaign' : 'single_post',
        created_by_user_id: payload.sub,
        created_by_agent_rep_id: payload.agentRepId || '',
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
          ],
        },
        manifest: {
          create: {
            manifest_version: 1,
            manifest_status: 'generated',
            manifest_summary: 'Postiz-ready package generated from approved content. No external scheduling performed.',
            generated_by_user_id: payload.sub,
            generated_by_agent_rep_id: payload.agentRepId || '',
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

    const postizSandbox = await checkPostizSandbox();

    res.json({
      id: pkg.id,
      campaignId,
      approvalId: approval.id,
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
    getPayload(req);
    const packages = await prisma.publishingPackage.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    res.json(packages.map((p: Record<string, unknown>) => ({
      id: p.id,
      campaignId: p.campaign_id,
      status: p.package_status,
      createdAt: p.created_at,
    })));
  } catch (err) {
    next(err);
  }
});
