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
  BarList,
  DetailGrid,
  EmptyProductState,
  ExecutiveGauge,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;
type WorkspaceTab = 'overview' | 'strategy' | 'kpis' | 'leads' | 'blockers' | 'closeout';

const TABS: Array<{ id: WorkspaceTab; label: string; helper: string }> = [
  { id: 'overview', label: 'Overview', helper: 'Today status' },
  { id: 'strategy', label: 'Plan', helper: 'Offer and campaign work' },
  { id: 'kpis', label: 'KPIs', helper: 'Spend, reach, forms, sales' },
  { id: 'leads', label: 'Leads', helper: 'CRM and sales flow' },
  { id: 'blockers', label: 'Risks', helper: 'What needs attention' },
  { id: 'closeout', label: 'Learning', helper: 'Closeout and lessons' },
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
  return `${Math.round(numberValue(value)).toLocaleString()} SAR`;
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

function eventTitle(event: RecordMap): string {
  return text(event.name || event.eventName, 'Untitled event');
}

function firstAvailableId(events: RecordMap[], routeId?: string): string {
  if (routeId && events.some(event => String(event.id) === routeId)) return routeId;
  return String(events[0]?.id || '');
}

function useEventWorkspaceData() {
  const { eventId } = useParams();
  const { token } = useAuth();
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
        eventProblemsApi.dashboard(nextEventId, token).catch(() => ({})),
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
      setProblemDashboard(problemSummary as RecordMap);
      setEventProblems(list(problems));
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
  }, [token, eventId]);

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
      <ProductCard title="Events" subtitle="Start by creating the event you want to sell.">
        <EmptyProductState
          title="No events yet"
          message="Create the first event, then this workspace will track its campaign plan, spend, leads, and sales outcomes."
        />
      </ProductCard>
    );
  }

  return (
    <ProductCard title="Events" subtitle="Choose the event Amro is operating today.">
      <div className="space-y-2">
        {events.map(event => {
          const id = String(event.id || '');
          const active = id === selectedEventId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`w-full rounded-lg border p-4 text-left transition ${
                active
                  ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-950 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold">{eventTitle(event)}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-white/70' : 'text-neutral-500'}`}>
                    {titleCase(event.eventType)} - {formatDate(event.eventDate)}
                  </div>
                </div>
                <ProductStatus tone={statusTone(event.status)}>{titleCase(event.status)}</ProductStatus>
              </div>
            </button>
          );
        })}
      </div>
    </ProductCard>
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
    <div className="rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {TABS.map(tab => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-lg px-4 py-3 text-left transition ${
                active ? 'bg-neutral-950 text-white shadow-sm' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className={`mt-1 text-xs ${active ? 'text-white/65' : 'text-neutral-500'}`}>{tab.helper}</div>
            </button>
          );
        })}
      </div>
    </div>
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
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl bg-[#151426] p-6 text-white shadow-[0_18px_54px_rgba(15,15,22,0.24)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Event Control Room</div>
              <h2 className="mt-2 line-clamp-3 max-w-3xl break-words text-xl font-semibold leading-tight tracking-tight lg:text-2xl">{eventTitle(event)}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">
                Plan the campaign, track lead flow, compare spend against outcomes, and keep the sales team focused on the next action.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ProductStatus tone={statusTone(event.status)}>{titleCase(event.status)}</ProductStatus>
              <ProductStatus tone={numberValue(sourceStatus.connectorRecords) ? 'good' : 'warn'}>
                {sourceLabel(sourceStatus.primarySource)}
              </ProductStatus>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">Event date</div>
              <div className="mt-2 text-lg font-semibold">{formatDate(event.eventDate)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">Location</div>
              <div className="mt-2 text-lg font-semibold">{text(event.location, 'Not set')}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">Budget</div>
              <div className="mt-2 text-lg font-semibold">{money(kpis.plannedBudget)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">CRM readiness</div>
              <div className="mt-2 text-lg font-semibold">{text(ghlStatus?.credentialStatus) === 'configured' ? 'Configured' : 'Needs setup'}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <ExecutiveGauge
            value={readiness}
            label="Operating readiness"
            detail="Based on KPI records, spend, leads, sales outcomes, and connector/import data."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ProductStatus tone={numberValue(problemDashboard?.openProblems) ? 'warn' : 'good'}>
              {numberValue(problemDashboard?.openProblems)} active risk(s)
            </ProductStatus>
            <ProductStatus tone={numberValue(problemDashboard?.criticalOpen) ? 'danger' : 'good'}>
              {numberValue(problemDashboard?.criticalOpen)} critical
            </ProductStatus>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="New Leads" value={numberValue(kpis.newLeads).toLocaleString()} detail={`${numberValue(kpis.capturedLeads)} captured in system`} tone="info" />
        <MetricCard label="Meetings Booked" value={numberValue(kpis.meetingsBooked).toLocaleString()} detail={`${numberValue(kpis.meetingsAttended)} attended / ${numberValue(kpis.noShows)} no-show`} tone="warn" />
        <MetricCard label="Purchases" value={numberValue(kpis.purchases).toLocaleString()} detail={`${percent(kpis.noShowRate)} no-show rate`} tone={numberValue(kpis.purchases) ? 'good' : 'warn'} />
        <MetricCard label="Spend" value={money(kpis.actualSpend)} detail={`${money(kpis.budgetVariance)} remaining variance`} tone={numberValue(kpis.actualSpend) ? 'info' : 'warn'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <ProductCard title="Lead and Sales Funnel" subtitle="This is the customer-language path from interest to purchase.">
          {funnel.length ? <FunnelChart stages={funnel.map(item => ({ label: titleCase(item.label), value: numberValue(item.value), tone: item.label === 'Purchases' ? 'good' : 'info' }))} /> : (
            <EmptyProductState message="No lead funnel data exists yet. Connect/import KPI data or sync leads from CRM." />
          )}
        </ProductCard>

        <ProductCard title="What Amro Should Do Next" subtitle="Backend-generated next actions from current event data.">
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
            { label: 'Offer', value: text(event.offer, 'Add the event offer and promise.') },
            { label: 'Audience', value: text(event.audience, 'Define target segment, age, location, warm or cold audience.') },
            { label: 'Location / Geography', value: text(event.geography, 'Set the city, country, or target market.') },
            { label: 'FOMO Angle', value: text(event.fomoAngle, 'Add deadline, limited seats, or outcome pressure.') },
            { label: 'Upsell Plan', value: text(event.upsellPlan, 'Describe upsell path for existing customers.') },
            { label: 'Channels', value: selectedChannels },
          ]}
        />
      </ProductCard>

      <ProductCard title="Campaign Plan Checklist" subtitle="The work packages Amro needs before launch.">
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
        KPI data source: {sourceLabel(sourceStatus.primarySource)}. Use Connector Setup to connect/import Meta, YouTube, Formaloo, GHL, Postiz, or CSV data for this event.
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
          action={<SecondaryAction onClick={() => navigate('/integration-credentials')}>Connector Setup</SecondaryAction>}
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
            <EmptyProductState message="No KPI record is saved yet. Use Connector Setup or the advanced workspace to add the first record." />
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
              rows={salesLeads.slice(0, 10).map(lead => [
                text(lead.leadName || lead.name, 'Unnamed lead'),
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
      <ProductPage eyebrow="Event Workspace" title="Loading events..." subtitle="Opening the governed Tanaghum event operating workspace.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="skeleton-pulse h-36 rounded-xl" />)}
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Commercial / Social"
      title="Event Operating Workspace"
      subtitle="A simple daily workspace for planning, campaign KPIs, lead follow-up, blockers, and event learning. Powered by Tanaghum governance and backend APIs."
      action={(
        <>
          <ProductStatus tone="info">Hybrid v2</ProductStatus>
          <SecondaryAction onClick={() => navigate('/events/master')}>Portfolio Dashboard</SecondaryAction>
          <PrimaryAction onClick={() => navigate('/events/new')}>Create Event</PrimaryAction>
        </>
      )}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <EventPicker events={events} selectedEventId={selectedEventId} onSelect={selectEvent} />

          <ProductCard title="Today Focus" subtitle="What this workspace is for.">
            <ReadableQueue
              items={[
                { title: 'Plan the event', meta: 'Offer, audience, budget, channels, content, email, WhatsApp, and upsell plan.', status: 'Plan', tone: 'info' },
                { title: 'Track performance', meta: 'Reach, spend, forms, leads, meetings, no-shows, purchases, and cost efficiency.', status: 'KPIs', tone: 'warn' },
                { title: 'Close the loop', meta: 'Sync CRM leads, record blockers, and learn what to improve for the next event.', status: 'Learning', tone: 'good' },
              ]}
            />
          </ProductCard>
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
              <ProductCard>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ProductStatus tone={statusTone(event.status)}>{titleCase(event.status)}</ProductStatus>
                      <ProductStatus tone={statusTone(sourceStatus.primarySource)}>{sourceLabel(sourceStatus.primarySource)}</ProductStatus>
                      <ProductStatus tone={text(ghlStatus?.credentialStatus) === 'configured' ? 'good' : 'warn'}>
                        {text(ghlStatus?.credentialStatus) === 'configured' ? 'GHL configured' : 'GHL needs setup'}
                      </ProductStatus>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">{eventTitle(event)}</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-500">
                      {titleCase(event.eventType)} in {text(event.location, 'unspecified location')} on {formatDate(event.eventDate)}.
                    </p>
                  </div>
                  <SecondaryAction onClick={() => navigate(`/events/advanced/${selectedEventId}`)}>Advanced Workspace</SecondaryAction>
                </div>
              </ProductCard>

              <WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} />

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
    </ProductPage>
  );
}
