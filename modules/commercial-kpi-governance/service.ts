import { auditLog } from '@shared/logging';
import { checkKpiGovernancePermission } from './policy';
import * as repo from './repository';
import type {
  AmendKpiTargetInput,
  CreateKpiTargetInput,
  EventCapacityInput,
  ListKpiTargetsInput,
  TransitionKpiTargetInput,
  UpdateKpiTargetInput,
} from './types';

export async function listTargets(role: string, tenantKey: string, input: ListKpiTargetsInput) {
  checkKpiGovernancePermission(role, 'commercial-kpi:read');
  return repo.listTargets(tenantKey, input);
}

export async function listEffectiveEventTargets(
  role: string,
  tenantKey: string,
  eventId: string,
) {
  checkKpiGovernancePermission(role, 'commercial-kpi:read');
  return repo.listEffectiveEventTargets(tenantKey, eventId);
}

export async function evaluateEventTargets(
  role: string,
  tenantKey: string,
  eventId: string,
) {
  checkKpiGovernancePermission(role, 'commercial-kpi:read');
  return repo.evaluateEventTargets(tenantKey, eventId);
}

export async function createTarget(
  role: string,
  tenantKey: string,
  userId: string,
  input: CreateKpiTargetInput,
) {
  checkKpiGovernancePermission(role, 'commercial-kpi:create');
  const result = await repo.createTarget(tenantKey, userId, input);
  log(userId, 'commercial_kpi_target_created', String(result.id));
  return result;
}

export async function updateTarget(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateKpiTargetInput,
) {
  checkKpiGovernancePermission(role, 'commercial-kpi:update');
  return repo.updateTarget(tenantKey, userId, id, input);
}

export async function transitionTarget(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: TransitionKpiTargetInput,
) {
  checkKpiGovernancePermission(
    role,
    input.action === 'approve' ? 'commercial-kpi:approve' : 'commercial-kpi:submit',
  );
  return repo.transitionTarget(tenantKey, userId, id, input);
}

export async function amendTarget(
  role: string,
  tenantKey: string,
  userId: string,
  id: string,
  input: AmendKpiTargetInput,
) {
  checkKpiGovernancePermission(role, 'commercial-kpi:amend');
  return repo.amendApprovedTarget(tenantKey, userId, id, input);
}

export async function getEventCapacity(role: string, tenantKey: string, eventId: string) {
  checkKpiGovernancePermission(role, 'commercial-kpi:read');
  return repo.getEventCapacity(tenantKey, eventId);
}

export async function setEventCapacity(
  role: string,
  tenantKey: string,
  userId: string,
  eventId: string,
  input: EventCapacityInput,
) {
  checkKpiGovernancePermission(role, 'commercial-kpi:capacity');
  return repo.setEventCapacity(tenantKey, userId, eventId, input);
}

function log(userId: string, action: string, objectId: string): void {
  auditLog(
    {
      actor: `user:${userId}`,
      action,
      object_type: 'commercial_kpi_target',
      object_id: objectId,
      result: 'success',
    },
    action,
  );
}
