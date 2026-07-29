import { z } from 'zod';

export const GHL_OPERATION_TYPES = [
  'contact_upsert',
  'contact_tags_update',
  'opportunity_upsert',
  'appointment_upsert',
  'whatsapp_send',
] as const;
export type GhlOperationType = (typeof GHL_OPERATION_TYPES)[number];

export const GHL_OPERATION_STATUSES = [
  'previewed',
  'pending_approval',
  'approved',
  'executing',
  'provider_accepted',
  'reconciled',
  'rejected',
  'cancelled',
  'blocked',
  'failed',
  'reconciliation_failed',
  'expired',
] as const;
export type GhlOperationStatus = (typeof GHL_OPERATION_STATUSES)[number];

const uuid = z.string().uuid();
const money = z.coerce.number().finite().min(0).max(1_000_000_000);
const compactText = z.string().trim().min(1).max(500);
const tag = z.string().trim().min(1).max(160);
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]);

export function paidSaleRequiresWon(input: {
  status?: string;
  payment?: { paymentStatus?: string; amountPaid?: number };
}): boolean {
  const paymentStatus = input.payment?.paymentStatus;
  const amountPaid = input.payment?.amountPaid ?? 0;
  const receivedPayment =
    paymentStatus === 'partial' ||
    paymentStatus === 'paid_in_full' ||
    (amountPaid > 0 && paymentStatus !== 'refunded' && paymentStatus !== 'cancelled');
  return (
    receivedPayment && input.status !== 'won'
  );
}

const contactUpsertSchema = z.object({
  type: z.literal('contact_upsert'),
  leadId: uuid,
  source: z.string().trim().min(1).max(220).optional(),
});

const contactTagsSchema = z.object({
  type: z.literal('contact_tags_update'),
  leadId: uuid,
  addTags: z.array(tag).max(50).default([]),
  removeTags: z.array(tag).max(50).default([]),
});

const paymentSchema = z
  .object({
    totalSaleValue: money.optional(),
    amountPaid: money.optional(),
    outstandingBalance: money.optional(),
    paymentStatus: z
      .enum(['unknown', 'partial', 'paid_in_full', 'refunded', 'cancelled'])
      .optional(),
    paymentDate: z.string().datetime({ offset: true }).optional(),
    ticketQuantity: z.coerce.number().int().min(0).max(100_000).optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.totalSaleValue !== undefined &&
      input.amountPaid !== undefined &&
      input.amountPaid > input.totalSaleValue
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountPaid'],
        message: 'Amount paid cannot exceed total sale value',
      });
    }
    const expectedOutstanding =
      input.totalSaleValue !== undefined && input.amountPaid !== undefined
        ? Math.max(0, input.totalSaleValue - input.amountPaid)
        : undefined;
    if (
      expectedOutstanding !== undefined &&
      input.outstandingBalance !== undefined &&
      Math.abs(input.outstandingBalance - expectedOutstanding) > 0.005
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outstandingBalance'],
        message: 'Outstanding balance must equal total sale value minus amount paid',
      });
    }
    if (input.paymentStatus === 'paid_in_full') {
      if (
        input.totalSaleValue === undefined ||
        input.amountPaid === undefined ||
        input.amountPaid !== input.totalSaleValue
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentStatus'],
          message: 'Paid in full requires amount paid to equal total sale value',
        });
      }
      if (!input.paymentDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentDate'],
          message: 'Paid in full requires a payment date',
        });
      }
    }
    if (input.paymentStatus === 'partial') {
      if (
        input.totalSaleValue === undefined ||
        input.amountPaid === undefined ||
        input.amountPaid <= 0 ||
        input.amountPaid >= input.totalSaleValue
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentStatus'],
          message: 'Partial payment requires an amount above zero and below the total sale value',
        });
      }
      if (!input.paymentDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentDate'],
          message: 'Partial payment requires a payment date',
        });
      }
    }
    if (
      input.amountPaid !== undefined &&
      input.amountPaid > 0 &&
      (!input.paymentStatus || input.paymentStatus === 'unknown')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentStatus'],
        message: 'A received payment requires an explicit payment status',
      });
    }
  });

const opportunityUpsertSchema = z.object({
  type: z.literal('opportunity_upsert'),
  leadId: uuid,
  opportunityId: z.string().trim().min(1).max(220).optional(),
  pipelineId: z.string().trim().min(1).max(220),
  stageId: z.string().trim().min(1).max(220),
  name: compactText,
  status: z.enum(['open', 'won', 'lost', 'abandoned']).default('open'),
  monetaryValue: money.optional(),
  payment: paymentSchema.optional(),
  customFields: z.record(scalar).default({}),
});

const appointmentUpsertSchema = z.object({
  type: z.literal('appointment_upsert'),
  leadId: uuid,
  appointmentId: z.string().trim().min(1).max(220).optional(),
  calendarId: z.string().trim().min(1).max(220),
  title: compactText,
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  status: z
    .enum(['new', 'confirmed', 'cancelled', 'showed', 'noshow', 'invalid'])
    .default('confirmed'),
  notes: z.string().trim().max(2000).optional(),
});

