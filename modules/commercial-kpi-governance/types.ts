import { z } from 'zod';
import { thresholdConfigurationError } from './evaluation';

export const KPI_SCOPES = [
  'annual_strategy',
  'monthly_portfolio',
  'execution_plan',
  'event',
  'product_campaign',
] as const;
export const KPI_UNITS = ['currency', 'percentage', 'count', 'ratio', 'duration_days'] as const;
export const KPI_DIRECTIONS = ['minimum', 'maximum', 'target', 'target_range'] as const;
export const KPI_CONTROL_MODES = ['locked', 'inherited', 'adjustable'] as const;
export const KPI_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'superseded',
  'archived',
] as const;

const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const nonNegative = z.coerce.number().finite().min(0);

export const listKpiTargetsSchema = z.object({
  annualPlanId: uuid.optional(),
  monthlyItemId: uuid.optional(),
  commercialPlanId: uuid.optional(),
  eventId: uuid.optional(),
  campaignId: uuid.optional(),
  scope: z.enum(KPI_SCOPES).optional(),
  status: z.enum(KPI_STATUSES).optional(),
});

const kpiTargetFieldsSchema = z.object({
    metricKey: z.string().trim().min(2).max(100).regex(/^[a-z0-9_]+$/),
    label: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    unit: z.enum(KPI_UNITS),
    direction: z.enum(KPI_DIRECTIONS),
    scope: z.enum(KPI_SCOPES),
    controlMode: z.enum(KPI_CONTROL_MODES),
    currency: z.enum(['AED', 'USD']).nullable().optional(),
    targetValue: nonNegative,
    warningValue: nonNegative.nullable().optional(),
    criticalValue: nonNegative.nullable().optional(),
    lowerBound: nonNegative.nullable().optional(),
    upperBound: nonNegative.nullable().optional(),
    annualPlanId: optionalUuid,
    monthlyItemId: optionalUuid,
    commercialPlanId: optionalUuid,
    eventId: optionalUuid,
    campaignId: optionalUuid,
    parentTargetId: optionalUuid,
    ownerUserId: optionalUuid,
    effectiveFrom: z.coerce.date().nullable().optional(),
    effectiveTo: z.coerce.date().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  });

export const createKpiTargetSchema = kpiTargetFieldsSchema
  .superRefine(validateTarget);

export const updateKpiTargetSchema = kpiTargetFieldsSchema
  .omit({
    scope: true,
    annualPlanId: true,
    monthlyItemId: true,
    commercialPlanId: true,
    eventId: true,
    campaignId: true,
    parentTargetId: true,
  })
  .partial()
  .extend({ expectedRevision: z.coerce.number().int().min(1) })
  .refine((input: Record<string, unknown>) => Object.keys(input).some((key) => key !== 'expectedRevision'), {
    message: 'At least one KPI target field must be updated',
  });

export const transitionKpiTargetSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  action: z.enum(['submit', 'approve', 'archive']),
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const amendKpiTargetSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  reason: z.string().trim().min(3).max(1000),
  targetValue: nonNegative,
  warningValue: nonNegative.nullable().optional(),
  criticalValue: nonNegative.nullable().optional(),
  lowerBound: nonNegative.nullable().optional(),
  upperBound: nonNegative.nullable().optional(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

export const eventCapacitySchema = z
  .object({
    venueCapacity: z.coerce.number().int().positive(),
    sellableTicketCapacity: z.coerce.number().int().positive(),
    source: z.string().trim().min(3).max(500),
  })
  .refine((input) => input.sellableTicketCapacity <= input.venueCapacity, {
    path: ['sellableTicketCapacity'],
    message: 'Sellable ticket capacity cannot exceed the booked venue capacity',
  });

function validateTarget(input: z.infer<typeof kpiTargetFieldsSchema>, ctx: z.RefinementCtx): void {
  const references = [
    input.annualPlanId,
    input.monthlyItemId,
    input.commercialPlanId,
    input.eventId,
    input.campaignId,
  ].filter(Boolean);
  if (references.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope'],
      message: 'A KPI target must belong to exactly one business scope',
    });
  }
  const expectedReference: Record<(typeof KPI_SCOPES)[number], unknown> = {
    annual_strategy: input.annualPlanId,
    monthly_portfolio: input.monthlyItemId,
    execution_plan: input.commercialPlanId,
    event: input.eventId,
    product_campaign: input.campaignId,
  };
  if (!expectedReference[input.scope]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope'],
      message: `Scope '${input.scope}' requires its matching object identifier`,
    });
  }
  if (input.unit === 'currency' && !input.currency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currency'],
      message: 'Currency is required for a currency KPI',
    });
  }
  if (
    input.direction === 'target_range' &&
    (input.lowerBound == null || input.upperBound == null || input.lowerBound > input.upperBound)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['upperBound'],
      message: 'A target range requires a valid lower and upper bound',
    });
  }
  const thresholdError = thresholdConfigurationError(
    input.direction,
    input.targetValue,
    input.warningValue,
    input.criticalValue,
  );
  if (thresholdError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['criticalValue'],
      message: thresholdError,
    });
  }
}

export type ListKpiTargetsInput = z.infer<typeof listKpiTargetsSchema>;
export type CreateKpiTargetInput = z.infer<typeof createKpiTargetSchema>;
export type UpdateKpiTargetInput = z.infer<typeof updateKpiTargetSchema>;
export type TransitionKpiTargetInput = z.infer<typeof transitionKpiTargetSchema>;
export type AmendKpiTargetInput = z.infer<typeof amendKpiTargetSchema>;
export type EventCapacityInput = z.infer<typeof eventCapacitySchema>;
