import { prisma } from '@shared/database';
import { getGhlSyncStatus } from '../ghl-sync/repository';
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
      linkedEventId: string | null;
    }>;
  };
  guardrails: {
    mode: 'read_only';
    writesExecuted: false;
    externalExecution: 'blocked';
    secretsReturned: false;
  };
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
        linked_event_id: string | null;
        revenue_line: { name: string };
      }>>;
    };
    commercialAssessmentSignal?: {
      findMany(args: unknown): Promise<Array<{ id: string }>>;
    };
  };

  const [
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
  ] = await Promise.all([
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
      select: { id: true },
      take: 100,
    }),
    prisma.connectorImportJob.findMany({
      where: { tenant_key: tenantKey, ...(eventId ? { event_id: eventId } : {}) },
      select: {
        sync_status: true,
        state: true,
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
        linked_event_id: true,
        revenue_line: { select: { name: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
    }) ?? Promise.resolve([]),
    commercialClients.commercialAssessmentSignal?.findMany({
      where: { tenant_key: tenantKey, status: { in: ['open', 'reviewing'] } },
      select: { id: true },
      take: 100,
    }) ?? Promise.resolve([]),
  ]);

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
    recentEvents: recentEvents.map(mapEvent),
    leadSummary: summarizeLeads(leads),
    kpiSummary: summarizeKpis(kpis),
    riskSummary: summarizeProblems(openProblems),
    connectorSummary: summarizeConnectors(credentials.length, connectorJobs),
    ghlCrm,
    commercialCenter: {
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
        linkedEventId: plan.linked_event_id,
      })),
    },
    guardrails: {
      mode: 'read_only',
      writesExecuted: false,
      externalExecution: 'blocked',
      secretsReturned: false,
    },
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
    name: event.name,
    status: String(event.status),
    eventType: String(event.event_type),
    eventDate: event.event_date,
    location: event.location,
    plannedBudget: decimalToNumber(event.planned_budget),
    revenueTarget: decimalToNumber(event.revenue_target),
    selectedChannels: event.selected_channels,
  };
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
