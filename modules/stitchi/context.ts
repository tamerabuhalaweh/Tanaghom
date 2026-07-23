import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import {
  evaluateEventTargets,
  getEventCapacity,
  listEffectiveEventTargets,
} from '../commercial-kpi-governance/repository';
import { getGhlSyncStatus } from '../ghl-sync/repository';
import { listMappings as listGhlAttributionMappings } from '../ghl-plan-attribution/repository';
import type { StitchiConversationSummary } from './types';

export interface StitchiReadOnlyContext {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentName: string | null;
  };
  conversation: {
    id: string;
    title: string;
    eventId: string | null;
  };
  selectedEvent: EventContext | null;
  recentEvents: EventContext[];
  leadSummary: {
    total: number;
    byStatus: Record<string, number>;
    byTemperature: Record<string, number>;
    purchases: number;
    knownRevenue: number;
  };
  kpiSummary: {
    records: number;
    reach: number;
    impressions: number;
    interactions: number;
    clicks: number;
    formCompletions: number;
    leads: number;
    meetingsBooked: number;
    meetingsAttended: number;
    purchases: number;
    noShows: number;
    spend: number;
  };
  governedPerformance: {
    eventCapacity: {
      venueCapacity: number | null;
      sellableTicketCapacity: number | null;
      source: string | null;
      confirmedAt: Date | null;
      isAbsolute: boolean;
    } | null;
    effectiveTargets: Array<{
      id: string;
      metricKey: string;
      label: string;
      unit: string;
      direction: string;
      controlMode: string;
      targetValue: number;
      warningValue: number | null;
      criticalValue: number | null;
      currency: string | null;
      appliedAs: string;
    }>;
    inheritedTargets: number;
    eventSpecificTargets: number;
    dailyEvaluation: {
      onTrack: number;
      warning: number;
      critical: number;
      thresholdsMissing: number;
      actualUnavailable: number;
      latestEvidenceAt: Date | null;
      targets: Array<{
        label: string;
        status: string;
        actualValue: number | null;
        targetValue: number;
        reason: string;
      }>;
    };
    ghlAttribution: {
      mappingCount: number;
      approvedMappingId: string | null;
      readyForMatching: boolean;
      missingCustomerDefinitions: string[];
    };
  };
  riskSummary: {
    open: number;
    critical: number;
    topOpen: Array<{ title: string; severity: string; category: string }>;
  };
  connectorSummary: {
    configuredCredentials: number;
    connectorJobs: number;
    readyForSync: number;
    synced: number;
    blocked: number;
  };
  unifiedDataLayer: {
    kajabi: DataSourceContext;
    acquisition: DataSourceContext[];
    whatsappFollowUp: {
      sourceOfTruth: 'gohighlevel';
      ghlCredentialStatus: string;
      whatsappCredentialStatus: string;
      readyForPreparedFollowUp: boolean;
      executionEnabled: boolean;
      externalWritesAllowed: false;
      requiredActions: string[];
    };
    smartLabsVoice: {
      credentialStatus: string;
      readyForHandoffPreview: boolean;
      executionEnabled: boolean;
      externalCallsAllowed: false;
      requiredActions: string[];
    };
  };
  ghlCrm: {
    sourceOfTruth: 'gohighlevel';
    tanaghumRole: 'operating_reporting_layer';
    credentialStatus: string;
    mappingStatus: string;
    readinessStatus: string;
    readyForReadSync: boolean;
    readSyncEnabled: boolean;
    writeBackEnabled: boolean;
    externalWritesAllowed: false;
    mirroredLeadCount: number;
    lastSyncAt: Date | null;
    requiredActions: string[];
    rawSecretsReturned: false;
  };
  commercialCenter: {
    defaultCurrency: 'AED' | 'USD';
    configuredRevenueLines: number;
    activePlans: number;
    openAssessmentSignals: number;
    revenueLines: Array<{
      id: string | null;
      type: string;
      name: string;
      status: string;
      planCount: number;
      openSignals: number;
    }>;
    recentPlans: Array<{
      id: string;
      title: string;
      stage: string;
      revenueLine: string;
      status: string;
        budgetTarget: number | null;
        revenueTarget: number | null;
        currency: string;
        linkedEventId: string | null;
    }>;
  };
  annualPlanning: {
    currentPlan: {
      id: string;
      revision: number;
      year: number;
      title: string;
      status: string;
      currency: string;
      budgetTarget: number;
      revenueTarget: number;
      itemCount: number;
      allocatedBudget: number;
      monthlyItems: Array<{
        id: string;
        month: number;
        title: string;
        revenueLineId: string;
        revenueLineName: string;
        commercialPlanId: string | null;
        eventId: string | null;
        currency: string;
        budgetAllocation: number;
        revenueTarget: number;
        priority: string;
        readiness: string;
        plannedStartDate: Date | null;
        plannedEndDate: Date | null;
      }>;
    } | null;
    approvedLearningSets: Array<{ id: string; title: string; findingCount: number }>;
    requiredActions: string[];
  };
  commercialHierarchy: {
    linkedPlans: Array<{
      commercialPlanId: string;
      commercialPlanTitle: string;
      annualPlanId: string;
      annualPlanTitle: string;
      year: number;
      monthlyPortfolioItemId: string;
      monthlyTitle: string;
      month: number;
      linkedEvents: number;
      linkedCampaigns: number;
    }>;
    orphanPlans: Array<{ id: string; title: string; status: string }>;
    requiredActions: string[];
  };
  commercialExecutive: {
    recentReports: number;
    activeSchedules: number;
    latestReportTitle: string | null;
    latestReportStatus: string | null;
    latestReportConfidence: string | null;
    requiredActions: string[];
  };
  historicalAssessment: {
    recentRuns: number;
    latestRunId: string | null;
    latestRunStatus: string | null;
    latestRunTitle: string | null;
    latestDateFrom: Date | null;
    latestDateTo: Date | null;
    latestEvidenceCount: number;
    latestMissingData: unknown;
    pendingFindings: Array<{
      id: string;
      type: string;
      title: string;
      summary: string;
      recommendation: string;
      confidence: number;
      evidenceIds: string[];
    }>;
    approvedLearning: Array<{
      id: string;
      learningSetId: string;
      type: string;
      title: string;
      recommendation: string;
      confidence: number;
    }>;
    requiredActions: string[];
  };
  guardrails: {
    mode: 'read_only';
    writesExecuted: false;
    externalExecution: 'blocked';
    secretsReturned: false;
  };
}

