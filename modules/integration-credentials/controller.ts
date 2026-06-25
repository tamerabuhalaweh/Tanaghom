import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  deactivateIntegrationCredential,
  listIntegrationCredentials,
  upsertIntegrationCredential,
  upsertIntegrationCredentialSchema,
} from './service';

export const integrationCredentialsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

const REQUIRED_CREDENTIALS = [
  {
    provider: 'postiz',
    credentialType: 'api_key',
    label: 'Postiz Sandbox API Key',
    requiredFields: ['apiKey', 'baseUrl', 'integrationId'],
    purpose: 'Create Postiz-ready payloads and optionally execute sandbox scheduling when policy allows.',
  },
  {
    provider: 'gohighlevel',
    credentialType: 'api_key',
    label: 'GoHighLevel Sandbox API Key',
    requiredFields: ['apiKey', 'locationId'],
    purpose: 'Validate CRM readiness and execute sandbox/test contact upsert when policy allows.',
  },
  {
    provider: 'whatsapp',
    credentialType: 'api_key',
    label: 'WhatsApp Cloud API',
    requiredFields: ['accessToken', 'phoneNumberId'],
    purpose: 'Prepare and later send approved sandbox WhatsApp messages.',
  },
  {
    provider: 'telegram',
    credentialType: 'bot_token',
    label: 'Telegram Bot',
    requiredFields: ['botToken', 'chatId'],
    purpose: 'Prepare and later send approved sandbox Telegram messages.',
  },
  {
    provider: 'voice_chat',
    credentialType: 'service_endpoint',
    label: 'AI Voice/Chat Agent API',
    requiredFields: ['apiUrl', 'apiKey'],
    purpose: 'Prepare and later trigger approved test voice/chat handoff.',
  },
  {
    provider: 'social_oauth',
    credentialType: 'oauth_client',
    label: 'Social OAuth Client',
    requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
    purpose: 'Connect official social accounts through OAuth in a future authorized flow.',
  },
  {
    provider: 'openclaw',
    credentialType: 'runtime_endpoint',
    label: 'OpenClaw Runtime',
    requiredFields: ['baseUrl', 'apiKey'],
    purpose: 'Call OpenClaw as an adjacent orchestration/channel layer while STITCH remains authority.',
  },
  {
    provider: 'agentgateway',
    credentialType: 'runtime_endpoint',
    label: 'agentgateway Endpoint',
    requiredFields: ['baseUrl'],
    purpose: 'Route MCP traffic through an external gateway/proxy once deployed.',
  },
  {
    provider: 'agentscope',
    credentialType: 'runtime_endpoint',
    label: 'AgentScope Runtime',
    requiredFields: ['baseUrl', 'apiKey'],
    purpose: 'Use external sandboxed agent runtime endpoints once deployed.',
  },
] as const;

integrationCredentialsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = typeof req.query.tenantKey === 'string' ? req.query.tenantKey : 'default';
    const credentials = await listIntegrationCredentials(payload.role, tenantKey);
    res.json({ credentials, rawSecretsReturned: false });
  } catch (err) {
    next(err);
  }
});

integrationCredentialsRouter.get('/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    getPayload(req);
    res.json({
      tenantKey: 'default',
      requirements: REQUIRED_CREDENTIALS,
      rawSecretsReturned: false,
      _label: 'Tenant credential requirements for integration setup',
    });
  } catch (err) {
    next(err);
  }
});

integrationCredentialsRouter.get('/matrix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = typeof req.query.tenantKey === 'string' ? req.query.tenantKey : 'default';
    const credentials = await listIntegrationCredentials(payload.role, tenantKey);
    const rows = REQUIRED_CREDENTIALS.map((requirement) => {
      const credential = credentials.find((item) =>
        item.provider === requirement.provider && item.credentialType === requirement.credentialType && item.isActive,
      );
      return {
        ...requirement,
        status: credential ? 'configured' : 'missing',
        credentialId: credential?.id ?? null,
        secretFields: credential?.secretFields ?? [],
        secretFingerprints: credential?.secretFingerprints ?? {},
        rawSecretsReturned: false,
      };
    });
    res.json({ tenantKey, rows, rawSecretsReturned: false });
  } catch (err) {
    next(err);
  }
});

integrationCredentialsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = upsertIntegrationCredentialSchema.parse({
      ...req.body,
      tenantKey: req.body.tenantKey ?? 'default',
    });
    const credential = await upsertIntegrationCredential(payload.role, payload.sub, input);
    res.status(201).json({
      credential,
      rawSecretsReturned: false,
      _label: 'Tenant integration credential encrypted and saved',
    });
  } catch (err) {
    next(err);
  }
});

integrationCredentialsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const id = z.string().uuid().parse(req.params.id);
    const credential = await deactivateIntegrationCredential(payload.role, payload.sub, id);
    res.json({
      credential,
      rawSecretsReturned: false,
      _label: 'Tenant integration credential disabled',
    });
  } catch (err) {
    next(err);
  }
});
