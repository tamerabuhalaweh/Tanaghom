import { ForbiddenError } from '@shared/errors';
import { auditLog, createIdentityLineage } from '@shared/logging';
import * as repo from './repository';
import type {
  CreateDecisionInput, UpdateDecisionInput, CreateRoleAssignmentInput,
  CreateEvaluationInput, CreateExecutionHandoffInput,
  DecisionSummary, RoleAssignmentSummary, EvaluationSummary, ExecutionHandoffSummary,
} from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:assign_role', 'decisions:evaluate', 'decisions:execute'],
  cco: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:assign_role', 'decisions:evaluate', 'decisions:execute'],
  department_head: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:assign_role', 'decisions:evaluate'],
  specialist: ['decisions:create', 'decisions:read', 'decisions:update', 'decisions:evaluate'],
  reviewer: ['decisions:read', 'decisions:evaluate'],
  viewer: ['decisions:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export async function createDecision(requesterRole: string, input: CreateDecisionInput): Promise<DecisionSummary> {
  checkPermission(requesterRole, 'decisions:create');
  const decision = await repo.createDecision(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'decision_created', object_type: 'saif_decision', object_id: decision.id, result: 'success' },
    `Decision created: ${decision.title}`,
  );

  createIdentityLineage(
    input.humanUserId,
    input.agentRepId,
    'human',
    null,
    'create_decision',
    'saif_decision',
    decision.id,
    'success',
    { title: decision.title, scope: decision.decisionScope },
  );

  return decision;
}

export async function getDecision(requesterRole: string, id: string): Promise<DecisionSummary> {
  checkPermission(requesterRole, 'decisions:read');
  return repo.getDecisionById(id);
}

export async function listDecisions(requesterRole: string, filters?: { status?: string; humanUserId?: string; agentRepId?: string }): Promise<DecisionSummary[]> {
  checkPermission(requesterRole, 'decisions:read');
  return repo.listDecisions(filters);
}

export async function updateDecision(requesterRole: string, id: string, input: UpdateDecisionInput): Promise<DecisionSummary> {
  checkPermission(requesterRole, 'decisions:update');
  const decision = await repo.updateDecision(id, input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'decision_updated', object_type: 'saif_decision', object_id: id, result: 'success' },
    `Decision updated: ${decision.title} -> ${decision.status}`,
  );

  return decision;
}

export async function createRoleAssignment(requesterRole: string, input: CreateRoleAssignmentInput): Promise<RoleAssignmentSummary> {
  checkPermission(requesterRole, 'decisions:assign_role');
  const assignment = await repo.createRoleAssignment(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'decision_role_assigned', object_type: 'decision_role', object_id: assignment.id, result: 'success' },
    `Role ${assignment.role} assigned to decision ${assignment.decisionId}`,
  );

  return assignment;
}

export async function createEvaluation(requesterRole: string, input: CreateEvaluationInput): Promise<EvaluationSummary> {
  checkPermission(requesterRole, 'decisions:evaluate');
  const evaluation = await repo.createEvaluation(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'decision_evaluated', object_type: 'decision_evaluation', object_id: evaluation.id, result: 'success' },
    `Evaluation: ${evaluation.dimension} rated ${evaluation.rating} for decision ${evaluation.decisionId}`,
  );

  return evaluation;
}

export async function markExecutionReady(requesterRole: string, decisionId: string): Promise<DecisionSummary> {
  checkPermission(requesterRole, 'decisions:execute');
  const decision = await repo.markExecutionReady(decisionId);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'decision_execution_ready', object_type: 'saif_decision', object_id: decisionId, result: 'success' },
    `Decision marked execution_ready: ${decision.title}`,
  );

  return decision;
}

export async function createExecutionHandoff(requesterRole: string, input: CreateExecutionHandoffInput): Promise<ExecutionHandoffSummary> {
  checkPermission(requesterRole, 'decisions:execute');
  const handoff = await repo.createExecutionHandoff(input);

  auditLog(
    { actor: `role:${requesterRole}`, action: 'execution_handoff_created', object_type: 'execution_handoff', object_id: handoff.id, result: 'success' },
    `Execution handoff created for decision ${handoff.decisionId}`,
  );

  return handoff;
}

export async function validateCriticalDimensions(requesterRole: string, decisionId: string): Promise<{ valid: boolean; missing: string[] }> {
  checkPermission(requesterRole, 'decisions:read');
  return repo.validateCriticalDimensions(decisionId);
}