interface DataSourceContext {
  provider: string;
  credentialStatus: string;
  importJobStatus: string;
  lastDryRunAt: Date | null;
  lastSyncAt: Date | null;
  requiredActions: string[];
}

interface EventContext {
  id: string;
  name: string;
  status: string;
  eventType: string;
  eventDate: Date;
  location: string | null;
  plannedBudget: number | null;
  revenueTarget: number | null;
  selectedChannels: string[];
}

export async function loadReadOnlyContext(
  tenantKey: string,
  conversation: StitchiConversationSummary,
  requestedEventId?: string,
  currentUserRole = 'unknown',
): Promise<StitchiReadOnlyContext> {
  const eventId = requestedEventId || conversation.eventId || undefined;
  const commercialClients = prisma as unknown as {
    tenant?: {
      findUnique(args: unknown): Promise<{ default_currency?: unknown } | null>;
    };
    commercialRevenueLine?: {
      findMany(args: unknown): Promise<Array<{
        id: string;
        revenue_line_type: unknown;
        name: string;
        status: unknown;
        _count?: { plans?: number; assessment_signals?: number };
      }>>;
    };
    commercialPlan?: {
      findMany(args: unknown): Promise<Array<{
        title: string;
        stage: unknown;
        status: unknown;
        id: string;
        budget_target: unknown;
        revenue_target: unknown;
        currency?: unknown;
        linked_event_id: string | null;
        revenue_line: { name: string };
        hierarchy_assignment?: { id: string } | null;
      }>>;
    };
    commercialPlanHierarchyAssignment?: {
      findMany(args: unknown): Promise<Array<{
        commercial_plan_id: string;
        annual_plan_id: string;
        monthly_portfolio_item_id: string;
        commercial_plan: {
          title: string;
          _count?: { event_links?: number; campaign_links?: number };
        };
        annual_plan: { title: string; year: number };
        monthly_item: { title: string; month: number };
      }>>;
    };
    commercialAssessmentSignal?: {
      findMany(args: unknown): Promise<Array<{ id: string }>>;
    };
    commercialExecutiveReport?: {
      findMany(args: unknown): Promise<Array<{
        title: string;
        status: unknown;
        confidence: string;
        created_at: Date;
      }>>;
    };
    commercialExecutiveReportSchedule?: {
      findMany(args: unknown): Promise<Array<{ id: string }>>;
    };
    commercialHistoricalAssessmentRun?: {
      findMany(args: unknown): Promise<Array<{
        id: string;
        title: string;
        status: unknown;
        date_from: Date;
        date_to: Date;
        missing_data: unknown;
        created_at: Date;
        _count?: { evidence?: number };
        findings: Array<{
          id: string;
          finding_type: unknown;
          title: string;
          summary: string;
          recommendation: string;
          confidence: unknown;
          evidence_ids: string[];
        }>;
      }>>;
    };
    commercialLearningSet?: {
      findMany(args: unknown): Promise<Array<{
        id: string;
        title: string;
        findings: Array<{
          id: string;
          finding_type: unknown;
          title: string;
          recommendation: string;
          confidence: unknown;
          evidence_ids: string[];
        }>;
      }>>;
    };
    annualCommercialPlan?: {
      findMany(args: unknown): Promise<Array<{
        id: string;
        year: number;
        title: string;
        revision: number;
        status: unknown;
        currency: unknown;
        budget_target: unknown;
        revenue_target: unknown;
        items: Array<{
          id: string;
          month: number;
          title: string;
          revenue_line_id: string;
          commercial_plan_id: string | null;
          event_id: string | null;
          currency: unknown;
          budget_allocation: unknown;
          revenue_target: unknown;
          priority: unknown;
          readiness: unknown;
          planned_start_date: Date | null;
          planned_end_date: Date | null;
          revenue_line: { name: string };
        }>;
      }>>;
    };
  };

  const hierarchyAssignmentQuery = {
    where: { tenant_key: tenantKey, status: 'active' as const },
    select: {
      commercial_plan_id: true,
      annual_plan_id: true,
      monthly_portfolio_item_id: true,
      commercial_plan: {
        select: {
          title: true,
          _count: {
            select: {
              event_links: { where: { status: 'active' as const } },
              campaign_links: { where: { status: 'active' as const } },
            },
          },
        },
      },
      annual_plan: { select: { title: true, year: true } },
      monthly_item: { select: { title: true, month: true } },
    },
    orderBy: { created_at: 'desc' as const },
    take: 20,
  } satisfies Prisma.CommercialPlanHierarchyAssignmentFindManyArgs;

  const [
    tenantSettings,
    currentUser,
    selectedEvent,
    recentEvents,
    leads,
    kpis,
    openProblems,
    credentials,
    connectorJobs,
    ghlCrm,
    revenueLines,
    commercialPlans,
    assessmentSignals,
    executiveReports,
    executiveSchedules,
    historicalAssessmentRuns,
    learningSets,
    annualPlans,
    hierarchyAssignments,
  ] = await Promise.all([
    commercialClients.tenant?.findUnique({
      where: { tenant_key: tenantKey },
      select: { default_currency: true },
    }) ?? Promise.resolve(null),
    prisma.user.findFirst({
      where: { id: conversation.userId, tenant_key: tenantKey },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: { select: { name: true } },
      },
    }),
    eventId
      ? prisma.commercialEvent.findFirst({
        where: { id: eventId, tenant_key: tenantKey },
        select: eventSelect,
      })
      : Promise.resolve(null),
    prisma.commercialEvent.findMany({
      where: { tenant_key: tenantKey },
      select: eventSelect,
      orderBy: { event_date: 'desc' },
      take: 5,
    }),
    prisma.leadCaptureRecord.findMany({
      where: { tenant_key: tenantKey, ...(eventId ? { event_id: eventId } : {}) },
      select: {
        lead_status: true,
        lead_temperature: true,
        purchase_amount: true,
      },
      take: 500,
    }),
    prisma.eventKpiRecord.findMany({
      where: { tenant_key: tenantKey, ...(eventId ? { event_id: eventId } : {}) },
      select: {
        reach: true,
        impressions: true,
        interactions: true,
        clicks: true,
        form_completions: true,
        leads: true,
        meetings_booked: true,
        meetings_attended: true,
        purchases: true,
        no_shows: true,
        spend: true,
      },
      take: 500,
    }),
    prisma.eventProblem.findMany({
      where: { tenant_key: tenantKey, ...(eventId ? { event_id: eventId } : {}), status: { in: ['open', 'investigating'] } },
      select: {
        title: true,
        severity: true,
        category: true,
      },
      orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
      take: 5,
    }),
    prisma.integrationCredential.findMany({
      where: { tenant_key: tenantKey, is_active: true },
      select: { id: true, provider: true, credential_type: true, last_validated_at: true },
      take: 100,
    }),
    prisma.connectorImportJob.findMany({
      where: { tenant_key: tenantKey, ...(eventId ? { event_id: eventId } : {}) },
      select: {
        connector_id: true,
        sync_status: true,
        state: true,
        last_dry_run_at: true,
        last_sync_at: true,
      },
      take: 100,
    }),
    loadGhlCrmSummary(tenantKey, eventId),
    commercialClients.commercialRevenueLine?.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        revenue_line_type: true,
        name: true,
        status: true,
        _count: {
          select: {
            plans: true,
            assessment_signals: { where: { status: { in: ['open', 'reviewing'] } } },
          },
        },
      },
      take: 50,
    }) ?? Promise.resolve([]),
    commercialClients.commercialPlan?.findMany({
      where: { tenant_key: tenantKey },
      select: {
        title: true,
        stage: true,
        status: true,
        id: true,
        budget_target: true,
        revenue_target: true,
        currency: true,
        linked_event_id: true,
        revenue_line: { select: { name: true } },
        hierarchy_assignment: { select: { id: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
    }) ?? Promise.resolve([]),
    commercialClients.commercialAssessmentSignal?.findMany({
      where: { tenant_key: tenantKey, status: { in: ['open', 'reviewing'] } },
      select: { id: true },
      take: 100,
    }) ?? Promise.resolve([]),
    commercialClients.commercialExecutiveReport?.findMany({
      where: { tenant_key: tenantKey },
      select: {
        title: true,
        status: true,
        confidence: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 3,
    }) ?? Promise.resolve([]),
    commercialClients.commercialExecutiveReportSchedule?.findMany({
      where: { tenant_key: tenantKey, status: 'active' },
      select: { id: true },
      take: 20,
    }) ?? Promise.resolve([]),
    commercialClients.commercialHistoricalAssessmentRun?.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        title: true,
        status: true,
        date_from: true,
        date_to: true,
        missing_data: true,
        created_at: true,
        _count: { select: { evidence: true } },
        findings: {
          where: { decision: 'pending' },
          select: {
            id: true,
            finding_type: true,
            title: true,
            summary: true,
            recommendation: true,
            confidence: true,
            evidence_ids: true,
          },
          take: 12,
        },
      },
      orderBy: { created_at: 'desc' },
      take: 3,
    }) ?? Promise.resolve([]),
    commercialClients.commercialLearningSet?.findMany({
      where: { tenant_key: tenantKey, status: 'active' },
      select: {
        id: true,
        title: true,
        findings: {
          where: { decision: 'approved' },
          select: { id: true, finding_type: true, title: true, recommendation: true, confidence: true, evidence_ids: true },
          take: 12,
        },
      },
      orderBy: { approved_at: 'desc' },
      take: 3,
    }) ?? Promise.resolve([]),
    commercialClients.annualCommercialPlan?.findMany({
      where: { tenant_key: tenantKey, status: { not: 'archived' } },
      select: {
        id: true,
        revision: true,
        year: true,
        title: true,
        status: true,
        currency: true,
        budget_target: true,
        revenue_target: true,
        items: {
          where: { archived_at: null },
          select: {
            id: true,
            month: true,
            title: true,
            revenue_line_id: true,
            commercial_plan_id: true,
            event_id: true,
            currency: true,
            budget_allocation: true,
            revenue_target: true,
            priority: true,
            readiness: true,
            planned_start_date: true,
            planned_end_date: true,
            revenue_line: { select: { name: true } },
          },
          orderBy: [{ month: 'asc' }, { sort_order: 'asc' }],
        },
      },
      orderBy: [{ year: 'desc' }, { scenario_version: 'desc' }],
      take: 3,
    }) ?? Promise.resolve([]),
    commercialClients.commercialPlanHierarchyAssignment?.findMany(hierarchyAssignmentQuery) ?? Promise.resolve([]),
  ]);
  const governedPerformance =
    eventId && selectedEvent
      ? await loadGovernedPerformanceContext(tenantKey, eventId)
      : emptyGovernedPerformanceContext();

  return {
    currentUser: {
      id: currentUser?.id || conversation.userId,
      name: currentUser?.name || 'Tanaghum user',
      email: currentUser?.email || '',
      role: currentUserRole,
      departmentName: currentUser?.department?.name || null,
    },
    conversation: {
      id: conversation.id,
      title: conversation.title,
      eventId: conversation.eventId,
    },
    selectedEvent: selectedEvent ? mapEvent(selectedEvent) : null,
    recentEvents: recentEvents.filter(event => isCustomerVisibleRecordName(event.name)).map(mapEvent),
    leadSummary: summarizeLeads(leads),
    kpiSummary: summarizeKpis(kpis),
    governedPerformance,
    riskSummary: summarizeProblems(openProblems),
    connectorSummary: summarizeConnectors(credentials.length, connectorJobs),
    unifiedDataLayer: summarizeUnifiedDataLayer(credentials, connectorJobs),
    ghlCrm,
    commercialCenter: {
      defaultCurrency: String(tenantSettings?.default_currency) === 'USD' ? 'USD' : 'AED',
      configuredRevenueLines: revenueLines.filter(line => String(line.status) === 'active').length,
      activePlans: commercialPlans.filter(plan => String(plan.status) === 'active').length,
      openAssessmentSignals: assessmentSignals.length,
      revenueLines: revenueLines.map(line => ({
        id: line.id,
        type: String(line.revenue_line_type),
        name: line.name,
        status: String(line.status),
        planCount: line._count?.plans || 0,
        openSignals: line._count?.assessment_signals || 0,
      })),
      recentPlans: commercialPlans.map(plan => ({
        id: plan.id,
        title: plan.title,
        stage: String(plan.stage),
        revenueLine: plan.revenue_line.name,
        status: String(plan.status),
        budgetTarget: decimalToNumber(plan.budget_target),
        revenueTarget: decimalToNumber(plan.revenue_target),
        currency: String(plan.currency || tenantSettings?.default_currency || 'AED'),
        linkedEventId: plan.linked_event_id,
      })),
    },
    annualPlanning: summarizeAnnualPlanning(annualPlans, learningSets),
    commercialHierarchy: summarizeCommercialHierarchy(commercialPlans, hierarchyAssignments),
    commercialExecutive: summarizeExecutiveReporting(executiveReports, executiveSchedules),
    historicalAssessment: {
      recentRuns: historicalAssessmentRuns.length,
      latestRunId: historicalAssessmentRuns[0]?.id || null,
      latestRunStatus: historicalAssessmentRuns[0] ? String(historicalAssessmentRuns[0].status) : null,
      latestRunTitle: historicalAssessmentRuns[0]?.title || null,
      latestDateFrom: historicalAssessmentRuns[0]?.date_from || null,
      latestDateTo: historicalAssessmentRuns[0]?.date_to || null,
      latestEvidenceCount: historicalAssessmentRuns[0]?._count?.evidence || 0,
      latestMissingData: historicalAssessmentRuns[0]?.missing_data || [],
      pendingFindings: (historicalAssessmentRuns[0]?.findings || []).map(finding => ({
        id: finding.id,
        type: String(finding.finding_type),
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        confidence: decimalToNumber(finding.confidence) || 0,
        evidenceIds: finding.evidence_ids,
      })),
      approvedLearning: learningSets.flatMap(set => set.findings).slice(0, 12).map(finding => ({
        id: finding.id,
        learningSetId: learningSets.find(set => set.findings.some(candidate => candidate.id === finding.id))?.id || '',
        type: String(finding.finding_type),
        title: finding.title,
        recommendation: finding.recommendation,
        confidence: decimalToNumber(finding.confidence) || 0,
      })),
      requiredActions: historicalAssessmentRuns.length
        ? learningSets.length ? [] : ['Review and approve evidence-backed historical findings before reusing them in future plans.']
        : ['Create a historical assessment before preparing the next commercial plan.'],
    },
    guardrails: {
      mode: 'read_only',
      writesExecuted: false,
      externalExecution: 'blocked',
      secretsReturned: false,
    },
  };
}

