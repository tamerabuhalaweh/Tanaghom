import { checkGhlAttributionPermission } from './policy';
import * as repo from './repository';
import type {
  ApproveAttributionMappingInput,
  CreateAttributionMappingInput,
  ListAttributionMappingsInput,
  PreviewAttributionMatchInput,
  UpdateAttributionMappingInput,
} from './types';

export async function listMappings(
  role: string,
  tenantKey: string,
  input: ListAttributionMappingsInput,
) {
  checkGhlAttributionPermission(role, 'ghl-attribution:read');
  return repo.listMappings(tenantKey, input);
}

export async function createMapping(
  role: string,
  tenantKey: string,
  userId: string,
  input: CreateAttributionMappingInput,
) {
  checkGhlAttributionPermission(role, 'ghl-attribution:create');
  return repo.createMapping(tenantKey, userId, input);
}

export async function updateMapping(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateAttributionMappingInput,
) {
  checkGhlAttributionPermission(role, 'ghl-attribution:update');
  return repo.updateMapping(tenantKey, userId, id, input);
}

export async function approveMapping(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: ApproveAttributionMappingInput,
) {
  checkGhlAttributionPermission(role, 'ghl-attribution:approve');
  return repo.approveMapping(tenantKey, userId, id, input);
}

export async function previewMatch(
  role: string,
  tenantKey: string,
  id: string,
  input: PreviewAttributionMatchInput,
) {
  checkGhlAttributionPermission(role, 'ghl-attribution:read');
  return repo.previewMatch(tenantKey, id, input);
}

