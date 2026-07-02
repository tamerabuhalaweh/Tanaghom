import { checkReadinessPermission } from './policy';
import * as repo from './repository';
import type { EventConnectorReadiness } from './types';

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
