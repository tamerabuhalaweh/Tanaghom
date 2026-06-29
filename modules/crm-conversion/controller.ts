import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { validateOrThrow } from '@shared/validation';
import { evaluateExternalExecution } from '@shared/policy';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
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
      tenantKey: session.tenantKey,
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
    const lead = await service.createLeadCaptureRecord(session.role, session.tenantKey, session.humanUserId, session.agentRepId, input);
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
    const lead = await service.getLeadCaptureRecord(session.role, session.tenantKey, req.params.id as string);
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
    const intent = await service.createConversionIntent(session.role, session.tenantKey, input);
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
    const handoff = await service.createCrmHandoffRequest(session.role, session.tenantKey, session.humanUserId, session.agentRepId, input);
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
    const handoff = await service.createWhatsAppHandoffRequest(session.role, session.tenantKey, session.humanUserId, session.agentRepId, input);
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
    const plan = await service.createConversionSequencePlan(session.role, session.tenantKey, session.humanUserId, session.agentRepId, input);
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
    const lead = await service.getLeadCaptureRecord(session.role, session.tenantKey, req.params.id as string);
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

crmConversionRouter.post('/leads/:id/sandbox-execution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    const input = validateOrThrow(z.object({
      target: z.enum(['whatsapp', 'telegram', 'voice_chat']),
      mode: z.enum(['preview', 'execute']).default('preview'),
      message: z.string().min(1).max(2000).optional(),
      approvalId: z.string().uuid().optional(),
      capabilityResolutionId: z.string().uuid().optional(),
      mcpMediationRequestId: z.string().uuid().optional(),
    }), req.body);
    const lead = await service.getLeadCaptureRecord(session.role, session.tenantKey, req.params.id as string);
    const payload = buildSandboxHandoffPayload(input.target, lead as unknown as Record<string, unknown>, input.message);
    const gate = await sandboxCommunicationGate(input.target, session.tenantKey);
    const policy = evaluateExternalExecution({
      system: input.target,
      action: input.target === 'voice_chat' ? 'trigger_call' : 'send_message',
      executionMode: 'sandbox',
      approvalId: input.approvalId,
      capabilityResolutionId: input.capabilityResolutionId,
      mcpMediationRequestId: input.mcpMediationRequestId,
      humanApproved: Boolean(input.approvalId),
    });

    if (input.mode === 'preview' || !gate.allowed || !policy.allowed) {
      res.status(input.mode === 'execute' ? 403 : 200).json({
        status: input.mode === 'execute' ? 'blocked' : 'prepared',
        target: input.target,
        payload,
        reasons: [...gate.reasons, ...policy.reasons],
        executionPolicy: policy,
        safety: {
          executionPerformed: false,
          productionExecution: false,
          sandboxOnly: true,
        },
        _label: input.mode === 'execute'
          ? 'Blocked - sandbox communication requires credentials, flags, approval, capability resolution, and MCP mediation'
          : 'Sandbox communication payload prepared - no external action performed',
      });
      return;
    }

    const result = await executeSandboxCommunication(input.target, payload, session.tenantKey);
    res.status(result.ok ? 200 : 502).json({
      status: result.ok ? 'sandbox_executed' : 'failed',
      target: input.target,
      responseStatus: result.status,
      response: result.body,
      payload,
      safety: {
        executionPerformed: true,
        productionExecution: false,
        sandboxOnly: true,
      },
      _label: result.ok ? 'Sandbox communication executed against configured test endpoint' : 'Sandbox communication API call failed',
    });
  } catch (err) {
    next(err);
  }
});

type CommunicationTarget = 'whatsapp' | 'telegram' | 'voice_chat';
type CommunicationConfig = {
  configured: boolean;
  accessToken?: string;
  phoneNumberId?: string;
  botToken?: string;
  chatId?: string;
  apiUrl?: string;
  apiKey?: string;
};

