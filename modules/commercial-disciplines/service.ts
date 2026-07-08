import { auditLog } from '@shared/logging';
import { checkCommercialDisciplinePermission } from './policy';
import * as repo from './repository';
import type {
  CommercialDisciplineId,
  CreateDisciplineRecordInput,
  ListDisciplineRecordsQueryInput,
  UpdateDisciplineRecordInput,
} from './types';

export async function listWorkspaces(role: string, tenantKey: string) {
  checkCommercialDisciplinePermission(role, 'commercial:disciplines:read');
  return repo.listWorkspaces(tenantKey);
}

export async function listRecords(role: string, tenantKey: string, filters: ListDisciplineRecordsQueryInput) {
  checkCommercialDisciplinePermission(role, 'commercial:disciplines:read');
  return repo.listRecords(tenantKey, filters);
}

export async function createRecord(
  role: string,
  tenantKey: string,
  userId: string,
  input: CreateDisciplineRecordInput,
) {
  checkCommercialDisciplinePermission(role, 'commercial:disciplines:create');
  const record = await repo.createRecord(tenantKey, userId, input);
  auditLog(
    {
      actor: `user:${userId}`,
      action: 'commercial_discipline_record_created',
      object_type: 'commercial_discipline_record',
      object_id: record.id,
      result: 'success',
    },
    `Commercial discipline record created: ${record.title}`,
  );
  return record;
}

export async function updateRecord(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateDisciplineRecordInput,
) {
  checkCommercialDisciplinePermission(role, 'commercial:disciplines:update');
  const record = await repo.updateRecord(tenantKey, id, input);
  auditLog(
    {
      actor: `user:${userId}`,
      action: 'commercial_discipline_record_updated',
      object_type: 'commercial_discipline_record',
      object_id: record.id,
      result: 'success',
    },
    `Commercial discipline record updated: ${record.title}`,
  );
  return record;
}

export async function getWorkspaceContext(role: string, tenantKey: string, discipline?: CommercialDisciplineId) {
  checkCommercialDisciplinePermission(role, 'commercial:disciplines:read');
  return repo.getWorkspaceContext(tenantKey, discipline);
}
