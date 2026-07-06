import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  eventCloseoutApi,
  eventPlannerApi,
  eventProblemsApi,
  eventsApi,
  ghlSyncApi,
  leadsApi,
  learningRecommendationsApi,
} from '../api';
import {
  AieroActionButton,
  AieroGhostButton,
  AieroLightPanel,
  AieroMetricCard,
  AieroPage,
  AieroPanel,
  AieroStatusPill,
} from '../components/AieroUX';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  ExecutiveGauge,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';

type RecordMap = Record<string, unknown>;
type WorkspaceTab = 'overview' | 'strategy' | 'kpis' | 'leads' | 'blockers' | 'closeout';

const TABS: Array<{ id: WorkspaceTab; label: string; helper: string; action: string }> = [
  { id: 'overview', label: 'Overview', helper: 'What needs attention today', action: 'Review the event health and next team action.' },
  { id: 'strategy', label: 'Plan', helper: 'Offer, audience and work packages', action: 'Confirm the event strategy and required campaign work.' },
  { id: 'kpis', label: 'KPIs', helper: 'Spend, reach, forms and sales', action: 'Connect or import campaign results so the numbers stay current.' },
  { id: 'leads', label: 'Leads', helper: 'CRM and sales flow', action: 'Review lead temperature, sales stages, meetings and purchases.' },
  { id: 'blockers', label: 'Risks', helper: 'Issues slowing the event', action: 'Record and resolve blockers before they affect sales.' },
  { id: 'closeout', label: 'Learning', helper: 'Lessons for the next event', action: 'Use evidence to understand what worked and what to improve.' },
];

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') as string[] : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function titleCase(value: unknown): string {
  return text(value, 'not_available')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function money(value: unknown): string {
  return formatCurrency(value);
}

function percent(value: unknown): string {
  const safe = Number.isFinite(numberValue(value)) ? numberValue(value) : 0;
  return `${Math.round(safe * 10) / 10}%`;
}

function formatDate(value: unknown): string {
  if (!value) return 'Not set';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value: unknown): string {
  if (!value) return 'Not synced';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not synced';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusTone(value: unknown): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const status = text(value, '').toLowerCase();
  if (['active', 'completed', 'approved', 'synced', 'ready', 'purchased', 'meeting_attended'].includes(status)) return 'good';
  if (['planning', 'pending', 'pending_review', 'in_progress', 'meeting_booked', 'follow_up_needed'].includes(status)) return 'warn';
  if (['cancelled', 'failed', 'blocked', 'lost', 'no_show', 'critical'].includes(status)) return 'danger';
  if (['draft', 'new_lead', 'configured'].includes(status)) return 'info';
  if (['archived', 'dismissed'].includes(status)) return 'muted';
  return 'default';
}

function userRole(user: unknown): string {
  return user && typeof user === 'object' ? text((user as RecordMap).role, '') : '';
}

function canLoadProblemDashboard(role: string): boolean {
  return ['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager'].includes(role);
}