function summarizeAnnualPlanning(
  plans: Array<{
    id: string;
    revision: number;
    year: number;
    title: string;
    status: unknown;
    currency: unknown;
    budget_target: unknown;
    revenue_target: unknown;
    items: Array<{
      id: string;
      month: number;
      title: string;
      revenue_line_id: string;
      commercial_plan_id: string | null;
      event_id: string | null;
      currency: unknown;
      budget_allocation: unknown;
      revenue_target: unknown;
      priority: unknown;
      readiness: unknown;
      planned_start_date: Date | null;
      planned_end_date: Date | null;
      revenue_line: { name: string };
    }>;
  }>,
  learningSets: Array<{ id: string; title: string; findings: unknown[] }>,
): StitchiReadOnlyContext['annualPlanning'] {
  const current = plans.find(plan => ['active', 'approved'].includes(String(plan.status))) || plans[0] || null;
  const currentCurrency = current ? String(current.currency) : 'AED';
  const currentPlan = current ? {
    id: current.id,
    revision: current.revision,
    year: current.year,
    title: current.title,
    status: String(current.status),
    currency: currentCurrency,
    budgetTarget: decimalToNumber(current.budget_target) || 0,
    revenueTarget: decimalToNumber(current.revenue_target) || 0,
    itemCount: current.items.length,
    allocatedBudget: current.items
      .filter(item => String(item.currency) === currentCurrency)
      .reduce((sum, item) => sum + (decimalToNumber(item.budget_allocation) || 0), 0),
    monthlyItems: current.items.map(item => ({
      id: item.id,
      month: item.month,
      title: item.title,
      revenueLineId: item.revenue_line_id,
      revenueLineName: item.revenue_line.name,
      commercialPlanId: item.commercial_plan_id,
      eventId: item.event_id,
      currency: String(item.currency),
      budgetAllocation: decimalToNumber(item.budget_allocation) || 0,
      revenueTarget: decimalToNumber(item.revenue_target) || 0,
      priority: String(item.priority),
      readiness: String(item.readiness),
      plannedStartDate: item.planned_start_date,
      plannedEndDate: item.planned_end_date,
    })),
  } : null;
  const requiredActions: string[] = [];
  if (!currentPlan) requiredActions.push('Prepare the next annual commercial strategy and total budget for approval.');
  else if (!currentPlan.itemCount) requiredActions.push(`Add the monthly products and events that will deliver the ${currentPlan.year} plan.`);
  if (!learningSets.length) requiredActions.push('Approve historical assessment findings before reusing them in annual planning.');
  return {
    currentPlan,
    approvedLearningSets: learningSets.map(set => ({ id: set.id, title: set.title, findingCount: set.findings.length })),
    requiredActions,
  };
}

