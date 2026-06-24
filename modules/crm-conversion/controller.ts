import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { evaluateExternalExecution } from '@shared/policy';
import {
  createLeadCaptureRecordSchema,
  createConversionIntentSchema,
  createCrmHandoffRequestSchema,
  createWhatsAppHandoffRequestSchema,
  createConversionSequencePlanSchema,
  type CreateLeadCaptureRecordInput,
  type CreateConversionIntentInput,
} from './types';
import * as service from './service';

export const crmConversionRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

crmConversionRouter.get('/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const leads = await service.listLeadCaptureRecords(session.role, {
      leadStatus: req.query.leadStatus as string | undefined,
      campaignId: req.query.campaignId as string | undefined,
      platform: req.query.platform as string | undefined,
      createdByUserId: req.query.mine === 'true' ? session.humanUserId : undefined,
    });
    res.json(leads);
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.post('/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createLeadCaptureRecordSchema, {
      ...req.body,
      consentStatus: req.body.consentStatus ?? 'pending',
      createdByUserId: session.humanUserId,
      createdByAgentRepId: session.agentRepId,
    }) as CreateLeadCaptureRecordInput;
    const lead = await service.createLeadCaptureRecord(session.role, session.humanUserId, session.agentRepId, input);
    res.status(201).json({
      ...lead,
      _label: 'Lead captured in STITCH - no CRM write performed',
    });
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.get('/leads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const lead = await service.getLeadCaptureRecord(session.role, req.params.id as string);
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.post('/leads/:id/intents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createConversionIntentSchema, {
      ...req.body,
      leadCaptureRecordId: req.params.id,
      confidence: req.body.confidence ?? 'low',
    }) as CreateConversionIntentInput;
    const intent = await service.createConversionIntent(session.role, input);
    res.status(201).json({
      ...intent,
      _label: 'Lead qualification recorded - advisory only',
    });
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.post('/leads/:id/crm-handoff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createCrmHandoffRequestSchema, {
      ...req.body,
      leadCaptureRecordId: req.params.id,
      requestedByUserId: session.humanUserId,
      requestedByAgentRepId: session.agentRepId,
    });
    const policy = evaluateExternalExecution({
      system: 'gohighlevel',
      action: 'write',
      executionMode: 'sandbox',
      approvalId: input.approvalId,
      capabilityResolutionId: input.capabilityResolutionId,
      mcpMediationRequestId: input.mcpMediationRequestId,
      humanApproved: Boolean(input.approvalId),
    });
    const handoff = await service.createCrmHandoffRequest(session.role, session.humanUserId, session.agentRepId, input);
    res.status(201).json({
      ...handoff,
      executionPolicy: policy,
      _label: 'GoHighLevel handoff package recorded - external CRM write remains policy-gated',
    });
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.post('/leads/:id/whatsapp-handoff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createWhatsAppHandoffRequestSchema, {
      ...req.body,
      leadCaptureRecordId: req.params.id,
      requestedByUserId: session.humanUserId,
      requestedByAgentRepId: session.agentRepId,
    });
    const policy = evaluateExternalExecution({
      system: 'whatsapp',
      action: 'send_message',
      executionMode: 'sandbox',
      approvalId: input.approvalId,
      capabilityResolutionId: input.capabilityResolutionId,
      mcpMediationRequestId: input.mcpMediationRequestId,
      humanApproved: Boolean(input.approvalId),
    });
    const handoff = await service.createWhatsAppHandoffRequest(session.role, session.humanUserId, session.agentRepId, input);
    res.status(201).json({
      ...handoff,
      executionPolicy: policy,
      _label: 'WhatsApp handoff package recorded - message sending remains policy-gated',
    });
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.post('/leads/:id/sequence-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(createConversionSequencePlanSchema, {
      ...req.body,
      leadCaptureRecordId: req.params.id,
      createdByUserId: session.humanUserId,
      createdByAgentRepId: session.agentRepId,
    });
    const plan = await service.createConversionSequencePlan(session.role, session.humanUserId, session.agentRepId, input);
    res.status(201).json({
      ...plan,
      _label: 'Follow-up sequence prepared - no CRM, WhatsApp, Telegram, or voice execution',
    });
  } catch (err) {
    next(err);
  }
});

crmConversionRouter.post('/leads/:id/handoff-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const schema = z.object({
      target: z.enum(['gohighlevel', 'whatsapp', 'telegram', 'voice_chat']).default('gohighlevel'),
      intentType: z.string().default('qualified_marketing_lead'),
      qualificationScore: z.number().int().min(0).max(100).default(72),
      consentStatus: z.string().default('unknown'),
    });
    const input = validateOrThrow(schema, req.body);
    const lead = await service.getLeadCaptureRecord(session.role, req.params.id as string);
    const policy = evaluateExternalExecution({
      system: input.target ?? 'gohighlevel',
      action: input.target === 'voice_chat' ? 'trigger_call' : input.target === 'gohighlevel' ? 'write' : 'send_message',
      executionMode: 'sandbox',
      humanApproved: false,
    });

    res.json({
      leadId: lead.id,
      target: input.target,
      payload: {
        leadName: lead.leadNamePlaceholder,
        leadEmail: lead.leadEmailPlaceholder,
        leadPhone: lead.leadPhonePlaceholder,
        campaignId: lead.campaignId,
        platform: lead.platform,
        consentStatus: input.consentStatus,
        qualificationScore: input.qualificationScore,
        intentType: input.intentType,
      },
      executionPolicy: policy,
      _label: 'Handoff payload preview - no external write',
    });
  } catch (err) {
    next(err);
  }
});
