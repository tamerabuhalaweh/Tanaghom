import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';

export const publishingPackageRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

publishingPackageRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { campaignId, platforms, scheduledTime } = req.body;

    const campaign = await prisma.contentRequest.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError('Campaign', campaignId);

    const platformPayloads = (platforms || ['linkedin', 'instagram']).map((platform: string) => ({
      platform,
      content: (campaign as Record<string, unknown>).raw_message,
      scheduledTime: scheduledTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'prepared',
      postizPayload: {
        platform,
        content: (campaign as Record<string, unknown>).raw_message,
        scheduledAt: scheduledTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        _label: 'Mock Postiz payload — no real scheduling',
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
      _label: 'Publishing package prepared — no real scheduling',
      _postizStatus: 'Mock/sandbox — not connected',
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
