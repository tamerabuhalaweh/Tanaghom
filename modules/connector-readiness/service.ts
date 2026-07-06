import { checkReadinessPermission } from './policy';
import * as repo from './repository';
import { requireCredentialAdmin } from '../integration-credentials/service';
import type { EventConnectorReadiness, ReadAccessValidationResult, ReadValidationProviderId } from './types';

export async function getEventConnectorReadiness(
  role: string, tenantKey: string, eventId: string,
): Promise<EventConnectorReadiness> {
  checkReadinessPermission(role);
  return repo.getEventConnectorReadiness(tenantKey, eventId);
}

export async function getGlobalConnectorReadiness(
  role: string, tenantKey: string,
) {
  checkReadinessPermission(role);
  return repo.getGlobalConnectorReadiness(tenantKey);
}

export async function validateProviderReadAccess(
  role: string,
  tenantKey: string,
  userId: string,
  providerId: ReadValidationProviderId,
): Promise<ReadAccessValidationResult> {
  requireCredentialAdmin(role);
  return repo.validateProviderReadAccess(tenantKey, userId, providerId);
}
