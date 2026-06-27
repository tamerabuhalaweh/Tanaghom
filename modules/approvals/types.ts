import { z } from 'zod';

export const APPROVAL_TARGET_TYPES = ['campaign', 'content_item', 'draft_version', 'saif_decision_record'] as const;
export type ApprovalTargetType = (typeof APPROVAL_TARGET_TYPES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested', 'escalated', 'expired', 'cancelled'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_TYPES = [
  'department_review', 'brand_review', 'compliance_review', 'cco_review',
  'demand_generation_review', 'conversion_review', 'customer_growth_review', 'revenue_operations_review'
] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const RISK_CATEGORIES = ['low', 'medium', 'high'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const DEPARTMENTS = [
  'Brand & Market Intelligence', 'Demand Generation', 'Conversion',
  'Customer Growth & Retention', 'Revenue Operations'
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const createApprovalSchema = z.object({
  targetType: z.enum(APPROVAL_TARGET_TYPES),
  targetId: z.string().uuid(),
  saifDecisionRecordId: z.string().uuid().optional(),
  requesterUserId: z.string().uuid(),
  requesterAgentRepId: z.string().uuid(),
  approvalType: z.enum(APPROVAL_TYPES).default('department_review'),
  riskCategory: z.enum(RISK_CATEGORIES).default('low'),
  requiredDepartment: z.string().optional(),
  requiredRole: z.string().optional(),
  comment: z.string().max(5000).optional(),
});

export const approvalDecisionSchema = z.object({
  approverUserId: z.string().uuid(),
  approverAgentRepId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'changes_requested']),
  comment: z.string().max(5000).optional(),
  rationale: z.string().max(5000).optional(),
});

export const escalationSchema = z.object({
  escalatedByUserId: z.string().uuid(),
  escalatedByAgentRepId: z.string().uuid(),
  reason: z.string().max(5000).optional(),
});

export const cancellationSchema = z.object({
  cancelledByUserId: z.string().uuid(),
  cancelledByAgentRepId: z.string().uuid(),
  reason: z.string().max(5000).optional(),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type EscalationInput = z.infer<typeof escalationSchema>;
export type CancellationInput = z.infer<typeof cancellationSchema>;

export interface ApprovalSummary {
  id: string;
  targetType: ApprovalTargetType;
  targetId: string;
  saifDecisionRecordId: string | null;
  requesterUserId: string;
  requesterAgentRepId: string;
  approverUserId: string | null;
  approverAgentRepId: string | null;
  approvalType: ApprovalType;
  approvalStatus: ApprovalStatus;
  decision: string | null;
  comment: string | null;
  rationale: string | null;
  riskCategory: RiskCategory;
  requiredDepartment: string | null;
  requiredRole: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  expiresAt: Date | null;
  escalatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalDecisionPacket {
  approval: ApprovalSummary;
  campaign: {
    id: string;
    topic: string;
    objective: string;
    audience: string | null;
    platforms: string[];
    cta: string | null;
    riskCategory: string;
    status: string;
  } | null;
  contentItem: {
    id: string;
    platform: string;
    contentType: string;
    draftText: string;
    riskScore: number;
    riskReason: string | null;
    reachScore: number;
    reachBreakdown: unknown;
    status: string;
  } | null;
  latestDraftVersion: {
    id: string;
    versionNo: number;
    text: string;
    modelUsed: string | null;
    createdAt: Date;
  } | null;
  publishingPackages: Array<{
    id: string;
    status: string;
    readinessScore: number | null;
    readinessSummary: string | null;
    createdAt: Date;
  }>;
  safety: {
    humanApprovalRequired: true;
    externalExecutionBlocked: true;
    m5Disabled: true;
  };
}

export interface RoutingRule {
  riskCategory: RiskCategory;
  targetType: ApprovalTargetType;
  approvalType: ApprovalType;
  requiredDepartment: string | null;
  requiredRole: string | null;
}

export const ROUTING_RULES: RoutingRule[] = [
  { riskCategory: 'low', targetType: 'campaign', approvalType: 'department_review', requiredDepartment: null, requiredRole: 'reviewer' },
  { riskCategory: 'medium', targetType: 'campaign', approvalType: 'department_review', requiredDepartment: null, requiredRole: 'department_head' },
  { riskCategory: 'high', targetType: 'campaign', approvalType: 'cco_review', requiredDepartment: null, requiredRole: 'cco' },
  { riskCategory: 'low', targetType: 'content_item', approvalType: 'department_review', requiredDepartment: null, requiredRole: 'reviewer' },
  { riskCategory: 'medium', targetType: 'content_item', approvalType: 'brand_review', requiredDepartment: 'Brand & Market Intelligence', requiredRole: 'department_head' },
  { riskCategory: 'high', targetType: 'content_item', approvalType: 'cco_review', requiredDepartment: null, requiredRole: 'cco' },
];

export function getRoutingRule(riskCategory: RiskCategory, targetType: ApprovalTargetType): RoutingRule | undefined {
  return ROUTING_RULES.find(r => r.riskCategory === riskCategory && r.targetType === targetType);
}

export function getDepartmentForReview(reviewType: string): string | null {
  const mapping: Record<string, string> = {
    brand_review: 'Brand & Market Intelligence',
    demand_generation_review: 'Demand Generation',
    conversion_review: 'Conversion',
    customer_growth_review: 'Customer Growth & Retention',
    revenue_operations_review: 'Revenue Operations',
  };
  return mapping[reviewType] || null;
}

export const VALID_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  pending: ['approved', 'rejected', 'changes_requested', 'escalated', 'expired', 'cancelled'],
  approved: [],
  rejected: [],
  changes_requested: ['pending', 'cancelled'],
  escalated: ['approved', 'rejected', 'changes_requested', 'expired', 'cancelled'],
  expired: ['pending', 'cancelled'],
  cancelled: [],
};

export function isValidApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): void {
  if (!isValidApprovalTransition(from, to)) {
    throw new Error(`Invalid approval state transition: ${from} → ${to}`);
  }
}