function summarizeCommercialHierarchy(
  plans: Array<{
    id: string;
    title: string;
    status: unknown;
    hierarchy_assignment?: { id: string } | null;
  }>,
  assignments: Array<{
    commercial_plan_id: string;
    annual_plan_id: string;
    monthly_portfolio_item_id: string;
    commercial_plan: {
      title: string;
      _count?: { event_links?: number; campaign_links?: number };
    };
    annual_plan: { title: string; year: number };
    monthly_item: { title: string; month: number };
  }>,
): StitchiReadOnlyContext['commercialHierarchy'] {
  const linkedPlanIds = new Set(assignments.map(assignment => assignment.commercial_plan_id));
  const orphanPlans = plans
    .filter(plan => !plan.hierarchy_assignment && !linkedPlanIds.has(plan.id))
    .filter(plan => !['archived', 'superseded'].includes(String(plan.status)))
    .map(plan => ({ id: plan.id, title: plan.title, status: String(plan.status) }));
  const linkedPlans = assignments.map(assignment => ({
    commercialPlanId: assignment.commercial_plan_id,
    commercialPlanTitle: assignment.commercial_plan.title,
    annualPlanId: assignment.annual_plan_id,
    annualPlanTitle: assignment.annual_plan.title,
    year: assignment.annual_plan.year,
    monthlyPortfolioItemId: assignment.monthly_portfolio_item_id,
    monthlyTitle: assignment.monthly_item.title,
    month: assignment.monthly_item.month,
    linkedEvents: assignment.commercial_plan._count?.event_links || 0,
    linkedCampaigns: assignment.commercial_plan._count?.campaign_links || 0,
  }));
  const requiredActions: string[] = [];
  if (orphanPlans.length) {
    requiredActions.push(`${orphanPlans.length} recent execution plan(s) still need an annual and monthly parent.`);
  }
  if (linkedPlans.some(plan => plan.linkedEvents + plan.linkedCampaigns === 0)) {
    requiredActions.push('Connect operating events or campaigns to plans that have no execution work yet.');
  }
  return { linkedPlans, orphanPlans, requiredActions };
}

