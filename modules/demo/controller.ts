import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';

export const demoRouter = Router();

const POSTIZ_SANDBOX_URL = process.env.POSTIZ_SANDBOX_URL || 'https://postiz.163-123-180-104.sslip.io';
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/health';
const POSTIZ_SANDBOX_SCHEDULING_ENABLED = process.env.POSTIZ_SANDBOX_SCHEDULING_ENABLED === 'true';
const GHL_SANDBOX_ENABLED = process.env.GHL_SANDBOX_ENABLED === 'true';
const VOICE_CHAT_SANDBOX_ENABLED = process.env.VOICE_CHAT_SANDBOX_ENABLED === 'true';

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
      status: postiz.reachable ? 'Sandbox Ready' : 'Requires Credentials',
      url: POSTIZ_SANDBOX_URL,
      reachable: postiz.reachable,
      statusCode: postiz.statusCode,
      checkedAt: postiz.checkedAt,
      mode: 'sandbox',
      scheduling: POSTIZ_SANDBOX_SCHEDULING_ENABLED ? 'Requires Authorization' : 'Blocked',
      publishing: 'Blocked',
      credentialStatus: postiz.reachable ? 'Sandbox reachable; social account credentials not enabled by default' : 'Requires Credentials',
      sandboxSchedulingEnabled: POSTIZ_SANDBOX_SCHEDULING_ENABLED,
      message: postiz.reachable
        ? 'Postiz sandbox is reachable. STITCH prepares packages; scheduling remains blocked unless sandbox execution is explicitly enabled.'
        : 'Postiz sandbox is not reachable from the STITCH backend.',
    },
    openClaw: {
      name: 'OpenClaw Gateway',
      status: openClaw.reachable ? 'Sandbox Ready' : 'Requires Credentials',
      url: 'loopback-only',
      reachable: openClaw.reachable,
      statusCode: openClaw.statusCode,
      checkedAt: openClaw.checkedAt,
      mode: 'local_gateway',
      channelExecution: 'Blocked',
      message: openClaw.reachable
        ? 'OpenClaw gateway is installed and health-checkable on loopback only.'
        : 'OpenClaw gateway is not reachable from the STITCH backend.',
    },
    goHighLevel: {
      name: 'GoHighLevel CRM',
      status: process.env.GHL_API_KEY ? 'Sandbox Ready' : 'Requires Credentials',
      reachable: !!process.env.GHL_API_KEY,
      mode: GHL_SANDBOX_ENABLED ? 'sandbox_ready' : 'handoff_package_only',
      writes: GHL_SANDBOX_ENABLED ? 'Requires Authorization' : 'Blocked',
      credentialStatus: process.env.GHL_API_KEY ? 'configured' : 'missing',
      sandboxEnabled: GHL_SANDBOX_ENABLED,
      message: 'GHL handoff is represented as a governed package. No real CRM write is enabled unless sandbox credentials and authorization flags are present.',
    },
    socialAnalytics: {
      name: 'Official Social Analytics APIs',
      status: 'Requires Credentials',
      reachable: false,
      mode: 'demo_data_only',
      reads: 'Requires Authorization',
      message: 'Current analytics are deterministic demo intelligence. Official read-only APIs require separate scope and credentials.',
    },
    voiceChat: {
      name: 'AI Voice/Chat Agent Handoff',
      status: process.env.VOICE_CHAT_API_URL ? 'Sandbox Ready' : 'Requires Credentials',
      reachable: !!process.env.VOICE_CHAT_API_URL,
      mode: VOICE_CHAT_SANDBOX_ENABLED ? 'api_ready' : 'handoff_package_only',
      triggers: VOICE_CHAT_SANDBOX_ENABLED ? 'Requires Authorization' : 'Blocked',
      credentialStatus: process.env.VOICE_CHAT_API_URL ? 'configured' : 'missing',
      sandboxEnabled: VOICE_CHAT_SANDBOX_ENABLED,
      message: 'Voice/chat handoff package is prepared by STITCH. No call or chat trigger is enabled unless explicitly authorized for a test lead.',
    },
  };
}

function buildHandoffPackage(input: Record<string, unknown>, payload: JwtPayload): Record<string, unknown> {
  const campaignId = String(input.campaignId || '');
  const campaignTopic = String(input.campaignTopic || 'Commercial/Social campaign');
  const platform = String(input.platform || 'linkedin');
  const publishingPackageId = String(input.publishingPackageId || '');
  const qualificationScore = Number(input.qualificationScore || 82);
  const consentStatus = String(input.consentStatus || 'pending');

  return {
    id: `handoff-${Date.now()}`,
    createdByUserId: payload.sub,
    createdByAgentRepId: payload.agentRepId || '',
    status: 'Prepared',
    executionState: 'Blocked',
    requiresAuthorization: true,
    campaignAttribution: {
      campaignId,
      campaignTopic,
      platform,
      publishingPackageId,
      source: `${platform}:commercial-social-poc`,
    },
    leadQualification: {
      leadReference: 'sandbox-lead-reference',
      qualificationScore,
      intent: qualificationScore >= 80 ? 'High intent product interest' : 'Nurture and qualify',
      consentStatus,
      recommendedNextStep: 'Human review before CRM or voice/chat execution',
    },
    goHighLevel: {
      status: process.env.GHL_API_KEY ? 'Sandbox Ready' : 'Requires Credentials',
      executionState: GHL_SANDBOX_ENABLED ? 'Requires Authorization' : 'Blocked',
      contactPayload: {
        firstName: 'Sandbox',
        lastName: 'Lead',
        source: platform,
        tags: ['tanaghum-poc', 'commercial-social', platform],
        customFields: {
          campaignId,
          campaignTopic,
          qualificationScore,
          approvalRequired: true,
        },
      },
      opportunityPayload: {
        pipeline: 'Commercial/Social POC',
        stage: 'Qualified Lead',
        monetaryValue: 0,
        status: 'open',
      },
      writeEnabled: false,
    },
    voiceChat: {
      status: process.env.VOICE_CHAT_API_URL ? 'Sandbox Ready' : 'Requires Credentials',
      executionState: VOICE_CHAT_SANDBOX_ENABLED ? 'Requires Authorization' : 'Blocked',
      apiUrlConfigured: !!process.env.VOICE_CHAT_API_URL,
      payload: {
        leadContext: 'Sandbox lead from approved Commercial/Social content',
        campaignSource: campaignTopic,
        qualificationScore,
        consentStatus,
        suggestedIntent: 'Introduce offer, confirm interest, route to human sales owner',
        suggestedScript: 'Hello, this is a test-approved Tanaghum follow-up about the SmartLab campaign. Is this a good time to continue?',
      },
      triggerEnabled: false,
    },
    safety: {
      crmWrite: 'Blocked',
      whatsappMessage: 'Blocked',
      voiceCall: 'Blocked',
      m5: 'M5 Disabled',
      note: 'This is a sandbox handoff package only. External execution requires credentials, human approval, sandbox flag, and audit.',
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

demoRouter.post('/handoff-package', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    res.status(201).json(buildHandoffPackage(req.body as Record<string, unknown>, payload));
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
