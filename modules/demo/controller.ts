import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';

export const demoRouter = Router();

const POSTIZ_SANDBOX_URL = process.env.POSTIZ_SANDBOX_URL || 'https://postiz.163-123-180-104.sslip.io';
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/health';

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

async function checkHttpEndpoint(url: string, timeoutMs = 2500): Promise<{ reachable: boolean; statusCode: number | null; checkedAt: string }> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
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

async function getIntegrationStatus(): Promise<Record<string, unknown>> {
  const [postiz, openClaw] = await Promise.all([
    checkHttpEndpoint(`${POSTIZ_SANDBOX_URL}/auth/login`),
    checkHttpEndpoint(OPENCLAW_GATEWAY_URL),
  ]);

  return {
    postiz: {
      name: 'Postiz Scheduling Surface',
      status: postiz.reachable ? 'sandbox_ready' : 'unreachable',
      url: POSTIZ_SANDBOX_URL,
      reachable: postiz.reachable,
      statusCode: postiz.statusCode,
      checkedAt: postiz.checkedAt,
      mode: 'sandbox',
      scheduling: 'blocked',
      publishing: 'blocked',
      credentialStatus: 'sandbox account configured; social provider credentials missing',
      message: postiz.reachable
        ? 'Postiz sandbox is reachable. STITCH prepares packages; real scheduling remains blocked.'
        : 'Postiz sandbox is not reachable from the STITCH backend.',
    },
    openClaw: {
      name: 'OpenClaw Gateway',
      status: openClaw.reachable ? 'gateway_ready' : 'not_ready',
      url: 'loopback-only',
      reachable: openClaw.reachable,
      statusCode: openClaw.statusCode,
      checkedAt: openClaw.checkedAt,
      mode: 'local_gateway',
      channelExecution: 'blocked',
      message: openClaw.reachable
        ? 'OpenClaw gateway is installed and health-checkable on loopback only.'
        : 'OpenClaw gateway is not reachable from the STITCH backend.',
    },
    goHighLevel: {
      name: 'GoHighLevel CRM',
      status: 'planned',
      reachable: false,
      mode: 'readiness_only',
      writes: 'blocked',
      message: 'GHL handoff is represented as a governed package only. No real CRM writes are enabled.',
    },
    socialAnalytics: {
      name: 'Official Social Analytics APIs',
      status: 'planned',
      reachable: false,
      mode: 'demo_data_only',
      reads: 'blocked_until_scoped',
      message: 'Current analytics are deterministic demo intelligence. Official read-only APIs require separate scope and credentials.',
    },
    voiceChat: {
      name: 'AI Voice/Chat Agent Handoff',
      status: 'planned',
      reachable: false,
      mode: 'handoff_package_only',
      triggers: 'blocked',
      message: 'No voice/chat call or message trigger is enabled.',
    },
  };
}

async function optionalFindMany<T>(query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch {
    return [];
  }
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

    const auditRecords = await optionalFindMany(prisma.auditRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    }));

    const observabilityEvents = await optionalFindMany(prisma.observabilityEvent.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    }));

    const leadCaptures = await optionalFindMany(prisma.leadCaptureRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
    }));

    const productionRequests = await optionalFindMany(prisma.productionRequest.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
    }));

    const publishingPackages = await optionalFindMany(prisma.publishingPackage.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
    }));

    const integrations = await getIntegrationStatus();

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
      integrations,
      _label: 'Demo status - data from backend',
    });
  } catch (err) {
    next(err);
  }
});

demoRouter.get('/integrations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    res.json(await getIntegrationStatus());
  } catch (err) {
    next(err);
  }
});

demoRouter.get('/audit-trail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const records = await optionalFindMany(prisma.auditRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 20,
    }));
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
    const leads = await optionalFindMany(prisma.leadCaptureRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
    }));
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