function summarizeExecutiveReporting(
  reports: Array<{ title: string; status: unknown; confidence: string; created_at: Date }>,
  schedules: Array<{ id: string }>,
): StitchiReadOnlyContext['commercialExecutive'] {
  const latest = reports[0] || null;
  const requiredActions: string[] = [];
  if (!latest) requiredActions.push('Generate the first CEO commercial report preview.');
  if (!schedules.length) requiredActions.push('Configure the daily 9 AM executive report workflow for CEO, GM, and CCO.');
  if (latest && latest.confidence === 'low') requiredActions.push('Improve report confidence by connecting/importing CRM, analytics, and course data.');
  return {
    recentReports: reports.length,
    activeSchedules: schedules.length,
    latestReportTitle: latest?.title || null,
    latestReportStatus: latest ? String(latest.status) : null,
    latestReportConfidence: latest?.confidence || null,
    requiredActions,
  };
}

async function loadGhlCrmSummary(tenantKey: string, eventId?: string) {
  try {
    const status = await getGhlSyncStatus(tenantKey, eventId);
    return {
      sourceOfTruth: 'gohighlevel' as const,
      tanaghumRole: 'operating_reporting_layer' as const,
      credentialStatus: status.credentialStatus,
      mappingStatus: status.mappingStatus,
      readinessStatus: status.acceptance.status,
      readyForReadSync: status.acceptance.readyForReadSync,
      readSyncEnabled: status.readSyncEnabled,
      writeBackEnabled: status.writeBackEnabled,
      externalWritesAllowed: false as const,
      mirroredLeadCount: status.ghlLeadCount,
      lastSyncAt: status.lastSyncAt,
      requiredActions: status.requiredActions,
      rawSecretsReturned: false as const,
    };
  } catch {
    return {
      sourceOfTruth: 'gohighlevel' as const,
      tanaghumRole: 'operating_reporting_layer' as const,
      credentialStatus: 'unknown',
      mappingStatus: 'unknown',
      readinessStatus: 'unavailable',
      readyForReadSync: false,
      readSyncEnabled: false,
      writeBackEnabled: false,
      externalWritesAllowed: false as const,
      mirroredLeadCount: 0,
      lastSyncAt: null,
      requiredActions: ['GoHighLevel CRM readiness could not be loaded. Ask an admin to check Connector Setup.'],
      rawSecretsReturned: false as const,
    };
  }
}

