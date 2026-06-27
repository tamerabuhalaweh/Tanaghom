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

export interface PostizDiagnosticCheck {
  id: string;
  label: string;
  status: 'passed' | 'warning' | 'blocked' | 'not_checked';
  detail: string;
  action?: string;
}

export interface PostizDiagnostics {
  status:
    | 'ready'
    | 'requires_credentials'
    | 'api_key_failed'
    | 'oauth_ready'
    | 'requires_provider_setup'
    | 'requires_channel'
    | 'requires_channel_selection';
  title: string;
  summary: string;
  checks: PostizDiagnosticCheck[];
  nextActions: string[];
}

export function inspectPostizAuthorizationUrl(value: unknown): {
  authorizationUrl: string | null;
  host: string | null;
  hasClientId: boolean;
  providerConfigurationReady: boolean;
  failureReason: string | null;
} {
  if (typeof value !== 'string' || !value.trim()) {
    return {
      authorizationUrl: null,
      host: null,
      hasClientId: false,
      providerConfigurationReady: false,
      failureReason: 'Postiz response did not include an authorization URL.',
    };
  }

  try {
    const url = new URL(value);
    const hasClientId = Boolean(url.searchParams.get('client_id'));
    return {
      authorizationUrl: value,
      host: url.host,
      hasClientId,
      providerConfigurationReady: hasClientId,
      failureReason: hasClientId
        ? null
        : 'Postiz returned an OAuth URL without a provider client_id. Configure the provider app credentials in Postiz.',
    };
  } catch {
    return {
      authorizationUrl: null,
      host: null,
      hasClientId: false,
      providerConfigurationReady: false,
      failureReason: 'Postiz returned an invalid authorization URL.',
    };
  }
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

export function buildPostizDiagnostics(input: {
  hasBaseUrl: boolean;
  hasApiKey: boolean;
  apiConnected: boolean | null;
  channelCount: number;
  selectedIntegrationId?: string | null;
  oauthUrlReady?: boolean;
  oauthUrlHasClientId?: boolean;
  oauthProviderHost?: string | null;
  oauthChecked?: boolean;
  oauthFailureReason?: string | null;
  platform?: string | null;
  sandboxSchedulingAllowed?: boolean;
}): PostizDiagnostics {
  const platform = input.platform || 'selected platform';
  const oauthProviderConfigured = input.oauthUrlReady && input.oauthUrlHasClientId !== false;
  const checks: PostizDiagnosticCheck[] = [
    {
      id: 'postiz_base_url',
      label: 'Postiz server URL',
      status: input.hasBaseUrl ? 'passed' : 'blocked',
      detail: input.hasBaseUrl ? 'Postiz base URL is configured.' : 'Postiz base URL is missing.',
      action: input.hasBaseUrl ? undefined : 'Save the Postiz base URL in Credentials.',
    },
    {
      id: 'postiz_api_key',
      label: 'Postiz API key',
      status: input.hasApiKey ? input.apiConnected === false ? 'blocked' : 'passed' : 'blocked',
      detail: input.hasApiKey
        ? input.apiConnected === false
          ? 'The API key did not pass Postiz connection validation.'
          : input.apiConnected === true
            ? 'The API key is accepted by Postiz.'
            : 'The API key is present; validation was not completed.'
        : 'Postiz API key is missing.',
      action: input.hasApiKey ? undefined : 'Save the tenant Postiz API key.',
    },
    {
      id: 'postiz_oauth_url',
      label: 'Channel OAuth handoff',
      status: input.oauthChecked
        ? oauthProviderConfigured ? 'passed' : 'blocked'
        : input.hasApiKey ? 'not_checked' : 'blocked',
      detail: input.oauthChecked
        ? oauthProviderConfigured
          ? `Postiz can create an OAuth URL for ${platform}${input.oauthProviderHost ? ` through ${input.oauthProviderHost}` : ''}.`
          : input.oauthFailureReason
            || (input.oauthUrlReady && input.oauthUrlHasClientId === false
              ? `Postiz returned an OAuth URL for ${platform}, but the provider client ID is missing.`
              : `Postiz did not return a usable OAuth URL for ${platform}.`)
        : input.hasApiKey
          ? 'Run diagnostics or click Connect Channel to request a Postiz OAuth URL.'
          : 'Postiz API credentials are required before OAuth can start.',
      action: input.oauthChecked && !oauthProviderConfigured
        ? 'Verify provider app credentials in the Postiz deployment.'
        : undefined,
    },
    {
      id: 'postiz_channel_count',
      label: 'Connected social channels',
      status: input.channelCount > 0 ? 'passed' : 'blocked',
      detail: input.channelCount > 0
        ? `${input.channelCount} connected social channel(s) are visible through the Postiz API.`
        : 'Postiz returned zero connected social channels for this API key.',
      action: input.channelCount > 0 ? undefined : 'Complete provider OAuth in Postiz, then refresh channels in Tanaghum.',
    },
    {
      id: 'postiz_selected_channel',
      label: 'Scheduling channel selected',
      status: input.selectedIntegrationId ? 'passed' : input.channelCount > 0 ? 'warning' : 'blocked',
      detail: input.selectedIntegrationId
        ? 'A Postiz channel is selected for scheduling payloads.'
        : input.channelCount > 0
          ? 'A channel is visible but has not been selected for Tanaghum scheduling packages.'
          : 'No channel can be selected until Postiz returns at least one channel.',
      action: input.channelCount > 0 && !input.selectedIntegrationId ? 'Choose Use for Scheduling on the correct channel.' : undefined,
    },
    {
      id: 'postiz_sandbox_execution',
      label: 'Sandbox scheduling gate',
      status: input.sandboxSchedulingAllowed ? 'warning' : 'blocked',
      detail: input.sandboxSchedulingAllowed
        ? 'Sandbox scheduling is deployment-enabled, but still requires human approval and a selected test channel.'
        : 'External scheduling remains blocked by deployment policy.',
      action: input.sandboxSchedulingAllowed ? undefined : 'Enable sandbox scheduling flags only when a test channel and approval path are ready.',
    },
  ];

  if (!input.hasBaseUrl || !input.hasApiKey) {
    return {
      status: 'requires_credentials',
      title: 'Postiz credentials required',
      summary: 'Tanaghum needs the tenant Postiz base URL and API key before it can inspect channels or start OAuth.',
      checks,
      nextActions: [
        'Open Credentials and configure Postiz Sandbox API Key.',
        'Save baseUrl and apiKey in the tenant vault.',
        'Run Postiz diagnostics again.',
      ],
    };
  }

  if (input.apiConnected === false) {
    return {
      status: 'api_key_failed',
      title: 'Postiz API key failed validation',
      summary: 'Postiz rejected the configured API key or the key cannot access this organization.',
      checks,
      nextActions: [
        'Create or copy the API key from the same Postiz organization that owns the social channels.',
        'Update the tenant Postiz credential in Tanaghum.',
        'Run diagnostics again before attempting OAuth.',
      ],
    };
  }

  if (input.channelCount === 0) {
    if (input.oauthChecked && !oauthProviderConfigured) {
      return {
        status: 'requires_provider_setup',
        title: 'Postiz provider setup needs attention',
        summary: input.oauthUrlReady && input.oauthUrlHasClientId === false
          ? `Postiz accepted the API key but the ${platform} OAuth URL is missing the provider client ID.`
          : `Postiz accepted the API key but could not provide an OAuth URL for ${platform}.`,
        checks,
        nextActions: [
          'Configure the required provider app credentials in Postiz deployment settings.',
          'For Instagram/Facebook, set the Meta/Facebook app ID and app secret in the Postiz environment.',
          'Restart Postiz after provider env changes.',
          'Run diagnostics again and confirm OAuth URL is available.',
        ],
      };
    }

    return {
      status: 'oauth_ready',
      title: 'Postiz OAuth handoff ready',
      summary: `Postiz can start ${platform} OAuth, but no connected channel is visible yet.`,
      checks,
      nextActions: [
        'Click Connect Channel via Postiz from Tanaghum.',
        'Complete the provider login and permission approval inside Postiz.',
        'Return to Tanaghum and click Refresh Channels.',
        'Select the connected test channel for scheduling packages.',
      ],
    };
  }

  if (!input.selectedIntegrationId) {
    return {
      status: 'requires_channel_selection',
      title: 'Select a Postiz channel',
      summary: 'Postiz returned connected channels. Tanaghum needs one selected channel before scheduling payloads can target it.',
      checks,
      nextActions: ['Choose Use for Scheduling on the correct sandbox/test channel.'],
    };
  }

  return {
    status: 'ready',
    title: 'Postiz channel path ready',
    summary: 'Tanaghum can see a connected Postiz channel and has a selected scheduling target. Real scheduling remains policy-gated.',
    checks,
    nextActions: ['Prepare an approved package, inspect the payload, then request sandbox scheduling only when authorized.'],
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
