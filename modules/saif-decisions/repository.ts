import { prisma } from '@shared/database';
import { NotFoundError, ForbiddenError } from '@shared/errors';
import type {
  CreateDecisionInput, UpdateDecisionInput, CreateRoleAssignmentInput,
  CreateEvaluationInput, CreateExecutionHandoffInput,
  DecisionSummary, RoleAssignmentSummary, EvaluationSummary, ExecutionHandoffSummary,
  EvaluationDimension,
} from './types';
import { CRITICAL_DIMENSIONS } from './types';

export async function createDecision(input: CreateDecisionInput): Promise<DecisionSummary> {
  const decision = await prisma.saifDecisionRecord.create({
    data: {
      title: input.title,
      description: input.description,
      decision_scope: input.decisionScope,
      complexity: input.complexity,
      parent_decision_id: input.parentDecisionId,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      authority_user_id: input.authorityUserId,
      authority_agent_rep_id: input.authorityAgentRepId,
      rationale: input.rationale,
      alternatives_considered: input.alternativesConsidered,
      confidence: input.confidence,
      risk_acceptance: input.riskAcceptance,
      success_criteria: input.successCriteria,
    },
    include: {
      roles: true,
      evaluations: true,
      execution_handoff: true,
      child_decisions: true,
    },
  });
  return mapDecision(decision);
}

export async function getDecisionById(id: string): Promise<DecisionSummary> {
  const decision = await prisma.saifDecisionRecord.findUnique({
    where: { id },
    include: {
      roles: true,
      evaluations: true,
      execution_handoff: true,
      child_decisions: {
        include: { roles: true, evaluations: true, execution_handoff: true, child_decisions: true },
      },
    },
  });
  if (!decision) throw new NotFoundError('SaifDecisionRecord', id);
  return mapDecision(decision);
}