function emptyGovernedPerformanceContext(): StitchiReadOnlyContext['governedPerformance'] {
  return {
    eventCapacity: null,
    effectiveTargets: [],
    inheritedTargets: 0,
    eventSpecificTargets: 0,
    dailyEvaluation: {
      onTrack: 0,
      warning: 0,
      critical: 0,
      thresholdsMissing: 0,
      actualUnavailable: 0,
      latestEvidenceAt: null,
      targets: [],
    },
    ghlAttribution: {
      mappingCount: 0,
      approvedMappingId: null,
      readyForMatching: false,
      missingCustomerDefinitions: [
        'Define and approve the event or product attribution rules in GoHighLevel.',
      ],
    },
  };
}

async function loadGovernedPerformanceContext(
  tenantKey: string,
  eventId: string,
): Promise<StitchiReadOnlyContext['governedPerformance']> {
  const [capacity, targets, evaluation, mappings] = await Promise.all([
    getEventCapacity(tenantKey, eventId),
    listEffectiveEventTargets(tenantKey, eventId),
    evaluateEventTargets(tenantKey, eventId),
    listGhlAttributionMappings(tenantKey, { eventId }),
  ]);
  const approvedMapping = mappings.find((mapping) => String(mapping.status) === 'approved') || null;
  const missingCustomerDefinitions: string[] = [];
  if (!approvedMapping) {
    missingCustomerDefinitions.push(
      'Define and approve the event or product attribution rules in GoHighLevel.',
    );
  } else {
    if (!approvedMapping.paymentAmountField) {
      missingCustomerDefinitions.push('Confirm the GoHighLevel field that stores amount paid.');
    }
    if (!approvedMapping.saleValueField) {
      missingCustomerDefinitions.push(
        'Confirm the GoHighLevel field that stores total sale value or supports outstanding-balance calculation.',
      );
    }
    if (!approvedMapping.ticketQuantityField) {
      missingCustomerDefinitions.push(
        'Confirm the GoHighLevel field that stores purchased ticket quantity.',
      );
    }
  }

  const effectiveTargets = targets.map((target) => ({
    id: String(target.id),
    metricKey: String(target.metricKey),
    label: String(target.label),
    unit: String(target.unit),
    direction: String(target.direction),
    controlMode: String(target.controlMode),
    targetValue: Number(target.targetValue || 0),
    warningValue: target.warningValue == null ? null : Number(target.warningValue),
    criticalValue: target.criticalValue == null ? null : Number(target.criticalValue),
    currency: target.currency == null ? null : String(target.currency),
    appliedAs: String(target.appliedAs),
  }));

  return {
    eventCapacity: {
      venueCapacity: capacity.venueCapacity == null ? null : Number(capacity.venueCapacity),
      sellableTicketCapacity:
        capacity.sellableTicketCapacity == null
          ? null
          : Number(capacity.sellableTicketCapacity),
      source: capacity.source == null ? null : String(capacity.source),
      confirmedAt: capacity.confirmedAt instanceof Date ? capacity.confirmedAt : null,
      isAbsolute: Boolean(capacity.isAbsolute),
    },
    effectiveTargets,
    inheritedTargets: effectiveTargets.filter((target) => target.appliedAs === 'inherited').length,
    eventSpecificTargets: effectiveTargets.filter(
      (target) => target.appliedAs === 'event_specific',
    ).length,
    dailyEvaluation: {
      onTrack: evaluation.summary.onTrack,
      warning: evaluation.summary.warning,
      critical: evaluation.summary.critical,
      thresholdsMissing: evaluation.summary.thresholdsMissing,
      actualUnavailable: evaluation.summary.actualUnavailable,
      latestEvidenceAt: evaluation.latestEvidenceAt,
      targets: evaluation.evaluations.map((item) => ({
        label: item.label,
        status: item.status,
        actualValue: item.actualValue,
        targetValue: item.targetValue,
        reason: item.reason,
      })),
    },
    ghlAttribution: {
      mappingCount: mappings.length,
      approvedMappingId: approvedMapping ? String(approvedMapping.id) : null,
      readyForMatching: Boolean(approvedMapping),
      missingCustomerDefinitions,
    },
  };
}

