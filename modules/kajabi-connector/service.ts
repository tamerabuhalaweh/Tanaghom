import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { requireCredentialAdmin, getActiveIntegrationCredential, type DecryptedIntegrationCredential } from '../integration-credentials/service';
import { checkReadinessPermission } from '../connector-readiness/policy';
import {
  KAJABI_BASE_URL,
  KAJABI_SOURCE_LINKS,
  KAJABI_SUPPORTED_ENTITIES,
  type KajabiConnectorStatus,
} from './types';

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<FetchResponseLike>;

const PROVIDER_ENDPOINT = 'Kajabi Public API purchases';

export async function getKajabiStatus(role: string, tenantKey: string): Promise<KajabiConnectorStatus> {
  checkReadinessPermission(role);
  const credential = await findKajabiCredentialState(tenantKey);
  const readSyncEnabled = process.env.KAJABI_READ_SYNC_ENABLED === 'true';
  if (!credential.configured) {
    return buildStatus('requires_credentials', {
      credentialStatus: 'missing',
      readSyncEnabled,
      requiredActions: [
        'Ask the customer to enable Kajabi Public API access on their Kajabi plan.',
        'Save the customer-owned Kajabi client ID and client secret in Connector Setup.',
      ],
    });
  }

  if (!readSyncEnabled) {
    return buildStatus('blocked_by_environment', {
      credentialStatus: credential.validated ? 'validated' : 'configured',
      readSyncEnabled,
      requiredActions: [
        'Kajabi credentials are saved.',
        'Enable KAJABI_READ_SYNC_ENABLED=true only after customer approval and acceptance testing.',
      ],
    });
  }

  return buildStatus(credential.validated ? 'validated' : 'configured', {
    credentialStatus: credential.validated ? 'validated' : 'configured',
    readSyncEnabled,
    requiredActions: credential.validated
      ? ['Run a read-only Kajabi import preview for course revenue dashboards when the customer is ready.']
      : ['Run Kajabi read-access validation before importing course revenue signals.'],
  });
}

export async function validateKajabiReadAccess(
  role: string,
  tenantKey: string,
  userId: string,
): Promise<KajabiConnectorStatus> {
  requireCredentialAdmin(role);
  return validateKajabiReadAccessInternal(tenantKey, userId);
}