export async function listDecisions(filters?: { status?: string; humanUserId?: string; agentRepId?: string }): Promise<DecisionSummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.humanUserId) where.human_user_id = filters.humanUserId;
  if (filters?.agentRepId) where.agent_rep_id = filters.agentRepId;

  const decisions = await prisma.saifDecisionRecord.findMany({
    where,
    include: {
      roles: true,
      evaluations: true,
      execution_handoff: true,
      child_decisions: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return decisions.map(mapDecision);
}

export async function updateDecision(id: string, input: UpdateDecisionInput): Promise<DecisionSummary> {
  const existing = await prisma.saifDecisionRecord.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SaifDecisionRecord', id);

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.decisionScope !== undefined) data.decision_scope = input.decisionScope;
  if (input.complexity !== undefined) data.complexity = input.complexity;
  if (input.status !== undefined) data.status = input.status;
  if (input.authorityUserId !== undefined) data.authority_user_id = input.authorityUserId;
  if (input.authorityAgentRepId !== undefined) data.authority_agent_rep_id = input.authorityAgentRepId;
  if (input.rationale !== undefined) data.rationale = input.rationale;
  if (input.alternativesConsidered !== undefined) data.alternatives_considered = input.alternativesConsidered;
  if (input.confidence !== undefined) data.confidence = input.confidence;
  if (input.riskAcceptance !== undefined) data.risk_acceptance = input.riskAcceptance;
  if (input.executionReadiness !== undefined) data.execution_readiness = input.executionReadiness;
  if (input.successCriteria !== undefined) data.success_criteria = input.successCriteria;

  const decision = await prisma.saifDecisionRecord.update({
    where: { id },
    data,
    include: {
      roles: true,
      evaluations: true,
      execution_handoff: true,
      child_decisions: true,
    },
  });
  return mapDecision(decision);
}

export async function createRoleAssignment(input: CreateRoleAssignmentInput): Promise<RoleAssignmentSummary> {
  const assignment = await prisma.decisionRoleAssignment.create({
    data: {
      decision_id: input.decisionId,
      role: input.role,
      human_user_id: input.humanUserId,
      agent_rep_id: input.agentRepId,
      functional_agent_id: input.functionalAgentId,
      governance_agent_id: input.governanceAgentId,
    },
  });
  return mapRoleAssignment(assignment);
}

export async function createEvaluation(input: CreateEvaluationInput): Promise<EvaluationSummary> {
  const evaluation = await prisma.decisionEvaluation.create({
    data: {
      decision_id: input.decisionId,
      dimension: input.dimension,
      rating: input.rating,
      assessment: input.assessment,
      notes: input.notes,
      mitigation: input.mitigation,
      evaluated_by: input.evaluatedBy,
    },
  });
  return mapEvaluation(evaluation);
}

export async function validateCriticalDimensions(decisionId: string): Promise<{ valid: boolean; missing: EvaluationDimension[] }> {
  const evaluations = await prisma.decisionEvaluation.findMany({
    where: {
      decision_id: decisionId,
      dimension: { in: CRITICAL_DIMENSIONS as unknown as ('security_posture' | 'human_oversight' | 'compliance')[] },
    },
  });

  const evaluatedDimensions = evaluations.map(e => e.dimension as EvaluationDimension);
  const missing = CRITICAL_DIMENSIONS.filter(d => !evaluatedDimensions.includes(d));

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  const negativeCritical = evaluations.filter(
    e => CRITICAL_DIMENSIONS.includes(e.dimension as EvaluationDimension) && e.rating === 'negative' && !e.mitigation
  );

  if (negativeCritical.length > 0) {
    return { valid: false, missing: negativeCritical.map(e => e.dimension as EvaluationDimension) };
  }

  return { valid: true, missing: [] };
}

export async function markExecutionReady(decisionId: string): Promise<DecisionSummary> {
  const { valid, missing } = await validateCriticalDimensions(decisionId);
  if (!valid) {
    throw new ForbiddenError(
      `Cannot mark execution_ready: critical dimensions missing or negatively rated without mitigation: ${missing.join(', ')}`
    );
  }

  return updateDecision(decisionId, { executionReadiness: true, status: 'execution_ready' });
}

export async function createExecutionHandoff(input: CreateExecutionHandoffInput): Promise<ExecutionHandoffSummary> {
  const handoff = await prisma.decisionExecutionHandoff.create({
    data: {
      decision_id: input.decisionId,
      implementation_spec: input.implementationSpec,
      constraints: input.constraints,
      acceptance_criteria: input.acceptanceCriteria,
      expected_outcome: input.expectedOutcome,
      handoff_to_agent_rep_id: input.handoffToAgentRepId,
    },
  });
  return mapExecutionHandoff(handoff);
}

function mapDecision(d: Record<string, unknown>): DecisionSummary {
  return {
    id: d.id as string,
    title: d.title as string,
    description: d.description as string | null,
    decisionScope: d.decision_scope as string,
    complexity: d.complexity as string | null,
    status: d.status as DecisionSummary['status'],
    parentDecisionId: d.parent_decision_id as string | null,
    humanUserId: d.human_user_id as string,
    agentRepId: d.agent_rep_id as string,
    authorityUserId: d.authority_user_id as string | null,
    authorityAgentRepId: d.authority_agent_rep_id as string | null,
    rationale: d.rationale as string | null,
    alternativesConsidered: d.alternatives_considered as string | null,
    confidence: d.confidence as string,
    riskAcceptance: d.risk_acceptance as string | null,
    executionReadiness: d.execution_readiness as boolean,
    successCriteria: d.success_criteria as string | null,
    createdAt: d.created_at as Date,
    updatedAt: d.updated_at as Date,
    roles: (d.roles as Record<string, unknown>[] || []).map(mapRoleAssignment),
    evaluations: (d.evaluations as Record<string, unknown>[] || []).map(mapEvaluation),
    executionHandoff: d.execution_handoff ? mapExecutionHandoff(d.execution_handoff as Record<string, unknown>) : null,
    childDecisions: (d.child_decisions as Record<string, unknown>[] || []).map(mapDecision),
  };
}

function mapRoleAssignment(r: Record<string, unknown>): RoleAssignmentSummary {
  return {
    id: r.id as string,
    decisionId: r.decision_id as string,
    role: r.role as RoleAssignmentSummary['role'],
    humanUserId: r.human_user_id as string | null,
    agentRepId: r.agent_rep_id as string | null,
    functionalAgentId: r.functional_agent_id as string | null,
    governanceAgentId: r.governance_agent_id as string | null,
    assignedAt: r.assigned_at as Date,
  };
}

function mapEvaluation(e: Record<string, unknown>): EvaluationSummary {
  return {
    id: e.id as string,
    decisionId: e.decision_id as string,
    dimension: e.dimension as EvaluationSummary['dimension'],
    rating: e.rating as EvaluationSummary['rating'],
    assessment: e.assessment as string | null,
    notes: e.notes as string | null,
    mitigation: e.mitigation as string | null,
    evaluatedBy: e.evaluated_by as string | null,
    evaluatedAt: e.evaluated_at as Date,
  };
}

function mapExecutionHandoff(h: Record<string, unknown>): ExecutionHandoffSummary {
  return {
    id: h.id as string,
    decisionId: h.decision_id as string,
    implementationSpec: h.implementation_spec as string | null,
    constraints: h.constraints as string | null,
    acceptanceCriteria: h.acceptance_criteria as string | null,
    expectedOutcome: h.expected_outcome as string | null,
    handoffStatus: h.handoff_status as ExecutionHandoffSummary['handoffStatus'],
    handoffToAgentRepId: h.handoff_to_agent_rep_id as string | null,
    acknowledgedAt: h.acknowledged_at as Date | null,
    createdAt: h.created_at as Date,
  };
}