export function formatReadOnlyContextForPrompt(context: StitchiReadOnlyContext): string {
  return JSON.stringify(context, (_key, value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value;
  });
}

const eventSelect = {
  id: true,
  name: true,
  status: true,
  event_type: true,
  event_date: true,
  location: true,
  planned_budget: true,
  revenue_target: true,
  selected_channels: true,
} as const;

function mapEvent(event: {
  id: string;
  name: string;
  status: unknown;
  event_type: unknown;
  event_date: Date;
  location: string | null;
  planned_budget: unknown;
  revenue_target: unknown;
  selected_channels: string[];
}): EventContext {
  return {
    id: event.id,
    name: isCustomerVisibleRecordName(event.name) ? event.name : 'Linked live event',
    status: String(event.status),
    eventType: String(event.event_type),
    eventDate: event.event_date,
    location: event.location,
    plannedBudget: decimalToNumber(event.planned_budget),
    revenueTarget: decimalToNumber(event.revenue_target),
    selectedChannels: event.selected_channels,
  };
}

function isCustomerVisibleRecordName(name: string): boolean {
  return !/\b(sprint\s*\d+|acceptance|smoke test|test tenant|customer review event)\b/i.test(name);
}

function summarizeLeads(leads: Array<{ lead_status: unknown; lead_temperature: unknown; purchase_amount: unknown }>) {
  const byStatus: Record<string, number> = {};
  const byTemperature: Record<string, number> = {};
  let purchases = 0;
  let knownRevenue = 0;

  for (const lead of leads) {
    const status = String(lead.lead_status);
    const temperature = String(lead.lead_temperature);
    byStatus[status] = (byStatus[status] || 0) + 1;
    byTemperature[temperature] = (byTemperature[temperature] || 0) + 1;
    const purchaseAmount = decimalToNumber(lead.purchase_amount) || 0;
    if (purchaseAmount > 0 || status === 'purchased') purchases += 1;
    knownRevenue += purchaseAmount;
  }

  return {
    total: leads.length,
    byStatus,
    byTemperature,
    purchases,
    knownRevenue,
  };
}

function summarizeKpis(kpis: Array<{
  reach: number;
  impressions: number;
  interactions: number;
  clicks: number;
  form_completions: number;
  leads: number;
  meetings_booked: number;
  meetings_attended: number;
  purchases: number;
  no_shows: number;
  spend: unknown;
}>) {
  return kpis.reduce((summary, row) => {
    summary.records += 1;
    summary.reach += row.reach;
    summary.impressions += row.impressions;
    summary.interactions += row.interactions;
    summary.clicks += row.clicks;
    summary.formCompletions += row.form_completions;
    summary.leads += row.leads;
    summary.meetingsBooked += row.meetings_booked;
    summary.meetingsAttended += row.meetings_attended;
    summary.purchases += row.purchases;
    summary.noShows += row.no_shows;
    summary.spend += decimalToNumber(row.spend) || 0;
    return summary;
  }, {
    records: 0,
    reach: 0,
    impressions: 0,
    interactions: 0,
    clicks: 0,
    formCompletions: 0,
    leads: 0,
    meetingsBooked: 0,
    meetingsAttended: 0,
    purchases: 0,
    noShows: 0,
    spend: 0,
  });
}

