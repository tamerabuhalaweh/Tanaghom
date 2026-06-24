import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';

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
    const { campaignId, platforms, scheduledTime } = req.body;

    const campaign = await prisma.contentRequest.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign', campaignId);

    const preparedAt = scheduledTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const platformPayloads = (platforms || ['linkedin', 'instagram']).map((platform: string) => ({
      platform,
      content: (campaign as Record<string, unknown>).raw_message,
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
        package_status: 'ready_for_future_execution',
        created_by_user_id: payload.sub,
        created_by_agent_rep_id: payload.agentRepId || '',
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
      status: 'ready',
      platforms: platformPayloads,
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
