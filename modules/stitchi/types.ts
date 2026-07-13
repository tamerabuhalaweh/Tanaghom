import { z } from 'zod';

export const STITCHI_CONVERSATION_STATUSES = ['active', 'archived'] as const;
export type StitchiConversationStatus = (typeof STITCHI_CONVERSATION_STATUSES)[number];

export const STITCHI_MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type StitchiMessageRole = (typeof STITCHI_MESSAGE_ROLES)[number];

export const STITCHI_ACTION_STATUSES = [
  'proposed',
  'awaiting_approval',
  'approved',
  'rejected',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type StitchiActionStatus = (typeof STITCHI_ACTION_STATUSES)[number];

export const STITCHI_ACTION_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type StitchiActionRiskLevel = (typeof STITCHI_ACTION_RISK_LEVELS)[number];

export const STITCHI_APPROVAL_DECISIONS = ['approved', 'rejected', 'changes_requested'] as const;
export type StitchiApprovalDecision = (typeof STITCHI_APPROVAL_DECISIONS)[number];

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(180),
  eventId: z.string().uuid().optional(),
});

export const listConversationSchema = z.object({
  status: z.enum(STITCHI_CONVERSATION_STATUSES).optional(),
  eventId: z.string().uuid().optional(),
  includeTenant: z.coerce.boolean().optional(),
});

export const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(12000),
  metadata: z.record(z.unknown()).optional(),
});

export const readOnlyAssistantRequestSchema = z.object({
  content: z.string().trim().min(1).max(12000),
  eventId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createActionRunSchema = z.object({
  actionType: z.string().trim().min(1).max(160),
  inputPayload: z.record(z.unknown()).default({}),
  previewPayload: z.record(z.unknown()).optional(),
  requiresApproval: z.boolean().default(true),
  riskLevel: z.enum(STITCHI_ACTION_RISK_LEVELS).default('medium'),
  langGraphThreadId: z.string().trim().max(240).optional(),
});

export const actionDecisionSchema = z.object({
  notes: z.string().trim().max(5000).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ListConversationInput = z.infer<typeof listConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ReadOnlyAssistantRequestInput = z.infer<typeof readOnlyAssistantRequestSchema>;
export type CreateActionRunInput = z.infer<typeof createActionRunSchema>;
export type ActionDecisionInput = z.infer<typeof actionDecisionSchema>;

export interface StitchiConversationSummary {
  id: string;
  tenantKey: string;
  userId: string;
  eventId: string | null;
  title: string;
  status: StitchiConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
  actionCount?: number;
}

export interface StitchiMessageSummary {
  id: string;
  tenantKey: string;
  conversationId: string;
  role: StitchiMessageRole;
  content: string;
  metadata: unknown;
  createdAt: Date;
}

export interface StitchiActionRunSummary {
  id: string;
  tenantKey: string;
  conversationId: string;
  userId: string;
  actionType: string;
  status: StitchiActionStatus;
  inputPayload: unknown;
  previewPayload: unknown;
  resultPayload: unknown;
  requiresApproval: boolean;
  riskLevel: StitchiActionRiskLevel;
  auditRecordId: string | null;
  langGraphThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface StitchiActionApprovalSummary {
  id: string;
  tenantKey: string;
  actionRunId: string;
  approverUserId: string;
  decision: StitchiApprovalDecision;
  notes: string | null;
  createdAt: Date;
}

export interface StitchiReadOnlyAnswer {
  userMessage: StitchiMessageSummary;
  assistantMessage: StitchiMessageSummary;
  provider: {
    status: 'used' | 'required' | 'unavailable';
    name: string;
    type: string;
    model: string | null;
  };
  safety: {
    mode: 'read_only';
    writesExecuted: false;
    externalExecution: 'blocked';
    actionProposalsCreated: 0;
  };
}

export type StitchiResponseStreamEvent =
  | { type: 'started'; conversationId: string; mode: 'read_only' }
  | { type: 'user_message_saved'; message: StitchiMessageSummary }
  | { type: 'context_loaded'; selectedEventId: string | null; contextShape: Record<string, unknown> }
  | { type: 'provider_required'; message: StitchiMessageSummary }
  | { type: 'provider_unavailable'; message: StitchiMessageSummary }
  | { type: 'token'; text: string }
  | { type: 'completed'; answer: StitchiReadOnlyAnswer };
