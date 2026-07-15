import { z } from 'zod';

export const BUDGET_LEVELS = ['monthly_item', 'commercial_plan', 'event', 'campaign'] as const;
export const BUDGET_STATUSES = ['planned', 'approved', 'committed', 'archived'] as const;
export const COMMERCIAL_CURRENCIES = ['AED', 'USD'] as const;
export const KPI_VERIFICATION_STATUSES = ['verified', 'rejected'] as const;

const uuid = z.string().uuid();
const money = z.coerce.number().finite().min(0).max(999_999_999_999.99);
const reason = z.string().trim().min(3).max(2000);

export const createBudgetAllocationSchema = z
  .object({
    level: z.enum(BUDGET_LEVELS),
    parentAllocationId: uuid.nullable().optional(),
    monthlyPortfolioItemId: uuid.nullable().optional(),
    commercialPlanId: uuid.nullable().optional(),
    eventId: uuid.nullable().optional(),
    campaignId: uuid.nullable().optional(),
    currency: z.enum(COMMERCIAL_CURRENCIES),
    amount: money,
    reason,
    allowOverAllocation: z.boolean().default(false),
    exceptionReason: reason.optional(),
  })
  .superRefine((input, ctx) => {
    const targets = {
      monthly_item: input.monthlyPortfolioItemId,
      commercial_plan: input.commercialPlanId,
      event: input.eventId,
      campaign: input.campaignId,
    };
    const supplied = Object.values(targets).filter(Boolean);
    if (!targets[input.level] || supplied.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['level'],
        message: 'Exactly one target matching the allocation level is required',
      });
    }
    if (input.level === 'monthly_item' && input.parentAllocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parentAllocationId'],
        message: 'Monthly allocations are the root and cannot have a parent allocation',
      });
    }
    if (input.level !== 'monthly_item' && !input.parentAllocationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parentAllocationId'],
        message: 'A parent allocation is required below the monthly level',
      });
    }
    if (input.allowOverAllocation && !input.exceptionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exceptionReason'],
        message: 'An approved exception reason is required for over-allocation',
      });
    }
  });

export const reallocateBudgetSchema = z
  .object({
    expectedRevision: z.coerce.number().int().min(1),
    amount: money,
    reason,
    allowOverAllocation: z.boolean().default(false),
    exceptionReason: reason.optional(),
  })
  .superRefine((input, ctx) => {
    if (input.allowOverAllocation && !input.exceptionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exceptionReason'],
        message: 'An approved exception reason is required for over-allocation',
      });
    }
  });

export const budgetTransitionSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  reason,
});

export const verifyKpiEvidenceSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  decision: z.enum(KPI_VERIFICATION_STATUSES),
  reason,
});

export type BudgetLevel = (typeof BUDGET_LEVELS)[number];
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type CommercialCurrency = (typeof COMMERCIAL_CURRENCIES)[number];
export type CreateBudgetAllocationInput = z.infer<typeof createBudgetAllocationSchema>;
export type ReallocateBudgetInput = z.infer<typeof reallocateBudgetSchema>;
export type BudgetTransitionInput = z.infer<typeof budgetTransitionSchema>;
export type VerifyKpiEvidenceInput = z.infer<typeof verifyKpiEvidenceSchema>;

export type BudgetTarget = {
  id: string;
  label: string;
  month: number | null;
  revenueLineId: string | null;
  revenueLineName: string | null;
};

export type BudgetAllocationSummary = {
  id: string;
  parentAllocationId: string | null;
  level: BudgetLevel;
  target: BudgetTarget;
  currency: CommercialCurrency;
  amount: number;
  status: BudgetStatus;
  revision: number;
  reason: string;
  exceptionApproved: boolean;
  exceptionReason: string | null;
  verifiedActual: number;
  remaining: number;
  variance: number;
  childAllocated: number;
  childRemaining: number;
  children: BudgetAllocationSummary[];
};

export type CurrencyReconciliation = {
  currency: CommercialCurrency;
  annualEnvelope: number | null;
  allocated: number;
  approved: number;
  committed: number;
  verifiedActual: number;
  remaining: number | null;
  variance: number | null;
  overAllocated: boolean;
  envelopeMissing: boolean;
};
