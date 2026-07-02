export interface CloseoutReport {
  event: EventSummary;
  timeline: EventTimelineEntry[];
  budget: BudgetSection;
  leadFunnel: LeadFunnelSection;
  salesOutcomes: SalesOutcomesSection;
  channelPerformance: ChannelPerformanceRow[];
  sourcePerformance: SourcePerformanceRow[];
  topBarriers: TopBarrierRow[];
  campaigns: CampaignSummaryRow[];
  contentPackages: ContentPackageRow[];
  openFollowUps: OpenFollowUpRow[];
  plannerSummary: PlannerSummarySection;
  dataCompleteness: DataCompletenessSection;
}

export interface EventSummary {
  eventId: string;
  eventName: string;
  eventType: string;
  eventDate: Date;
  location: string | null;
  status: string;
  ownerName: string | null;
  geography: string | null;
  expectedAttendance: number | null;
  revenueTarget: number | null;
  plannedBudget: number | null;
  campaignStartDate: Date | null;
  campaignEndDate: Date | null;
}

export interface EventTimelineEntry {
  date: Date;
  label: string;
  category: string;
}

export interface BudgetSection {
  plannedBudget: number | null;
  knownSpend: number;
  budgetVariance: number | null;
  spendSource: string;
}

export interface LeadFunnelSection {
  totalLeads: number;
  byStatus: Record<string, number>;
  byTemperature: Record<string, number>;
}

export interface SalesOutcomesSection {
  meetingsBooked: number;
  meetingsAttended: number;
  noShows: number;
  noShowRate: number;
  purchases: number;
  revenue: number;
}

export interface ChannelPerformanceRow {
  channel: string;
  leads: number;
  purchases: number;
  spend: number;
}

export interface SourcePerformanceRow {
  source: string;
  leads: number;
  purchases: number;
}

export interface TopBarrierRow {
  id: string;
  title: string;
  severity: string;
  category: string;
  status: string;
  ownerRole: string | null;
}

export interface CampaignSummaryRow {
  id: string;
  title: string;
  status: string;
  platforms: string[];
  createdAt: Date;
}

export interface ContentPackageRow {
  id: string;
  packageStatus: string;
  packageType: string;
  createdAt: Date;
}

export interface OpenFollowUpRow {
  type: 'lead_follow_up' | 'sales_task' | 'content_requirement' | 'problem';
  id: string;
  title: string;
  dueDate: Date | null;
  ownerRole: string | null;
  severity: string | null;
}

export interface PlannerSummarySection {
  emailPlans: number;
  whatsappPlans: number;
  upsellPlans: number;
  contentRequirements: number;
  salesTasks: number;
}

export interface DataCompletenessSection {
  hasKpiRecords: boolean;
  hasLeads: boolean;
  hasCampaigns: boolean;
  hasProblems: boolean;
  hasContentPackages: boolean;
  hasPlannerData: boolean;
  missingSections: string[];
}
