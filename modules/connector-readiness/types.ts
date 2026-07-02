export const PROVIDER_IDS = [
  'meta_analytics',
  'youtube_analytics',
  'formaloo',
  'gohighlevel',
  'whatsapp_provider',
  'telegram_provider',
  'smartlabs_voice',
  'postiz',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const CREDENTIAL_STATES = [
  'missing',
  'configured',
  'validated',
  'expired',
  'blocked',
] as const;

export type CredentialState = (typeof CREDENTIAL_STATES)[number];

export interface ProviderReadiness {
  providerId: ProviderId;
  displayName: string;
  credentialState: CredentialState;
  oauthRequired: boolean;
  mappingRequired: boolean;
  dryRunSupported: boolean;
  importSupported: boolean;
  writeBackStatus: 'available' | 'blocked' | 'not_supported';
  writeBackBlocker: string | null;
  nextAction: string;
  hasMapping: boolean;
}

export interface EventConnectorReadiness {
  eventId: string;
  tenantKey: string;
  providers: ProviderReadiness[];
  readyCount: number;
  blockedCount: number;
  missingCount: number;
}

export const PROVIDER_METADATA: Record<ProviderId, {
  displayName: string;
  oauthRequired: boolean;
  mappingRequired: boolean;
  dryRunSupported: boolean;
  importSupported: boolean;
  writeBackSupported: boolean;
  writeBackBlocker: string;
  missingCredentialAction: string;
}> = {
  meta_analytics: {
    displayName: 'Meta Analytics',
    oauthRequired: true,
    mappingRequired: true,
    dryRunSupported: true,
    importSupported: true,
    writeBackSupported: false,
    writeBackBlocker: 'Meta Ads write-back not authorized in this environment',
    missingCredentialAction: 'Connect Meta Business account with read-only analytics permission',
  },
  youtube_analytics: {
    displayName: 'YouTube Analytics',
    oauthRequired: true,
    mappingRequired: true,
    dryRunSupported: true,
    importSupported: true,
    writeBackSupported: false,
    writeBackBlocker: 'YouTube Ads write-back not authorized in this environment',
    missingCredentialAction: 'Connect YouTube channel with analytics read permission',
  },
  formaloo: {
    displayName: 'Formaloo',
    oauthRequired: false,
    mappingRequired: true,
    dryRunSupported: true,
    importSupported: true,
    writeBackSupported: false,
    writeBackBlocker: 'Formaloo write-back not supported',
    missingCredentialAction: 'Enter Formaloo API key and form ID',
  },
  gohighlevel: {
    displayName: 'GoHighLevel',
    oauthRequired: false,
    mappingRequired: true,
    dryRunSupported: true,
    importSupported: true,
    writeBackSupported: false,
    writeBackBlocker: 'GHL live write not authorized in this environment',
    missingCredentialAction: 'Enter GoHighLevel API key and location ID',
  },
  whatsapp_provider: {
    displayName: 'WhatsApp Provider',
    oauthRequired: false,
    mappingRequired: false,
    dryRunSupported: false,
    importSupported: false,
    writeBackSupported: false,
    writeBackBlocker: 'WhatsApp live execution not authorized in this environment',
    missingCredentialAction: 'Enter WhatsApp Business API token and phone number ID',
  },
  telegram_provider: {
    displayName: 'Telegram Provider',
    oauthRequired: false,
    mappingRequired: false,
    dryRunSupported: false,
    importSupported: false,
    writeBackSupported: false,
    writeBackBlocker: 'Telegram live execution not authorized in this environment',
    missingCredentialAction: 'Enter Telegram bot token',
  },
  smartlabs_voice: {
    displayName: 'SmartLabs Voice',
    oauthRequired: false,
    mappingRequired: false,
    dryRunSupported: false,
    importSupported: false,
    writeBackSupported: false,
    writeBackBlocker: 'SmartLabs voice execution not authorized in this environment',
    missingCredentialAction: 'Enter SmartLabs API key and agent ID',
  },
  postiz: {
    displayName: 'Postiz',
    oauthRequired: false,
    mappingRequired: true,
    dryRunSupported: true,
    importSupported: true,
    writeBackSupported: false,
    writeBackBlocker: 'Postiz scheduling requires customer social account OAuth',
    missingCredentialAction: 'Enter Postiz API key and base URL',
  },
};