const whatsappSendSchema = z.object({
  type: z.literal('whatsapp_send'),
  leadId: uuid,
  message: z.string().trim().min(1).max(4000),
  templateId: z.string().trim().min(1).max(220).optional(),
  scheduledTimestamp: z.coerce.number().int().positive().optional(),
});

export const ghlOperationActionSchema = z
  .discriminatedUnion('type', [
    contactUpsertSchema,
    contactTagsSchema,
    opportunityUpsertSchema,
    appointmentUpsertSchema,
    whatsappSendSchema,
  ])
  .superRefine((input, ctx) => {
    if (input.type === 'contact_tags_update') {
      if (input.addTags.length === 0 && input.removeTags.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addTags'],
          message: 'Add or remove at least one tag',
        });
      }
      if (input.addTags.some((value) => input.removeTags.includes(value))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['removeTags'],
          message: 'The same tag cannot be added and removed in one operation',
        });
      }
      if (input.addTags.length > 0 && input.removeTags.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['removeTags'],
          message: 'Additions and removals must be prepared as separate CRM actions',
        });
      }
    }
    if (
      input.type === 'appointment_upsert' &&
      new Date(input.endTime) <= new Date(input.startTime)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'Meeting end time must be after the start time',
      });
    }
    if (
      input.type === 'opportunity_upsert' &&
      input.status === 'won' &&
      (!input.payment?.paymentStatus || input.payment.paymentStatus === 'unknown')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment', 'paymentStatus'],
        message: 'A won opportunity requires an explicit payment status',
      });
    }
    if (input.type === 'opportunity_upsert' && paidSaleRequiresWon(input)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'A partial or fully paid sale must use Won opportunity status',
      });
    }
  });

export const prepareGhlOperationSchema = z.object({
  idempotencyKey: z
    .string()
    .trim()
    .min(12)
    .max(180)
    .regex(/^[a-zA-Z0-9._:-]+$/, 'Use letters, numbers, dots, colons, underscores or dashes')
    .optional(),
  eventId: uuid.optional(),
  commercialPlanId: uuid.optional(),
  stitchiActionRunId: uuid.optional(),
  action: ghlOperationActionSchema,
});

export const submitGhlOperationSchema = z.object({
  previewHash: z.string().length(64),
  expectedVersion: z.coerce.number().int().min(1),
  reason: z.string().trim().min(3).max(1000),
});

export const decideGhlOperationSchema = z.object({
  previewHash: z.string().length(64),
  expectedVersion: z.coerce.number().int().min(1),
  decision: z.enum(['approve', 'reject']),
  notes: z.string().trim().min(3).max(1000),
});

export const executeGhlOperationSchema = z.object({
  previewHash: z.string().length(64),
  expectedVersion: z.coerce.number().int().min(1),
});

export const reconcileGhlOperationSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1),
});

export const listGhlOperationsSchema = z.object({
  eventId: uuid.optional(),
  leadId: uuid.optional(),
  status: z.enum(GHL_OPERATION_STATUSES).optional(),
  type: z.enum(GHL_OPERATION_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type GhlOperationAction = z.infer<typeof ghlOperationActionSchema>;
export type PrepareGhlOperationInput = z.infer<typeof prepareGhlOperationSchema>;
export type SubmitGhlOperationInput = z.infer<typeof submitGhlOperationSchema>;
export type DecideGhlOperationInput = z.infer<typeof decideGhlOperationSchema>;
export type ExecuteGhlOperationInput = z.infer<typeof executeGhlOperationSchema>;
export type ReconcileGhlOperationInput = z.infer<typeof reconcileGhlOperationSchema>;
export type ListGhlOperationsInput = z.infer<typeof listGhlOperationsSchema>;

export interface GhlOperationSummary {
  id: string;
  tenantKey: string;
  eventId: string | null;
  commercialPlanId: string | null;
  leadId: string | null;
  stitchiActionRunId: string | null;
  operationType: GhlOperationType;
  status: GhlOperationStatus;
  reconciliationStatus: 'pending' | 'confirmed' | 'failed' | 'not_required';
  idempotencyKey: string;
  previewHash: string;
  version: number;
  preview: Record<string, unknown>;
  providerObjectId: string | null;
  providerContactId: string | null;
  providerOpportunityId: string | null;
  providerAppointmentId: string | null;
  providerMessageId: string | null;
  failureReason: string | null;
  requestedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  reconciledAt: Date | null;
  expiresAt: Date;
  attemptCount: number;
  rawSecretsReturned: false;
  createdAt: Date;
  updatedAt: Date;
  idempotent?: boolean;
}

export interface GhlProviderResult {
  ok: boolean;
  status: number;
  body: unknown;
}
