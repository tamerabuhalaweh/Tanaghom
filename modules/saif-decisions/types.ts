import { z } from 'zod';

export const DECISION_STATUSES = [
  'draft', 'context_gathering', 'proposed', 'evaluating', 'authority_review',
  'accepted', 'rejected', 'deferred', 'execution_ready', 'superseded', 'audited'
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_ROLES = ['context', 'proposer', 'evaluator', 'authority'] as const;
export type DecisionRole = (typeof DECISION_ROLES)[number];

export const EVALUATION_DIMENSIONS = [
  'capability_impact', 'security_posture', 'cost', 'latency', 'maintainability',
  'reversibility', 'human_oversight', 'compliance', 'observability', 'learning_potential'
] as const;
export type EvaluationDimension = (typeof EVALUATION_DIMENSIONS)[number];

export const CRITICAL_DIMENSIONS: EvaluationDimension[] = [
  'security_posture', 'human_oversight', 'compliance'
];

export const RATING_VALUES = ['positive', 'neutral', 'negative'] as const;
export type RatingValue = (typeof RATING_VALUES)[number];

export const HANDOFF_STATUSES = ['pending', 'acknowledged', 'in_progress', 'completed', 'cancelled'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const createDecisionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  decisionScope: z.string().min(1).max(200),
  complexity: z.string().default('medium'),
  parentDecisionId: z.string().uuid().optional(),
  humanUserId: z.string().uuid(),
  agentRepId: z.string().uuid(),
  authorityUserId: z.string().uuid().optional(),
  authorityAgentRepId: z.string().uuid().optional(),
  rationale: z.string().max(5000).optional(),
  alternativesConsidered: z.string().max(5000).optional(),
  confidence: z.enum(['low', 'medium', 'high']).default('low'),
  riskAcceptance: z.string().max(5000).optional(),
  successCriteria: z.string().max(5000).optional(),
});

export const updateDecisionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  decisionScope: z.string().min(1).max(200).optional(),
  complexity: z.string().optional(),
  status: z.enum(DECISION_STATUSES).optional(),
  authorityUserId: z.string().uuid().nullable().optional(),
  authorityAgentRepId: z.string().uuid().nullable().optional(),
  rationale: z.string().max(5000).optional(),
  alternativesConsidered: z.string().max(5000).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  riskAcceptance: z.string().max(5000).optional(),
  executionReadiness: z.boolean().optional(),
  successCriteria: z.string().max(5000).optional(),
});

export const createRoleAssignmentSchema = z.object({
  decisionId: z.string().uuid(),
  role: z.enum(DECISION_ROLES),
  humanUserId: z.string().uuid().optional(),
  agentRepId: z.string().uuid().optional(),
  functionalAgentId: z.string().uuid().optional(),
  governanceAgentId: z.string().uuid().optional(),
});

export const createEvaluationSchema = z.object({
  decisionId: z.string().uuid(),
  dimension: z.enum(EVALUATION_DIMENSIONS),
  rating: z.enum(RATING_VALUES),
  assessment: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  mitigation: z.string().max(5000).optional(),
  evaluatedBy: z.string().uuid().optional(),
});

export const createExecutionHandoffSchema = z.object({
  decisionId: z.string().uuid(),
  implementationSpec: z.string().max(5000).optional(),
  constraints: z.string().max(5000).optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
  expectedOutcome: z.string().max(5000).optional(),
  handoffToAgentRepId: z.string().uuid().optional(),
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type UpdateDecisionInput = z.infer<typeof updateDecisionSchema>;
export type CreateRoleAssignmentInput = z.infer<typeof createRoleAssignmentSchema>;
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type CreateExecutionHandoffInput = z.infer<typeof createExecutionHandoffSchema>;

export interface DecisionSummary {
  id: string;
  title: string;
  description: string | null;
  decisionScope: string;
  complexity: string | null;
  status: DecisionStatus;
  parentDecisionId: string | null;
  humanUserId: string;
  agentRepId: string;
  authorityUserId: string | null;
  authorityAgentRepId: string | null;
  rationale: string | null;
  alternativesConsidered: string | null;
  confidence: string;
  riskAcceptance: string | null;
  executionReadiness: boolean;
  successCriteria: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: RoleAssignmentSummary[];
  evaluations: EvaluationSummary[];
  executionHandoff: ExecutionHandoffSummary | null;
  childDecisions: DecisionSummary[];
}

export interface RoleAssignmentSummary {
  id: string;
  decisionId: string;
  role: DecisionRole;
  humanUserId: string | null;
  agentRepId: string | null;
  functionalAgentId: string | null;
  governanceAgentId: string | null;
  assignedAt: Date;
}

export interface EvaluationSummary {
  id: string;
  decisionId: string;
  dimension: EvaluationDimension;
  rating: RatingValue;
  assessment: string | null;
  notes: string | null;
  mitigation: string | null;
  evaluatedBy: string | null;
  evaluatedAt: Date;
}

export interface ExecutionHandoffSummary {
  id: string;
  decisionId: string;
  implementationSpec: string | null;
  constraints: string | null;
  acceptanceCriteria: string | null;
  expectedOutcome: string | null;
  handoffStatus: HandoffStatus;
  handoffToAgentRepId: string | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}
