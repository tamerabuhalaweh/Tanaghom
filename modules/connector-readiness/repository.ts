import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import { getActiveIntegrationCredential, type DecryptedIntegrationCredential } from '../integration-credentials/service';
import { validateKajabiReadAccessInternal } from '../kajabi-connector/service';
import type {
  CredentialState, ProviderReadiness, EventConnectorReadiness, ReadAccessValidationResult,
  ReadValidationProviderId,
} from './types';
import { PROVIDER_IDS, PROVIDER_METADATA, READ_VALIDATION_PROVIDER_IDS } from './types';

type IntegrationProvider = Parameters<typeof getActiveIntegrationCredential>[0];
type CredentialType = Parameters<typeof getActiveIntegrationCredential>[1];
type CredentialLookup = { provider: IntegrationProvider; credentialType: CredentialType; connectionKey: string };

const PROVIDER_CREDENTIAL_MAP: Record<string, CredentialLookup[]> = {
  meta_analytics: [
    { provider: 'meta_analytics', credentialType: 'api_key', connectionKey: 'default' },
    { provider: 'social_oauth', credentialType: 'oauth_client', connectionKey: 'meta' },
  ],
  youtube_analytics: [
    { provider: 'youtube_analytics', credentialType: 'oauth_token', connectionKey: 'default' },
    { provider: 'youtube', credentialType: 'api_key', connectionKey: 'default' },
  ],
  formaloo: [{ provider: 'formaloo', credentialType: 'api_key', connectionKey: 'default' }],
  kajabi: [{ provider: 'kajabi', credentialType: 'oauth_client', connectionKey: 'default' }],
  gohighlevel: [{ provider: 'gohighlevel', credentialType: 'api_key', connectionKey: 'default' }],
  whatsapp_provider: [{ provider: 'whatsapp', credentialType: 'api_key', connectionKey: 'default' }],
  telegram_provider: [{ provider: 'telegram', credentialType: 'bot_token', connectionKey: 'default' }],
  smartlabs_voice: [{ provider: 'smartlabs_voice', credentialType: 'api_key', connectionKey: 'default' }],
  postiz: [{ provider: 'postiz', credentialType: 'api_key', connectionKey: 'default' }],
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
}) => Promise<FetchResponseLike>;

async function resolveCredentialState(tenantKey: string, providerId: string): Promise<CredentialState> {
  const mappings = PROVIDER_CREDENTIAL_MAP[providerId];
  if (!mappings?.length) return 'missing';

  for (const mapping of mappings) {
    const credential = await prisma.integrationCredential.findFirst({
      where: {
        tenant_key: tenantKey,
        provider: mapping.provider,
        credential_type: mapping.credentialType,
        connection_key: mapping.connectionKey,
        is_active: true,
      },
      select: { id: true, last_validated_at: true },
    });

    if (credential?.last_validated_at) return 'validated';
    if (credential) return 'configured';
  }

  return 'missing';
}

async function resolveActiveConnectorCredential(
  tenantKey: string,
  providerId: string,
): Promise<DecryptedIntegrationCredential | null> {
  const mappings = PROVIDER_CREDENTIAL_MAP[providerId];
  if (!mappings?.length) return null;

  for (const mapping of mappings) {
    const credential = await getActiveIntegrationCredential(
      mapping.provider,
      mapping.credentialType,
      tenantKey,
      mapping.connectionKey,
    );
    if (credential) return credential;
  }
  return null;
}

async function hasEventMapping(tenantKey: string, providerId: string, eventId: string): Promise<boolean> {
  const mapping = await prisma.connectorFieldMapping.findFirst({
    where: {
      tenant_key: tenantKey,
      connector_id: providerId,
      OR: [
        { event_id: eventId },
        { event_id: null },
      ],
    },
    select: { id: true },
  });
  return !!mapping;
}

async function hasGlobalMapping(tenantKey: string, providerId: string): Promise<boolean> {
  const mapping = await prisma.connectorFieldMapping.findFirst({
    where: { tenant_key: tenantKey, connector_id: providerId },
    select: { id: true },
  });
  return !!mapping;
}

async function hasEventDryRunOrTest(tenantKey: string, providerId: string, eventId: string): Promise<boolean> {
  const job = await prisma.connectorImportJob.findFirst({
    where: {
      tenant_key: tenantKey,
      connector_id: providerId,
      event_id: eventId,
    },
    select: { id: true, last_dry_run_result: true, state: true },
  });
  if (!job) return false;
  if (job.state !== 'test_passed') return false;

  const dryRunResult = job.last_dry_run_result;
  if (!dryRunResult || typeof dryRunResult !== 'object' || Array.isArray(dryRunResult)) return false;

  const result = dryRunResult as { kpiRows?: unknown };
  return Array.isArray(result.kpiRows) && result.kpiRows.length > 0;
}

