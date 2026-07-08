import { z } from 'zod';

export const COMMERCIAL_DISCIPLINES = [
  'brand_positioning',
  'acquisition',
  'conversion_closing',
  'growth_retention',
  'commercial_operations',
] as const;

export const COMMERCIAL_DISCIPLINE_RECORD_CATEGORIES = [
  'research_note',
  'competitor_intelligence',
  'brand_voice',
  'messaging_library',
  'pr_partnership',
  'paid_media',
  'seo_keyword',
  'influencer_partnership',
  'attribution',
  'approved_script',
  'objection_handling',
  'closer_feedback',
  'cro_note',
  'upsell_ascension',
  'platinum_elite',
  'b2b_account',
  'trainer_network',
  'loyalty_lifecycle',
  'crm_data_quality',
  'tech_stack',
  'reporting_schedule',
  'training_library',
] as const;

export const COMMERCIAL_DISCIPLINE_RECORD_STATUSES = ['draft', 'active', 'blocked', 'completed', 'archived'] as const;
export const COMMERCIAL_DISCIPLINE_RECORD_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type CommercialDisciplineId = (typeof COMMERCIAL_DISCIPLINES)[number];
export type CommercialDisciplineRecordCategory = (typeof COMMERCIAL_DISCIPLINE_RECORD_CATEGORIES)[number];
export type CommercialDisciplineRecordStatus = (typeof COMMERCIAL_DISCIPLINE_RECORD_STATUSES)[number];
export type CommercialDisciplineRecordPriority = (typeof COMMERCIAL_DISCIPLINE_RECORD_PRIORITIES)[number];

export const DISCIPLINE_CATALOG: Array<{
  id: CommercialDisciplineId;
  label: string;
  purpose: string;
  categories: CommercialDisciplineRecordCategory[];
  stitchiPrompt: string;
}> = [
  {
    id: 'brand_positioning',
    label: 'Brand & Positioning',
    purpose: 'Research audience, competitors, brand voice, messaging, PR and partnerships.',
    categories: ['research_note', 'competitor_intelligence', 'brand_voice', 'messaging_library', 'pr_partnership'],
    stitchiPrompt: 'Draft a brand positioning record for the current commercial plan.',
  },
  {
    id: 'acquisition',
    label: 'Acquisition',
    purpose: 'Track paid media, SEO, influencer pipeline and lead-source attribution.',
    categories: ['paid_media', 'seo_keyword', 'influencer_partnership', 'attribution'],
    stitchiPrompt: 'Draft an acquisition action record for the selected revenue line.',
  },
  {
    id: 'conversion_closing',
    label: 'Conversion & Closing',
    purpose: 'Manage scripts, objection handling, closer feedback and CRO issues.',
    categories: ['approved_script', 'objection_handling', 'closer_feedback', 'cro_note'],
    stitchiPrompt: 'Draft a conversion and closing record based on current lead blockers.',
  },
  {
    id: 'growth_retention',
    label: 'Growth & Retention',
    purpose: 'Plan upsell, premium relationships, B2B accounts, trainers and loyalty lifecycle.',
    categories: ['upsell_ascension', 'platinum_elite', 'b2b_account', 'trainer_network', 'loyalty_lifecycle'],
    stitchiPrompt: 'Draft a growth and retention record for the strongest customer segment.',
  },
  {
    id: 'commercial_operations',
    label: 'Commercial Operations',
    purpose: 'Govern CRM data quality, tech stack, reporting schedule and training library.',
    categories: ['crm_data_quality', 'tech_stack', 'reporting_schedule', 'training_library'],
    stitchiPrompt: 'Draft an operations record to improve data quality or reporting cadence.',
  },
];

const disciplineRecordBaseSchema = z.object({
  discipline: z.enum(COMMERCIAL_DISCIPLINES),
  category: z.enum(COMMERCIAL_DISCIPLINE_RECORD_CATEGORIES),
  title: z.string().trim().min(1).max(260),
  summary: z.string().trim().max(5000).nullable().optional(),
  details: z.string().trim().max(12000).nullable().optional(),
  status: z.enum(COMMERCIAL_DISCIPLINE_RECORD_STATUSES).default('active').optional(),
  priority: z.enum(COMMERCIAL_DISCIPLINE_RECORD_PRIORITIES).default('medium').optional(),
  sourceType: z.string().trim().min(1).max(120).default('manual').optional(),
  revenueLineId: z.string().uuid().nullable().optional(),
  commercialPlanId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

function validateDisciplineCategory(input: { discipline?: CommercialDisciplineId; category?: CommercialDisciplineRecordCategory }, ctx: z.RefinementCtx) {
  if (!input.discipline || !input.category) return;
  const catalog = DISCIPLINE_CATALOG.find(item => item.id === input.discipline);
  if (catalog && !catalog.categories.includes(input.category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category'],
      message: `${input.category} is not a valid category for ${catalog.label}`,
    });
  }
}

export const createDisciplineRecordSchema = disciplineRecordBaseSchema.superRefine(validateDisciplineCategory);

export const updateDisciplineRecordSchema = disciplineRecordBaseSchema.partial().superRefine(validateDisciplineCategory).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one discipline record field is required',
});

export const listDisciplineRecordsQuerySchema = z.object({
  discipline: z.enum(COMMERCIAL_DISCIPLINES).optional(),
  category: z.enum(COMMERCIAL_DISCIPLINE_RECORD_CATEGORIES).optional(),
  status: z.enum(COMMERCIAL_DISCIPLINE_RECORD_STATUSES).optional(),
  priority: z.enum(COMMERCIAL_DISCIPLINE_RECORD_PRIORITIES).optional(),
  revenueLineId: z.string().uuid().optional(),
  commercialPlanId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
});

export type CreateDisciplineRecordInput = z.infer<typeof createDisciplineRecordSchema>;
export type UpdateDisciplineRecordInput = z.infer<typeof updateDisciplineRecordSchema>;
export type ListDisciplineRecordsQueryInput = z.infer<typeof listDisciplineRecordsQuerySchema>;

export interface DisciplineRecordSummary {
  id: string;
  tenantKey: string;
  discipline: CommercialDisciplineId;
  category: CommercialDisciplineRecordCategory;
  title: string;
  summary: string | null;
  details: string | null;
  status: CommercialDisciplineRecordStatus;
  priority: CommercialDisciplineRecordPriority;
  sourceType: string;
  revenueLineId: string | null;
  revenueLineType: string | null;
  revenueLineName: string | null;
  commercialPlanId: string | null;
  commercialPlanTitle: string | null;
  eventId: string | null;
  eventName: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisciplineWorkspaceSummary {
  id: CommercialDisciplineId;
  label: string;
  purpose: string;
  categories: CommercialDisciplineRecordCategory[];
  stitchiPrompt: string;
  recordCount: number;
  activeCount: number;
  blockedCount: number;
  completedCount: number;
  highPriorityCount: number;
  records: DisciplineRecordSummary[];
}
