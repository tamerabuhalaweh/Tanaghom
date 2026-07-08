import { z } from 'zod';

export const COMMERCIAL_REVENUE_LINE_TYPES = [
  'live_event',
  'online_course',
  'b2b',
  'platinum_elite',
  'certified_trainer_network',
  'loyalty_community',
] as const;

export const COMMERCIAL_REVENUE_LINE_STATUSES = ['active', 'paused', 'archived'] as const;
export const COMMERCIAL_OPERATING_STAGES = ['assess', 'strategy_planning', 'implementation_engagement'] as const;
export const COMMERCIAL_PLAN_HORIZONS = ['three_year', 'one_year', 'quarterly', 'product_or_event'] as const;
export const COMMERCIAL_PLAN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
export const COMMERCIAL_ASSESSMENT_SEVERITIES = ['info', 'watch', 'risk', 'critical'] as const;
export const COMMERCIAL_ASSESSMENT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;

export type CommercialRevenueLineType = (typeof COMMERCIAL_REVENUE_LINE_TYPES)[number];
export type CommercialRevenueLineStatus = (typeof COMMERCIAL_REVENUE_LINE_STATUSES)[number];
export type CommercialOperatingStage = (typeof COMMERCIAL_OPERATING_STAGES)[number];
export type CommercialPlanHorizon = (typeof COMMERCIAL_PLAN_HORIZONS)[number];
export type CommercialPlanStatus = (typeof COMMERCIAL_PLAN_STATUSES)[number];
export type CommercialAssessmentSeverity = (typeof COMMERCIAL_ASSESSMENT_SEVERITIES)[number];
export type CommercialAssessmentStatus = (typeof COMMERCIAL_ASSESSMENT_STATUSES)[number];

export const REVENUE_LINE_CATALOG: Array<{
  type: CommercialRevenueLineType;
  label: string;
  purpose: string;
}> = [
  {
    type: 'live_event',
    label: 'Live Events',
    purpose: 'Operate event campaigns, audience strategy, leads, meetings, attendance and purchases.',
  },
  {
    type: 'online_course',
    label: 'Online Courses',
    purpose: 'Plan evergreen and launch-based course sales with content, funnel and CRM follow-up.',
  },
  {
    type: 'b2b',
    label: 'B2B',
    purpose: 'Manage corporate training, consulting offers, enterprise leads and account follow-up.',
  },
  {
    type: 'platinum_elite',
    label: 'Platinum Elite',
    purpose: 'Track premium programs, high-value buyers, exclusivity and conversion readiness.',
  },
  {
    type: 'certified_trainer_network',
    label: 'Certified Trainer Network',
    purpose: 'Coordinate certified trainer pipeline, enablement content and commercial opportunities.',
  },
  {
    type: 'loyalty_community',
    label: 'Loyalty & Community',
    purpose: 'Grow repeat purchase, community engagement, referrals and customer retention.',
  },
];