export async function getEventConnectorReadiness(
  tenantKey: string,
  eventId: string,
): Promise<EventConnectorReadiness> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    select: { id: true },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const providers: ProviderReadiness[] = [];
  let readyCount = 0;
  let blockedCount = 0;
  let missingCount = 0;

  for (const providerId of PROVIDER_IDS) {
    const meta = PROVIDER_METADATA[providerId];
    const credentialState = await resolveCredentialState(tenantKey, providerId);
    const eventMappingExists = await hasEventMapping(tenantKey, providerId, eventId);
    const hasDryRun = await hasEventDryRunOrTest(tenantKey, providerId, eventId);

    let writeBackStatus: ProviderReadiness['writeBackStatus'] = 'not_supported';
    let writeBackBlocker: string | null = null;
    if (meta.writeBackSupported) {
      writeBackStatus = 'available';
    } else {
      writeBackStatus = 'blocked';
      writeBackBlocker = meta.writeBackBlocker;
    }

    let nextAction: string;
    if (!meta.configurable) {
      nextAction = meta.notConfigurableAction ?? 'Provider not configurable in this environment';
      blockedCount++;
    } else if (credentialState === 'missing') {
      nextAction = meta.missingCredentialAction;
      missingCount++;
    } else if (credentialState === 'expired') {
      nextAction = 'Re-authenticate expired credentials';
      blockedCount++;
    } else if (meta.mappingRequired && !eventMappingExists) {
      nextAction = 'Create field mapping for this provider and event';
      blockedCount++;
    } else if (meta.dryRunSupported && !hasDryRun) {
      nextAction = 'Run connector dry-run for this event';
      blockedCount++;
    } else {
      nextAction = 'Ready for use';
      readyCount++;
    }

    providers.push({
      providerId,
      displayName: meta.displayName,
      credentialState,
      oauthRequired: meta.oauthRequired,
      mappingRequired: meta.mappingRequired,
      dryRunSupported: meta.dryRunSupported,
      importSupported: meta.importSupported,
      writeBackStatus,
      writeBackBlocker,
      nextAction,
      hasMapping: eventMappingExists,
    });
  }

  return {
    eventId,
    tenantKey,
    providers,
    readyCount,
    blockedCount,
    missingCount,
  };
}

export async function getGlobalConnectorReadiness(
  tenantKey: string,
): Promise<Omit<EventConnectorReadiness, 'eventId'>> {
  const providers: ProviderReadiness[] = [];
  let readyCount = 0;
  let blockedCount = 0;
  let missingCount = 0;

  for (const providerId of PROVIDER_IDS) {
    const meta = PROVIDER_METADATA[providerId];
    const credentialState = await resolveCredentialState(tenantKey, providerId);
    const mappingExists = await hasGlobalMapping(tenantKey, providerId);

    let writeBackStatus: ProviderReadiness['writeBackStatus'] = 'not_supported';
    let writeBackBlocker: string | null = null;
    if (meta.writeBackSupported) {
      writeBackStatus = 'available';
    } else {
      writeBackStatus = 'blocked';
      writeBackBlocker = meta.writeBackBlocker;
    }

    let nextAction: string;
    if (!meta.configurable) {
      nextAction = meta.notConfigurableAction ?? 'Provider not configurable in this environment';
      blockedCount++;
    } else if (credentialState === 'missing') {
      nextAction = meta.missingCredentialAction;
      missingCount++;
    } else if (credentialState === 'expired') {
      nextAction = 'Re-authenticate expired credentials';
      blockedCount++;
    } else if (meta.mappingRequired && !mappingExists) {
      nextAction = 'Create field mapping for this provider';
      blockedCount++;
    } else {
      nextAction = 'Ready for use';
      readyCount++;
    }

    providers.push({
      providerId,
      displayName: meta.displayName,
      credentialState,
      oauthRequired: meta.oauthRequired,
      mappingRequired: meta.mappingRequired,
      dryRunSupported: meta.dryRunSupported,
      importSupported: meta.importSupported,
      writeBackStatus,
      writeBackBlocker,
      nextAction,
      hasMapping: mappingExists,
    });
  }

  return { tenantKey, providers, readyCount, blockedCount, missingCount };
}

