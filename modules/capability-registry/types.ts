import { z } from 'zod';

export const INTENT_STATUSES = ['active', 'fulfilled', 'abandoned', 'superseded'] as const;
export type IntentStatus = (typeof INTENT_STATUSES)[number];

export const OBJECTIVE_STATUSES = ['active', 'achieved', 'failed', 'abandoned'] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const CAPABILITY_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type CapabilityRiskLevel = (typeof CAPABILITY_RISK_LEVELS)[number];

export const RESOLUTION_STATUSES = ['pending', 'resolved', 'rejected', 'blocked', 'deferred'] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

export const createIntentSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  sourceType: z.string().max(200).optional(),
  createdByUserId: z.string().uuid(),
  createdByAgentRepId: z.string().uuid(),
});

export const createObjectiveSchema = z.object({
  intentId: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  successCriteria: z.string().max(5000).optional(),
  constraints: z.string().max(5000).optional(),
  priority: z.number().int().default(0),
});

export const createCapabilitySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  ownerSubstrate: z.string().max(200).optional(),
  riskLevel: z.enum(CAPABILITY_RISK_LEVELS).default('low'),
  requiresApproval: z.boolean().default(false),
  requiresSaifDecision: z.boolean().default(false),
  allowedAgentTypes: z.array(z.string()).default(['functional']),
});

export const createExecutionPatternSchema = z.object({
  capabilityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  orderedSteps: z.record(z.unknown()),
  requiredInputs: z.array(z.string()).default([]),
  expectedOutputs: z.array(z.string()).default([]),
  boundaryRules: z.record(z.unknown()).optional(),
  m4Allowed: z.boolean().default(true),
  m5Required: z.boolean().default(false),
});

export const createResourceSchema = z.object({
  name: z.string().min(1).max(200),
  resourceType: z.string().min(1).max(200),
  canonicalOwner: z.string().max(200).optional(),
  externalReference: z.string().max(500).optional(),
  sensitivity: z.string().max(100).optional(),
  accessRules: z.record(z.unknown()).optional(),
});

export const createImplementationSchema = z.object({
  capabilityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  implementationType: z.string().min(1).max(200),
  provider: z.string().max(200).optional(),
  isExternal: z.boolean().default(false),
  requiresMcp: z.boolean().default(false),
  m4Allowed: z.boolean().default(true),
  m5Allowed: z.boolean().default(false),
});

export const resolveCapabilitySchema = z.object({
  intentId: z.string().uuid(),
  objectiveId: z.string().uuid(),
  capabilityId: z.string().uuid(),
  executionPatternId: z.string().uuid(),
  implementationId: z.string().uuid(),
  saifDecisionRecordId: z.string().uuid().optional(),
  humanUserId: z.string().uuid(),
  agentRepId: z.string().uuid(),
  rationale: z.string().max(5000).optional(),
  constraintsApplied: z.record(z.unknown()).optional(),
  rejectedAlternatives: z.record(z.unknown()).optional(),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
export type CreateObjectiveInput = z.infer<typeof createObjectiveSchema>;
export type CreateCapabilityInput = z.infer<typeof createCapabilitySchema>;
export type CreateExecutionPatternInput = z.infer<typeof createExecutionPatternSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type CreateImplementationInput = z.infer<typeof createImplementationSchema>;
export type ResolveCapabilityInput = z.infer<typeof resolveCapabilitySchema>;

export interface IntentSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sourceType: string | null;
  createdByUserId: string;
  createdByAgentRepId: string;
  status: IntentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObjectiveSummary {
  id: string;
  intentId: string;
  name: string;
  description: string | null;
  successCriteria: string | null;
  constraints: string | null;
  priority: number;
  status: ObjectiveStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapabilitySummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  ownerSubstrate: string | null;
  riskLevel: CapabilityRiskLevel;
  requiresApproval: boolean;
  requiresSaifDecision: boolean;
  allowedAgentTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionPatternSummary {
  id: string;
  capabilityId: string;
  name: string;
  description: string | null;
  orderedSteps: Record<string, unknown>;
  requiredInputs: string[];
  expectedOutputs: string[];
  boundaryRules: Record<string, unknown> | null;
  m4Allowed: boolean;
  m5Required: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceSummary {
  id: string;
  name: string;
  resourceType: string;
  canonicalOwner: string | null;
  externalReference: string | null;
  sensitivity: string | null;
  accessRules: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImplementationSummary {
  id: string;
  capabilityId: string;
  name: string;
  implementationType: string;
  provider: string | null;
  isExternal: boolean;
  requiresMcp: boolean;
  m4Allowed: boolean;
  m5Allowed: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapabilityResolutionSummary {
  id: string;
  intentId: string;
  objectiveId: string;
  capabilityId: string;
  executionPatternId: string;
  implementationId: string;
  saifDecisionRecordId: string | null;
  humanUserId: string;
  agentRepId: string;
  resolutionStatus: ResolutionStatus;
  rationale: string | null;
  constraintsApplied: Record<string, unknown> | null;
  rejectedAlternatives: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
