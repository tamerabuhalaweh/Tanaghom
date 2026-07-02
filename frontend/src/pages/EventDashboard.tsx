import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { eventsApi } from '../api';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
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
  ReadableQueue,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
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

function formatDate(value: unknown): string {
  if (!value) return 'Not set';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function money(value: unknown): string {
  return `${numberValue(value).toLocaleString()} SAR`;
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(value: unknown): number | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function EventDashboard() {
  const { token } = useAuth();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [kpiForm, setKpiForm] = useState({
    metricDate: todayInput(),
    channel: 'instagram',
    sourceName: 'manual',
    reach: '',
    impressions: '',
    interactions: '',
    clicks: '',
    formCompletions: '',
    leads: '',
    meetingsBooked: '',
    meetingsAttended: '',
    purchases: '',
    noShows: '',
    spend: '',
    notes: '',
  });

  const selectedEventId = eventId || String(events[0]?.id || '');

  async function load(selected = selectedEventId) {
    if (!token) return;
    const eventList = await eventsApi.list(token);
    const normalizedEvents = list(eventList);
    setEvents(normalizedEvents);
    const nextEventId = selected || String(normalizedEvents[0]?.id || '');
    if (nextEventId) {
      const data = await eventsApi.dashboard(nextEventId, token);
      setDashboard(data as RecordMap);
    } else {
      setDashboard(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        await load(eventId || '');
      } catch (error) {
        if (!cancelled) setMessage(`Events failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId]);

  const event = useMemo(() => (dashboard?.event || {}) as RecordMap, [dashboard]);
  const kpis = (dashboard?.kpis || {}) as RecordMap;
  const sourceStatus = (dashboard?.sourceStatus || {}) as RecordMap;
  const funnel = list(dashboard?.funnel);
  const channelPerformance = list(dashboard?.channelPerformance);
  const leadTemperature = list(dashboard?.leadTemperature);
  const nextActions = list(dashboard?.nextActions);
  const kpiRecords = list(dashboard?.kpiRecords);
  const leads = list(dashboard?.leads);
  const campaigns = list(dashboard?.campaigns);
  const daysRemaining = daysUntil(event.eventDate);

  const eventDetails = useMemo(
    () => [
      { label: 'Event Type', value: titleCase(text(event.eventType, 'Not set')) },
      { label: 'Event Date', value: formatDate(event.eventDate) },
      { label: 'Location', value: text(event.location, 'Not set') },
      { label: 'Campaign Start', value: formatDate(event.campaignStartDate) },
      { label: 'Campaign End', value: formatDate(event.campaignEndDate) },
      { label: 'Owner', value: text(event.ownerUserName, 'Not assigned') },
      { label: 'Expected Attendance', value: String(numberValue(event.expectedAttendance)) },
      { label: 'Revenue Target', value: money(event.revenueTarget) },
    ],
    [event],
  );

  async function saveKpi() {
    if (!token || !selectedEventId) return;
    setLoading('save-kpi');
    setMessage('');
    try {
      const payload: RecordMap = {
        sourceType: 'manual',
        sourceName: kpiForm.sourceName || 'manual',
        metricDate: new Date(`${kpiForm.metricDate}T12:00:00Z`).toISOString(),
        channel: kpiForm.channel || 'manual',
        notes: kpiForm.notes || null,
      };

      for (const key of ['reach', 'impressions', 'interactions', 'clicks', 'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended', 'purchases', 'noShows', 'spend']) {
        const value = kpiForm[key as keyof typeof kpiForm];
        if (value !== '') payload[key] = Number(value);
      }

      await eventsApi.createKpi(selectedEventId, payload, token);
      setMessage('Event KPI update saved. Dashboard refreshed.');
      setKpiForm(current => ({
        ...current,
        reach: '',
        impressions: '',
        interactions: '',
        clicks: '',
        formCompletions: '',
        leads: '',
        meetingsBooked: '',
        meetingsAttended: '',
        purchases: '',
        noShows: '',
        spend: '',
        notes: '',
      }));
      await load(selectedEventId);
    } catch (error) {
      setMessage(`Could not save KPI update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  if (pageLoading) {
    return (
      <ProductPage eyebrow="Events" title="Event Dashboard" subtitle="Loading event results...">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="skeleton-pulse h-36 rounded-xl" />)}
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Event Revenue Operations"
      title="Events"
      subtitle="Track each course, camp, or live event from campaign launch to leads, meetings, purchases, no-shows, and learning."
      action={(
        <>
          <ProductStatus tone="info">Amro Workspace</ProductStatus>
          <PrimaryAction onClick={() => navigate('/events/new')}>Create Event</PrimaryAction>
        </>
      )}
    >
      {message && <Notice tone={message.toLowerCase().includes('could not') || message.toLowerCase().includes('failed') ? 'danger' : 'good'}>{message}</Notice>}

      {events.length === 0 ? (
        <EmptyProductState
          title="No events yet"
          message="Create the first event strategy, then this page becomes Amro's operating dashboard for leads, spend, meetings, purchases, and follow-up."
          action={<PrimaryAction onClick={() => navigate('/events/new')}>Create Event Strategy</PrimaryAction>}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <ProductCard title="Event Queue" subtitle="Choose the event Amro is operating today.">
              <div className="space-y-3">
                {events.map(item => {
                  const active = String(item.id) === selectedEventId;
                  return (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => navigate(`/events/${String(item.id)}`)}
                      className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                    >
                      <div className="font-semibold">{text(item.name, 'Untitled event')}</div>
                      <div className={`mt-2 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                        {titleCase(text(item.eventType, 'event'))} / {formatDate(item.eventDate)}
                      </div>
                      <div className="mt-3">
                        <ProductStatus tone={active ? 'muted' : 'info'}>{titleCase(text(item.status, 'draft'))}</ProductStatus>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ProductCard>

            <ProductCard title="Manual KPI Update" subtitle="Use this until official Meta, YouTube, Formaloo, GHL, and WhatsApp connectors are enabled.">
              <div className="space-y-4">
                <Field label="Date">
                  <input
                    type="date"
                    value={kpiForm.metricDate}
                    onChange={event => setKpiForm(current => ({ ...current, metricDate: event.target.value }))}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Channel">
                  <select
                    value={kpiForm.channel}
                    onChange={event => setKpiForm(current => ({ ...current, channel: event.target.value }))}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  >
                    {['instagram', 'meta_ads', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ads', 'referral', 'manual'].map(channel => (
                      <option key={channel} value={channel}>{titleCase(channel)}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['reach', 'Reach'],
                    ['interactions', 'Interactions'],
                    ['formCompletions', 'Forms'],
                    ['leads', 'Leads'],
                    ['meetingsBooked', 'Meetings'],
                    ['purchases', 'Purchases'],
                    ['noShows', 'No-shows'],
                    ['spend', 'Spend'],
                  ].map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="number"
                        min="0"
                        value={kpiForm[key as keyof typeof kpiForm]}
                        onChange={event => setKpiForm(current => ({ ...current, [key]: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Notes">
                  <textarea
                    value={kpiForm.notes}
                    onChange={event => setKpiForm(current => ({ ...current, notes: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Example: Meta campaign adjusted after low interaction rate."
                  />
                </Field>
                <PrimaryAction onClick={saveKpi} disabled={loading === 'save-kpi'}>
                  {loading === 'save-kpi' ? 'Saving...' : 'Save KPI Update'}
                </PrimaryAction>
              </div>
            </ProductCard>
          </div>

          <div className="space-y-6">
            <ProductCard
              title={text(event.name, 'Selected event')}
              subtitle="This is the event-level operating view: budget, leads, meetings, purchases, no-shows, and next actions."
              action={<ProductStatus tone={text(event.status) === 'active' ? 'good' : 'info'}>{titleCase(text(event.status, 'planning'))}</ProductStatus>}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <DetailGrid items={eventDetails} />
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                  <div className="text-sm font-semibold text-neutral-950">Time pressure</div>
                  <div className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
                    {daysRemaining == null ? 'N/A' : Math.max(0, daysRemaining)}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-neutral-500">
                    {daysRemaining == null ? 'Event date is not available.' : 'day(s) until event date. Campaign activity should intensify as this number drops.'}
                  </div>
                </div>
              </div>
            </ProductCard>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ExecutiveKpiCard label="New Leads" value={numberValue(kpis.newLeads)} detail={`${numberValue(kpis.formCompletions)} forms completed`} tone={numberValue(kpis.newLeads) ? 'good' : 'warn'} series={[numberValue(kpis.formCompletions), numberValue(kpis.newLeads), numberValue(kpis.meetingsBooked), numberValue(kpis.purchases)]} />
              <ExecutiveKpiCard label="Meetings" value={numberValue(kpis.meetingsBooked)} detail={`${numberValue(kpis.noShows)} no-show(s)`} tone={numberValue(kpis.meetingsBooked) ? 'info' : 'warn'} series={[numberValue(kpis.newLeads), numberValue(kpis.meetingsBooked), numberValue(kpis.meetingsAttended), numberValue(kpis.noShows)]} />
              <ExecutiveKpiCard label="Purchases" value={numberValue(kpis.purchases)} detail={`${money(kpis.actualSpend)} actual spend`} tone={numberValue(kpis.purchases) ? 'good' : 'warn'} series={[numberValue(kpis.meetingsBooked), numberValue(kpis.meetingsAttended), numberValue(kpis.purchases)]} />
              <ExecutiveKpiCard label="Interaction Rate" value={`${numberValue(kpis.interactionRate)}%`} detail={`${numberValue(kpis.reach).toLocaleString()} reach`} tone={numberValue(kpis.interactionRate) ? 'info' : 'warn'} series={[numberValue(kpis.reach), numberValue(kpis.interactions), numberValue(kpis.clicks)]} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <ProductCard title="Event Funnel" subtitle="Where the event is gaining or losing momentum.">
                {funnel.some(stage => numberValue(stage.value) > 0) ? (
                  <FunnelChart stages={funnel.map(stage => ({ label: text(stage.label), value: numberValue(stage.value), tone: numberValue(stage.value) ? 'info' : 'default' }))} />
                ) : (
                  <EmptyProductState message="Add KPI data or link leads to this event to see the funnel." />
                )}
              </ProductCard>

              <ProductCard title="Budget Control" subtitle="Manual spend until ad connectors are enabled.">
                <div className="grid gap-3">
                  <MetricCard label="Planned Budget" value={money(kpis.plannedBudget)} detail="From event strategy" tone="info" />
                  <MetricCard label="Actual Spend" value={money(kpis.actualSpend)} detail="From KPI records" tone={numberValue(kpis.actualSpend) ? 'warn' : 'default'} />
                  <MetricCard label="Cost Per Lead" value={money(kpis.costPerLead)} detail="Spend / event leads" tone={numberValue(kpis.costPerLead) ? 'info' : 'default'} />
                </div>
              </ProductCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <ProductCard title="Next Required Actions" subtitle="Operational actions for Amro and the sales/content teams.">
                {nextActions.length ? (
                  <ReadableQueue
                    items={nextActions.map(action => ({
                      title: text(action.title),
                      meta: text(action.detail),
                      status: titleCase(text(action.priority)),
                      tone: text(action.priority) === 'high' ? 'warn' : 'info',
                    }))}
                  />
                ) : (
                  <EmptyProductState message="No urgent action detected from the current event data." />
                )}
              </ProductCard>

              <ProductCard title="Lead Temperature" subtitle="Simple funnel temperature from linked leads and event KPI records.">
                <BarList
                  items={leadTemperature.map(item => ({
                    label: text(item.label),
                    value: numberValue(item.value),
                    tone: text(item.label).toLowerCase().includes('buyer') ? 'good' : text(item.label).toLowerCase().includes('no') ? 'warn' : 'info',
                  }))}
                />
              </ProductCard>
            </div>

            <ProductCard title="Channel Performance" subtitle="Compare where event attention and sales signals are coming from.">
              {channelPerformance.length ? (
                <ProductTable
                  columns={['Channel', 'Reach', 'Interactions', 'Leads', 'Purchases', 'Spend', 'Conversion']}
                  rows={channelPerformance.map(channel => [
                    titleCase(text(channel.channel)),
                    numberValue(channel.reach).toLocaleString(),
                    numberValue(channel.interactions).toLocaleString(),
                    numberValue(channel.leads).toLocaleString(),
                    numberValue(channel.purchases).toLocaleString(),
                    money(channel.spend),
                    `${numberValue(channel.conversionRate)}%`,
                  ])}
                />
              ) : (
                <EmptyProductState message="No channel metrics yet. Add manual KPI data for Instagram, Meta Ads, YouTube, WhatsApp, email, dark ads, or referrals." />
              )}
            </ProductCard>

            <ProductCard title="Leads For This Event" subtitle="Only leads linked to this event are shown. No other event data is mixed in.">
              {leads.length ? (
                <ProductTable
                  columns={['Lead', 'Source', 'Status', 'Email', 'Created']}
                  rows={leads.map(lead => [
                    text(lead.leadName, 'Unnamed lead'),
                    titleCase(text(lead.platform, 'manual')),
                    titleCase(text(lead.status, 'new lead')),
                    text(lead.leadEmail, 'Not provided'),
                    formatDate(lead.createdAt),
                  ])}
                />
              ) : (
                <EmptyProductState message="No leads are linked to this event yet. Capture leads from Performance or link imported leads after customer-owned connectors are configured." />
              )}
            </ProductCard>

            <ProductCard title="KPI Evidence" subtitle="Every dashboard number comes from manual/imported/connector records.">
              <div className="mb-4 flex flex-wrap gap-2">
                <ProductStatus tone="info">{numberValue(sourceStatus.manualRecords)} manual</ProductStatus>
                <ProductStatus tone="info">{numberValue(sourceStatus.importedRecords)} imported</ProductStatus>
                <ProductStatus tone="info">{numberValue(sourceStatus.connectorRecords)} connector</ProductStatus>
              </div>
              {kpiRecords.length ? (
                <ProductTable
                  columns={['Date', 'Channel', 'Leads', 'Meetings', 'Purchases', 'Spend', 'Source']}
                  rows={kpiRecords.slice(0, 12).map(record => [
                    formatDate(record.metricDate),
                    titleCase(text(record.channel)),
                    numberValue(record.leads).toLocaleString(),
                    numberValue(record.meetingsBooked).toLocaleString(),
                    numberValue(record.purchases).toLocaleString(),
                    money(record.spend),
                    titleCase(text(record.sourceType)),
                  ])}
                />
              ) : (
                <EmptyProductState message="No KPI records yet. Add the first update from the form on the left." />
              )}
            </ProductCard>

            <ProductCard title="Linked Campaigns" subtitle="Campaigns connected to this event.">
              {campaigns.length ? (
                <ReadableQueue
                  items={campaigns.map(campaign => ({
                    title: text(campaign.title, 'Event campaign'),
                    meta: `${text(campaign.objective, 'No objective')} / ${list(campaign.platforms).join(', ') || 'No platform set'}`,
                    status: titleCase(text(campaign.status, 'idea')),
                    tone: 'info',
                  }))}
                />
              ) : (
                <EmptyProductState message="No campaigns are linked to this event yet. Link a campaign from the event strategy workflow." />
              )}
            </ProductCard>

            <div className="flex justify-end">
              <SecondaryAction onClick={() => load(selectedEventId)}>Refresh Event Data</SecondaryAction>
            </div>
          </div>
        </div>
      )}
    </ProductPage>
  );
}
