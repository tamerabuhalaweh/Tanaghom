import { z } from 'zod';

// ============================================================
// Approval Decisions
// ============================================================

export const APPROVAL_DECISIONS = ['approved', 'rejected', 'needs_changes'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

// ============================================================
// Risk Categories
// ============================================================

export const RISK_CATEGORIES = ['low', 'medium', 'high'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

// ============================================================
// Approval Routing Rules
// ============================================================

export interface ApprovalRoute {
  department: string;
  role: string;
  required: boolean;
  reason: string;
}

export const ROUTING_RULES: Record<RiskCategory, ApprovalRoute[]> = {
  low: [
    { department: 'Acquisition', role: 'specialist', required: true, reason: 'Platform/format review' },
  ],
  medium: [
    { department: 'Acquisition', role: 'specialist', required: true, reason: 'Platform/format review' },
    { department: 'Brand & Positioning', role: 'department_head', required: true, reason: 'Brand voice compliance' },
  ],
  high: [
    { department: 'CCO', role: 'cco', required: true, reason: 'Senior approval for high-risk content' },
    { department: 'Brand & Positioning', role: 'department_head', required: true, reason: 'Brand voice compliance' },
    { department: 'Acquisition', role: 'specialist', required: true, reason: 'Platform/format review' },
  ],
};

// ============================================================
// Content Type Routing Overrides
// ============================================================

export const CONTENT_TYPE_ROUTES: Record<string, ApprovalRoute[]> = {
  announcement: [
    { department: 'CCO', role: 'cco', required: true, reason: 'Public announcement requires senior approval' },
    { department: 'Brand & Positioning', role: 'department_head', required: true, reason: 'Brand messaging' },
  ],
  thought_leadership: [
    { department: 'Brand & Positioning', role: 'department_head', required: true, reason: 'Brand positioning review' },
    { department: 'Acquisition', role: 'specialist', required: true, reason: 'Reach optimization' },
  ],
  campaign: [
    { department: 'Conversion & Closing', role: 'department_head', required: true, reason: 'CTA/sales review' },
    { department: 'Commercial Operations', role: 'department_head', required: false, reason: 'Reporting/tracking setup' },
  ],
};

// ============================================================
// SLA Configuration
// ============================================================

export const APPROVAL_SLA = {
  reminderHours: 24,
  escalationHours: 48,
  criticalHours: 72,
  deadlineWarningHours: 24,
} as const;

// ============================================================
// Schemas
// ============================================================

export const submitForApprovalSchema = z.object({
  contentItemId: z.string().uuid('Invalid content item ID'),
  campaignRequestId: z.string().uuid('Invalid campaign request ID'),
  riskCategory: z.enum(RISK_CATEGORIES),
  contentType: z.string().min(1),
  ownerDepartmentId: z.string().uuid(),
  platform: z.string().min(1),
  draftText: z.string().min(1),
  deadline: z.string().datetime().optional(),
});

export const approvalDecisionSchema = z.object({
  approvalRecordId: z.string().uuid('Invalid approval record ID'),
  decision: z.enum(APPROVAL_DECISIONS),
  comments: z.string().max(2000).optional(),
});

export const checkApprovalStatusSchema = z.object({
  contentItemId: z.string().uuid('Invalid content item ID'),
});

export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type CheckApprovalStatusInput = z.infer<typeof checkApprovalStatusSchema>;

// ============================================================
// Response Types
// ============================================================

export interface ApprovalRecord {
  id: string;
  contentItemId: string;
  campaignRequestId: string;
  department: string;
  approverRole: string;
  approverId: string | null;
  decision: ApprovalDecision | null;
  comments: string | null;
  required: boolean;
  reason: string;
  submittedAt: Date;
  decidedAt: Date | null;
  slaDeadline: Date;
  reminderSent: boolean;
  escalated: boolean;
}

export interface ApprovalStatus {
  contentItemId: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  totalRequired: number;
  approvedCount: number;
  rejectedCount: number;
  needsChangesCount: number;
  pendingCount: number;
  records: ApprovalRecord[];
  canSchedule: boolean;
  blockReasons: string[];
}

export interface ApprovalRoutingResult {
  contentItemId: string;
  routes: ApprovalRoute[];
  records: ApprovalRecord[];
  totalRequired: number;
}
