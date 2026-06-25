import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { evaluateExternalExecution } from '@shared/policy';
import { getActiveIntegrationCredential } from '../integration-credentials/service';

export const ghlRouter = Router();
const GHL_BASE_URL = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';

interface GhlRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  locationId: string;
  source: 'tenant_vault' | 'environment' | 'missing';
}

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

    const config = await resolveGhlRuntimeConfig();
    const hasApiKey = Boolean(config.apiKey);
    const hasLocationId = Boolean(config.locationId);
    const sandboxEnabled = process.env.GHL_SANDBOX_ENABLED === 'true';

    res.json({
      configured: hasApiKey && hasLocationId,
      apiKeyStatus: hasApiKey ? 'configured' : 'missing',
      locationIdStatus: hasLocationId ? 'configured' : 'missing',
      credentialSource: config.source,
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

ghlRouter.get('/wizard-options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    const config = await resolveGhlRuntimeConfig();
    res.json({
      connectionLevels: [
        { id: 'readiness', label: 'Readiness Only', executable: true, risk: 'low' },
        { id: 'handoff_package', label: 'Lead Handoff Package Only', executable: true, risk: 'low' },
        { id: 'sandbox_contact', label: 'Sandbox Contact Upsert', executable: process.env.GHL_SANDBOX_WRITE_ENABLED === 'true', risk: 'medium' },
        { id: 'sandbox_opportunity', label: 'Sandbox Opportunity Preparation', executable: false, risk: 'medium' },
        { id: 'production_write', label: 'Production CRM Write-back', executable: false, risk: 'high' },
      ],
      requiredCredentials: [
        { name: 'Tenant vault apiKey or GHL_API_KEY/GOHIGHLEVEL_API_KEY', status: config.apiKey ? 'configured' : 'missing' },
        { name: 'Tenant vault locationId or GHL_LOCATION_ID', status: config.locationId ? 'configured' : 'missing' },
        { name: 'GHL_SANDBOX_WRITE_ENABLED', status: process.env.GHL_SANDBOX_WRITE_ENABLED === 'true' ? 'enabled' : 'disabled' },
      ],
      safety: {
        productionWrites: 'Blocked',
        sourceOfTruth: 'STITCH',
        endpoint: `${GHL_BASE_URL}/contacts/upsert`,
      },
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

async function resolveGhlRuntimeConfig(): Promise<GhlRuntimeConfig> {
  const credential = await getActiveIntegrationCredential('gohighlevel', 'api_key');
  if (credential) {
    return {
      baseUrl: credential.secrets.baseUrl || GHL_BASE_URL,
      apiKey: credential.secrets.apiKey || '',
      locationId: credential.secrets.locationId || '',
      source: 'tenant_vault',
    };
  }
  return {
    baseUrl: GHL_BASE_URL,
    apiKey: process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || '',
    source: process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY ? 'environment' : 'missing',
  };
}

async function ghlSandboxWriteGate(config?: GhlRuntimeConfig): Promise<{ allowed: boolean; reasons: string[] }> {
  const runtimeConfig = config || await resolveGhlRuntimeConfig();
  const reasons: string[] = [];
  if (process.env.DEMO_MODE === 'true') reasons.push('DEMO_MODE=true blocks CRM sandbox writes');
  if (process.env.EXTERNAL_EXECUTION_ENABLED !== 'true') reasons.push('EXTERNAL_EXECUTION_ENABLED is not true');
  if (process.env.CRM_LIVE_ENABLED !== 'true') reasons.push('CRM_LIVE_ENABLED is not true');
  if (process.env.GHL_SANDBOX_WRITE_ENABLED !== 'true') reasons.push('GHL_SANDBOX_WRITE_ENABLED is not true');
  if (!runtimeConfig.apiKey) reasons.push('GoHighLevel API key is missing');
  if (!runtimeConfig.locationId) reasons.push('GoHighLevel location id is missing');
  return { allowed: reasons.length === 0, reasons };
}

function buildGhlContactPayload(lead: Record<string, unknown>, config?: GhlRuntimeConfig) {
  return {
    locationId: config?.locationId || process.env.GHL_LOCATION_ID || '<configured sandbox location id>',
    firstName: String(lead.lead_name_placeholder || 'Sandbox Lead').split(' ')[0],
    name: lead.lead_name_placeholder || 'Sandbox Lead',
    email: lead.lead_email_placeholder || undefined,
    phone: lead.lead_phone_placeholder || undefined,
    source: lead.lead_source || 'Tanaghum Commercial/Social',
    tags: ['tanaghum', 'commercial-social', 'sandbox'],
    customFields: [
      { key: 'tanaghum_lead_score', field_value: String(deriveQualificationScore(lead)) },
      { key: 'tanaghum_campaign_id', field_value: String(lead.campaign_id || '') },
      { key: 'tanaghum_consent_status', field_value: String(lead.consent_status || 'pending') },
    ],
  };
}

ghlRouter.post('/sandbox-contact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = z.object({
      leadId: z.string().uuid(),
      mode: z.enum(['preview', 'execute']).default('preview'),
    }).parse(req.body);

    const lead = await prisma.leadCaptureRecord.findUnique({ where: { id: input.leadId } }) as Record<string, unknown> | null;
    if (!lead) throw new NotFoundError('Lead', input.leadId);

    const config = await resolveGhlRuntimeConfig();
    const contactPayload = buildGhlContactPayload(lead, config);
    const gate = await ghlSandboxWriteGate(config);

    if (input.mode === 'preview' || !gate.allowed) {
      auditLog(
        { actor: `user:${payload.sub}`, action: 'ghl_sandbox_contact_previewed', object_type: 'lead', object_id: input.leadId, result: gate.allowed ? 'preview' : 'blocked' },
        gate.allowed ? 'GHL sandbox contact payload previewed' : `GHL sandbox contact blocked: ${gate.reasons.join('; ')}`,
      );
      res.status(input.mode === 'execute' ? 403 : 200).json({
        status: input.mode === 'execute' ? 'blocked' : 'prepared',
        reasons: input.mode === 'execute' ? gate.reasons : [],
        endpoint: `${config.baseUrl}/contacts/upsert`,
        credentialSource: config.source,
        payload: contactPayload,
        safety: {
          executionPerformed: false,
          productionWrite: false,
        },
        _label: input.mode === 'execute'
          ? 'Blocked - sandbox CRM write requires explicit deployment flags and credentials'
          : 'GHL sandbox contact payload prepared - no CRM write performed',
      });
      return;
    }

    const response = await fetch(`${config.baseUrl}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Version: process.env.GHL_API_VERSION || '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));

    auditLog(
      { actor: `user:${payload.sub}`, action: 'ghl_sandbox_contact_executed', object_type: 'lead', object_id: input.leadId, result: response.ok ? 'success' : 'failed' },
      `GHL sandbox contact API returned ${response.status}`,
    );

    res.status(response.ok ? 200 : 502).json({
      status: response.ok ? 'sandbox_contact_upserted' : 'failed',
      ghlStatus: response.status,
      response: body,
      payload: contactPayload,
      safety: {
        executionPerformed: true,
        productionWrite: false,
        sandboxOnly: true,
      },
      _label: response.ok ? 'Sandbox contact written to GoHighLevel test location' : 'GoHighLevel sandbox API call failed',
    });
  } catch (err) {
    next(err);
  }
});
