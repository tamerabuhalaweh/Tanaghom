import { z } from 'zod';

export const ASSESSMENT_RUN_STATUSES = [
  'draft',
  'evidence_ready',
  'generating',
  'generated',
  'approved',
  'failed',
  'archived',
] as const;

export const ASSESSMENT_FINDING_TYPES = ['repeat', 'improve', 'avoid', 'investigate'] as const;
export const ASSESSMENT_FINDING_DECISIONS = ['pending', 'approved', 'rejected'] as const;
export const ASSESSMENT_CHANNELS = ['meta', 'instagram', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral', 'manual'] as const;

const uuidListSchema = z.preprocess(
  value => value ?? [],
  z.array(z.string().uuid()).max(100),
);

const channelListSchema = z.preprocess(
  value => value ?? [],
  z.array(z.enum(ASSESSMENT_CHANNELS)).max(20),
);

const assessmentScopeBaseSchema = z.object({
  revenueLineId: z.string().uuid().nullable().optional(),
  eventIds: uuidListSchema,
  campaignIds: uuidListSchema,
  audienceQuery: z.string().trim().max(260).nullable().optional(),
  channels: channelListSchema,
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
});

function validateDateRange(
  value: { dateFrom: Date; dateTo: Date },
  context: z.RefinementCtx,
) {
  if (value.dateFrom > value.dateTo) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Assessment start date must be on or before the end date', path: ['dateTo'] });
  }
  if (value.dateTo.getTime() - value.dateFrom.getTime() > 1000 * 60 * 60 * 24 * 366 * 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Assessment range cannot exceed five years', path: ['dateTo'] });
  }
}

export const assessmentScopeSchema = assessmentScopeBaseSchema.superRefine(validateDateRange);

export const previewAssessmentSchema = assessmentScopeSchema;

export const createAssessmentRunSchema = assessmentScopeBaseSchema.extend({
  title: z.string().trim().min(3).max(260),
}).superRefine(validateDateRange);

export const listAssessmentRunsSchema = z.object({
  revenueLineId: z.string().uuid().optional(),
  status: z.enum(ASSESSMENT_RUN_STATUSES).optional(),
});

export const decideAssessmentFindingSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(2000).nullable().optional(),
});

export const generatedFindingSchema = z.object({
  type: z.enum(ASSESSMENT_FINDING_TYPES),
  title: z.string().trim().min(3).max(260),
  summary: z.string().trim().min(3).max(4000),
  recommendation: z.string().trim().min(3).max(4000),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string().uuid()).min(1).max(20),
});

export const generatedAssessmentSchema = z.object({
  findings: z.array(generatedFindingSchema).min(1).max(8),
});

export type AssessmentScopeInput = z.infer<typeof assessmentScopeSchema>;
export type CreateAssessmentRunInput = z.infer<typeof createAssessmentRunSchema>;
export type ListAssessmentRunsInput = z.infer<typeof listAssessmentRunsSchema>;
export type DecideAssessmentFindingInput = z.infer<typeof decideAssessmentFindingSchema>;
export type GeneratedAssessment = z.infer<typeof generatedAssessmentSchema>;

export interface EvidenceDraft {
  evidenceType: 'commercial_plan' | 'campaign' | 'event' | 'event_kpi' | 'lead_outcome' | 'event_problem' | 'assessment_signal' | 'connector_status';
  sourceObjectType: string;
  sourceObjectId: string;
  sourceName: string | null;
  metricKey: string;
  metricValue: number | null;
  metricUnit: string | null;
  observedAt: Date | null;
  payload: Record<string, unknown>;
}

export interface AssessmentEvidencePreview {
  scope: {
    revenueLineId: string | null;
    revenueLineName: string | null;
    eventIds: string[];
    campaignIds: string[];
    audienceQuery: string | null;
    channels: string[];
    dateFrom: Date;
    dateTo: Date;
    defaultCurrency: 'AED' | 'USD';
  };
  summary: Record<string, unknown>;
  missingData: string[];
  evidence: EvidenceDraft[];
}
