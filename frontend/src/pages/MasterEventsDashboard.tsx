import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { masterEventsApi } from '../api';
import {
  AieroActionButton,
  AieroGhostButton,
  AieroMetricCard,
  AieroPage,
  AieroPanel,
  AieroStatusPill,
} from '../components/AieroUX';
import {
  BarList,
  EmptyProductState,
  ExecutiveGauge,
  Field,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductStatus,
  ProductTable,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';

type RecordMap = Record<string, unknown>;

const EVENT_TYPES = [
  { value: '', label: 'All event types' },
  { value: 'tagyeer_wa_irtaqi', label: 'Tagyeer wa Irtaqi' },
  { value: 'moaaskar_al_tamayoz', label: 'Moaaskar Al-Tamayoz' },
  { value: 'business_camp', label: 'Business Camp' },
  { value: 'virtual_event', label: 'Virtual Event' },
];

const EVENT_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function mapEntries(value: unknown): Array<[string, RecordMap | number]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, RecordMap | number>);
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

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function money(value: unknown): string {
  return formatCurrency(value);
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 10) / 10}%`;
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
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const internalCustomerTextPattern = /\b(sprint\s*\d+|acceptance|smoke)\b/i;

function isInternalCustomerText(value: unknown): boolean {
  return typeof value === 'string' && internalCustomerTextPattern.test(value);
}

function sourceLabel(value: unknown): string {
  const source = text(value, 'none');
  if (source === 'connector') return 'Connector';
  if (source === 'imported') return 'Import';
  if (source === 'manual') return 'Manual fallback';
  return 'No KPI';
}

function sourceTone(value: unknown): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const source = text(value, 'none');
  if (source === 'connector') return 'good';
  if (source === 'imported') return 'info';
  if (source === 'manual') return 'warn';
  return 'default';
}

function filterPayload(filters: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (!value.trim()) continue;
    if (key === 'dateFrom') {
      payload[key] = `${value.trim()}T00:00:00.000Z`;
      continue;
    }
    if (key === 'dateTo') {
      payload[key] = `${value.trim()}T23:59:59.999Z`;
      continue;
    }
    payload[key] = value.trim();
  }
  return payload;
}

function stat(record: RecordMap | number, key: string): number {
  if (typeof record === 'number') return record;
  return numberValue(record[key]);
}

function calculatePurchaseConversion(totals: RecordMap): number {
  const leads = numberValue(totals.totalLeads);
  if (!leads) return 0;
  return (numberValue(totals.purchases) / leads) * 100;
}

function getEventName(row: RecordMap): string {
  const rawName = text(row.eventName, '');
  if (rawName && !isInternalCustomerText(rawName)) return rawName;
  const eventDate = row.eventDate || row.date;
  const date = formatDate(eventDate);
  return date === 'Not set' ? 'Customer event' : `Customer event - ${date}`;
}

function buildNextActions(totals: RecordMap, dataSourceSummary: RecordMap, events: RecordMap[]) {
  const actions: { title: string; meta: string; status: string; tone: 'good' | 'warn' | 'danger' | 'info' }[] = [];
  if (!numberValue(dataSourceSummary.connectorRecords) && !numberValue(dataSourceSummary.importedRecords)) {
    actions.push({
      title: 'Connect campaign data',
      meta: 'Add customer-owned Meta, YouTube, Formaloo, GHL, Postiz, or CSV imports so performance is verified.',
      status: 'Data',
      tone: 'warn',
    });
  }
  if (numberValue(totals.noShowRate) > 0.2) {
    actions.push({
      title: 'Reduce meeting no-shows',
      meta: `${Math.round(numberValue(totals.noShowRate) * 100)}% no-show rate needs WhatsApp, email, or sales follow-up action.`,
      status: 'Sales',
      tone: 'danger',
    });
  }
  if (numberValue(totals.totalLeads) && !numberValue(totals.purchases)) {
    actions.push({
      title: 'Turn leads into purchases',
      meta: 'Leads exist, but purchases are not moving yet. Review lead stages, sales tasks, and CRM mapping.',
      status: 'Revenue',
      tone: 'warn',
    });
  }
  if (!events.length) {
    actions.push({
      title: 'Create the first event',
      meta: 'Start with the event date, offer, audience, budget, and target location.',
      status: 'Start',
      tone: 'info',
    });
  }
  if (!actions.length) {
    actions.push({
      title: 'Review top performing event',
      meta: 'Use the event comparison table to continue the event with the strongest revenue or lead signal.',
      status: 'Review',
      tone: 'good',
    });
  }
  return actions;
}

export default function MasterEventsDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [filters, setFilters] = useState({
    eventType: '',
    eventStatus: '',
    dateFrom: '',
    dateTo: '',
    geography: '',
  });

  async function load(nextFilters = filters) {
    if (!token) return;
    setMessage('');
    const data = await masterEventsApi.dashboard(token, filterPayload(nextFilters));
    setDashboard(data as RecordMap);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        await load();
      } catch (error) {
        if (!cancelled) setMessage(`Master dashboard failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const totals = useMemo(() => (dashboard?.totals || {}) as RecordMap, [dashboard]);
  const dataSourceSummary = useMemo(() => (dashboard?.dataSourceSummary || {}) as RecordMap, [dashboard]);
  const events = list(dashboard?.events);
  const bestPerforming = (dashboard?.bestPerforming || {}) as RecordMap;
  const byChannel = mapEntries(dashboard?.byChannel);
  const byEventType = mapEntries(dashboard?.byEventType);
  const byAudience = mapEntries(dashboard?.byAudienceSource);
  const byGeography = mapEntries(dashboard?.byGeography);
  const purchaseConversion = calculatePurchaseConversion(totals);
  const noShowPct = numberValue(totals.noShowRate) * 100;
  const nextActions = buildNextActions(totals, dataSourceSummary, events);

  const funnelStages = useMemo(
    () => [
      { label: 'Leads', value: numberValue(totals.totalLeads), tone: 'info' as const },
      { label: 'Forms', value: numberValue(totals.formCompletions), tone: 'info' as const },
      { label: 'Meetings', value: numberValue(totals.meetingsBooked), tone: 'warn' as const },
      { label: 'Attended', value: numberValue(totals.meetingsAttended), tone: 'info' as const },
      { label: 'Purchases', value: numberValue(totals.purchases), tone: 'good' as const },
    ],
    [totals],
  );

  const channelRows = byChannel
    .map(([channel, data]) => ({
      channel,
      leads: stat(data, 'leads'),
      purchases: stat(data, 'purchases'),
      spend: stat(data, 'spend'),
    }))
    .sort((a, b) => b.leads - a.leads);

  const eventTypeRows = byEventType
    .map(([eventType, data]) => ({
      eventType,
      events: stat(data, 'events'),
      leads: stat(data, 'leads'),
      purchases: stat(data, 'purchases'),
      revenue: stat(data, 'revenue'),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  if (pageLoading) {
    return (
      <AieroPage eyebrow="Home" title="Business Control Room" subtitle="Loading cross-event results...">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="h-36 rounded-[1.25rem] border border-white/10 bg-white/[0.08]" />)}
        </div>
      </AieroPage>
    );
  }

  return (
    <AieroPage
      eyebrow="Home"
      title="Business Control Room"
      subtitle="See what needs action today across events, leads, spend, meetings, purchases, and campaign data sources."
      action={(
        <>
          <AieroStatusPill accent="blue">{numberValue(dashboard?.filteredEvents)} shown</AieroStatusPill>
          <AieroActionButton onClick={() => navigate('/events/new')}>Create Event</AieroActionButton>
        </>
      )}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <AieroPanel className="bg-[#121122]">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Today</div>
          <h2 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight tracking-tight">Keep events moving from attention to purchase.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">
            Use this page to decide what needs work now: data connections, lead follow-up, no-show recovery, spend efficiency, and sales conversion.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <AieroMetricCard label="Events" value={events.length} detail="Active event workspace" accent="teal" />
            <AieroMetricCard label="Leads" value={numberValue(totals.totalLeads).toLocaleString()} detail="Captured and imported interest" accent="rose" />
            <AieroMetricCard label="Purchases" value={numberValue(totals.purchases).toLocaleString()} detail="Closed sales outcomes" accent="violet" />
          </div>
        </AieroPanel>

        <AieroPanel title="Next Actions" subtitle="The shortest path to improve event results.">
          <div className="space-y-3">
            {nextActions.map(action => (
              <div key={action.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{action.title}</div>
                    <p className="mt-1 text-sm leading-6 text-white/55">{action.meta}</p>
                  </div>
                  <AieroStatusPill accent={action.tone === 'danger' ? 'rose' : action.tone === 'good' ? 'teal' : action.tone === 'info' ? 'blue' : 'amber'}>
                    {action.status}
                  </AieroStatusPill>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AieroActionButton onClick={() => navigate('/events')}>Open Events</AieroActionButton>
            <AieroGhostButton onClick={() => navigate('/integration-credentials')}>Connect Data</AieroGhostButton>
          </div>
        </AieroPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <AieroMetricCard label="Total Leads" value={numberValue(totals.totalLeads).toLocaleString()} detail={`${numberValue(totals.formCompletions).toLocaleString()} form completions`} accent="teal" />
        <AieroMetricCard label="Meetings Booked" value={numberValue(totals.meetingsBooked).toLocaleString()} detail={`${numberValue(totals.meetingsAttended).toLocaleString()} attended / ${numberValue(totals.noShows).toLocaleString()} no-show`} accent="amber" />
        <AieroMetricCard label="Purchases" value={numberValue(totals.purchases).toLocaleString()} detail={`${money(totals.revenue)} recorded revenue`} accent="rose" />
        <AieroMetricCard label="Cost Per Lead" value={money(totals.costPerLead)} detail={`${money(totals.actualSpend)} actual spend`} accent="violet" />
      </div>

      <AieroPanel
        title="Production Data Backbone"
        subtitle="Portfolio-level source control for KPI records. Connector data is the production target; approved imports are a bridge; manual entries are fallback corrections."
        action={<AieroStatusPill accent={numberValue(dataSourceSummary.connectorRecords) ? 'teal' : numberValue(dataSourceSummary.importedRecords) ? 'blue' : 'amber'}>{numberValue(dataSourceSummary.connectorRecords) ? 'Connector Data Active' : numberValue(dataSourceSummary.importedRecords) ? 'Import Bridge Active' : 'Manual Fallback Active'}</AieroStatusPill>}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AieroMetricCard label="Connector Records" value={numberValue(dataSourceSummary.connectorRecords)} detail={`${numberValue(dataSourceSummary.eventsUsingConnectorData)} event(s) connected`} accent="teal" />
          <AieroMetricCard label="Approved Imports" value={numberValue(dataSourceSummary.importedRecords)} detail={`${numberValue(dataSourceSummary.eventsUsingImportedData)} event(s) using imports`} accent="blue" />
          <AieroMetricCard label="Manual Fallback" value={numberValue(dataSourceSummary.manualRecords)} detail={`${numberValue(dataSourceSummary.eventsUsingManualFallback)} event(s) fallback`} accent="amber" />
          <AieroMetricCard label="Synced Jobs" value={numberValue(dataSourceSummary.syncedConnectorJobs)} detail={`${numberValue(dataSourceSummary.readyConnectorJobs)} ready / ${numberValue(dataSourceSummary.failedConnectorJobs)} failed`} accent="violet" />
          <AieroMetricCard label="Last Sync" value={formatDateTime(dataSourceSummary.lastConnectorSyncAt)} detail={`${numberValue(dataSourceSummary.connectorRowsImported)} row(s) imported`} accent="rose" />
        </div>
      </AieroPanel>

      {!numberValue(dataSourceSummary.connectorRecords) && (
        <Notice tone="warn">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Verified metrics pending</div>
              <div className="mt-1">
                Connect Meta/Instagram, YouTube, Formaloo, GoHighLevel, Postiz, WhatsApp, or SmartLabs from Data Sources.
                After credentials, mapping, dry-run, and approval, connector data will populate these dashboards.
              </div>
            </div>
            <AieroGhostButton onClick={() => navigate('/integration-credentials')}>
              Open Data Sources
            </AieroGhostButton>
          </div>
        </Notice>
      )}

      <ProductCard title="Filters" subtitle="Narrow the dashboard without changing or importing external data.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Event type">
            <select
              value={filters.eventType}
              onChange={event => setFilters(current => ({ ...current, eventType: event.target.value }))}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              {EVENT_TYPES.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={filters.eventStatus}
              onChange={event => setFilters(current => ({ ...current, eventStatus: event.target.value }))}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              {EVENT_STATUSES.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="From">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={event => setFilters(current => ({ ...current, dateFrom: event.target.value }))}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={filters.dateTo}
              onChange={event => setFilters(current => ({ ...current, dateTo: event.target.value }))}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Location">
            <input
              value={filters.geography}
              onChange={event => setFilters(current => ({ ...current, geography: event.target.value }))}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Riyadh, Dubai, GCC..."
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryAction onClick={() => load(filters)}>Apply Filters</PrimaryAction>
          <SecondaryAction
            onClick={() => {
              const cleared = { eventType: '', eventStatus: '', dateFrom: '', dateTo: '', geography: '' };
              setFilters(cleared);
              void load(cleared);
            }}
          >
            Clear
          </SecondaryAction>
        </div>
      </ProductCard>

      {events.length === 0 ? (
        <EmptyProductState
          title="No event results yet"
          message="Create events and add KPI or lead records. This dashboard will then show real cross-event performance without static sample numbers."
          action={<PrimaryAction onClick={() => navigate('/events/new')}>Create Event</PrimaryAction>}
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
            <ProductCard title="Revenue Funnel" subtitle="A portfolio view of how attention turns into meetings and purchases.">
              <FunnelChart stages={funnelStages} />
            </ProductCard>
            <ExecutiveGauge
              label="Purchase Conversion"
              value={purchaseConversion}
              detail={`${percent(purchaseConversion)} of captured leads became purchases. No-show rate is ${percent(noShowPct)}.`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Revenue Target" value={money(totals.revenueTarget)} detail="Across filtered events" tone="info" />
            <MetricCard label="Planned Budget" value={money(totals.plannedBudget)} detail="From event strategies" tone="info" />
            <MetricCard label="Actual Spend" value={money(totals.actualSpend)} detail="From KPI records" tone={numberValue(totals.actualSpend) ? 'warn' : 'default'} />
            <MetricCard label="No-show Rate" value={percent(noShowPct)} detail={`${numberValue(totals.noShows)} no-show(s)`} tone={noShowPct > 20 ? 'warn' : 'info'} />
          </div>

          <ProductCard title="Best Signals" subtitle="These are calculated from event records, not invented recommendations.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Best Channel" value={titleCase(text(bestPerforming.bestChannel, 'Unknown'))} detail="Highest lead volume" tone={bestPerforming.bestChannel ? 'good' : 'default'} />
              <MetricCard label="Best Audience" value={titleCase(text(bestPerforming.bestAudienceSource, 'Unknown'))} detail="Highest lead volume" tone={bestPerforming.bestAudienceSource ? 'good' : 'default'} />
              <MetricCard
                label="Highest Revenue Event"
                value={bestPerforming.highestRevenueEvent ? getEventName(bestPerforming.highestRevenueEvent as RecordMap) : 'Not enough data'}
                detail={money((bestPerforming.highestRevenueEvent as RecordMap | undefined)?.revenue)}
                tone={bestPerforming.highestRevenueEvent ? 'good' : 'default'}
              />
              <MetricCard
                label="Lowest Cost Per Lead"
                value={bestPerforming.lowestCostPerLeadEvent ? getEventName(bestPerforming.lowestCostPerLeadEvent as RecordMap) : 'Not enough data'}
                detail={money((bestPerforming.lowestCostPerLeadEvent as RecordMap | undefined)?.costPerLead)}
                tone={bestPerforming.lowestCostPerLeadEvent ? 'info' : 'default'}
              />
            </div>
          </ProductCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <ProductCard title="Channel Performance" subtitle="Which channels are creating pipeline and purchases.">
              {channelRows.length ? (
                <ProductTable
                  columns={['Channel', 'Leads', 'Purchases', 'Spend', 'Cost / Lead']}
                  rows={channelRows.map(channel => [
                    titleCase(channel.channel),
                    channel.leads.toLocaleString(),
                    channel.purchases.toLocaleString(),
                    money(channel.spend),
                    money(channel.leads ? channel.spend / channel.leads : 0),
                  ])}
                />
              ) : (
                <EmptyProductState message="No channel performance yet. Add KPI records or capture event leads with channel attribution." />
              )}
            </ProductCard>

            <ProductCard title="Audience Sources" subtitle="Which source types are becoming qualified sales signals.">
              {byAudience.length ? (
                <BarList
                  items={byAudience.map(([source, data]) => ({
                    label: titleCase(source),
                    value: stat(data, 'leads'),
                    detail: `${stat(data, 'leads')} leads / ${stat(data, 'purchases')} purchases`,
                    tone: stat(data, 'purchases') ? 'good' : 'info',
                  }))}
                />
              ) : (
                <EmptyProductState message="No audience source data yet. Leads need follower, non-follower, existing customer, or referral attribution." />
              )}
            </ProductCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ProductCard title="Event Type Comparison" subtitle="Compare course, camp, business, and virtual event performance.">
              {eventTypeRows.length ? (
                <ProductTable
                  columns={['Event Type', 'Events', 'Leads', 'Purchases', 'Revenue']}
                  rows={eventTypeRows.map(row => [
                    titleCase(row.eventType),
                    row.events.toLocaleString(),
                    row.leads.toLocaleString(),
                    row.purchases.toLocaleString(),
                    money(row.revenue),
                  ])}
                />
              ) : (
                <EmptyProductState message="No event type comparison yet." />
              )}
            </ProductCard>

            <ProductCard title="Locations" subtitle="Where event demand is appearing.">
              {byGeography.length ? (
                <BarList
                  items={byGeography.map(([geo, data]) => ({
                    label: titleCase(geo),
                    value: stat(data, 'leads'),
                    detail: `${stat(data, 'events')} event(s), ${money(stat(data, 'revenue'))}`,
                    tone: stat(data, 'revenue') ? 'good' : 'info',
                  }))}
                />
              ) : (
                <EmptyProductState message="No location data yet. Add geography in event strategy records." />
              )}
            </ProductCard>
          </div>

          <ProductCard title="Event Comparison" subtitle="Drill into one event to operate the campaign, sales workflow, KPI source, and closeout evidence.">
            <ProductTable
              columns={['Event', 'Type', 'Status', 'Data Source', 'Date', 'Leads', 'Meetings', 'Purchases', 'Revenue', 'Action']}
              rows={events.map(row => [
                getEventName(row),
                titleCase(text(row.eventType, 'Unknown')),
                titleCase(text(row.status, 'Unknown')),
                <ProductStatus key={`${String(row.eventId)}-source`} tone={sourceTone(row.primaryDataSource)}>{sourceLabel(row.primaryDataSource)}</ProductStatus>,
                formatDate(row.eventDate),
                numberValue(row.totalLeads).toLocaleString(),
                numberValue(row.meetingsBooked).toLocaleString(),
                numberValue(row.purchases).toLocaleString(),
                money(row.revenue),
                <SecondaryAction key={String(row.eventId || row.eventName)} onClick={() => navigate(`/events/${String(row.eventId)}`)}>Open</SecondaryAction>,
              ])}
            />
          </ProductCard>

          <Notice tone="info">
            Production target: connector-synced KPI data. Approved imports are a transition bridge. Manual entries are fallback corrections and should not be the long-term source of truth for customer reporting.
          </Notice>
        </>
      )}
    </AieroPage>
  );
}
