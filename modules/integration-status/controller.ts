import { Router, Request, Response, NextFunction } from 'express';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { evaluateExternalExecution } from '@shared/policy';
import { getProviderStatus } from '@shared/providers/llm-provider';
import { hasActiveIntegrationCredential } from '../integration-credentials/service';

export const integrationStatusRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function envCredentialStatus(...names: string[]): 'configured' | 'missing' {
  return names.some((name) => Boolean(process.env[name])) ? 'configured' : 'missing';
}

async function credentialStatus(provider: Parameters<typeof hasActiveIntegrationCredential>[0], credentialType: Parameters<typeof hasActiveIntegrationCredential>[1], envNames: string[], tenantKey: string): Promise<'configured' | 'missing'> {
  if (await hasActiveIntegrationCredential(provider, credentialType, tenantKey)) return 'configured';
  return envCredentialStatus(...envNames);
}

integrationStatusRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = resolveSessionContext(getPayload(req));
    const llm = getProviderStatus();
    const postizCredential = await credentialStatus('postiz', 'api_key', ['POSTIZ_API_KEY'], session.tenantKey);
    const ghlCredential = await credentialStatus('gohighlevel', 'api_key', ['GHL_API_KEY', 'GOHIGHLEVEL_API_KEY'], session.tenantKey);
    const whatsappCredential = await credentialStatus('whatsapp', 'api_key', ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'], session.tenantKey);
    const telegramCredential = await credentialStatus('telegram', 'bot_token', ['TELEGRAM_BOT_TOKEN'], session.tenantKey);
    const voiceCredential = await credentialStatus('voice_chat', 'service_endpoint', ['VOICE_CHAT_API_URL', 'VOICE_CHAT_API_KEY'], session.tenantKey);
    res.json({
      generatedAt: new Date().toISOString(),
      aiProvider: {
        provider: llm.type,
        model: llm.model,
        credentialStatus: llm.type === 'mock' && process.env.ALLOW_MOCK_LLM !== 'true' ? 'missing' : llm.apiKeyStatus,
        label: llm.type === 'mock' && process.env.ALLOW_MOCK_LLM !== 'true' ? 'Requires User LLM Credential' : 'Live Provider Active',
      },
      connectors: [
        {
          id: 'postiz',
          name: 'Postiz Scheduling',
          credentialStatus: postizCredential,
          endpointStatus: process.env.POSTIZ_SANDBOX_URL || process.env.POSTIZ_BASE_URL ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'postiz', action: 'schedule', executionMode: 'sandbox' }),
        },
        {
          id: 'gohighlevel',
          name: 'GoHighLevel CRM',
          credentialStatus: ghlCredential,
          endpointStatus: ghlCredential === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'gohighlevel', action: 'write', executionMode: 'sandbox' }),
        },
        {
          id: 'whatsapp',
          name: 'WhatsApp Business',
          credentialStatus: whatsappCredential,
          endpointStatus: whatsappCredential === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'whatsapp', action: 'send_message', executionMode: 'sandbox' }),
        },
        {
          id: 'telegram',
          name: 'Telegram',
          credentialStatus: telegramCredential,
          endpointStatus: telegramCredential === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'telegram', action: 'send_message', executionMode: 'sandbox' }),
        },
        {
          id: 'voice_chat',
          name: 'AI Voice/Chat Agent API',
          credentialStatus: voiceCredential,
          endpointStatus: voiceCredential === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'voice_chat', action: 'trigger_call', executionMode: 'sandbox' }),
        },
      ],
      safety: {
        externalExecutionEnabled: process.env.EXTERNAL_EXECUTION_ENABLED === 'true',
        m5WriteExecutionEnabled: process.env.M5_WRITE_EXECUTION_ENABLED === 'true',
        demoMode: process.env.DEMO_MODE === 'true',
      },
    });
  } catch (err) {
    next(err);
  }
});
