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

leadsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const leads = await prisma.leadCaptureRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    res.json(leads.map((lead: Record<string, unknown>) => ({
      id: lead.id,
      sourcePlatform: lead.platform,
      campaignId: lead.campaign_id,
      leadStatus: lead.lead_status,
      qualificationScore: deriveQualificationScore(lead),
      consentStatus: lead.consent_status,
      createdAt: lead.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

leadsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const { sourcePlatform, campaignId, consentStatus, leadName, leadPhone, leadEmail } = req.body;

    const lead = await prisma.leadCaptureRecord.create({
      data: {
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
      id: lead.id,
      sourcePlatform: lead.platform,
      campaignId: lead.campaign_id,
      leadStatus: lead.lead_status,
      qualificationScore: deriveQualificationScore(lead as unknown as Record<string, unknown>),
      consentStatus: lead.consent_status,
      _label: 'Lead captured - no external CRM write',
    });
  } catch (err) {
    next(err);
  }
});

leadsRouter.post('/:id/qualify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const id = req.params.id as string;

    const lead = await prisma.leadCaptureRecord.findUnique({ where: { id } }) as Record<string, unknown> | null;
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
    getPayload(req);

    const total = await prisma.leadCaptureRecord.count();
    const qualified = await prisma.leadCaptureRecord.count({ where: { lead_status: 'qualified' as LeadStatus } });
    const nurturing = await prisma.leadCaptureRecord.count({ where: { lead_status: 'nurturing' as LeadStatus } });
    const newLeads = await prisma.leadCaptureRecord.count({ where: { lead_status: 'new_lead' as LeadStatus } });

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
