import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { EVENT_PROBLEM_EVENTS, type ProblemEvent } from './events';
import { checkProblemPermission, checkProblemCategoryPermission } from './policy';
import { validateProblemTransition, type ProblemStatus } from './types';
import * as repo from './repository';
import type {
  CreateProblemInput, UpdateProblemInput, ProblemSummary,
  TransitionProblemInput, ProblemDashboardSummary,
} from './types';

export async function listProblems(
  role: string, tenantKey: string, eventId?: string, status?: ProblemStatus,
): Promise<ProblemSummary[]> {
  checkProblemPermission(role, 'problems:read');
  return repo.listProblems(tenantKey, eventId, status);
}

export async function getProblem(role: string, tenantKey: string, id: string): Promise<ProblemSummary> {
  checkProblemPermission(role, 'problems:read');
  return repo.getProblemById(tenantKey, id);
}

export async function createProblem(
  role: string, tenantKey: string, userId: string, input: CreateProblemInput,
): Promise<ProblemSummary> {
  checkProblemPermission(role, 'problems:create');
  checkProblemCategoryPermission(role, input.category);
  const problem = await repo.createProblem(tenantKey, userId, input);
  auditLog({ actor: `user:${userId}`, action: 'problem_created', object_type: 'event_problem', object_id: problem.id, result: 'success' }, `Problem created: ${problem.title}`);
  await eventBus.emit(EVENT_PROBLEM_EVENTS.PROBLEM_CREATED, { problemId: problem.id, tenantKey, eventId: input.eventId, actorUserId: userId, timestamp: new Date() } as ProblemEvent);
  return problem;
}

export async function updateProblem(
  role: string, tenantKey: string, userId: string, id: string, input: UpdateProblemInput,
): Promise<ProblemSummary> {
  checkProblemPermission(role, 'problems:update');
  if (input.category) checkProblemCategoryPermission(role, input.category);
  const problem = await repo.updateProblem(tenantKey, id, input);
  auditLog({ actor: `user:${userId}`, action: 'problem_updated', object_type: 'event_problem', object_id: id, result: 'success' }, `Problem updated: ${problem.title}`);
  await eventBus.emit(EVENT_PROBLEM_EVENTS.PROBLEM_UPDATED, { problemId: id, tenantKey, eventId: problem.eventId, actorUserId: userId, timestamp: new Date() } as ProblemEvent);
  return problem;
}

export async function transitionProblem(
  role: string, tenantKey: string, userId: string, id: string, input: TransitionProblemInput,
): Promise<ProblemSummary> {
  checkProblemPermission(role, 'problems:transition');
  const current = await repo.getProblemById(tenantKey, id);
  validateProblemTransition(current.status, input.toStatus);
  const problem = await repo.transitionProblem(tenantKey, id, input.toStatus, userId, input.resolutionNotes);
  auditLog({ actor: `user:${userId}`, action: 'problem_status_changed', object_type: 'event_problem', object_id: id, result: 'success' }, `Problem status: ${current.status} → ${input.toStatus}`);
  await eventBus.emit(EVENT_PROBLEM_EVENTS.PROBLEM_STATUS_CHANGED, { problemId: id, tenantKey, eventId: problem.eventId, actorUserId: userId, timestamp: new Date() } as ProblemEvent);
  return problem;
}

export async function getProblemDashboard(
  role: string, tenantKey: string, eventId: string,
): Promise<ProblemDashboardSummary> {
  checkProblemPermission(role, 'problems:dashboard');
  return repo.getProblemDashboard(tenantKey, eventId);
}
