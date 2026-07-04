import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { masterEventsApi } from '../api';
import {
  BarList,
  EmptyProductState,
  ExecutiveGauge,
  ExecutiveKpiCard,
  Field,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

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
  return `${Math.round(numberValue(value)).toLocaleString()} SAR`;
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
  return text(row.eventName, 'Unnamed event');
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
      <ProductPage eyebrow="Events" title="Master Events Dashboard" subtitle="Loading cross-event results...">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="skeleton-pulse h-36 rounded-xl" />)}
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Executive Event Results"
      title="Master Events Dashboard"
      subtitle="Compare every course, camp, and live event by leads, meetings, purchases, spend efficiency, channels, and audience source."
      action={(
        <>
          <ProductStatus tone="info">{numberValue(dashboard?.filteredEvents)} shown</ProductStatus>
          <PrimaryAction onClick={() => navigate('/events/new')}>Create Event</PrimaryAction>
        </>
      )}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <div className="grid gap-4 xl:grid-cols-4">
        <ExecutiveKpiCard
          label="Total Leads"
          value={numberValue(totals.totalLeads).toLocaleString()}
          detail={`${numberValue(totals.formCompletions).toLocaleString()} form completions`}
          tone={numberValue(totals.totalLeads) ? 'good' : 'warn'}
          series={[numberValue(totals.formCompletions), numberValue(totals.totalLeads), numberValue(totals.meetingsBooked), numberValue(totals.purchases)]}
        />
        <ExecutiveKpiCard
          label="Meetings Booked"
          value={numberValue(totals.meetingsBooked).toLocaleString()}
          detail={`${numberValue(totals.meetingsAttended).toLocaleString()} attended / ${numberValue(totals.noShows).toLocaleString()} no-show`}
          tone={numberValue(totals.meetingsBooked) ? 'info' : 'warn'}
          series={[numberValue(totals.totalLeads), numberValue(totals.meetingsBooked), numberValue(totals.meetingsAttended), numberValue(totals.noShows)]}
        />
        <ExecutiveKpiCard
          label="Purchases"
          value={numberValue(totals.purchases).toLocaleString()}
          detail={`${money(totals.revenue)} recorded revenue`}
          tone={numberValue(totals.purchases) ? 'good' : 'warn'}
          series={[numberValue(totals.meetingsBooked), numberValue(totals.meetingsAttended), numberValue(totals.purchases)]}
        />
        <ExecutiveKpiCard
          label="Cost Per Lead"
          value={money(totals.costPerLead)}
          detail={`${money(totals.actualSpend)} actual spend`}
          tone={numberValue(totals.costPerLead) ? 'info' : 'default'}
          series={[numberValue(totals.plannedBudget), numberValue(totals.actualSpend), numberValue(totals.totalLeads)]}
        />
      </div>

      <ProductCard
        title="Production Data Backbone"
        subtitle="Portfolio-level source control for KPI records. Connector data is the production target; approved imports are a bridge; manual entries are fallback corrections."
        action={<ProductStatus tone={numberValue(dataSourceSummary.connectorRecords) ? 'good' : numberValue(dataSourceSummary.importedRecords) ? 'info' : 'warn'}>{numberValue(dataSourceSummary.connectorRecords) ? 'Connector Data Active' : numberValue(dataSourceSummary.importedRecords) ? 'Import Bridge Active' : 'Manual Fallback Active'}</ProductStatus>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Connector Records" value={numberValue(dataSourceSummary.connectorRecords)} detail={`${numberValue(dataSourceSummary.eventsUsingConnectorData)} event(s) connected`} tone={numberValue(dataSourceSummary.connectorRecords) ? 'good' : 'warn'} />
          <MetricCard label="Approved Imports" value={numberValue(dataSourceSummary.importedRecords)} detail={`${numberValue(dataSourceSummary.eventsUsingImportedData)} event(s) using imports`} tone={numberValue(dataSourceSummary.importedRecords) ? 'info' : 'default'} />
          <MetricCard label="Manual Fallback" value={numberValue(dataSourceSummary.manualRecords)} detail={`${numberValue(dataSourceSummary.eventsUsingManualFallback)} event(s) fallback`} tone={numberValue(dataSourceSummary.eventsUsingManualFallback) ? 'warn' : 'default'} />
          <MetricCard label="Synced Jobs" value={numberValue(dataSourceSummary.syncedConnectorJobs)} detail={`${numberValue(dataSourceSummary.readyConnectorJobs)} ready / ${numberValue(dataSourceSummary.failedConnectorJobs)} failed`} tone={numberValue(dataSourceSummary.syncedConnectorJobs) ? 'good' : 'warn'} />
          <MetricCard label="Last Sync" value={formatDateTime(dataSourceSummary.lastConnectorSyncAt)} detail={`${numberValue(dataSourceSummary.connectorRowsImported)} row(s) imported`} tone={dataSourceSummary.lastConnectorSyncAt ? 'good' : 'default'} />
        </div>
      </ProductCard>

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
                value={text((bestPerforming.highestRevenueEvent as RecordMap | undefined)?.eventName, 'Not enough data')}
                detail={money((bestPerforming.highestRevenueEvent as RecordMap | undefined)?.revenue)}
                tone={bestPerforming.highestRevenueEvent ? 'good' : 'default'}
              />
              <MetricCard
                label="Lowest Cost Per Lead"
                value={text((bestPerforming.lowestCostPerLeadEvent as RecordMap | undefined)?.eventName, 'Not enough data')}
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
            Production target: connector-synced KPI data. Approved imports are a transition bridge. Manual entries are fallback corrections and should not be the long-term source of truth for Amro's reporting.
          </Notice>
        </>
      )}
    </ProductPage>
  );
}
