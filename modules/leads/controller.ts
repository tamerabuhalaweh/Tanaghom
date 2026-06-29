import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import type { LeadStatus } from '@prisma/client';

export const leadsRouter = Router();

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

function summarizeLead(lead: Record<string, unknown>) {
  return {
    id: lead.id,
    sourcePlatform: lead.platform,
    campaignId: lead.campaign_id,
    leadStatus: lead.lead_status,
    qualificationScore: deriveQualificationScore(lead),
    consentStatus: lead.consent_status,
    leadName: lead.lead_name_placeholder,
    leadEmail: lead.lead_email_placeholder,
    leadPhone: lead.lead_phone_placeholder,
    createdAt: lead.created_at,
  };
}

leadsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const leads = await prisma.leadCaptureRecord.findMany({
      where: { tenant_key: tenantKey },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    res.json(leads.map((lead: Record<string, unknown>) => summarizeLead(lead)));
  } catch (err) {
    next(err);
  }
});

leadsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const { sourcePlatform, campaignId, consentStatus, leadName, leadPhone, leadEmail } = req.body;

    if (campaignId) {
      const campaign = await prisma.contentRequest.findFirst({ where: { id: campaignId, tenant_key: tenantKey }, select: { id: true } });
      if (!campaign) throw new NotFoundError('Campaign', campaignId);
    }

    const lead = await prisma.leadCaptureRecord.create({
      data: {
        tenant_key: tenantKey,
        lead_source: sourcePlatform || 'manual',
        platform: sourcePlatform || 'manual',
        campaign_id: campaignId || null,
        created_by_user_id: payload.sub,
        created_by_agent_rep_id: payload.agentRepId || '',
        lead_status: 'new_lead',
        consent_status: consentStatus || 'pending',
        lead_name_placeholder: leadName || null,
        lead_phone_placeholder: leadPhone || null,
        lead_email_placeholder: leadEmail || null,
      },
    });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'lead_created', object_type: 'lead', object_id: lead.id, result: 'success' },
      `Lead created from ${sourcePlatform || 'manual'}`,
    );

    res.status(201).json({
      ...summarizeLead(lead as unknown as Record<string, unknown>),
      _label: 'Lead captured - no external CRM write',
    });
  } catch (err) {
    next(err);
  }
});

leadsRouter.post('/:id/qualify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';
    const id = req.params.id as string;

    const lead = await prisma.leadCaptureRecord.findFirst({ where: { id, tenant_key: tenantKey } }) as Record<string, unknown> | null;
    if (!lead) throw new NotFoundError('Lead', id);

    const score = deriveQualificationScore(lead);
    const status = score >= 80 ? 'qualified' : score >= 60 ? 'nurturing' : 'lost';

    await prisma.leadCaptureRecord.update({
      where: { id },
      data: { lead_status: status },
    });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'lead_qualified', object_type: 'lead', object_id: id, result: 'success' },
      `Lead qualified with score ${score}`,
    );

    res.json({
      id,
      qualificationScore: score,
      leadStatus: status,
      _label: 'Lead qualified - deterministic rules',
    });
  } catch (err) {
    next(err);
  }
});

leadsRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = payload.tenantKey || 'default';

    const total = await prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey } });
    const qualified = await prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey, lead_status: 'qualified' as LeadStatus } });
    const nurturing = await prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey, lead_status: 'nurturing' as LeadStatus } });
    const newLeads = await prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey, lead_status: 'new_lead' as LeadStatus } });

    res.json({
      total,
      qualified,
      nurturing,
      newLeads,
      _label: 'Lead statistics from backend',
    });
  } catch (err) {
    next(err);
  }
});
