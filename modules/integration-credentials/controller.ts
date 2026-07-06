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
import { resolveCredentialTenantKey } from './tenant-scope';

export const integrationCredentialsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

// Customer/business integration requirements only. Internal runtime endpoints
// (OpenClaw, agentgateway, AgentScope) are handled through Admin/Ops runtime
// evidence, not the customer connector setup matrix.
const REQUIRED_CREDENTIALS = [
  {
    provider: 'postiz',
    credentialType: 'api_key',
    connectionKey: 'default',
    label: 'Postiz API Key',
    requiredFields: ['apiKey', 'baseUrl'],
    optionalFields: ['integrationId'],
    purpose: 'Connect this tenant to its Postiz workspace. The social channel integration ID is added after the customer connects an eligible channel in Postiz.',
  },
  {
    provider: 'gohighlevel',
    credentialType: 'api_key',
    connectionKey: 'default',
    label: 'GoHighLevel API Key',
    requiredFields: ['apiKey', 'locationId'],
    purpose: 'Connect this tenant to its own GoHighLevel location. CRM writes remain policy-gated and require explicit tenant configuration.',
  },
  {
    provider: 'meta_analytics',
    credentialType: 'api_key',
    connectionKey: 'default',
    label: 'Meta Ads Read Access',
    requiredFields: ['accessToken', 'adAccountId'],
    optionalFields: ['pageId', 'graphApiVersion'],
    purpose: 'Read Meta/Facebook/Instagram ads performance for event dashboards. The token must be customer-owned and read-only for ads insights.',
  },
  {
    provider: 'youtube_analytics',
    credentialType: 'oauth_token',
    connectionKey: 'default',
    label: 'YouTube Analytics Read Access',
    requiredFields: ['accessToken', 'channelId'],
    optionalFields: ['contentOwnerId'],
    purpose: 'Read YouTube Analytics reports for customer channel performance. Requires a customer-owned OAuth token with analytics read scope.',
  },
  {
    provider: 'formaloo',
    credentialType: 'api_key',
    connectionKey: 'default',
    label: 'Formaloo Forms Read Access',
    requiredFields: ['clientKey', 'clientSecret', 'formId'],
    optionalFields: ['workspaceId', 'baseUrl'],
    purpose: 'Prepare Formaloo form submission imports for event lead and form-completion reporting. Live API calls require the exact customer Formaloo API contract.',
  },
  {
    provider: 'whatsapp',
    credentialType: 'api_key',
    connectionKey: 'default',
    label: 'WhatsApp Cloud API',
    requiredFields: ['accessToken', 'phoneNumberId'],
    purpose: 'Prepare and later send approved sandbox WhatsApp messages.',
  },
  {
    provider: 'telegram',
    credentialType: 'bot_token',
    connectionKey: 'default',
    label: 'Telegram Bot',
    requiredFields: ['botToken', 'chatId'],
    purpose: 'Prepare and later send approved sandbox Telegram messages.',
  },
  {
    provider: 'voice_chat',
    credentialType: 'service_endpoint',
    connectionKey: 'default',
    label: 'AI Voice/Chat Agent API',
    requiredFields: ['apiUrl', 'apiKey'],
    purpose: 'Prepare and later trigger approved test voice/chat handoff.',
  },
  {
    provider: 'smartlabs_voice',
    credentialType: 'api_key',
    connectionKey: 'default',
    label: 'SmartLabs Voice Agent',
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'agentId', 'voiceId', 'ttsBackend'],
    purpose: 'Connect this tenant to its own SmartLabs ConvAI and text-to-speech API. Conversations and TTS execution remain policy-gated.',
  },
  {
    provider: 'social_oauth',
    credentialType: 'oauth_client',
    connectionKey: 'linkedin',
    label: 'LinkedIn OAuth Client',
    requiredFields: ['clientId', 'clientSecret', 'redirectUri', 'authorizationUrl', 'tokenUrl', 'accountInfoUrl', 'scope'],
    purpose: 'Connect official LinkedIn accounts through OAuth authorization code flow.',
  },
  {
    provider: 'social_oauth',
    credentialType: 'oauth_client',
    connectionKey: 'meta',
    label: 'Meta OAuth Client',
    requiredFields: ['clientId', 'clientSecret', 'redirectUri', 'authorizationUrl', 'tokenUrl', 'accountInfoUrl', 'scope'],
    purpose: 'Connect official Facebook/Instagram assets through Meta OAuth authorization code flow.',
  },
  {
    provider: 'social_oauth',
    credentialType: 'oauth_client',
    connectionKey: 'x',
    label: 'X OAuth Client',
    requiredFields: ['clientId', 'clientSecret', 'redirectUri', 'authorizationUrl', 'tokenUrl', 'accountInfoUrl', 'scope'],
    purpose: 'Connect official X/Twitter accounts through OAuth authorization code flow.',
  },
] as const;

integrationCredentialsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const tenantKey = resolveCredentialTenantKey(payload);
    const credentials = await listIntegrationCredentials(payload.role, tenantKey);
    res.json({ credentials, rawSecretsReturned: false });
  } catch (err) {
    next(err);
  }
});

integrationCredentialsRouter.get('/requirements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    res.json({
      tenantKey: resolveCredentialTenantKey(payload),
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
    const tenantKey = resolveCredentialTenantKey(payload);
    const credentials = await listIntegrationCredentials(payload.role, tenantKey);
    const rows = REQUIRED_CREDENTIALS.map((requirement) => {
      const credential = credentials.find((item) =>
        item.provider === requirement.provider
        && item.credentialType === requirement.credentialType
        && item.connectionKey === requirement.connectionKey
        && item.isActive,
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
      tenantKey: resolveCredentialTenantKey(payload),
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