function summarizeProblems(problems: Array<{ title: string; severity: unknown; category: unknown }>) {
  return {
    open: problems.length,
    critical: problems.filter((problem) => String(problem.severity) === 'critical').length,
    topOpen: problems.slice(0, 3).map((problem) => ({
      title: problem.title,
      severity: String(problem.severity),
      category: String(problem.category),
    })),
  };
}

function summarizeConnectors(
  configuredCredentials: number,
  jobs: Array<{ sync_status: unknown; state: unknown }>,
) {
  return {
    configuredCredentials,
    connectorJobs: jobs.length,
    readyForSync: jobs.filter((job) => String(job.sync_status) === 'ready_for_sync' || String(job.state) === 'test_passed').length,
    synced: jobs.filter((job) => String(job.sync_status) === 'synced').length,
    blocked: jobs.filter((job) => ['blocked', 'failed'].includes(String(job.sync_status)) || String(job.state) === 'blocked').length,
  };
}

function summarizeUnifiedDataLayer(
  credentials: Array<{ provider: unknown; credential_type: unknown; last_validated_at: Date | null }>,
  jobs: Array<{ connector_id?: unknown; sync_status: unknown; state: unknown; last_dry_run_at?: Date | null; last_sync_at?: Date | null }>,
): StitchiReadOnlyContext['unifiedDataLayer'] {
  const source = (provider: string): DataSourceContext => {
    const providerCredentials = credentials.filter(credential => String(credential.provider) === provider);
    const connectorJobs = jobs.filter(job => String(job.connector_id) === provider);
    const latestJob = connectorJobs[0] || null;
    const hasCredential = providerCredentials.length > 0;
    const validated = providerCredentials.some(credential => credential.last_validated_at);
    const hasDryRun = connectorJobs.some(job => Boolean(job.last_dry_run_at));
    const synced = connectorJobs.some(job => String(job.sync_status) === 'synced');
    const requiredActions: string[] = [];
    if (!hasCredential) requiredActions.push(`Save customer-owned ${provider} credentials.`);
    if (hasCredential && !validated) requiredActions.push(`Validate ${provider} read access.`);
    if (validated && !hasDryRun) requiredActions.push(`Run ${provider} read-only dry-run for this event.`);
    if (hasDryRun && !synced) requiredActions.push(`Approve ${provider} import after reviewing dry-run rows.`);
    return {
      provider,
      credentialStatus: !hasCredential ? 'missing' : validated ? 'validated' : 'configured',
      importJobStatus: latestJob ? String(latestJob.sync_status) : 'not_started',
      lastDryRunAt: latestJob?.last_dry_run_at ?? null,
      lastSyncAt: latestJob?.last_sync_at ?? null,
      requiredActions,
    };
  };

  const ghlCredential = credentials.some(credential => String(credential.provider) === 'gohighlevel');
  const whatsappCredential = credentials.some(credential => String(credential.provider) === 'whatsapp');
  const smartLabsCredential = credentials.some(credential => String(credential.provider) === 'smartlabs_voice');
  return {
    kajabi: source('kajabi'),
    acquisition: [
      source('meta_analytics'),
      source('youtube_analytics'),
      source('formaloo'),
    ],
    whatsappFollowUp: {
      sourceOfTruth: 'gohighlevel',
      ghlCredentialStatus: ghlCredential ? 'configured' : 'missing',
      whatsappCredentialStatus: whatsappCredential ? 'configured' : 'missing',
      readyForPreparedFollowUp: ghlCredential || whatsappCredential,
      executionEnabled: process.env.WHATSAPP_LIVE_ENABLED === 'true' && process.env.EXTERNAL_EXECUTION_ENABLED === 'true',
      externalWritesAllowed: false,
      requiredActions: [
        ...(!ghlCredential ? ['Save customer-owned GoHighLevel credentials for CRM-driven WhatsApp follow-up.'] : []),
        ...(!whatsappCredential ? ['Save WhatsApp credential only if direct WhatsApp Cloud sending is required.'] : []),
        ...(process.env.WHATSAPP_LIVE_ENABLED === 'true' && process.env.EXTERNAL_EXECUTION_ENABLED === 'true' ? [] : ['External WhatsApp sending remains disabled until customer authorization and policy flags are enabled.']),
      ],
    },
    smartLabsVoice: {
      credentialStatus: smartLabsCredential ? 'configured' : 'missing',
      readyForHandoffPreview: true,
      executionEnabled: process.env.SMARTLABS_LIVE_ENABLED === 'true' && process.env.VOICE_CHAT_LIVE_ENABLED === 'true',
      externalCallsAllowed: false,
      requiredActions: [
        ...(!smartLabsCredential ? ['Save customer-owned SmartLabs API key, agent id, and voice settings.'] : []),
        ...(process.env.SMARTLABS_LIVE_ENABLED === 'true' && process.env.VOICE_CHAT_LIVE_ENABLED === 'true' ? [] : ['SmartLabs live conversation/TTS execution remains disabled until customer authorization and policy flags are enabled.']),
      ],
    },
  };
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  if (typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
