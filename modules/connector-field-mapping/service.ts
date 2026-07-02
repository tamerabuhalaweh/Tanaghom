import { checkFieldMappingPermission } from './policy';
import * as repo from './repository';
import type {
  CreateFieldMappingInput, UpdateFieldMappingInput, FieldMappingSummary,
} from './types';

export async function listMappings(role: string, tenantKey: string, connectorId?: string): Promise<FieldMappingSummary[]> {
  checkFieldMappingPermission(role, 'mapping:read');
  return repo.listMappings(tenantKey, connectorId);
}

export async function getMapping(role: string, tenantKey: string, id: string): Promise<FieldMappingSummary> {
  checkFieldMappingPermission(role, 'mapping:read');
  return repo.getMappingById(tenantKey, id);
}

export async function createMapping(
  role: string, tenantKey: string, userId: string, input: CreateFieldMappingInput,
): Promise<FieldMappingSummary> {
  checkFieldMappingPermission(role, 'mapping:create');
  return repo.createMapping(tenantKey, userId, input);
}

export async function updateMapping(
  role: string, tenantKey: string, userId: string, id: string, input: UpdateFieldMappingInput,
): Promise<FieldMappingSummary> {
  checkFieldMappingPermission(role, 'mapping:update');
  return repo.updateMapping(tenantKey, id, userId, input);
}

export async function deleteMapping(role: string, tenantKey: string, id: string, userId: string): Promise<void> {
  checkFieldMappingPermission(role, 'mapping:delete');
  return repo.deleteMapping(tenantKey, id, userId);
}