export const createRevenueLineSchema = z.object({
  revenueLineType: z.enum(COMMERCIAL_REVENUE_LINE_TYPES),
  name: z.string().trim().min(1).max(220),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(COMMERCIAL_REVENUE_LINE_STATUSES).default('active').optional(),
  systemOfRecord: z.string().trim().min(1).max(120).default('tanaghum').optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

export const createCommercialPlanSchema = z.object({
  revenueLineId: z.string().uuid(),
  linkedEventId: z.string().uuid().nullable().optional(),
  horizon: z.enum(COMMERCIAL_PLAN_HORIZONS),
  stage: z.enum(COMMERCIAL_OPERATING_STAGES).default('assess').optional(),
  title: z.string().trim().min(1).max(260),
  objective: z.string().trim().max(5000).nullable().optional(),
  audience: z.string().trim().max(5000).nullable().optional(),
  budgetTarget: z.number().min(0).nullable().optional(),
  revenueTarget: z.number().min(0).nullable().optional(),
  kpiTargets: z.record(z.unknown()).nullable().optional(),
  strategySummary: z.string().trim().max(8000).nullable().optional(),
  actionPlan: z.string().trim().max(8000).nullable().optional(),
  status: z.enum(COMMERCIAL_PLAN_STATUSES).default('draft').optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

export const updateCommercialPlanSchema = z.object({
  revenueLineId: z.string().uuid().optional(),
  linkedEventId: z.string().uuid().nullable().optional(),
  horizon: z.enum(COMMERCIAL_PLAN_HORIZONS).optional(),
  stage: z.enum(COMMERCIAL_OPERATING_STAGES).optional(),
  title: z.string().trim().min(1).max(260).optional(),
  objective: z.string().trim().max(5000).nullable().optional(),
  audience: z.string().trim().max(5000).nullable().optional(),
  budgetTarget: z.number().min(0).nullable().optional(),
  revenueTarget: z.number().min(0).nullable().optional(),
  kpiTargets: z.record(z.unknown()).nullable().optional(),
  strategySummary: z.string().trim().max(8000).nullable().optional(),
  actionPlan: z.string().trim().max(8000).nullable().optional(),
  status: z.enum(COMMERCIAL_PLAN_STATUSES).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one commercial plan field is required',
});

export const createAssessmentSignalSchema = z.object({
  revenueLineId: z.string().uuid().nullable().optional(),
  commercialPlanId: z.string().uuid().nullable().optional(),
  sourceType: z.string().trim().min(1).max(120).default('manual').optional(),
  title: z.string().trim().min(1).max(260),
  severity: z.enum(COMMERCIAL_ASSESSMENT_SEVERITIES).default('watch').optional(),
  finding: z.string().trim().max(8000).nullable().optional(),
  recommendedAction: z.string().trim().max(8000).nullable().optional(),
  status: z.enum(COMMERCIAL_ASSESSMENT_STATUSES).default('open').optional(),
});

export const dashboardQuerySchema = z.object({
  stage: z.enum(COMMERCIAL_OPERATING_STAGES).optional(),
  revenueLineType: z.enum(COMMERCIAL_REVENUE_LINE_TYPES).optional(),
});

export const listPlansQuerySchema = z.object({
  revenueLineId: z.string().uuid().optional(),
  stage: z.enum(COMMERCIAL_OPERATING_STAGES).optional(),
  horizon: z.enum(COMMERCIAL_PLAN_HORIZONS).optional(),
  status: z.enum(COMMERCIAL_PLAN_STATUSES).optional(),
});

export const listAssessmentSignalsQuerySchema = z.object({
  revenueLineId: z.string().uuid().optional(),
  commercialPlanId: z.string().uuid().optional(),
  status: z.enum(COMMERCIAL_ASSESSMENT_STATUSES).optional(),
});

export type CreateRevenueLineInput = z.infer<typeof createRevenueLineSchema>;
export type CreateCommercialPlanInput = z.infer<typeof createCommercialPlanSchema>;
export type UpdateCommercialPlanInput = z.infer<typeof updateCommercialPlanSchema>;
export type CreateAssessmentSignalInput = z.infer<typeof createAssessmentSignalSchema>;
export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
export type ListPlansQueryInput = z.infer<typeof listPlansQuerySchema>;
export type ListAssessmentSignalsQueryInput = z.infer<typeof listAssessmentSignalsQuerySchema>;

export interface CommercialRevenueLineSummary {
  id: string | null;
  tenantKey: string;
  revenueLineType: CommercialRevenueLineType;
  name: string;
  description: string | null;
  status: CommercialRevenueLineStatus | 'not_configured';
  systemOfRecord: string;
  ownerUserId: string | null;
  configured: boolean;
  planCount: number;
  openSignalCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CommercialPlanSummary {
  id: string;
  tenantKey: string;
  revenueLineId: string;
  revenueLineType: CommercialRevenueLineType;
  revenueLineName: string;
  linkedEventId: string | null;
  linkedEventName: string | null;
  horizon: CommercialPlanHorizon;
  stage: CommercialOperatingStage;
  title: string;
  objective: string | null;
  audience: string | null;
  budgetTarget: number | null;
  revenueTarget: number | null;
  kpiTargets: unknown;
  strategySummary: string | null;
  actionPlan: string | null;
  status: CommercialPlanStatus;
  ownerUserId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommercialAssessmentSignalSummary {
  id: string;
  tenantKey: string;
  revenueLineId: string | null;
  revenueLineType: CommercialRevenueLineType | null;
  commercialPlanId: string | null;
  sourceType: string;
  title: string;
  severity: CommercialAssessmentSeverity;
  finding: string | null;
  recommendedAction: string | null;
  status: CommercialAssessmentStatus;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommercialEventBridgeSummary {
  id: string;
  name: string;
  status: string;
  eventType: string;
  eventDate: Date;
  plannedBudget: number | null;
  revenueTarget: number | null;
  linkedPlanCount?: number;
  linkedPlanTitles?: string[];
}

export interface CommercialCommandCenterDashboard {
  revenueLines: CommercialRevenueLineSummary[];
  stageSummary: Record<CommercialOperatingStage, number>;
  planSummary: {
    total: number;
    active: number;
    draft: number;
    linkedToEvents: number;
  };
  signalSummary: {
    open: number;
    critical: number;
    risk: number;
  };
  recentPlans: CommercialPlanSummary[];
  openSignals: CommercialAssessmentSignalSummary[];
  eventBridge: {
    activeEvents: number;
    planningEvents: number;
    completedEvents: number;
    eventSectionPath: string;
  };
  stitchi: {
    supported: true;
    suggestedPrompt: string;
  };
}

export interface CommercialRevenueLineDashboard {
  revenueLine: CommercialRevenueLineSummary;
  rollups: {
    plannedRevenueTarget: number;
    knownRevenue: number;
    plannedBudget: number;
    knownSpend: number;
    budgetVariance: number | null;
    leads: number;
    purchases: number;
    meetingsBooked: number;
    meetingsAttended: number;
    noShows: number;
    costPerLead: number | null;
    costPerPurchase: number | null;
    leadToPurchaseRate: number | null;
  };
  dataStatus: {
    hasLinkedEvents: boolean;
    hasKpiRecords: boolean;
    hasLeadRecords: boolean;
    hasConnectorRecords: boolean;
    missingDataSources: string[];
  };
  plans: CommercialPlanSummary[];
  openSignals: CommercialAssessmentSignalSummary[];
  linkedEvents: CommercialEventBridgeSummary[];
  availableEvents: CommercialEventBridgeSummary[];
  connectorStatus: {
    jobs: number;
    readyForSync: number;
    synced: number;
    blocked: number;
  };
  nextAction: {
    label: string;
    description: string;
    path: string | null;
  };
}