async function sandboxCommunicationGate(target: CommunicationTarget, tenantKey: string): Promise<{ allowed: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  if (process.env.DEMO_MODE === 'true') reasons.push('DEMO_MODE=true blocks sandbox communication execution');
  if (process.env.EXTERNAL_EXECUTION_ENABLED !== 'true') reasons.push('EXTERNAL_EXECUTION_ENABLED is not true');
  if (target === 'whatsapp' && process.env.WHATSAPP_LIVE_ENABLED !== 'true') reasons.push('WHATSAPP_LIVE_ENABLED is not true');
  if (target === 'telegram' && process.env.TELEGRAM_LIVE_ENABLED !== 'true') reasons.push('TELEGRAM_LIVE_ENABLED is not true');
  if (target === 'voice_chat' && process.env.VOICE_CHAT_LIVE_ENABLED !== 'true') reasons.push('VOICE_CHAT_LIVE_ENABLED is not true');
  const credential = await getCommunicationConfig(target, tenantKey);
  if (!credential.configured) reasons.push(`${target} sandbox credentials are missing`);
  return { allowed: reasons.length === 0, reasons };
}

function buildSandboxHandoffPayload(target: CommunicationTarget, lead: Record<string, unknown>, message?: string) {
  const defaultMessage = message || `Hello ${lead.leadNamePlaceholder || 'there'}, thanks for your interest. A Tanaghum advisor can help with the next step.`;
  return {
    target,
    leadId: lead.id,
    leadName: lead.leadNamePlaceholder,
    leadEmail: lead.leadEmailPlaceholder,
    leadPhone: lead.leadPhonePlaceholder,
    campaignId: lead.campaignId,
    platform: lead.platform,
    consentStatus: lead.consentStatus,
    message: defaultMessage,
    sandbox: true,
  };
}

async function getCommunicationConfig(target: CommunicationTarget, tenantKey = 'default'): Promise<CommunicationConfig> {
  if (target === 'whatsapp') {
    const credential = await getActiveIntegrationCredential('whatsapp', 'api_key', tenantKey);
    return {
      accessToken: credential?.secrets.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: credential?.secrets.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      configured: Boolean((credential?.secrets.accessToken || process.env.WHATSAPP_ACCESS_TOKEN) && (credential?.secrets.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID)),
    };
  }
  if (target === 'telegram') {
    const credential = await getActiveIntegrationCredential('telegram', 'bot_token', tenantKey);
    return {
      botToken: credential?.secrets.botToken || process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: credential?.secrets.chatId || process.env.TELEGRAM_CHAT_ID || '',
      configured: Boolean((credential?.secrets.botToken || process.env.TELEGRAM_BOT_TOKEN) && (credential?.secrets.chatId || process.env.TELEGRAM_CHAT_ID)),
    };
  }
  const credential = await getActiveIntegrationCredential('voice_chat', 'service_endpoint', tenantKey);
  return {
    apiUrl: credential?.secrets.apiUrl || process.env.VOICE_CHAT_API_URL || '',
    apiKey: credential?.secrets.apiKey || process.env.VOICE_CHAT_API_KEY || '',
    configured: Boolean((credential?.secrets.apiUrl || process.env.VOICE_CHAT_API_URL) && (credential?.secrets.apiKey || process.env.VOICE_CHAT_API_KEY)),
  };
}

async function executeSandboxCommunication(target: CommunicationTarget, payload: Record<string, unknown>, tenantKey: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const config = await getCommunicationConfig(target, tenantKey);
  if (target === 'whatsapp') {
    const response = await fetch(`https://graph.facebook.com/v19.0/${config.phoneNumberId || ''}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.accessToken || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: payload.leadPhone,
        type: 'text',
        text: { body: payload.message },
      }),
    });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({ statusText: response.statusText })) };
  }
  if (target === 'telegram') {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken || ''}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, text: payload.message }),
    });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({ statusText: response.statusText })) };
  }
  const response = await fetch(config.apiUrl || '', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey || ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({ statusText: response.statusText })) };
}
