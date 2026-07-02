import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type {
  CredentialState, ProviderReadiness, EventConnectorReadiness,
} from './types';
import { PROVIDER_IDS, PROVIDER_METADATA } from './types';

async function resolveCredentialState(tenantKey: string, providerId: string): Promise<CredentialState> {
  const credential = await prisma.integrationCredential.findFirst({
    where: { tenant_key: tenantKey, provider: providerId, is_active: true },
    select: { id: true, last_validated_at: true },
  });

  if (!credential) return 'missing';
  if (credential.last_validated_at) return 'validated';
  return 'configured';
}

async function hasMapping(tenantKey: string, providerId: string): Promise<boolean> {
  const mapping = await prisma.connectorFieldMapping.findFirst({
    where: { tenant_key: tenantKey, connector_id: providerId },
    select: { id: true },
  });
  return !!mapping;
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
    const mappingExists = await hasMapping(tenantKey, providerId);

    let writeBackStatus: ProviderReadiness['writeBackStatus'] = 'not_supported';
    let writeBackBlocker: string | null = null;
    if (meta.writeBackSupported) {
      writeBackStatus = 'available';
    } else {
      writeBackStatus = 'blocked';
      writeBackBlocker = meta.writeBackBlocker;
    }

    let nextAction: string;
    if (credentialState === 'missing') {
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
    const mappingExists = await hasMapping(tenantKey, providerId);

    let writeBackStatus: ProviderReadiness['writeBackStatus'] = 'not_supported';
    let writeBackBlocker: string | null = null;
    if (meta.writeBackSupported) {
      writeBackStatus = 'available';
    } else {
      writeBackStatus = 'blocked';
      writeBackBlocker = meta.writeBackBlocker;
    }

    let nextAction: string;
    if (credentialState === 'missing') {
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