export async function validateProviderReadAccess(
  tenantKey: string,
  userId: string,
  providerId: ReadValidationProviderId,
  fetcher: FetchLike = fetch as unknown as FetchLike,
): Promise<ReadAccessValidationResult> {
  if (!READ_VALIDATION_PROVIDER_IDS.includes(providerId)) {
    throw new ValidationError(`Read validation is not supported for ${providerId}`);
  }

  const credential = await resolveActiveConnectorCredential(tenantKey, providerId);
  const displayName = PROVIDER_METADATA[providerId].displayName;
  if (!credential) {
    return validationResult(providerId, 'requires_credentials', {
      message: `${displayName} credential is missing.`,
      requiredActions: [PROVIDER_METADATA[providerId].missingCredentialAction],
    });
  }

  let result: ReadAccessValidationResult;
  if (providerId === 'meta_analytics') {
    result = await validateMetaReadAccess(credential, fetcher);
  } else if (providerId === 'youtube_analytics') {
    result = await validateYouTubeReadAccess(credential, fetcher);
  } else if (providerId === 'kajabi') {
    const kajabiResult = await validateKajabiReadAccessInternal(tenantKey, userId, fetcher);
    result = validationResult('kajabi', kajabiResult.status === 'validated' ? 'validated' : kajabiResult.status === 'failed' ? 'failed' : kajabiResult.status === 'requires_credentials' ? 'requires_credentials' : 'requires_provider_contract', {
      message: kajabiResult.status === 'blocked_by_environment'
        ? 'Kajabi credentials are stored, but live read validation is waiting for KAJABI_READ_SYNC_ENABLED=true.'
        : `Kajabi read validation: ${kajabiResult.status}.`,
      requiredActions: kajabiResult.requiredActions,
      evidence: {
        rowsFound: kajabiResult.evidence.rowsFound ?? 0,
        metricLabels: ['contacts', 'customers', 'courses', 'offers', 'purchases', 'orders', 'forms'],
        accountReference: null,
        providerEndpoint: kajabiResult.evidence.providerEndpoint ?? 'Kajabi Public API',
      },
    });
  } else {
    result = validateFormalooReadAccess(credential);
  }

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_readiness',
      action: 'provider_read_access_validated',
      result: result.status === 'validated' ? 'success' : result.status === 'failed' ? 'failure' : 'blocked',
      human_user_id: userId,
      target_object_type: 'integration_credential',
      target_object_id: credential.id,
      reason: `${displayName} read validation: ${result.status}`,
      after_state: {
        providerId,
        status: result.status,
        rowsFound: result.evidence.rowsFound ?? null,
        rawSecretsReturned: false,
        rawPayloadReturned: false,
      },
    },
  });

  if (result.status === 'validated') {
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { last_validated_at: result.checkedAt },
    });
  }

  return result;
}

async function validateMetaReadAccess(
  credential: DecryptedIntegrationCredential,
  fetcher: FetchLike,
): Promise<ReadAccessValidationResult> {
  const accessToken = credential.secrets.accessToken;
  const adAccountId = normalizeMetaAdAccountId(credential.secrets.adAccountId);
  const version = credential.secrets.graphApiVersion || 'v25.0';

  if (!accessToken || !adAccountId) {
    return validationResult('meta_analytics', 'requires_credentials', {
      message: 'Meta read validation requires accessToken and adAccountId.',
      requiredActions: ['Save a customer-owned Meta access token and ad account ID.'],
    });
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 7);
  const url = new URL(`https://graph.facebook.com/${version}/${adAccountId}/insights`);
  url.searchParams.set('fields', 'date_start,date_stop,impressions,reach,clicks,spend,actions');
  url.searchParams.set('time_range', JSON.stringify({
    since: toDateOnly(startDate),
    until: toDateOnly(endDate),
  }));

  try {
    const response = await fetcher(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return validationResult('meta_analytics', 'failed', {
        message: `Meta read validation failed with HTTP ${response.status}.`,
        requiredActions: ['Confirm the token has ads_read permission and the ad account ID belongs to the customer.'],
        evidence: { providerEndpoint: 'Meta Marketing API insights' },
      });
    }
    const payload = await response.json();
    const rows = readArrayPayload(payload, 'data');
    const labels = rows.length ? Object.keys(rows[0]).filter(key => key !== 'actions') : [];
    return validationResult('meta_analytics', 'validated', {
      message: rows.length
        ? `Meta read access validated with ${rows.length} insight row(s).`
        : 'Meta read access validated, but no insight rows were returned for the last 7 days.',
      requiredActions: rows.length ? [] : ['Select an active ad account/date range before importing event KPI data.'],
      evidence: {
        rowsFound: rows.length,
        metricLabels: labels,
        accountReference: adAccountId,
        providerEndpoint: 'Meta Marketing API insights',
      },
    });
  } catch {
    return validationResult('meta_analytics', 'failed', {
      message: 'Meta read validation failed before a usable response was returned.',
      requiredActions: ['Check network access, token validity, and Meta app permissions.'],
      evidence: { providerEndpoint: 'Meta Marketing API insights' },
    });
  }
}