function localProblemDashboard(problems: RecordMap[]): RecordMap {
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const activeProblems = problems.filter(problem => ['open', 'investigating'].includes(text(problem.status, '').toLowerCase()));
  for (const problem of problems) {
    const category = text(problem.category, 'other').toLowerCase();
    const severity = text(problem.severity, 'medium').toLowerCase();
    byCategory[category] = (byCategory[category] || 0) + 1;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const topBlockers = [...activeProblems]
    .sort((a, b) => (severityOrder[text(a.severity, 'medium').toLowerCase()] ?? 4) - (severityOrder[text(b.severity, 'medium').toLowerCase()] ?? 4))
    .slice(0, 5);

  return {
    totalProblems: problems.length,
    openProblems: activeProblems.length,
    criticalOpen: activeProblems.filter(problem => text(problem.severity, '').toLowerCase() === 'critical').length,
    byCategory,
    bySeverity,
    topBlockers,
    limitedByRole: true,
  };
}

function sourceLabel(value: unknown): string {
  const source = text(value, 'none');
  if (source === 'connector') return 'Connector data';
  if (source === 'imported') return 'Imported data';
  if (source === 'manual') return 'Manual data';
  return 'Waiting for KPI data';
}

function strongestChannel(rows: RecordMap[]): string {
  if (!rows.length) return 'Not enough data';
  const sorted = [...rows].sort((a, b) => numberValue(b.leads || b.value) - numberValue(a.leads || a.value));
  return titleCase(sorted[0]?.channel || sorted[0]?.label || sorted[0]?.source || 'Not enough data');
}

const internalCustomerTextPattern = /\b(sprint\s*\d+|acceptance|smoke)\b/i;

function isInternalCustomerText(value: unknown): boolean {
  return typeof value === 'string' && internalCustomerTextPattern.test(value);
}

function customerSafeText(value: unknown, fallback: string): string {
  const raw = text(value, '');
  if (!raw || isInternalCustomerText(raw)) return fallback;
  return raw;
}

function eventTitle(event: RecordMap): string {
  const rawTitle = text(event.name || event.eventName, '');
  if (rawTitle && !isInternalCustomerText(rawTitle)) return rawTitle;
  const date = formatDate(event.eventDate);
  return date === 'Not scheduled' ? 'Customer event' : `Customer event - ${date}`;
}

function leadTitle(lead: RecordMap, index?: number): string {
  const rawTitle = text(lead.leadName || lead.name, '');
  if (rawTitle && !isInternalCustomerText(rawTitle)) return rawTitle;
  const source = titleCase(lead.sourceOfTruth || lead.externalSourceProvider || lead.platform || 'local');
  const suffix = typeof index === 'number' ? ` ${index + 1}` : '';
  return `${source} lead${suffix}`;
}

function firstAvailableId(events: RecordMap[], routeId?: string): string {
  if (routeId && events.some(event => String(event.id) === routeId)) return routeId;
  return String(events[0]?.id || '');
}

function useEventWorkspaceData() {
  const { eventId } = useParams();
  const { token, user } = useAuth();
  const role = userRole(user);
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [salesLeads, setSalesLeads] = useState<RecordMap[]>([]);
  const [problemDashboard, setProblemDashboard] = useState<RecordMap | null>(null);
  const [eventProblems, setEventProblems] = useState<RecordMap[]>([]);
  const [emailPlans, setEmailPlans] = useState<RecordMap[]>([]);
  const [whatsappPlans, setWhatsappPlans] = useState<RecordMap[]>([]);
  const [upsellPlans, setUpsellPlans] = useState<RecordMap[]>([]);
  const [contentRequirements, setContentRequirements] = useState<RecordMap[]>([]);
  const [salesTasks, setSalesTasks] = useState<RecordMap[]>([]);
  const [ghlStatus, setGhlStatus] = useState<RecordMap | null>(null);
  const [closeoutReport, setCloseoutReport] = useState<RecordMap | null>(null);
  const [learningSummary, setLearningSummary] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(token));

  async function load(preferredId?: string) {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const eventList = list(await eventsApi.list(token));
      const nextEventId = firstAvailableId(eventList, preferredId || eventId);
      setEvents(eventList);
      setSelectedEventId(nextEventId);

      if (!nextEventId) {
        setDashboard(null);
        setSalesLeads([]);
        setProblemDashboard(null);
        setEventProblems([]);
        setEmailPlans([]);
        setWhatsappPlans([]);
        setUpsellPlans([]);
        setContentRequirements([]);
        setSalesTasks([]);
        setGhlStatus(null);
        setCloseoutReport(null);
        setLearningSummary(null);
        return;
      }

      const problemDashboardRequest = canLoadProblemDashboard(role)
        ? eventProblemsApi.dashboard(nextEventId, token).catch(() => null)
        : Promise.resolve(null);

      const [
        dashboardData,
        leadData,
        problemSummary,
        problems,
        emailData,
        whatsappData,
        upsellData,
        contentData,
        salesTaskData,
        ghlData,
        closeoutData,
        learningData,
      ] = await Promise.all([
        eventsApi.dashboard(nextEventId, token),
        leadsApi.list(token, { eventId: nextEventId }),
        problemDashboardRequest,
        eventProblemsApi.list(token, { eventId: nextEventId }).catch(() => []),
        eventPlannerApi.emailPlans(nextEventId, token).catch(() => []),
        eventPlannerApi.whatsappPlans(nextEventId, token).catch(() => []),
        eventPlannerApi.upsellPlans(nextEventId, token).catch(() => []),
        eventPlannerApi.contentRequirements(nextEventId, token).catch(() => []),
        eventPlannerApi.salesTasks(nextEventId, token).catch(() => []),
        ghlSyncApi.status(token, nextEventId).catch(() => ({})),
        eventCloseoutApi.report(nextEventId, token).catch(() => null),
        learningRecommendationsApi.forEvent(nextEventId, token).catch(() => null),
      ]);

      setDashboard(dashboardData as RecordMap);
      setSalesLeads(list(leadData));
      const normalizedProblems = list(problems);
      setProblemDashboard((problemSummary as RecordMap | null) || localProblemDashboard(normalizedProblems));
      setEventProblems(normalizedProblems);
      setEmailPlans(list(emailData));
      setWhatsappPlans(list(whatsappData));
      setUpsellPlans(list(upsellData));
      setContentRequirements(list(contentData));
      setSalesTasks(list(salesTaskData));
      setGhlStatus(ghlData as RecordMap);
      setCloseoutReport(closeoutData as RecordMap | null);
      setLearningSummary(learningData as RecordMap | null);
    } catch (error) {
      setMessage(`Workspace failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void load(eventId);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId, role]);

  return {
    token,
    events,
    selectedEventId,
    dashboard,
    salesLeads,
    problemDashboard,
    eventProblems,
    emailPlans,
    whatsappPlans,
    upsellPlans,
    contentRequirements,
    salesTasks,
    ghlStatus,
    closeoutReport,
    learningSummary,
    message,
    loading,
    load,
  };
}

function EventPicker({
  events,
  selectedEventId,
  onSelect,
}: {
  events: RecordMap[];
  selectedEventId: string;
  onSelect: (eventId: string) => void;
}) {
  if (!events.length) {
    return (
      <AieroLightPanel title="Events" subtitle="Start by creating the event you want to sell.">
        <EmptyProductState
          title="No events yet"
          message="Create the first event, then this workspace will track its campaign plan, spend, leads, and sales outcomes."
        />
      </AieroLightPanel>
    );
  }

  return (
    <AieroPanel title="Events" subtitle="Choose the event your team is operating today.">
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {events.map(event => {
          const id = String(event.id || '');
          const active = id === selectedEventId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                active
                  ? 'border-white bg-white text-[#080813] shadow-sm'
                  : 'border-white/10 bg-white/[0.04] text-white hover:border-white/24 hover:bg-white/[0.07]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold">{eventTitle(event)}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-neutral-500' : 'text-white/46'}`}>
                    {titleCase(event.eventType)} - {formatDate(event.eventDate)}
                  </div>
                </div>
                <ProductStatus tone={statusTone(event.status)}>{titleCase(event.status)}</ProductStatus>
              </div>
            </button>
          );
        })}
      </div>
    </AieroPanel>
  );
}

