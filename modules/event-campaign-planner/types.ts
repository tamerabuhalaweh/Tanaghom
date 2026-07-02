import { z } from 'zod';

export const PLAN_APPROVAL_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'changes_requested',
] as const;

export type PlanApprovalStatus = (typeof PLAN_APPROVAL_STATUSES)[number];

export const EMAIL_CONTENT_TYPES = ['text', 'html', 'template'] as const;
export type EmailContentType = (typeof EMAIL_CONTENT_TYPES)[number];

export const WHATSAPP_CONTENT_TYPES = ['text', 'image', 'video'] as const;
export type WhatsappContentType = (typeof WHATSAPP_CONTENT_TYPES)[number];

export const CONTENT_REQUIREMENT_ASSET_TYPES = [
  'video', 'image', 'caption', 'landing_page', 'carousel', 'story', 'email_template', 'whatsapp_template',
] as const;
export type ContentRequirementAssetType = (typeof CONTENT_REQUIREMENT_ASSET_TYPES)[number];

export const CONTENT_REQUIREMENT_STATUSES = ['pending', 'in_progress', 'ready', 'blocked', 'delivered'] as const;
export type ContentRequirementStatus = (typeof CONTENT_REQUIREMENT_STATUSES)[number];

export const SALES_TASK_TYPES = ['inquiry_response', 'follow_up', 'closing', 'discovery_call', 'no_show_recovery', 'feedback_collection'] as const;
export type SalesTaskType = (typeof SALES_TASK_TYPES)[number];

export const SALES_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'] as const;
export type SalesTaskStatus = (typeof SALES_TASK_STATUSES)[number];

// Email Plan schemas
export const createEmailPlanSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  sequenceName: z.string().min(1, 'Sequence name is required').max(500),
  audienceSegment: z.string().max(1000).optional(),
  emailCount: z.number().int().min(1).max(50).optional(),
  plannedSendDates: z.array(z.string().datetime()).optional(),
  subjectDraft: z.string().max(2000).optional(),
  contentDraft: z.string().max(10000).optional(),
  contentType: z.enum(EMAIL_CONTENT_TYPES).optional(),
});

export const updateEmailPlanSchema = z.object({
  sequenceName: z.string().min(1).max(500).optional(),
  audienceSegment: z.string().max(1000).nullable().optional(),
  emailCount: z.number().int().min(1).max(50).optional(),
  plannedSendDates: z.array(z.string().datetime()).nullable().optional(),
  subjectDraft: z.string().max(2000).nullable().optional(),
  contentDraft: z.string().max(10000).nullable().optional(),
  contentType: z.enum(EMAIL_CONTENT_TYPES).optional(),
  approvalStatus: z.enum(PLAN_APPROVAL_STATUSES).optional(),
});

// WhatsApp Plan schemas
export const createWhatsappPlanSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  audienceSegment: z.string().max(1000).optional(),
  frequency: z.string().max(200).optional(),
  contentType: z.enum(WHATSAPP_CONTENT_TYPES).optional(),
  messageDraft: z.string().max(5000).optional(),
});

export const updateWhatsappPlanSchema = z.object({
  audienceSegment: z.string().max(1000).nullable().optional(),
  frequency: z.string().max(200).nullable().optional(),
  contentType: z.enum(WHATSAPP_CONTENT_TYPES).optional(),
  messageDraft: z.string().max(5000).nullable().optional(),
  approvalStatus: z.enum(PLAN_APPROVAL_STATUSES).optional(),
});

// Upsell Plan schemas
export const createUpsellPlanSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  targetSegment: z.string().max(1000).optional(),
  offer: z.string().max(5000).optional(),
  fomoAngle: z.string().max(5000).optional(),
  plannedChannel: z.string().max(200).optional(),
});

export const updateUpsellPlanSchema = z.object({
  targetSegment: z.string().max(1000).nullable().optional(),
  offer: z.string().max(5000).nullable().optional(),
  fomoAngle: z.string().max(5000).nullable().optional(),
  plannedChannel: z.string().max(200).nullable().optional(),
  approvalStatus: z.enum(PLAN_APPROVAL_STATUSES).optional(),
});

// Content Requirement schemas
export const createContentRequirementSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  assetType: z.enum(CONTENT_REQUIREMENT_ASSET_TYPES),
  description: z.string().max(5000).optional(),
  platform: z.string().max(200).optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateContentRequirementSchema = z.object({
  assetType: z.enum(CONTENT_REQUIREMENT_ASSET_TYPES).optional(),
  description: z.string().max(5000).nullable().optional(),
  platform: z.string().max(200).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(CONTENT_REQUIREMENT_STATUSES).optional(),
});

// Sales Task schemas
export const createSalesTaskSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  taskType: z.enum(SALES_TASK_TYPES),
  ownerRole: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateSalesTaskSchema = z.object({
  taskType: z.enum(SALES_TASK_TYPES).optional(),
  ownerRole: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(SALES_TASK_STATUSES).optional(),
});

// Types
export type CreateEmailPlanInput = z.infer<typeof createEmailPlanSchema>;
export type UpdateEmailPlanInput = z.infer<typeof updateEmailPlanSchema>;
export type CreateWhatsappPlanInput = z.infer<typeof createWhatsappPlanSchema>;
export type UpdateWhatsappPlanInput = z.infer<typeof updateWhatsappPlanSchema>;
export type CreateUpsellPlanInput = z.infer<typeof createUpsellPlanSchema>;
export type UpdateUpsellPlanInput = z.infer<typeof updateUpsellPlanSchema>;
export type CreateContentRequirementInput = z.infer<typeof createContentRequirementSchema>;
export type UpdateContentRequirementInput = z.infer<typeof updateContentRequirementSchema>;
export type CreateSalesTaskInput = z.infer<typeof createSalesTaskSchema>;
export type UpdateSalesTaskInput = z.infer<typeof updateSalesTaskSchema>;

// Summary types
export interface EmailPlanSummary {
  id: string;
  tenantKey: string;
  eventId: string;
  sequenceName: string;
  audienceSegment: string | null;
  emailCount: number;
  plannedSendDates: string[] | null;
  subjectDraft: string | null;
  contentDraft: string | null;
  contentType: EmailContentType;
  approvalStatus: PlanApprovalStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsappPlanSummary {
  id: string;
  tenantKey: string;
  eventId: string;
  audienceSegment: string | null;
  frequency: string | null;
  contentType: WhatsappContentType;
  messageDraft: string | null;
  approvalStatus: PlanApprovalStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsellPlanSummary {
  id: string;
  tenantKey: string;
  eventId: string;
  targetSegment: string | null;
  offer: string | null;
  fomoAngle: string | null;
  plannedChannel: string | null;
  approvalStatus: PlanApprovalStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentRequirementSummary {
  id: string;
  tenantKey: string;
  eventId: string;
  assetType: ContentRequirementAssetType;
  description: string | null;
  platform: string | null;
  dueDate: Date | null;
  status: ContentRequirementStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesTaskSummary {
  id: string;
  tenantKey: string;
  eventId: string;
  taskType: SalesTaskType;
  ownerRole: string | null;
  description: string | null;
  dueDate: Date | null;
  status: SalesTaskStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}