export async function validateKajabiReadAccessInternal(
  tenantKey: string,
  userId: string,
  fetcher: FetchLike = fetch as unknown as FetchLike,
): Promise<KajabiConnectorStatus> {
  const readSyncEnabled = process.env.KAJABI_READ_SYNC_ENABLED === 'true';
  const credential = await getActiveIntegrationCredential('kajabi', 'oauth_client', tenantKey);
  if (!credential) {
    return buildStatus('requires_credentials', {
      credentialStatus: 'missing',
      readSyncEnabled,
      requiredActions: ['Save the customer-owned Kajabi client ID and client secret before validation.'],
    });
  }

  const clientId = credential.secrets.clientId;
  const clientSecret = credential.secrets.clientSecret;
  if (!clientId || !clientSecret) {
    return buildStatus('requires_credentials', {
      credentialStatus: 'configured',
      readSyncEnabled,
      requiredActions: ['Kajabi validation requires both clientId and clientSecret.'],
    });
  }

  if (!readSyncEnabled) {
    await recordKajabiValidationAudit(userId, credential, 'blocked', 'Kajabi read validation blocked by environment flag.');
    return buildStatus('blocked_by_environment', {
      credentialStatus: 'configured',
      readSyncEnabled,
      requiredActions: ['Enable KAJABI_READ_SYNC_ENABLED=true after customer approval to run read-only validation.'],
    });
  }

  const baseUrl = normalizeBaseUrl(credential.secrets.baseUrl);
  try {
    const tokenResponse = await fetcher(`${baseUrl}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      await recordKajabiValidationAudit(userId, credential, 'failure', `Kajabi token request failed with HTTP ${tokenResponse.status}.`);
      return buildStatus('failed', {
        credentialStatus: 'configured',
        readSyncEnabled,
        requiredActions: ['Confirm Kajabi Public API is enabled and the customer client ID/secret are correct.'],
        evidence: { tokenAccepted: false, providerEndpoint: 'Kajabi OAuth token' },
      });
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = readString(tokenPayload, 'access_token');
    if (!accessToken) {
      await recordKajabiValidationAudit(userId, credential, 'failure', 'Kajabi token response did not include an access token.');
      return buildStatus('failed', {
        credentialStatus: 'configured',
        readSyncEnabled,
        requiredActions: ['Confirm the Kajabi token response contract for this customer account.'],
        evidence: { tokenAccepted: false, providerEndpoint: 'Kajabi OAuth token' },
      });
    }

    const purchasesUrl = `${baseUrl}/v1/purchases?page[number]=1&page[size]=1`;
    const purchasesResponse = await fetcher(purchasesUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!purchasesResponse.ok) {
      await recordKajabiValidationAudit(userId, credential, 'failure', `Kajabi purchases read failed with HTTP ${purchasesResponse.status}.`);
      return buildStatus('failed', {
        credentialStatus: 'configured',
        readSyncEnabled,
        requiredActions: ['Confirm the customer API client can read purchases and course revenue objects.'],
        evidence: { tokenAccepted: true, purchasesEndpointChecked: true, providerEndpoint: PROVIDER_ENDPOINT },
      });
    }

    const purchasesPayload = await purchasesResponse.json();
    const rowsFound = readArray(purchasesPayload, 'data').length;
    await prisma.integrationCredential.update({
      where: { id: credential.id },
      data: { last_validated_at: new Date() },
    });
    await recordKajabiValidationAudit(userId, credential, 'success', `Kajabi read validation completed with ${rowsFound} purchase row(s).`);

    return buildStatus('validated', {
      credentialStatus: 'validated',
      readSyncEnabled,
      requiredActions: rowsFound
        ? ['Use Kajabi purchase signals in course revenue dashboards after import mapping is approved.']
        : ['Kajabi read access works, but no purchase rows were returned for the first page. Confirm the customer has recent course purchases before import.'],
      evidence: {
        tokenAccepted: true,
        purchasesEndpointChecked: true,
        rowsFound,
        providerEndpoint: PROVIDER_ENDPOINT,
      },
    });
  } catch {
    await recordKajabiValidationAudit(userId, credential, 'failure', 'Kajabi validation failed before a usable response was returned.');
    return buildStatus('failed', {
      credentialStatus: 'configured',
      readSyncEnabled,
      requiredActions: ['Check network access, Kajabi API availability, and customer credential validity.'],
      evidence: { providerEndpoint: PROVIDER_ENDPOINT },
    });
  }
}

async function findKajabiCredentialState(tenantKey: string): Promise<{ configured: boolean; validated: boolean }> {
  const credential = await prisma.integrationCredential.findFirst({
    where: {
      tenant_key: tenantKey,
      provider: 'kajabi',
      credential_type: 'oauth_client',
      connection_key: 'default',
      is_active: true,
    },
    select: { id: true, last_validated_at: true },
  });
  return { configured: Boolean(credential), validated: Boolean(credential?.last_validated_at) };
}

function buildStatus(
  status: KajabiConnectorStatus['status'],
  options: {
    credentialStatus: KajabiConnectorStatus['credentialStatus'];
    readSyncEnabled: boolean;
    requiredActions: string[];
    evidence?: KajabiConnectorStatus['evidence'];
  },
): KajabiConnectorStatus {
  return {
    provider: 'kajabi',
    displayName: 'Kajabi Course Platform',
    role: 'course_sales_source',
    status,
    credentialStatus: options.credentialStatus,
    readSyncEnabled: options.readSyncEnabled,
    supportedEntities: [...KAJABI_SUPPORTED_ENTITIES],
    requiredCredentialFields: ['clientId', 'clientSecret'],
    optionalCredentialFields: ['baseUrl', 'siteId'],
    sourceLinks: [...KAJABI_SOURCE_LINKS],
    requiredActions: options.requiredActions,
    evidence: options.evidence ?? {},
    readOnly: true,
    externalWritesAllowed: false,
    rawSecretsReturned: false,
    rawPayloadReturned: false,
  };
}

async function recordKajabiValidationAudit(
  userId: string,
  credential: DecryptedIntegrationCredential,
  result: 'success' | 'failure' | 'blocked',
  reason: string,
): Promise<void> {
  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_readiness',
      action: 'kajabi_read_access_validated',
      result,
      human_user_id: userId,
      target_object_type: 'integration_credential',
      target_object_id: credential.id,
      reason,
      after_state: {
        provider: 'kajabi',
        readOnly: true,
        externalWritesAllowed: false,
        rawSecretsReturned: false,
        rawPayloadReturned: false,
      },
    },
  });
  auditLog(
    {
      actor: `user:${userId}`,
      action: 'kajabi_read_access_validated',
      object_type: 'integration_credential',
      object_id: credential.id,
      result,
    },
    reason,
  );
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : KAJABI_BASE_URL;
}

function readString(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return typeof record[key] === 'string' ? record[key] : '';
}

function readArray(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return Array.isArray(record[key]) ? record[key] : [];
}
