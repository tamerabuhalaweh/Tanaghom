import { z } from 'zod';

export const WEEKLY_WORK_STATUSES = [
  'planned',
  'ready',
  'in_progress',
  'blocked',
  'awaiting_approval',
  'completed',
  'cancelled',
] as const;

export const WEEKLY_WORK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const WEEKLY_WORK_LINK_TYPES = [
  'content_item',
  'campaign',
  'event',
  'lead',
  'discipline_record',
  'connector_evidence',
] as const;
export const COMMERCIAL_CURRENCIES = ['AED', 'USD'] as const;

const uuid = z.string().uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const nullableDate = localDate.nullable().optional();
const nullableUuid = uuid.nullable().optional();
const budget = z.coerce.number().finite().min(0).max(999_999_999_999.99).nullable().optional();

export const weeklyWorkspaceQuerySchema = z.object({
  weekOf: localDate.optional(),
});

const weeklyWorkFields = z.object({
  weekStartDate: localDate,
  title: z.string().trim().min(3).max(220),
  businessOutcome: z.string().trim().min(3).max(3000),
  ownerUserId: nullableUuid,
  ownerRole: z.string().trim().min(2).max(80).nullable().optional(),
  startDate: nullableDate,
  dueDate: nullableDate,
  status: z.enum(['planned', 'awaiting_approval']).default('planned'),
  priority: z.enum(WEEKLY_WORK_PRIORITIES).default('medium'),
  budgetGuardrail: budget,
  currency: z.enum(COMMERCIAL_CURRENCIES).optional(),
  linkType: z.enum(WEEKLY_WORK_LINK_TYPES).nullable().optional(),
  linkObjectId: z.string().trim().min(1).max(180).nullable().optional(),
  linkLabel: z.string().trim().min(1).max(220).nullable().optional(),
});

export const createWeeklyWorkItemSchema = weeklyWorkFields.superRefine(validateWeeklyWorkFields);

export const updateWeeklyWorkItemSchema = weeklyWorkFields
  .omit({ weekStartDate: true, status: true })
  .partial()
  .extend({
    expectedRevision: z.coerce.number().int().min(1),
    weekStartDate: localDate.optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== 'expectedRevision'), {
    message: 'At least one weekly work field must be updated',
  })
  .superRefine(validateWeeklyWorkFields);

export const transitionWeeklyWorkItemSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  targetStatus: z.enum(WEEKLY_WORK_STATUSES),
  reason: z.string().trim().min(3).max(2000).optional(),
  blockerReason: z.string().trim().min(3).max(3000).optional(),
  completionEvidence: z.string().trim().min(3).max(5000).optional(),
});

function validateWeeklyWorkFields(
  value: {
    weekStartDate?: string;
    startDate?: string | null;
    dueDate?: string | null;
    linkType?: WeeklyWorkLinkType | null;
    linkObjectId?: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dueDate'],
      message: 'Due date must be on or after the start date',
    });
  }
  if (value.weekStartDate) {
    const weekEnd = addDays(value.weekStartDate, 6);
    for (const [path, date] of [['startDate', value.startDate], ['dueDate', value.dueDate]] as const) {
      if (date && (date < value.weekStartDate || date > weekEnd)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: `${path === 'startDate' ? 'Start' : 'Due'} date must be inside the selected week`,
        });
      }
    }
  }
  if (Boolean(value.linkType) !== Boolean(value.linkObjectId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['linkObjectId'],
      message: 'Link type and linked record must be provided together',
    });
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export type WeeklyWorkStatus = (typeof WEEKLY_WORK_STATUSES)[number];
export type WeeklyWorkPriority = (typeof WEEKLY_WORK_PRIORITIES)[number];
export type WeeklyWorkLinkType = (typeof WEEKLY_WORK_LINK_TYPES)[number];
export type CommercialCurrency = (typeof COMMERCIAL_CURRENCIES)[number];
export type WeeklyWorkspaceQuery = z.infer<typeof weeklyWorkspaceQuerySchema>;
export type CreateWeeklyWorkItemInput = z.infer<typeof createWeeklyWorkItemSchema>;
export type UpdateWeeklyWorkItemInput = z.infer<typeof updateWeeklyWorkItemSchema>;
export type TransitionWeeklyWorkItemInput = z.infer<typeof transitionWeeklyWorkItemSchema>;

export type WeeklyWorkPermission =
  | 'weekly-work:read'
  | 'weekly-work:create'
  | 'weekly-work:update'
  | 'weekly-work:approve';

export interface WeeklyWorkItemSummary {
  id: string;
  commercialPlanId: string;
  weekStartDate: string;
  weekEndDate: string;
  title: string;
  businessOutcome: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: WeeklyWorkStatus;
  priority: WeeklyWorkPriority;
  budgetGuardrail: number | null;
  currency: CommercialCurrency;
  linkType: WeeklyWorkLinkType | null;
  linkObjectId: string | null;
  linkLabel: string | null;
  blockerReason: string | null;
  completionEvidence: string | null;
  revision: number;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyWorkspaceSummary {
  timezone: string;
  selectedWeek: { startDate: string; endDate: string; label: string };
  plan: {
    id: string;
    title: string;
    status: string;
    currency: CommercialCurrency;
    budgetTarget: number | null;
    revenueTarget: number | null;
    revenueLineName: string;
    annualPlanId: string | null;
    annualPlanTitle: string | null;
    annualPlanYear: number | null;
    monthlyPortfolioItemId: string | null;
    monthlyPortfolioTitle: string | null;
    monthlyPortfolioMonth: number | null;
    periodStartDate: string | null;
    periodEndDate: string | null;
  };
  rollup: {
    itemCount: number;
    completedCount: number;
    blockedCount: number;
    awaitingApprovalCount: number;
    budgetGuardrail: number;
    remainingPlanBudget: number | null;
  };
  owners: Array<{ id: string; name: string; role: string }>;
  linkOptions: Array<{ type: WeeklyWorkLinkType; id: string; label: string }>;
  items: WeeklyWorkItemSummary[];
}
