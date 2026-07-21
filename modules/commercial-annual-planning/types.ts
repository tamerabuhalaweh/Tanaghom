import { z } from 'zod';

export const ANNUAL_PLAN_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'active',
  'closed',
  'archived',
] as const;
export const PORTFOLIO_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const PORTFOLIO_READINESS = [
  'planned',
  'needs_brief',
  'ready',
  'blocked',
  'completed',
] as const;
export const COMMERCIAL_CURRENCIES = ['AED', 'USD'] as const;

const uuid = z.string().uuid();
const money = z.coerce.number().finite().min(0).max(999_999_999_999.99);
const optionalNullableUuid = uuid.nullable().optional();
const optionalDate = z.coerce.date().nullable().optional();

export const listAnnualPlansSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  status: z.enum(ANNUAL_PLAN_STATUSES).optional(),
});

export const createAnnualPlanSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  title: z.string().trim().min(3).max(220),
  strategy: z.string().trim().max(12000).nullable().optional(),
  currency: z.enum(COMMERCIAL_CURRENCIES).optional(),
  budgetTarget: money.default(0),
  revenueTarget: money.default(0),
  ownerUserId: optionalNullableUuid,
  learningSetIds: z.array(uuid).max(50).default([]),
});

export const updateAnnualPlanSchema = z
  .object({
    expectedRevision: z.coerce.number().int().min(1),
    title: z.string().trim().min(3).max(220).optional(),
    strategy: z.string().trim().max(12000).nullable().optional(),
    currency: z.enum(COMMERCIAL_CURRENCIES).optional(),
    budgetTarget: money.optional(),
    revenueTarget: money.optional(),
    ownerUserId: optionalNullableUuid,
  })
  .refine((input) => Object.keys(input).some((key) => key !== 'expectedRevision'), {
    message: 'At least one annual plan field must be updated',
  });

export const annualPlanTransitionSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const archiveAnnualPlanSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  reason: z.string().trim().min(3).max(1000),
  confirmation: z.literal('ARCHIVE'),
});

export const duplicateAnnualPlanSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  reason: z.string().trim().min(3).max(1000),
});

export const rejectAnnualPlanSchema = annualPlanTransitionSchema.extend({
  reason: z.string().trim().min(3).max(1000),
});

export const linkLearningSetsSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  learningSetIds: z.array(uuid).max(50),
});

const portfolioItemFields = z.object({
  month: z.coerce.number().int().min(1).max(12),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  revenueLineId: uuid,
  commercialPlanId: optionalNullableUuid,
  eventId: optionalNullableUuid,
  title: z.string().trim().min(2).max(220),
  plannedStartDate: optionalDate,
  plannedEndDate: optionalDate,
  currency: z.enum(COMMERCIAL_CURRENCIES).optional(),
  budgetAllocation: money.default(0),
  revenueTarget: money.default(0),
  priority: z.enum(PORTFOLIO_PRIORITIES).default('medium'),
  readiness: z.enum(PORTFOLIO_READINESS).default('planned'),
  ownerUserId: optionalNullableUuid,
});

export const createPortfolioItemSchema = portfolioItemFields
  .extend({
    expectedRevision: z.coerce.number().int().min(1),
  })
  .superRefine(validateDateOrder);

export const updatePortfolioItemSchema = portfolioItemFields
  .partial()
  .extend({
    expectedRevision: z.coerce.number().int().min(1),
  })
  .refine((input) => Object.keys(input).some((key) => key !== 'expectedRevision'), {
    message: 'At least one portfolio item field must be updated',
  })
  .superRefine(validateDateOrder);

export const archivePortfolioItemSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
});

export const createExecutionPlanForPortfolioItemSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  title: z.string().trim().min(3).max(260),
  objective: z.string().trim().max(5000).nullable().optional(),
  audience: z.string().trim().max(5000).nullable().optional(),
  strategySummary: z.string().trim().max(8000).nullable().optional(),
  actionPlan: z.string().trim().max(8000).nullable().optional(),
  ownerUserId: optionalNullableUuid,
});

function validateDateOrder(
  value: { plannedStartDate?: Date | null; plannedEndDate?: Date | null },
  ctx: z.RefinementCtx,
): void {
  if (
    value.plannedStartDate &&
    value.plannedEndDate &&
    value.plannedEndDate < value.plannedStartDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['plannedEndDate'],
      message: 'Planned end date must be on or after the start date',
    });
  }
}

export type AnnualPlanStatus = (typeof ANNUAL_PLAN_STATUSES)[number];
export type PortfolioPriority = (typeof PORTFOLIO_PRIORITIES)[number];
export type PortfolioReadiness = (typeof PORTFOLIO_READINESS)[number];
export type CommercialCurrency = (typeof COMMERCIAL_CURRENCIES)[number];
export type ListAnnualPlansInput = z.infer<typeof listAnnualPlansSchema>;
export type CreateAnnualPlanInput = z.infer<typeof createAnnualPlanSchema>;
export type UpdateAnnualPlanInput = z.infer<typeof updateAnnualPlanSchema>;
export type AnnualPlanTransitionInput = z.infer<typeof annualPlanTransitionSchema>;
export type ArchiveAnnualPlanInput = z.infer<typeof archiveAnnualPlanSchema>;
export type DuplicateAnnualPlanInput = z.infer<typeof duplicateAnnualPlanSchema>;
export type RejectAnnualPlanInput = z.infer<typeof rejectAnnualPlanSchema>;
export type LinkLearningSetsInput = z.infer<typeof linkLearningSetsSchema>;
export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;
export type ArchivePortfolioItemInput = z.infer<typeof archivePortfolioItemSchema>;
export type CreateExecutionPlanForPortfolioItemInput = z.infer<
  typeof createExecutionPlanForPortfolioItemSchema
>;

export type CurrencyRollup = {
  currency: CommercialCurrency;
  budgetAllocation: number;
  revenueTarget: number;
  itemCount: number;
};

export type MonthRollup = {
  month: number;
  itemCount: number;
  readiness: Record<PortfolioReadiness, number>;
  currencies: CurrencyRollup[];
};

export type AnnualPlanRollup = {
  planCurrency: CommercialCurrency;
  annualBudgetTarget: number;
  annualRevenueTarget: number;
  allocatedBudget: number;
  allocatedRevenueTarget: number;
  unallocatedBudget: number;
  overAllocated: boolean;
  readiness: Record<PortfolioReadiness, number>;
  currencies: CurrencyRollup[];
  months: MonthRollup[];
};
