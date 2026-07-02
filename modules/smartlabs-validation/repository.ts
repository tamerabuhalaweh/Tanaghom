import { getActiveIntegrationCredential } from '../integration-credentials/service';

const DEFAULT_BASE_URL = 'https://api.thesmartlabs.net';
const DEFAULT_TTS_BACKEND = 'omnivoice';
const DEFAULT_VOICE_ID = 'smarttts2-xms-default';

export interface ResolvedSmartLabsCredential {
  configured: boolean;
  source: 'tenant_vault' | 'missing';
  baseUrl: string;
  apiKey: string;
  agentId: string;
  voiceId: string;
  ttsBackend: string;
}

export async function resolveSmartLabsCredential(tenantKey = 'default'): Promise<ResolvedSmartLabsCredential> {
  const credential = await getActiveIntegrationCredential('smartlabs_voice', 'api_key', tenantKey);
  if (!credential) {
    return {
      configured: false,
      source: 'missing',
      baseUrl: DEFAULT_BASE_URL,
      apiKey: '',
      agentId: '',
      voiceId: DEFAULT_VOICE_ID,
      ttsBackend: DEFAULT_TTS_BACKEND,
    };
  }
  return {
    configured: true,
    source: 'tenant_vault',
    baseUrl: credential.secrets.baseUrl || DEFAULT_BASE_URL,
    apiKey: credential.secrets.apiKey || '',
    agentId: credential.secrets.agentId || '',
    voiceId: credential.secrets.voiceId || DEFAULT_VOICE_ID,
    ttsBackend: credential.secrets.ttsBackend || DEFAULT_TTS_BACKEND,
  };
}
