import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { evaluateExternalExecution } from '@shared/policy';

export const ghlRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function deriveQualificationScore(lead: Record<string, unknown>): number {
  let score = 50;
  if (lead.lead_email_placeholder) score += 15;
  if (lead.lead_phone_placeholder) score += 15;
  if (lead.consent_status === 'granted') score += 15;
  if (lead.platform && lead.platform !== 'manual') score += 5;
  return Math.min(score, 100);
}

ghlRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);

    const hasApiKey = Boolean(process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY);
    const hasLocationId = Boolean(process.env.GHL_LOCATION_ID);
    const sandboxEnabled = process.env.GHL_SANDBOX_ENABLED === 'true';

    res.json({
      configured: hasApiKey && hasLocationId,
      apiKeyStatus: hasApiKey ? 'configured' : 'missing',
      locationIdStatus: hasLocationId ? 'configured' : 'missing',
      sandboxEnabled,
      liveEnabled: false,
      pushEnabled: false,
      executionPolicy: evaluateExternalExecution({ system: 'gohighlevel', action: 'write', executionMode: 'sandbox' }),
      _label: !hasApiKey ? 'Requires Credentials' : sandboxEnabled ? 'Sandbox Ready' : 'Requires Authorization',
    });
  } catch (err) {
    next(err);
  }
});

ghlRouter.post('/handoff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { leadId } = req.body;

    const lead = await prisma.leadCaptureRecord.findUnique({ where: { id: leadId } }) as Record<string, unknown> | null;
    if (!lead) throw new NotFoundError('Lead', leadId);

    const handoffPackage = {
      leadId: lead.id,
      source: lead.lead_source,
      platform: lead.platform,
      status: lead.lead_status,
      score: deriveQualificationScore(lead),
      consentStatus: lead.consent_status,
      contact: {
        name: lead.lead_name_placeholder,
        phone: lead.lead_phone_placeholder,
        email: lead.lead_email_placeholder,
      },
      campaignId: lead.campaign_id,
    };

    const policy = evaluateExternalExecution({ system: 'gohighlevel', action: 'write', executionMode: 'sandbox' });
    auditLog(
      { actor: `user:${payload.sub}`, action: 'ghl_handoff_prepared', object_type: 'lead', object_id: leadId, result: 'success' },
      'GHL handoff package prepared',
    );

    res.json({
      status: 'prepared',
      package: handoffPackage,
      executionPolicy: policy,
      _label: 'GoHighLevel handoff package prepared - no external CRM write',
    });
  } catch (err) {
    next(err);
  }
});

ghlRouter.post('/push', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const policy = evaluateExternalExecution({ system: 'gohighlevel', action: 'write', executionMode: 'sandbox' });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'ghl_push_blocked', object_type: 'system', object_id: 'ghl', result: 'denied' },
      `GHL push blocked: ${policy.reasons.join('; ')}`,
    );

    res.status(403).json({
      status: 'blocked',
      reason: policy.reasons.join('; '),
      executionPolicy: policy,
      _label: 'Blocked',
    });
  } catch (err) {
    next(err);
  }
});
