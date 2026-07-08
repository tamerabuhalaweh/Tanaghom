import { z } from 'zod';
import { COMMERCIAL_REVENUE_LINE_TYPES } from '../commercial-command-center/types';

export const EXECUTIVE_REPORT_CADENCES = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'] as const;
export const EXECUTIVE_REPORT_STATUSES = ['preview', 'generated', 'approved_send_ready', 'archived'] as const;
export const EXECUTIVE_REPORT_DELIVERY_CHANNELS = ['dashboard', 'email', 'whatsapp'] as const;
export const EXECUTIVE_REPORT_SCHEDULE_STATUSES = ['active', 'paused', 'archived'] as const;

export type ExecutiveReportCadence = (typeof EXECUTIVE_REPORT_CADENCES)[number];
export type ExecutiveReportStatus = (typeof EXECUTIVE_REPORT_STATUSES)[number];
export type ExecutiveReportDeliveryChannel = (typeof EXECUTIVE_REPORT_DELIVERY_CHANNELS)[number];
export type ExecutiveReportScheduleStatus = (typeof EXECUTIVE_REPORT_SCHEDULE_STATUSES)[number];

export const executiveDashboardQuerySchema = z.object({
  revenueLineType: z.enum(COMMERCIAL_REVENUE_LINE_TYPES).optional(),
  eventId: z.string().uuid().optional(),
  location: z.string().trim().max(220).optional(),
  channel: z.string().trim().max(120).optional(),
  sourceType: z.enum(['manual', 'imported', 'connector']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const createExecutiveReportPreviewSchema = executiveDashboardQuerySchema.extend({
  cadence: z.enum(EXECUTIVE_REPORT_CADENCES),
  title: z.string().trim().min(1).max(260).optional(),
  timezone: z.string().trim().min(1).max(80).default('UTC').optional(),
});

export const listExecutiveReportsQuerySchema = z.object({
  cadence: z.enum(EXECUTIVE_REPORT_CADENCES).optional(),
  status: z.enum(EXECUTIVE_REPORT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

export const createExecutiveReportScheduleSchema = z.object({
  cadence: z.enum(EXECUTIVE_REPORT_CADENCES),
  timezone: z.string().trim().min(1).max(80).default('UTC').optional(),
  recipients: z.array(z.string().trim().min(3).max(220)).max(25).default([]).optional(),
  deliveryChannels: z.array(z.enum(EXECUTIVE_REPORT_DELIVERY_CHANNELS)).min(1).max(3).default(['dashboard']).optional(),
  approvalRequired: z.boolean().default(true).optional(),
  nextRunAt: z.coerce.date().nullable().optional(),
});

export const listExecutiveReportSchedulesQuerySchema = z.object({
  status: z.enum(EXECUTIVE_REPORT_SCHEDULE_STATUSES).optional(),
});

export type ExecutiveDashboardQueryInput = z.infer<typeof executiveDashboardQuerySchema>;
export type CreateExecutiveReportPreviewInput = z.infer<typeof createExecutiveReportPreviewSchema>;
export type ListExecutiveReportsQueryInput = z.infer<typeof listExecutiveReportsQuerySchema>;
export type CreateExecutiveReportScheduleInput = z.infer<typeof createExecutiveReportScheduleSchema>;
export type ListExecutiveReportSchedulesQueryInput = z.infer<typeof listExecutiveReportSchedulesQuerySchema>;

export interface ExecutiveMetricSummary {
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
  reach: number;
  impressions: number;
  interactions: number;
  clicks: number;
  formCompletions: number;
  costPerLead: number | null;
  costPerPurchase: number | null;
  leadToPurchaseRate: number | null;
  meetingShowRate: number | null;
  formCompletionRate: number | null;
}

export interface ExecutiveAlert {
  code: string;
  severity: 'info' | 'watch' | 'risk' | 'critical';
  title: string;
  detail: string;
  recommendedAction: string;
}

export interface ExecutiveDashboard {
  generatedAt: Date;
  period: {
    startDate: Date | null;
    endDate: Date | null;
  };
  filters: ExecutiveDashboardQueryInput;
  metrics: ExecutiveMetricSummary;
  confidence: 'high' | 'medium' | 'low';
  missingSources: string[];
  dataFreshness: Array<{
    source: string;
    status: 'current' | 'stale' | 'missing';
    lastSeenAt: Date | null;
    detail: string;
  }>;
  revenueLines: Array<{
    type: string;
    name: string;
    status: string;
    plannedRevenueTarget: number;
    plannedBudget: number;
    knownRevenue: number;
    knownSpend: number;
    leads: number;
    purchases: number;
  }>;
  channelPerformance: Array<{
    channel: string;
    spend: number;
    reach: number;
    leads: number;
    purchases: number;
    costPerLead: number | null;
    costPerPurchase: number | null;
  }>;
  sourceBreakdown: Array<{
    sourceType: string;
    records: number;
    spend: number;
    leads: number;
    purchases: number;
  }>;
  disciplineSummary: {
    total: number;
    active: number;
    blocked: number;
    completed: number;
    critical: number;
  };
  connectorReadiness: {
    jobs: number;
    readyForSync: number;
    synced: number;
    blocked: number;
    lastSyncAt: Date | null;
  };
  alerts: ExecutiveAlert[];
  reports: {
    recent: ExecutiveReportSummary[];
    activeSchedules: ExecutiveReportScheduleSummary[];
    nextRecommendedCadence: ExecutiveReportCadence;
  };
  stitchi: {
    suggestedPrompt: string;
  };
}

export interface ExecutiveReportSummary {
  id: string;
  cadence: ExecutiveReportCadence;
  periodStart: Date;
  periodEnd: Date;
  timezone: string;
  status: ExecutiveReportStatus;
  title: string;
  summary: string | null;
  metrics: unknown;
  alerts: unknown;
  missingSources: unknown;
  confidence: string;
  createdAt: Date;
}

export interface ExecutiveReportScheduleSummary {
  id: string;
  cadence: ExecutiveReportCadence;
  timezone: string;
  recipients: string[];
  deliveryChannels: ExecutiveReportDeliveryChannel[];
  status: ExecutiveReportScheduleStatus;
  approvalRequired: boolean;
  nextRunAt: Date | null;
  lastPreviewReportId: string | null;
  createdAt: Date;
}
