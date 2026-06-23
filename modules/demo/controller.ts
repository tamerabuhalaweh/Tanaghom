import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';

export const demoRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

demoRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);

    const campaigns = await prisma.contentRequest.findMany({
      where: { requester_id: payload.sub },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const approvals = await prisma.approval.findMany({
      where: { requester_user_id: payload.sub },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const auditRecords = await prisma.auditRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const observabilityEvents = await prisma.observabilityEvent.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const leadCaptures = await prisma.leadCaptureRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const productionRequests = await prisma.productionRequest.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const publishingPackages = await prisma.publishingPackage.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    res.json({
      campaigns: campaigns.map((c: Record<string, unknown>) => ({
        id: c.id,
        topic: c.raw_message,
        status: c.status,
        riskCategory: c.risk_category,
        platforms: c.target_platforms,
        createdAt: c.created_at,
      })),
      approvals: approvals.map((a: Record<string, unknown>) => ({
        id: a.id,
        targetType: a.target_type,
        targetId: a.target_id,
        status: a.approval_status,
        riskCategory: a.risk_category,
        createdAt: a.created_at,
      })),
      auditTrail: auditRecords.map((a: Record<string, unknown>) => ({
        id: a.id,
        actor: a.human_user_id || a.agent_rep_id || 'system',
        action: a.action,
        objectType: a.audit_type,
        objectId: a.id,
        result: a.result,
        createdAt: a.created_at,
      })),
      observability: observabilityEvents.map((e: Record<string, unknown>) => ({
        id: e.id,
        eventType: e.event_type,
        severity: e.severity,
        message: e.description,
        createdAt: e.created_at,
      })),
      leadCaptures: leadCaptures.map((l: Record<string, unknown>) => ({
        id: l.id,
        source: l.source_platform,
        status: l.lead_status,
        createdAt: l.created_at,
      })),
      productionRequests: productionRequests.map((p: Record<string, unknown>) => ({
        id: p.id,
        type: p.request_type,
        status: p.request_status,
        createdAt: p.created_at,
      })),
      publishingPackages: publishingPackages.map((p: Record<string, unknown>) => ({
        id: p.id,
        status: p.package_status,
        createdAt: p.created_at,
      })),
      safety: {
        demoMode: process.env.DEMO_MODE === 'true' || !process.env.DEMO_MODE,
        m5Blocked: process.env.M5_WRITE_EXECUTION_ENABLED !== 'true',
        externalBlocked: process.env.EXTERNAL_EXECUTION_ENABLED !== 'true',
        postizBlocked: process.env.POSTIZ_LIVE_ENABLED !== 'true',
        crmBlocked: process.env.CRM_LIVE_ENABLED !== 'true',
        whatsappBlocked: process.env.WHATSAPP_LIVE_ENABLED !== 'true',
      },
      _label: 'Demo status — data from backend',
    });
  } catch (err) {
    next(err);
  }
});

demoRouter.get('/audit-trail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const records = await prisma.auditRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    res.json(records.map((r: Record<string, unknown>) => ({
      id: r.id,
      actor: r.human_user_id || r.agent_rep_id || 'system',
      action: r.action,
      objectType: r.audit_type,
      objectId: r.id,
      result: r.result,
      createdAt: r.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

demoRouter.get('/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const leads = await prisma.leadCaptureRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    res.json(leads.map((l: Record<string, unknown>) => ({
      id: l.id,
      source: l.source_platform,
      status: l.lead_status,
      qualificationScore: l.qualification_score,
      createdAt: l.created_at,
    })));
  } catch (err) {
    next(err);
  }
});