async function validateYouTubeReadAccess(
  credential: DecryptedIntegrationCredential,
  fetcher: FetchLike,
): Promise<ReadAccessValidationResult> {
  const accessToken = credential.secrets.accessToken || credential.secrets.apiKey;
  const channelId = credential.secrets.channelId;
  if (!accessToken || !channelId) {
    return validationResult('youtube_analytics', 'requires_credentials', {
      message: 'YouTube read validation requires accessToken and channelId.',
      requiredActions: ['Save a customer-owned YouTube OAuth token and channel ID.'],
    });
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 7);
  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  url.searchParams.set('ids', `channel==${channelId}`);
  url.searchParams.set('startDate', toDateOnly(startDate));
  url.searchParams.set('endDate', toDateOnly(endDate));
  url.searchParams.set('metrics', 'views,estimatedMinutesWatched,likes,comments,shares');
  url.searchParams.set('dimensions', 'day');
  url.searchParams.set('sort', 'day');

  try {
    const response = await fetcher(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return validationResult('youtube_analytics', 'failed', {
        message: `YouTube read validation failed with HTTP ${response.status}.`,
        requiredActions: ['Confirm the token has YouTube Analytics read scope and the channel ID belongs to the customer.'],
        evidence: { providerEndpoint: 'YouTube Analytics reports.query' },
      });
    }
    const payload = await response.json();
    const rows = readArrayPayload(payload, 'rows');
    const columns = readArrayPayload(payload, 'columnHeaders')
      .map(item => typeof item.name === 'string' ? item.name : null)
      .filter((item): item is string => Boolean(item));
    return validationResult('youtube_analytics', 'validated', {
      message: rows.length
        ? `YouTube read access validated with ${rows.length} analytics row(s).`
        : 'YouTube read access validated, but no analytics rows were returned for the last 7 days.',
      requiredActions: rows.length ? [] : ['Select a channel/date range with recent activity before importing event KPI data.'],
      evidence: {
        rowsFound: rows.length,
        metricLabels: columns,
        accountReference: channelId,
        providerEndpoint: 'YouTube Analytics reports.query',
      },
    });
  } catch {
    return validationResult('youtube_analytics', 'failed', {
      message: 'YouTube read validation failed before a usable response was returned.',
      requiredActions: ['Check network access, token validity, and YouTube Analytics API permissions.'],
      evidence: { providerEndpoint: 'YouTube Analytics reports.query' },
    });
  }
}

function validateFormalooReadAccess(
  credential: DecryptedIntegrationCredential,
): ReadAccessValidationResult {
  const hasCredential = Boolean(
    (credential.secrets.clientKey && credential.secrets.clientSecret && credential.secrets.formId)
    || (credential.secrets.apiKey && credential.secrets.formId),
  );
  if (!hasCredential) {
    return validationResult('formaloo', 'requires_credentials', {
      message: 'Formaloo setup requires clientKey, clientSecret, and formId.',
      requiredActions: ['Save the customer-owned Formaloo client key, client secret, and form ID.'],
    });
  }

  return validationResult('formaloo', 'requires_provider_contract', {
    message: 'Formaloo credentials are stored, but live read validation is waiting for the exact customer Formaloo API contract.',
    requiredActions: [
      'Confirm the customer Formaloo workspace API method for reading form submissions.',
      'Provide a test form with safe sample submissions before enabling connector imports.',
    ],
    evidence: {
      rowsFound: 0,
      metricLabels: ['form submissions', 'completion rate', 'lead fields'],
      accountReference: credential.secrets.formId,
      providerEndpoint: 'Formaloo API contract pending confirmation',
    },
  });
}

function validationResult(
  providerId: ReadValidationProviderId,
  status: ReadAccessValidationResult['status'],
  options: {
    message: string;
    requiredActions: string[];
    evidence?: ReadAccessValidationResult['evidence'];
  },
): ReadAccessValidationResult {
  return {
    providerId,
    displayName: PROVIDER_METADATA[providerId].displayName,
    status,
    message: options.message,
    requiredActions: options.requiredActions,
    checkedAt: new Date(),
    readOnly: true,
    externalWritesAllowed: false,
    rawSecretsReturned: false,
    rawPayloadReturned: false,
    evidence: options.evidence ?? {},
  };
}

function normalizeMetaAdAccountId(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function readArrayPayload(payload: unknown, key: string): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const value = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> =>
    Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}
