import { Router, Request, Response, NextFunction } from 'express';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { evaluateExternalExecution } from '@shared/policy';
import { getProviderStatus } from '@shared/providers/llm-provider';

export const integrationStatusRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function credentialStatus(...names: string[]): 'configured' | 'missing' {
  return names.some((name) => Boolean(process.env[name])) ? 'configured' : 'missing';
}

integrationStatusRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    resolveSessionContext(getPayload(req));
    const llm = getProviderStatus();
    res.json({
      generatedAt: new Date().toISOString(),
      aiProvider: {
        provider: llm.type,
        model: llm.model,
        credentialStatus: llm.apiKeyStatus,
        label: llm.type === 'mock' ? 'Mock Provider' : 'Live Provider Active',
      },
      connectors: [
        {
          id: 'postiz',
          name: 'Postiz Scheduling',
          credentialStatus: credentialStatus('POSTIZ_API_KEY'),
          endpointStatus: process.env.POSTIZ_SANDBOX_URL || process.env.POSTIZ_BASE_URL ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'postiz', action: 'schedule', executionMode: 'sandbox' }),
        },
        {
          id: 'gohighlevel',
          name: 'GoHighLevel CRM',
          credentialStatus: credentialStatus('GHL_API_KEY', 'GOHIGHLEVEL_API_KEY'),
          endpointStatus: credentialStatus('GHL_API_KEY', 'GOHIGHLEVEL_API_KEY') === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'gohighlevel', action: 'write', executionMode: 'sandbox' }),
        },
        {
          id: 'whatsapp',
          name: 'WhatsApp Business',
          credentialStatus: credentialStatus('WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'),
          endpointStatus: credentialStatus('WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID') === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'whatsapp', action: 'send_message', executionMode: 'sandbox' }),
        },
        {
          id: 'telegram',
          name: 'Telegram',
          credentialStatus: credentialStatus('TELEGRAM_BOT_TOKEN'),
          endpointStatus: credentialStatus('TELEGRAM_BOT_TOKEN') === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
          executionPolicy: evaluateExternalExecution({ system: 'telegram', action: 'send_message', executionMode: 'sandbox' }),
        },
        {
          id: 'voice_chat',
          name: 'AI Voice/Chat Agent API',
          credentialStatus: credentialStatus('VOICE_CHAT_API_URL', 'VOICE_CHAT_API_KEY'),
          endpointStatus: credentialStatus('VOICE_CHAT_API_URL') === 'configured' ? 'Sandbox Ready' : 'Requires Credentials',
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
