import { ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateDksEntryInput, UpdateDksEntryInput, LinkDecisionToDksInput,
  DksEntrySummary, DecisionDksLinkSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['dks:create', 'dks:read', 'dks:update', 'dks:link'],
  cco: ['dks:create', 'dks:read', 'dks:update', 'dks:link'],
  department_head: ['dks:create', 'dks:read', 'dks:update', 'dks:link'],
  specialist: ['dks:create', 'dks:read', 'dks:update'],
  reviewer: ['dks:read'],
  viewer: ['dks:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export async function createDksEntry(requesterRole: string, input: CreateDksEntryInput): Promise<DksEntrySummary> {
  checkPermission(requesterRole, 'dks:create');
  const entry = await repo.createDksEntry(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'dks_entry_created', object_type: 'dks_entry', object_id: entry.id, result: 'success' },
    `DKS entry created: ${entry.title}`,
  );

  return entry;
}

export async function getDksEntry(requesterRole: string, id: string): Promise<DksEntrySummary> {
  checkPermission(requesterRole, 'dks:read');
  return repo.getDksEntryById(id);
}

export async function listDksEntries(requesterRole: string, filters?: { sourceType?: string; owner?: string; tags?: string[] }): Promise<DksEntrySummary[]> {
  checkPermission(requesterRole, 'dks:read');
  return repo.listDksEntries(filters);
}

export async function updateDksEntry(requesterRole: string, id: string, input: UpdateDksEntryInput): Promise<DksEntrySummary> {
  checkPermission(requesterRole, 'dks:update');
  const entry = await repo.updateDksEntry(id, input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'dks_entry_updated', object_type: 'dks_entry', object_id: id, result: 'success' },
    `DKS entry updated: ${entry.title}`,
  );

  return entry;
}

export async function linkDecisionToDks(requesterRole: string, input: LinkDecisionToDksInput): Promise<DecisionDksLinkSummary> {
  checkPermission(requesterRole, 'dks:link');
  const link = await repo.linkDecisionToDks(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'decision_dks_linked', object_type: 'decision_dks_link', object_id: link.id, result: 'success' },
    `Decision ${link.decisionId} linked to DKS entry ${link.dksEntryId}`,
  );

  return link;
}

export async function getDksLinksForDecision(requesterRole: string, decisionId: string): Promise<DecisionDksLinkSummary[]> {
  checkPermission(requesterRole, 'dks:read');
  return repo.getDksLinksForDecision(decisionId);
}
