export interface SafePostizChannel {
  id: unknown;
  name: unknown;
  providerIdentifier: unknown;
  type: unknown;
  profile: unknown;
  picture: unknown;
  disabled: boolean;
  refreshNeeded: boolean;
  customer: { id: unknown; name: unknown } | null;
  rawTokensReturned: false;
}

export interface PostizChannelGuidance {
  status: 'ready' | 'requires_credentials' | 'requires_channel';
  title: string;
  message: string;
  nextActions: string[];
}

export function toSafePostizChannel(channel: Record<string, unknown>): SafePostizChannel {
  const customer = (channel.customer || {}) as Record<string, unknown>;
  return {
    id: channel.id,
    name: channel.name,
    providerIdentifier: channel.providerIdentifier || channel.identifier,
    type: channel.type,
    profile: channel.profile,
    picture: channel.picture,
    disabled: Boolean(channel.disabled),
    refreshNeeded: Boolean(channel.refreshNeeded),
    customer: customer.id ? { id: customer.id, name: customer.name } : null,
    rawTokensReturned: false,
  };
}

export function buildPostizChannelGuidance(input: {
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  channelCount: number;
  selectedIntegrationId?: string | null;
}): PostizChannelGuidance {
  if (!input.hasBaseUrl || !input.hasApiKey) {
    return {
      status: 'requires_credentials',
      title: 'Postiz API credentials required',
      message: 'Tanaghum can reach Postiz only after the tenant Postiz base URL and API key are saved in Credentials.',
      nextActions: [
        'Open Credentials and configure Postiz Sandbox API Key.',
        'Save baseUrl and apiKey in the tenant vault.',
        'Return here and refresh Postiz channels.',
      ],
    };
  }

  if (input.channelCount === 0) {
    return {
      status: 'requires_channel',
      title: 'No social channel returned by Postiz',
      message: 'The Postiz API key is valid enough to query channels, but this Postiz organization has no connected social channel visible to that key yet.',
      nextActions: [
        'Verify Postiz has the required provider app credentials, such as Meta/Facebook app ID and secret for Instagram.',
        'Click Connect Channel via Postiz from Tanaghum.',
        'Complete the provider OAuth/login inside Postiz.',
        'Return to Tanaghum and click Refresh Channels.',
        'When a channel appears, choose Use for Scheduling.',
      ],
    };
  }

  if (!input.selectedIntegrationId) {
    return {
      status: 'ready',
      title: 'Postiz channels available',
      message: 'Connected channels were returned by Postiz. Select one channel before sandbox scheduling packages can target it.',
      nextActions: ['Choose Use for Scheduling on the correct test/sandbox channel.'],
    };
  }

  return {
    status: 'ready',
    title: 'Postiz channel selected',
    message: 'A connected Postiz channel is selected for scheduling payloads. External scheduling still requires explicit sandbox flags and approval gates.',
    nextActions: ['Prepare an approved publishing package, then review the Postiz payload.'],
  };
}