function WorkspaceTabs({
  activeTab,
  onChange,
}: {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {TABS.map(tab => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-[1.15rem] px-4 py-4 text-left transition ${
                active ? 'bg-white text-[#080813] shadow-sm' : 'bg-white/[0.04] text-white hover:bg-white/[0.08]'
              }`}
              aria-pressed={active}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className={`mt-1 text-xs ${active ? 'text-neutral-500' : 'text-white/45'}`}>{tab.helper}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabGuide({
  activeTab,
}: {
  activeTab: WorkspaceTab;
}) {
  const tab = TABS.find(item => item.id === activeTab) || TABS[0];
  return (
    <AieroPanel>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-white/42">{tab.label}</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{tab.helper}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">{tab.action}</p>
        </div>
        <AieroStatusPill accent="blue">Current step</AieroStatusPill>
      </div>
    </AieroPanel>
  );
}

function OverviewTab({
  event,
  kpis,
  funnel,
  nextActions,
  sourceStatus,
  problemDashboard,
  ghlStatus,
  onGoKpis,
}: {
  event: RecordMap;
  kpis: RecordMap;
  funnel: RecordMap[];
  nextActions: RecordMap[];
  sourceStatus: RecordMap;
  problemDashboard: RecordMap | null;
  ghlStatus: RecordMap | null;
  onGoKpis: () => void;
}) {
  const readiness = Math.min(100, Math.round(
    (numberValue(kpis.newLeads) > 0 ? 20 : 0)
    + (numberValue(kpis.actualSpend) > 0 ? 20 : 0)
    + (numberValue(kpis.meetingsBooked) > 0 ? 20 : 0)
    + (numberValue(kpis.purchases) > 0 ? 20 : 0)
    + (numberValue(sourceStatus.connectorRecords) > 0 || numberValue(sourceStatus.importedRecords) > 0 ? 20 : 0),
  ));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <AieroPanel className="bg-[#121122]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <AieroStatusPill accent="blue">{titleCase(event.status)}</AieroStatusPill>
                <AieroStatusPill accent={numberValue(sourceStatus.connectorRecords) ? 'teal' : 'amber'}>
                  {sourceLabel(sourceStatus.primarySource)}
                </AieroStatusPill>
              </div>
              <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-white/55">Today</div>
              <h2 className="mt-2 text-4xl font-semibold leading-tight tracking-tight">Run the event workflow</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
                Keep the team focused on the plan, the campaign numbers, lead follow-up, and the next sales action.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ['Event date', formatDate(event.eventDate)],
                ['Location', customerSafeText(event.location, 'Not set')],
                ['Budget', money(kpis.plannedBudget)],
                ['CRM', text(ghlStatus?.credentialStatus) === 'configured' ? 'Configured' : 'Needs setup'],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-white/38">{label}</div>
                  <div className="mt-2 break-words text-lg font-semibold leading-snug text-white [overflow-wrap:anywhere]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </AieroPanel>

        <ExecutiveGauge
          value={readiness}
          label="Operating readiness"
          detail="Calculated from KPI records, leads, sales outcomes, risks, and connector/import data."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ProductStatus tone={numberValue(problemDashboard?.openProblems) ? 'warn' : 'good'}>
          {numberValue(problemDashboard?.openProblems)} active risk(s)
        </ProductStatus>
        <ProductStatus tone={numberValue(problemDashboard?.criticalOpen) ? 'danger' : 'good'}>
          {numberValue(problemDashboard?.criticalOpen)} critical risk(s)
        </ProductStatus>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AieroMetricCard label="New Leads" value={numberValue(kpis.newLeads).toLocaleString()} detail={`${numberValue(kpis.capturedLeads)} captured in system`} accent="teal" />
        <AieroMetricCard label="Meetings Booked" value={numberValue(kpis.meetingsBooked).toLocaleString()} detail={`${numberValue(kpis.meetingsAttended)} attended / ${numberValue(kpis.noShows)} no-show`} accent="amber" />
        <AieroMetricCard label="Purchases" value={numberValue(kpis.purchases).toLocaleString()} detail={`${percent(kpis.noShowRate)} no-show rate`} accent={numberValue(kpis.purchases) ? 'rose' : 'amber'} />
        <AieroMetricCard label="Spend" value={money(kpis.actualSpend)} detail={`${money(kpis.budgetVariance)} remaining variance`} accent="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <ProductCard title="Lead and Sales Funnel" subtitle="This is the customer-language path from interest to purchase.">
          {funnel.length ? <FunnelChart stages={funnel.map(item => ({ label: titleCase(item.label), value: numberValue(item.value), tone: item.label === 'Purchases' ? 'good' : 'info' }))} /> : (
            <EmptyProductState message="No lead funnel data exists yet. Connect/import KPI data or sync leads from CRM." />
          )}
        </ProductCard>

        <ProductCard title="What The Team Should Do Next" subtitle="Backend-generated next actions from current event data.">
          {nextActions.length ? (
            <ReadableQueue
              items={nextActions.slice(0, 5).map(action => ({
                title: text(action.title, 'Action needed'),
                meta: text(action.detail, 'Review current event data.'),
                status: titleCase(action.priority),
                tone: text(action.priority) === 'high' ? 'danger' : text(action.priority) === 'medium' ? 'warn' : 'info',
              }))}
            />
          ) : (
            <EmptyProductState
              title="No urgent action"
              message="The event has no open backend-generated action at the moment."
              action={<SecondaryAction onClick={onGoKpis}>Review KPI data</SecondaryAction>}
            />
          )}
        </ProductCard>
      </div>
    </div>
  );
}

function StrategyTab({
  event,
  emailPlans,
  whatsappPlans,
  upsellPlans,
  contentRequirements,
  salesTasks,
  navigate,
}: {
  event: RecordMap;
  emailPlans: RecordMap[];
  whatsappPlans: RecordMap[];
  upsellPlans: RecordMap[];
  contentRequirements: RecordMap[];
  salesTasks: RecordMap[];
  navigate: (path: string) => void;
}) {
  const selectedChannels = stringList(event.selectedChannels).join(', ') || 'Not selected';
  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <ProductCard
        title="Event Strategy Brief"
        subtitle="The selling plan behind this event."
        action={<SecondaryAction onClick={() => navigate('/events/new')}>Create new event</SecondaryAction>}
      >
        <DetailGrid
          items={[
            { label: 'Offer', value: customerSafeText(event.offer, 'Add the event offer and promise.') },
            { label: 'Audience', value: customerSafeText(event.audience, 'Define target segment, age, location, warm or cold audience.') },
            { label: 'Location / Geography', value: text(event.geography, 'Set the city, country, or target market.') },
            { label: 'FOMO Angle', value: customerSafeText(event.fomoAngle, 'Add deadline, limited seats, or outcome pressure.') },
            { label: 'Upsell Plan', value: customerSafeText(event.upsellPlan, 'Describe upsell path for existing customers.') },
            { label: 'Channels', value: selectedChannels },
          ]}
        />
      </ProductCard>

      <ProductCard title="Campaign Plan Checklist" subtitle="The work packages your team needs before launch.">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Email Plans" value={emailPlans.length} detail="Upsell and reminder sequences" tone={emailPlans.length ? 'good' : 'warn'} />
          <MetricCard label="WhatsApp Plans" value={whatsappPlans.length} detail="Follow-up messages and reminders" tone={whatsappPlans.length ? 'good' : 'warn'} />
          <MetricCard label="Upsell Offers" value={upsellPlans.length} detail="VIP, camp, or course bridge offers" tone={upsellPlans.length ? 'good' : 'warn'} />
          <MetricCard label="Content Tasks" value={contentRequirements.length + salesTasks.length} detail="Creative and sales execution work" tone={(contentRequirements.length + salesTasks.length) ? 'info' : 'warn'} />
        </div>
      </ProductCard>

      <ProductCard title="Content Requirements" subtitle="Assets requested from content or creative team." className="xl:col-span-2">
        {contentRequirements.length ? (
          <ProductTable
            columns={['Asset', 'Platform', 'Due', 'Status']}
            rows={contentRequirements.slice(0, 8).map(item => [
              titleCase(item.assetType),
              text(item.platform, 'All'),
              formatDate(item.dueDate),
              <ProductStatus tone={statusTone(item.status)}>{titleCase(item.status)}</ProductStatus>,
            ])}
          />
        ) : (
          <EmptyProductState message="No content requirement is registered for this event yet." />
        )}
      </ProductCard>
    </div>
  );
}

function KpisTab({
  kpis,
  sourceStatus,
  channelPerformance,
  kpiRecords,
  navigate,
}: {
  kpis: RecordMap;
  sourceStatus: RecordMap;
  channelPerformance: RecordMap[];
  kpiRecords: RecordMap[];
  navigate: (path: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Notice tone={numberValue(sourceStatus.connectorRecords) ? 'good' : 'warn'}>
        KPI data source: {sourceLabel(sourceStatus.primarySource)}. Use Integrations to connect/import Meta, YouTube, Formaloo, GHL, Postiz, or CSV data for this event.
      </Notice>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Reach" value={numberValue(kpis.reach).toLocaleString()} detail={`${numberValue(kpis.impressions).toLocaleString()} impressions`} tone="info" />
        <MetricCard label="Interaction Rate" value={percent(kpis.interactionRate)} detail={`${numberValue(kpis.interactions).toLocaleString()} interactions`} tone={numberValue(kpis.interactionRate) ? 'good' : 'warn'} />
        <MetricCard label="Cost Per Lead" value={money(kpis.costPerLead)} detail={`${numberValue(kpis.reportedLeads).toLocaleString()} reported leads`} tone={numberValue(kpis.costPerLead) ? 'info' : 'warn'} />
        <MetricCard label="Cost Per Purchase" value={money(kpis.costPerPurchase)} detail={`${numberValue(kpis.purchases).toLocaleString()} purchases`} tone={numberValue(kpis.purchases) ? 'good' : 'warn'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <ProductCard
          title="Best Performing Channels"
          subtitle="Shows where reach and leads are coming from."
          action={<SecondaryAction onClick={() => navigate('/integration-credentials')}>Open Integrations</SecondaryAction>}
        >
          {channelPerformance.length ? (
            <BarList
              items={channelPerformance.slice(0, 8).map(row => ({
                label: titleCase(row.channel),
                value: numberValue(row.leads || row.interactions || row.reach),
                detail: `${numberValue(row.leads)} leads / ${money(row.spend)} spend`,
                tone: 'info' as const,
              }))}
            />
          ) : (
            <EmptyProductState message="No channel KPI rows exist yet. Import or sync campaign data to populate this chart." />
          )}
        </ProductCard>

        <ProductCard title="Latest KPI Records" subtitle="Verified rows from manual entry, CSV import, or connectors.">
          {kpiRecords.length ? (
            <ProductTable
              columns={['Date', 'Channel', 'Leads', 'Purchases', 'Spend', 'Source']}
              rows={kpiRecords.slice(0, 8).map(record => [
                formatDate(record.metricDate),
                titleCase(record.channel),
                numberValue(record.leads).toLocaleString(),
                numberValue(record.purchases).toLocaleString(),
                money(record.spend),
                <ProductStatus tone={statusTone(record.sourceType)}>{titleCase(record.sourceType)}</ProductStatus>,
              ])}
            />
          ) : (
            <EmptyProductState message="No KPI record is saved yet. Use Integrations or the advanced workspace to add the first record." />
          )}
        </ProductCard>
      </div>
    </div>
  );
}

function LeadsTab({
  salesLeads,
  leadTemperature,
  ghlStatus,
  navigate,
}: {
  salesLeads: RecordMap[];
  leadTemperature: RecordMap[];
  ghlStatus: RecordMap | null;
  navigate: (path: string) => void;
}) {
  const statusCounts = salesLeads.reduce<Record<string, number>>((acc, lead) => {
    const status = text(lead.leadStatus || lead.status, 'new_lead');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Notice tone={text(ghlStatus?.credentialStatus) === 'configured' ? 'good' : 'warn'}>
        GoHighLevel status: {text(ghlStatus?.credentialStatus) === 'configured' ? 'customer credential configured' : 'not configured yet'}. GHL remains the CRM source of truth; Tanaghum is the operating and reporting layer.
      </Notice>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Leads" value={salesLeads.length} detail={`${numberValue(ghlStatus?.ghlLeadCount)} mirrored from GHL`} tone="info" />
        <MetricCard label="Hot Leads" value={salesLeads.filter(lead => text(lead.leadTemperature) === 'hot').length} detail="Need sales follow-up" tone="warn" />
        <MetricCard label="Purchased" value={salesLeads.filter(lead => text(lead.leadStatus || lead.status) === 'purchased').length} detail="Closed revenue signals" tone="good" />
        <MetricCard label="No Shows" value={salesLeads.filter(lead => text(lead.leadStatus || lead.status) === 'no_show').length} detail="Need recovery action" tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ProductCard title="Lead Temperature" subtitle="How warm the current event pipeline is.">
          {leadTemperature.length ? (
            <BarList
              items={leadTemperature.map(item => ({
                label: titleCase(item.label),
                value: numberValue(item.value),
                tone: text(item.label).toLowerCase() === 'buyer' ? 'good' : 'warn',
              }))}
            />
          ) : (
            <EmptyProductState message="No lead temperature data yet." />
          )}
        </ProductCard>

        <ProductCard
          title="Lead List"
          subtitle="Recent CRM/local leads for this event."
          action={<SecondaryAction onClick={() => navigate('/integration-credentials')}>Configure CRM</SecondaryAction>}
        >
          {salesLeads.length ? (
            <ProductTable
              columns={['Lead', 'Status', 'Temperature', 'Source', 'Last Sync']}
              rows={salesLeads.slice(0, 10).map((lead, index) => [
                leadTitle(lead, index),
                <ProductStatus tone={statusTone(lead.leadStatus || lead.status)}>{titleCase(lead.leadStatus || lead.status)}</ProductStatus>,
                <ProductStatus tone={statusTone(lead.leadTemperature)}>{titleCase(lead.leadTemperature)}</ProductStatus>,
                titleCase(lead.sourceOfTruth || lead.externalSourceProvider || lead.platform || 'Tanaghum'),
                formatDateTime(lead.externalLastSyncedAt || lead.lastSyncedAt),
              ])}
            />
          ) : (
            <EmptyProductState
              title="No leads yet"
              message="Sync from GHL or capture leads through the event workflow to populate this list."
            />
          )}
        </ProductCard>
      </div>

      <ProductCard title="Lead Status Breakdown" subtitle="Simple count by current sales stage.">
        {Object.keys(statusCounts).length ? (
          <BarList
            items={Object.entries(statusCounts).map(([label, value]) => ({
              label: titleCase(label),
              value,
              tone: label === 'purchased' ? 'good' : label === 'no_show' ? 'danger' : 'info',
            }))}
          />
        ) : (
          <EmptyProductState message="No status breakdown yet." />
        )}
      </ProductCard>
    </div>
  );
}

function BlockersTab({
  problemDashboard,
  eventProblems,
}: {
  problemDashboard: RecordMap | null;
  eventProblems: RecordMap[];
}) {
  const byCategory = problemDashboard?.byCategory && typeof problemDashboard.byCategory === 'object'
    ? Object.entries(problemDashboard.byCategory as Record<string, number>)
    : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Open Risks" value={numberValue(problemDashboard?.openProblems)} detail="Need owner action" tone={numberValue(problemDashboard?.openProblems) ? 'warn' : 'good'} />
        <MetricCard label="Critical Risks" value={numberValue(problemDashboard?.criticalOpen)} detail="Escalate immediately" tone={numberValue(problemDashboard?.criticalOpen) ? 'danger' : 'good'} />
        <MetricCard label="Total Evidence" value={numberValue(problemDashboard?.totalProblems)} detail="Explains campaign movement" tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ProductCard title="Risk Categories" subtitle="Where campaign execution is getting stuck.">
          {byCategory.length ? (
            <BarList items={byCategory.map(([label, value]) => ({ label: titleCase(label), value: numberValue(value), tone: 'warn' as const }))} />
          ) : (
            <EmptyProductState message="No risk category data yet." />
          )}
        </ProductCard>

        <ProductCard title="Open Barrier Log" subtitle="The team can use this as closeout evidence later.">
          {eventProblems.length ? (
            <ProductTable
              columns={['Barrier', 'Area', 'Severity', 'Status', 'Owner']}
              rows={eventProblems.slice(0, 10).map(problem => [
                text(problem.title, 'Untitled barrier'),
                titleCase(problem.category),
                <ProductStatus tone={statusTone(problem.severity)}>{titleCase(problem.severity)}</ProductStatus>,
                <ProductStatus tone={statusTone(problem.status)}>{titleCase(problem.status)}</ProductStatus>,
                titleCase(problem.ownerRole),
              ])}
            />
          ) : (
            <EmptyProductState
              title="No blockers recorded"
              message="When ads, forms, creative, sales, budget, or follow-up work gets blocked, record it here so closeout explains what happened."
            />
          )}
        </ProductCard>
      </div>
    </div>
  );
}

function CloseoutTab({
  closeoutReport,
  learningSummary,
  channelPerformance,
  sourcePerformance,
}: {
  closeoutReport: RecordMap | null;
  learningSummary: RecordMap | null;
  channelPerformance: RecordMap[];
  sourcePerformance: RecordMap[];
}) {
  const leadFunnel = (closeoutReport?.leadFunnel || {}) as RecordMap;
  const salesOutcomes = (closeoutReport?.salesOutcomes || {}) as RecordMap;
  const completeness = (closeoutReport?.dataCompleteness || {}) as RecordMap;
  const recommendations = list(learningSummary?.recommendations);
  const warnings = stringList(learningSummary?.dataCompletenessWarnings);

  return (
    <div className="space-y-5">
      {!closeoutReport && (
        <Notice tone="warn">Closeout report is not available yet. Keep adding KPI records, leads, planner items, and risks until the event has enough evidence.</Notice>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Leads" value={numberValue(leadFunnel.totalLeads).toLocaleString()} detail="Closeout funnel" tone="info" />
        <MetricCard label="Purchases" value={numberValue(salesOutcomes.purchases).toLocaleString()} detail={money(salesOutcomes.revenue)} tone="good" />
        <MetricCard label="No-Show Rate" value={percent(numberValue(salesOutcomes.noShowRate) * 100)} detail={`${numberValue(salesOutcomes.noShows)} no-show(s)`} tone={numberValue(salesOutcomes.noShowRate) > 0.2 ? 'danger' : 'warn'} />
        <MetricCard label="Data Coverage" value={`${numberValue(completeness.completeSections)}/${numberValue(completeness.totalSections)}`} detail="Closeout sections complete" tone={numberValue(completeness.completeSections) ? 'info' : 'warn'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProductCard title="What Worked" subtitle="Top sources and channels from event evidence.">
          <DetailGrid
            items={[
              { label: 'Best Channel', value: strongestChannel(channelPerformance) },
              { label: 'Best Audience Source', value: strongestChannel(sourcePerformance) },
              { label: 'Recommendations', value: `${recommendations.length} generated` },
              { label: 'Data Warnings', value: `${warnings.length} warning(s)` },
            ]}
          />
        </ProductCard>

        <ProductCard title="Learning Recommendations" subtitle="Deterministic recommendations from event evidence.">
          {recommendations.length ? (
            <ReadableQueue
              items={recommendations.slice(0, 6).map(item => ({
                title: text(item.title, 'Recommendation'),
                meta: text(item.detail || item.rationale, 'Review this recommendation before the next event.'),
                status: titleCase(item.priority),
                tone: text(item.priority) === 'high' ? 'danger' : text(item.priority) === 'medium' ? 'warn' : 'info',
              }))}
            />
          ) : (
            <EmptyProductState message="No recommendations are available yet. The system needs more KPI, lead, planner, and barrier evidence." />
          )}
        </ProductCard>
      </div>
    </div>
  );
}

export default function HybridEventWorkspace() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const {
    events,
    selectedEventId,
    dashboard,
    salesLeads,
    problemDashboard,
    eventProblems,
    emailPlans,
    whatsappPlans,
    upsellPlans,
    contentRequirements,
    salesTasks,
    ghlStatus,
    closeoutReport,
    learningSummary,
    message,
    loading,
    load,
  } = useEventWorkspaceData();

  const event = useMemo(() => (dashboard?.event || events.find(item => String(item.id) === selectedEventId) || {}) as RecordMap, [dashboard, events, selectedEventId]);
  const kpis = (dashboard?.kpis || {}) as RecordMap;
  const sourceStatus = (dashboard?.sourceStatus || {}) as RecordMap;
  const funnel = list(dashboard?.funnel);
  const channelPerformance = list(dashboard?.channelPerformance);
  const leadTemperature = list(dashboard?.leadTemperature);
  const nextActions = list(dashboard?.nextActions);
  const kpiRecords = list(dashboard?.kpiRecords);
  const closeoutChannels = list(closeoutReport?.channelPerformance);
  const closeoutSources = list(closeoutReport?.sourcePerformance);

  function selectEvent(eventId: string) {
    navigate(`/events/${eventId}`);
    void load(eventId);
  }

  if (loading) {
    return (
      <AieroPage eyebrow="Events" title="Event Workspace" subtitle="Opening the event operating workspace.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="h-36 rounded-[1.25rem] border border-white/10 bg-white/[0.08]" />)}
        </div>
      </AieroPage>
    );
  }

  return (
    <AieroPage
      eyebrow="Events"
      title="Event Workspace"
      subtitle="Plan each event, track campaign performance, follow leads, manage risks, and learn what to improve next."
      action={(
        <>
          <AieroGhostButton onClick={() => navigate('/events/master')}>Portfolio Dashboard</AieroGhostButton>
          <AieroActionButton onClick={() => navigate('/events/new')}>Create Event</AieroActionButton>
        </>
      )}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <EventPicker events={events} selectedEventId={selectedEventId} onSelect={selectEvent} />

          <AieroLightPanel title="Today Focus" subtitle="What this workspace is for.">
            <ReadableQueue
              items={[
                { title: 'Plan the event', meta: 'Offer, audience, budget, channels, content, email, WhatsApp, and upsell plan.', status: 'Plan', tone: 'info' },
                { title: 'Track performance', meta: 'Reach, spend, forms, leads, meetings, no-shows, purchases, and cost efficiency.', status: 'KPIs', tone: 'warn' },
                { title: 'Close the loop', meta: 'Sync CRM leads, record blockers, and learn what to improve for the next event.', status: 'Learning', tone: 'good' },
              ]}
            />
          </AieroLightPanel>
        </aside>

        <section className="min-w-0 space-y-5">
          {!selectedEventId ? (
            <ProductCard>
              <EmptyProductState
                title="Create the first event"
                message="The workspace becomes useful after an event exists. Start with the event date, budget, audience, and sales target."
                action={<PrimaryAction onClick={() => navigate('/events/new')}>Create Event</PrimaryAction>}
              />
            </ProductCard>
          ) : (
            <>
              <AieroPanel className="bg-white/[0.05]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AieroStatusPill accent="blue">{titleCase(event.status)}</AieroStatusPill>
                      <AieroStatusPill accent={text(sourceStatus.primarySource) === 'none' ? 'amber' : 'teal'}>{sourceLabel(sourceStatus.primarySource)}</AieroStatusPill>
                      <AieroStatusPill accent={text(ghlStatus?.credentialStatus) === 'configured' ? 'teal' : 'amber'}>
                        {text(ghlStatus?.credentialStatus) === 'configured' ? 'GHL configured' : 'GHL needs setup'}
                      </AieroStatusPill>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{eventTitle(event)}</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-white/55">
                      {titleCase(event.eventType)} in {customerSafeText(event.location, 'the selected location')} on {formatDate(event.eventDate)}.
                    </p>
                  </div>
                </div>
              </AieroPanel>

              <WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />
              <TabGuide activeTab={activeTab} />

              {activeTab === 'overview' && (
                <OverviewTab
                  event={event}
                  kpis={kpis}
                  funnel={funnel}
                  nextActions={nextActions}
                  sourceStatus={sourceStatus}
                  problemDashboard={problemDashboard}
                  ghlStatus={ghlStatus}
                  onGoKpis={() => setActiveTab('kpis')}
                />
              )}

              {activeTab === 'strategy' && (
                <StrategyTab
                  event={event}
                  emailPlans={emailPlans}
                  whatsappPlans={whatsappPlans}
                  upsellPlans={upsellPlans}
                  contentRequirements={contentRequirements}
                  salesTasks={salesTasks}
                  navigate={navigate}
                />
              )}

              {activeTab === 'kpis' && (
                <KpisTab
                  kpis={kpis}
                  sourceStatus={sourceStatus}
                  channelPerformance={channelPerformance}
                  kpiRecords={kpiRecords}
                  navigate={navigate}
                />
              )}

              {activeTab === 'leads' && (
                <LeadsTab
                  salesLeads={salesLeads}
                  leadTemperature={leadTemperature}
                  ghlStatus={ghlStatus}
                  navigate={navigate}
                />
              )}

              {activeTab === 'blockers' && (
                <BlockersTab problemDashboard={problemDashboard} eventProblems={eventProblems} />
              )}

              {activeTab === 'closeout' && (
                <CloseoutTab
                  closeoutReport={closeoutReport}
                  learningSummary={learningSummary}
                  channelPerformance={closeoutChannels}
                  sourcePerformance={closeoutSources}
                />
              )}
            </>
          )}
        </section>
      </div>
    </AieroPage>
  );
}
