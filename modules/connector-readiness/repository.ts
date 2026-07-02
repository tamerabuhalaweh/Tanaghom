import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type {
  CredentialState, ProviderReadiness, EventConnectorReadiness,
} from './types';
import { PROVIDER_IDS, PROVIDER_METADATA } from './types';

const PROVIDER_CREDENTIAL_MAP: Record<string, { provider: string; credentialType?: string; connectionKey?: string }> = {
  meta_analytics: { provider: 'social_oauth', credentialType: 'oauth_client', connectionKey: 'meta' },
  youtube_analytics: { provider: 'youtube', credentialType: 'api_key', connectionKey: 'default' },
  formaloo: { provider: 'formaloo' },
  gohighlevel: { provider: 'gohighlevel' },
  whatsapp_provider: { provider: 'whatsapp' },
  telegram_provider: { provider: 'telegram' },
  smartlabs_voice: { provider: 'smartlabs_voice' },
  postiz: { provider: 'postiz' },
};

async function resolveCredentialState(tenantKey: string, providerId: string): Promise<CredentialState> {
  const mapping = PROVIDER_CREDENTIAL_MAP[providerId];
  if (!mapping) return 'missing';

  const where: Record<string, unknown> = {
    tenant_key: tenantKey,
    provider: mapping.provider,
    is_active: true,
  };
  if (mapping.credentialType) where.credential_type = mapping.credentialType;
  if (mapping.connectionKey) where.connection_key = mapping.connectionKey;

  const credential = await prisma.integrationCredential.findFirst({
    where,
    select: { id: true, last_validated_at: true },
  });

  if (!credential) return 'missing';
  if (credential.last_validated_at) return 'validated';
  return 'configured';
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
