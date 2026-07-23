import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Plus,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react';
import {
  eventCloseoutApi,
  eventPlannerApi,
  eventProblemsApi,
  eventsApi,
  commercialKpiApi,
  ghlSyncApi,
  leadsApi,
  learningRecommendationsApi,
} from '../api';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  MetricCard,
  Notice,
  ProductCard,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  SecondaryAction,
} from '../components/ProductUI';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';
import './EventSalesWorkspaces.css';

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

const EVENT_KPI_PRESETS = [
  { metricKey: 'ticket_sales', label: 'Ticket sales target', unit: 'count', direction: 'target' },
  { metricKey: 'cost_per_lead', label: 'Maximum cost per lead', unit: 'currency', direction: 'maximum' },
  { metricKey: 'interaction_rate', label: 'Minimum interaction rate', unit: 'percentage', direction: 'minimum' },
  { metricKey: 'daily_ad_spend', label: 'Maximum daily ad spend', unit: 'currency', direction: 'maximum' },
  { metricKey: 'purchase_conversion_rate', label: 'Minimum purchase conversion rate', unit: 'percentage', direction: 'minimum' },
] as const;

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
  const [governedTargets, setGovernedTargets] = useState<RecordMap[]>([]);
  const [eventCapacity, setEventCapacity] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(token));

  async function load(preferredId?: string, options: { background?: boolean } = {}) {
    if (!token) return;
    if (!options.background) {
      setLoading(true);
      setMessage('');
    }
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
        setGovernedTargets([]);
        setEventCapacity(null);
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
        governedTargetData,
        eventCapacityData,
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
        commercialKpiApi.effectiveEventTargets(nextEventId, token).catch(() => []),
        commercialKpiApi.eventCapacity(nextEventId, token).catch(() => null),
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
      setGovernedTargets(list(governedTargetData));
      setEventCapacity(eventCapacityData as RecordMap | null);
    } catch (error) {
      setMessage(`Workspace failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (!options.background) setLoading(false);
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
    role,
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
    governedTargets,
    eventCapacity,
    message,
    loading,
    load,
  };
}

function EventContext({ events, selectedEventId, event, sourceStatus, ghlStatus, onSelect }: { events: RecordMap[]; selectedEventId: string; event: RecordMap; sourceStatus: RecordMap; ghlStatus: RecordMap | null; onSelect: (eventId: string) => void }) {
  return (
    <section className="event-context" aria-label="Selected event">
      <div className="event-context-picker">
        <label htmlFor="event-operations-picker">Selected event</label>
        <div><CalendarDays size={18} aria-hidden="true" /><select id="event-operations-picker" value={selectedEventId} onChange={change => onSelect(change.target.value)}>{events.map(item => <option key={String(item.id)} value={String(item.id)}>{eventTitle(item)}</option>)}</select></div>
      </div>
      <dl>
        <div><dt>Date</dt><dd>{formatDate(event.eventDate)}</dd></div>
        <div><dt>Status</dt><dd><OpsStatus tone={statusTone(event.status) === 'good' ? 'positive' : statusTone(event.status) === 'warn' ? 'warning' : 'info'}>{titleCase(event.status)}</OpsStatus></dd></div>
        <div><dt>Performance data</dt><dd>{sourceLabel(sourceStatus.primarySource)}</dd></div>
        <div><dt>CRM</dt><dd>{text(ghlStatus?.credentialStatus) === 'configured' ? 'Configured' : 'Setup needed'}</dd></div>
      </dl>
    </section>
  );
}

function WorkspaceTabs({ activeTab, onChange }: { activeTab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  return <nav className="r1d2-tabs event-tabs" aria-label="Event workspace views">{TABS.map(tab => <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onChange(tab.id)} aria-pressed={activeTab === tab.id}>{tab.label}</button>)}</nav>;
}

function OverviewTab({
  kpis,
  nextActions,
  sourceStatus,
  problemDashboard,
  onNavigate,
}: {
  kpis: RecordMap;
  nextActions: RecordMap[];
  sourceStatus: RecordMap;
  problemDashboard: RecordMap | null;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const readiness = Math.min(100, Math.round(
    (numberValue(kpis.newLeads) > 0 ? 20 : 0)
    + (numberValue(kpis.actualSpend) > 0 ? 20 : 0)
    + (numberValue(kpis.meetingsBooked) > 0 ? 20 : 0)
    + (numberValue(kpis.purchases) > 0 ? 20 : 0)
    + (numberValue(sourceStatus.connectorRecords) > 0 || numberValue(sourceStatus.importedRecords) > 0 ? 20 : 0),
  ));

  const actionRows = nextActions.length ? nextActions.slice(0, 4) : [{ title: 'Review event performance data', detail: 'Confirm that spend, leads, meetings, and purchase records are current.', priority: 'medium' }];
  const blockers = list(problemDashboard?.topBlockers).slice(0, 3);
  function targetFor(action: RecordMap): WorkspaceTab {
    const value = `${text(action.title, '')} ${text(action.detail, '')}`.toLowerCase();
    if (/lead|meeting|sale|follow-up/.test(value)) return 'leads';
    if (/risk|block|delay/.test(value)) return 'blockers';
    if (/plan|content|offer|audience/.test(value)) return 'strategy';
    return 'kpis';
  }

  return <div className="event-overview">
    <OpsSection title="What needs attention today" subtitle="One ordered list across planning, marketing, and sales." action={<OpsStatus tone={actionRows.length ? 'warning' : 'positive'}>{actionRows.length} open</OpsStatus>} className="event-next-actions">
      <div className="event-action-list">{actionRows.map((action, index) => <article key={`${text(action.title)}-${index}`}><span>{index + 1}</span><div><h3>{text(action.title, 'Review event action')}</h3><p>{text(action.detail, 'Review the event data and assign the next owner.')}</p><small><Clock3 size={14} aria-hidden="true" />{titleCase(text(action.priority, 'normal'))} priority</small></div><button className="ops-button is-secondary" type="button" onClick={() => onNavigate(targetFor(action))}>Open</button></article>)}</div>
    </OpsSection>

    <aside className="event-overview-side">
      <OpsSection title="Event health" subtitle="Signals from recorded work and verified data." action={<OpsStatus tone={readiness >= 75 ? 'positive' : readiness >= 40 ? 'warning' : 'danger'}>{readiness >= 75 ? 'On track' : 'Needs attention'}</OpsStatus>} className="event-health">
        <div className="event-health-score"><strong>{readiness}%</strong><div><span><i style={{ width: `${readiness}%` }} /></span><p>Based on KPI records, leads, sales outcomes, and connected/imported data.</p></div></div>
        <dl><div><dt>Lead records</dt><dd>{numberValue(kpis.newLeads || kpis.capturedLeads)}</dd></div><div><dt>Sales outcomes</dt><dd>{numberValue(kpis.purchases)}</dd></div><div><dt>Data source</dt><dd>{numberValue(sourceStatus.connectorRecords) ? 'Connected' : numberValue(sourceStatus.importedRecords) ? 'Imported' : 'Pending'}</dd></div></dl>
      </OpsSection>

      <OpsSection title="Risks" subtitle="Only items that may affect the event outcome." action={<OpsStatus tone={numberValue(problemDashboard?.criticalOpen) ? 'danger' : numberValue(problemDashboard?.openProblems) ? 'warning' : 'positive'}>{numberValue(problemDashboard?.openProblems)} active</OpsStatus>} className="event-risk-summary">
        {blockers.length ? <ul>{blockers.map(problem => <li key={text(problem.id, text(problem.title))}><CircleAlert size={17} aria-hidden="true" /><span><strong>{customerSafeText(problem.title, 'Event risk')}</strong><small>{customerSafeText(problem.description || problem.impact, 'Review and assign the next action.')}</small></span></li>)}</ul> : <div className="event-no-risks"><CheckCircle2 size={18} aria-hidden="true" /><span><strong>No active risk returned</strong><small>Continue monitoring event progress.</small></span></div>}
      </OpsSection>
    </aside>
  </div>;
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
  governedTargets,
  eventCapacity,
  eventId,
  token,
  canManage,
  onRefresh,
  navigate,
}: {
  kpis: RecordMap;
  sourceStatus: RecordMap;
  channelPerformance: RecordMap[];
  kpiRecords: RecordMap[];
  governedTargets: RecordMap[];
  eventCapacity: RecordMap | null;
  eventId: string;
  token: string | null;
  canManage: boolean;
  onRefresh: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  const [targetPreset, setTargetPreset] = useState<string>(EVENT_KPI_PRESETS[0].metricKey);
  const [targetValue, setTargetValue] = useState('');
  const [venueCapacity, setVenueCapacity] = useState(
    eventCapacity?.venueCapacity == null ? '' : String(eventCapacity.venueCapacity),
  );
  const [sellableCapacity, setSellableCapacity] = useState(
    eventCapacity?.sellableTicketCapacity == null
      ? ''
      : String(eventCapacity.sellableTicketCapacity),
  );
  const [capacitySource, setCapacitySource] = useState(text(eventCapacity?.source, ''));
  const [saving, setSaving] = useState('');
  const [feedback, setFeedback] = useState('');
  const inheritedTargets = governedTargets.filter(target => text(target.appliedAs, '') === 'inherited');
  const eventTargets = governedTargets.filter(target => text(target.appliedAs, '') === 'event_specific');

  async function saveCapacity() {
    if (!token) return;
    setSaving('capacity');
    setFeedback('');
    try {
      await commercialKpiApi.setEventCapacity(eventId, {
        venueCapacity: Number(venueCapacity),
        sellableTicketCapacity: Number(sellableCapacity),
        source: capacitySource,
      }, token);
      await onRefresh();
      setFeedback('Venue capacity saved. Ticket targets cannot exceed this absolute limit.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Capacity could not be saved.');
    } finally {
      setSaving('');
    }
  }

  async function createTarget() {
    if (!token) return;
    const preset = EVENT_KPI_PRESETS.find(item => item.metricKey === targetPreset);
    if (!preset) return;
    setSaving('target');
    setFeedback('');
    try {
      await commercialKpiApi.create({
        ...preset,
        scope: 'event',
        controlMode: 'adjustable',
        targetValue: Number(targetValue),
        eventId,
        ...(preset.unit === 'currency' ? { currency: 'AED' } : {}),
      }, token);
      setTargetValue('');
      await onRefresh();
      setFeedback('Event KPI target created as a draft. Submit it for CCO approval when ready.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'KPI target could not be created.');
    } finally {
      setSaving('');
    }
  }

  async function transitionTarget(target: RecordMap, action: 'submit' | 'approve') {
    if (!token) return;
    setSaving(String(target.id));
    setFeedback('');
    try {
      await commercialKpiApi.transition(String(target.id), {
        expectedRevision: numberValue(target.revision),
        action,
        reason: action === 'approve'
          ? 'Approved by CCO for event execution'
          : 'Submitted by CCO for governed approval',
      }, token);
      await onRefresh();
      setFeedback(action === 'approve' ? 'KPI target approved.' : 'KPI target submitted.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'KPI target status could not be changed.');
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="space-y-5">
      <section className="event-kpi-governance" aria-labelledby="event-kpi-targets-title">
        <header>
          <div>
            <h2 id="event-kpi-targets-title">Performance targets</h2>
            <p>Approved strategy targets are inherited. Event-specific controls can be adjusted only by the CCO and remain separate from actual results.</p>
          </div>
          <ProductStatus tone={canManage ? 'info' : 'muted'}>{canManage ? 'CCO controls available' : 'Read only'}</ProductStatus>
        </header>

        {feedback ? <Notice tone={feedback.toLowerCase().includes('could not') ? 'danger' : 'good'}>{feedback}</Notice> : null}

        <div className="event-kpi-target-columns">
          <div className="event-kpi-target-list">
            <div className="event-kpi-target-heading">
              <div><strong>Locked strategy targets</strong><span>Inherited from the approved annual plan</span></div>
              <span>{inheritedTargets.length}</span>
            </div>
            {inheritedTargets.length ? inheritedTargets.map(target => (
              <TargetRow key={String(target.id)} target={target} />
            )) : (
              <p className="event-kpi-empty">No approved annual strategy targets are linked to this event yet.</p>
            )}
          </div>

          <div className="event-kpi-target-list">
            <div className="event-kpi-target-heading">
              <div><strong>Event controls</strong><span>Capacity, efficiency and campaign limits</span></div>
              <span>{eventTargets.length}</span>
            </div>
            {eventTargets.length ? eventTargets.map(target => (
              <TargetRow
                key={String(target.id)}
                target={target}
                action={canManage && text(target.status) === 'draft'
                  ? <button type="button" onClick={() => void transitionTarget(target, 'submit')} disabled={saving === String(target.id)}>Submit</button>
                  : canManage && text(target.status) === 'pending_approval'
                    ? <button type="button" onClick={() => void transitionTarget(target, 'approve')} disabled={saving === String(target.id)}>Approve</button>
                    : null}
              />
            )) : (
              <p className="event-kpi-empty">No approved event-specific target exists yet.</p>
            )}
          </div>
        </div>

        {canManage ? (
          <div className="event-kpi-control-grid">
            <form onSubmit={event => { event.preventDefault(); void saveCapacity(); }}>
              <h3>Venue capacity</h3>
              <p>For live on-stage events, this is an absolute ticket ceiling.</p>
              <label>Venue capacity<input type="number" min="1" required value={venueCapacity} onChange={event => setVenueCapacity(event.target.value)} /></label>
              <label>Sellable ticket capacity<input type="number" min="1" required value={sellableCapacity} onChange={event => setSellableCapacity(event.target.value)} /></label>
              <label>Capacity evidence<input required value={capacitySource} onChange={event => setCapacitySource(event.target.value)} placeholder="Example: signed hall agreement" /></label>
              <button className="ops-button is-secondary" type="submit" disabled={saving === 'capacity'}>{saving === 'capacity' ? 'Saving...' : 'Save capacity'}</button>
            </form>
            <form onSubmit={event => { event.preventDefault(); void createTarget(); }}>
              <h3>Add event KPI target</h3>
              <p>Create an adjustable event control. It stays draft until approved.</p>
              <label>KPI<select value={targetPreset} onChange={event => setTargetPreset(event.target.value)}>{EVENT_KPI_PRESETS.map(item => <option key={item.metricKey} value={item.metricKey}>{item.label}</option>)}</select></label>
              <label>Target value<input type="number" min="0" step="0.01" required value={targetValue} onChange={event => setTargetValue(event.target.value)} /></label>
              <button className="ops-button is-primary" type="submit" disabled={saving === 'target'}>{saving === 'target' ? 'Creating...' : 'Create draft target'}</button>
            </form>
          </div>
        ) : null}
      </section>

      <div className="event-results-heading">
        <div><h2>Actual results</h2><p>Evidence received from connected sources, imports, or governed corrections.</p></div>
      </div>
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

function TargetRow({ target, action }: { target: RecordMap; action?: ReactNode }) {
  const unit = text(target.unit, '');
  const raw = numberValue(target.targetValue);
  const value = unit === 'currency'
    ? formatCurrency(raw, target.currency === 'USD' ? 'USD' : 'AED')
    : unit === 'percentage'
      ? `${raw}%`
      : raw.toLocaleString();
  return (
    <article className="event-kpi-target-row">
      <div><strong>{text(target.label, 'KPI target')}</strong><span>{titleCase(target.scope)} / {titleCase(target.controlMode)}</span></div>
      <div><b>{value}</b><ProductStatus tone={text(target.status) === 'approved' ? 'good' : 'warn'}>{titleCase(target.status)}</ProductStatus>{action}</div>
    </article>
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
    token,
    role,
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
    governedTargets,
    eventCapacity,
    message,
    loading,
    load,
  } = useEventWorkspaceData();

  const event = useMemo(() => (dashboard?.event || events.find(item => String(item.id) === selectedEventId) || {}) as RecordMap, [dashboard, events, selectedEventId]);
  const kpis = (dashboard?.kpis || {}) as RecordMap;
  const sourceStatus = (dashboard?.sourceStatus || {}) as RecordMap;
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
    return <OpsPage className="event-operations-page"><OpsPageHeader title="Event Operations" subtitle="Loading the selected event workspace." /><div className="event-loading"><OpsSkeleton rows={5} /><OpsSkeleton rows={5} /></div></OpsPage>;
  }

  return (
    <OpsPage className="event-operations-page"
    >
      <OpsPageHeader
      title="Event Operations"
      subtitle="Plan each event, track campaign performance, follow leads, manage risks, and learn what to improve next."
      actions={(
        <>
          {selectedEventId ? <button className="ops-button is-secondary" type="button" onClick={() => navigate(`/stitchi?mode=prepare&prompt=${encodeURIComponent(`Review ${eventTitle(event)} and tell me the most important event action today.`)}&returnTo=${encodeURIComponent(`/events/${selectedEventId}`)}`)}><Sparkles size={17} aria-hidden="true" />Ask Stitchi</button> : null}
          <button className="ops-button is-primary" type="button" onClick={() => navigate('/events/new')}><Plus size={17} aria-hidden="true" />Create Event</button>
        </>
      )}
    />

      {message ? <OpsNotice tone="danger">{message}</OpsNotice> : null}

      {!selectedEventId ? (
        <OpsSection><OpsEmpty title="Create the first event" message="Start with the event date, location, budget, audience, and sales target." action={<button className="ops-button is-primary" type="button" onClick={() => navigate('/events/new')}>Create Event</button>} /></OpsSection>
      ) : (
        <>
          <EventContext events={events} selectedEventId={selectedEventId} event={event} sourceStatus={sourceStatus} ghlStatus={ghlStatus} onSelect={selectEvent} />

          <div className="event-workspace-toolbar"><WorkspaceTabs activeTab={activeTab} onChange={setActiveTab} /><button className="ops-text-button" type="button" onClick={() => navigate('/events/master')}>Open event portfolio</button></div>

          <section className="r1d2-summary-grid event-summary" aria-label="Event operating summary">
            <EventSummaryMetric label="Next action" value={text(nextActions[0]?.title, 'Review event plan')} detail={text(nextActions[0]?.priority, 'Normal priority')} icon={Target} tone={nextActions.length ? 'warning' : 'neutral'} />
            <EventSummaryMetric label="New leads" value={numberValue(kpis.newLeads || kpis.capturedLeads).toLocaleString()} detail={`${salesLeads.length} lead records`} icon={UsersRound} tone={numberValue(kpis.newLeads || kpis.capturedLeads) ? 'positive' : 'neutral'} />
            <EventSummaryMetric label="Meetings" value={numberValue(kpis.meetingsBooked).toLocaleString()} detail={`${numberValue(kpis.meetingsAttended)} attended`} icon={CalendarDays} />
            <EventSummaryMetric label="Purchases" value={numberValue(kpis.purchases).toLocaleString()} detail={`${percent(kpis.noShowRate)} no-show rate`} icon={CheckCircle2} tone={numberValue(kpis.purchases) ? 'positive' : 'neutral'} />
            <EventSummaryMetric label="Known spend" value={money(kpis.actualSpend)} detail={`${money(kpis.budgetVariance)} budget variance`} icon={BarChart3} />
          </section>

          {activeTab === 'overview' ? <OverviewTab kpis={kpis} nextActions={nextActions} sourceStatus={sourceStatus} problemDashboard={problemDashboard} onNavigate={setActiveTab} /> : null}
          {activeTab === 'strategy' ? <StrategyTab event={event} emailPlans={emailPlans} whatsappPlans={whatsappPlans} upsellPlans={upsellPlans} contentRequirements={contentRequirements} salesTasks={salesTasks} navigate={navigate} /> : null}
          {activeTab === 'kpis' ? <KpisTab kpis={kpis} sourceStatus={sourceStatus} channelPerformance={channelPerformance} kpiRecords={kpiRecords} governedTargets={governedTargets} eventCapacity={eventCapacity} eventId={selectedEventId} token={token} canManage={role === 'cco'} onRefresh={() => load(selectedEventId, { background: true })} navigate={navigate} /> : null}
          {activeTab === 'leads' ? <LeadsTab salesLeads={salesLeads} leadTemperature={leadTemperature} ghlStatus={ghlStatus} navigate={navigate} /> : null}
          {activeTab === 'blockers' ? <BlockersTab problemDashboard={problemDashboard} eventProblems={eventProblems} /> : null}
          {activeTab === 'closeout' ? <CloseoutTab closeoutReport={closeoutReport} learningSummary={learningSummary} channelPerformance={closeoutChannels} sourcePerformance={closeoutSources} /> : null}
        </>
      )}
    </OpsPage>
  );
}

function EventSummaryMetric({ label, value, detail, icon: Icon, tone = 'neutral' }: { label: string; value: string; detail: string; icon: typeof Target; tone?: 'neutral' | 'positive' | 'warning' }) {
  return <article className={`r1d2-summary-metric is-${tone}`}><span><Icon size={18} aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}
