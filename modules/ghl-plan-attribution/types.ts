import { z } from 'zod';

const uuid = z.string().uuid();
const trimmedList = z.array(z.string().trim().min(1).max(160)).max(100).default([]);

export const listAttributionMappingsSchema = z.object({
  commercialPlanId: uuid.optional(),
  eventId: uuid.optional(),
  status: z.enum(['draft', 'approved', 'superseded', 'archived']).optional(),
});

const mappingFieldsSchema = z.object({
  commercialPlanId: uuid,
  eventId: uuid.nullable().optional(),
  locationId: z.string().trim().min(2).max(200),
  pipelineId: z.string().trim().min(1).max(200).nullable().optional(),
  identifyingTags: trimmedList,
  sourceValues: trimmedList,
  matchMode: z.enum(['any', 'all']).default('any'),
  paymentAmountField: z.string().trim().min(1).max(300).nullable().optional(),
  saleValueField: z.string().trim().min(1).max(300).nullable().optional(),
  ticketQuantityField: z.string().trim().min(1).max(300).nullable().optional(),
  paymentStatusField: z.string().trim().min(1).max(300).nullable().optional(),
  customFieldRules: z
    .array(
      z.object({
        field: z.string().trim().min(1).max(300),
        operator: z.enum(['equals', 'contains', 'exists']),
        value: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .max(100)
    .default([]),
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

export const createAttributionMappingSchema = mappingFieldsSchema.superRefine(requireIdentityRule);

export const updateAttributionMappingSchema = mappingFieldsSchema
  .omit({ commercialPlanId: true })
  .partial()
  .extend({ expectedRevision: z.coerce.number().int().min(1) })
  .refine((input) => Object.keys(input).some((key) => key !== 'expectedRevision'), {
    message: 'At least one attribution mapping field must be updated',
  });

export const approveAttributionMappingSchema = z.object({
  expectedRevision: z.coerce.number().int().min(1),
  reason: z.string().trim().min(3).max(1000),
});

export const previewAttributionMatchSchema = z.object({
  pipelineId: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  source: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).default({}),
});

function requireIdentityRule(
  input: z.infer<typeof mappingFieldsSchema>,
  ctx: z.RefinementCtx,
): void {
  if (
    !input.pipelineId &&
    input.identifyingTags.length === 0 &&
    input.sourceValues.length === 0 &&
    input.customFieldRules.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pipelineId'],
      message: 'Define at least one pipeline, tag, source, or custom-field attribution rule',
    });
  }
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'Effective end must be on or after effective start',
    });
  }
}

export type ListAttributionMappingsInput = z.infer<typeof listAttributionMappingsSchema>;
export type CreateAttributionMappingInput = z.infer<typeof createAttributionMappingSchema>;
export type UpdateAttributionMappingInput = z.infer<typeof updateAttributionMappingSchema>;
export type ApproveAttributionMappingInput = z.infer<typeof approveAttributionMappingSchema>;
export type PreviewAttributionMatchInput = z.infer<typeof previewAttributionMatchSchema>;

