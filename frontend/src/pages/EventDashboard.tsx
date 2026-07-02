import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { eventsApi, leadsApi } from '../api';
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
type LeadStatus = 'new_lead' | 'contacted' | 'meeting_booked' | 'meeting_attended' | 'no_show' | 'purchased' | 'lost' | 'follow_up_needed' | 'qualified' | 'nurturing' | 'converted' | 'archived';
type LeadTemperature = 'cold' | 'warm' | 'hot' | 'buyer';

const LEAD_STATUSES: LeadStatus[] = ['new_lead', 'qualified', 'nurturing', 'contacted', 'meeting_booked', 'meeting_attended', 'no_show', 'purchased', 'follow_up_needed', 'lost', 'archived'];
const LEAD_TEMPERATURES: LeadTemperature[] = ['cold', 'warm', 'hot', 'buyer'];
const AUDIENCE_SOURCES = ['follower', 'non_follower', 'existing_customer', 'referral'];
const CHANNEL_ATTRIBUTIONS = ['instagram', 'meta', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral', 'manual'];

const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new_lead: ['contacted', 'qualified', 'nurturing', 'lost'],
  contacted: ['meeting_booked', 'follow_up_needed', 'lost'],
  meeting_booked: ['meeting_attended', 'no_show', 'lost'],
  meeting_attended: ['purchased', 'follow_up_needed', 'lost'],
  no_show: ['follow_up_needed', 'lost'],
  purchased: ['archived'],
  lost: [],
  follow_up_needed: ['contacted', 'meeting_booked', 'lost'],
  qualified: ['meeting_booked', 'nurturing', 'lost'],
  nurturing: ['contacted', 'qualified', 'lost'],
  converted: ['archived'],
  archived: [],
};

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

function leadStatus(value: unknown): LeadStatus {
  const normalized = text(value, 'new_lead') as LeadStatus;
  return LEAD_STATUSES.includes(normalized) ? normalized : 'new_lead';
}

function leadTemp(value: unknown): LeadTemperature {
  const normalized = text(value, 'cold') as LeadTemperature;
  return LEAD_TEMPERATURES.includes(normalized) ? normalized : 'cold';
}

function leadName(lead: RecordMap | null): string {
  if (!lead) return 'No lead selected';
  return text(lead.leadName || lead.name, 'Unnamed lead');
}

function statusTone(status: LeadStatus): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (status === 'purchased' || status === 'converted') return 'good';
  if (status === 'qualified' || status === 'meeting_attended') return 'info';
  if (status === 'meeting_booked' || status === 'follow_up_needed' || status === 'no_show') return 'warn';
  if (status === 'lost') return 'danger';
  if (status === 'archived') return 'muted';
  return 'default';
}

function nextAllowedStatuses(lead: RecordMap | null): LeadStatus[] {
  if (!lead) return [];
  return LEAD_TRANSITIONS[leadStatus(lead.leadStatus || lead.status)] || [];
}

function dateInputValue(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 16);
  return date.toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
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
  const [salesLeads, setSalesLeads] = useState<RecordMap[]>([]);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadFilters, setLeadFilters] = useState({
    status: 'all',
    temperature: 'all',
    channel: 'all',
  });
  const [leadForm, setLeadForm] = useState({
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    audienceSource: 'follower',
    channelAttribution: 'instagram',
    platform: 'instagram',
    salesNotes: '',
  });
  const [leadUpdateForm, setLeadUpdateForm] = useState({
    nextAction: '',
    followUpDate: '',
    salesNotes: '',
    temperature: 'warm' as LeadTemperature,
  });
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: dateInputValue(null),
    meetingType: 'strategy_call',
    meetingOutcome: '',
  });
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseDate: dateInputValue(null),
    purchaseAmount: '',
    purchaseReference: '',
  });
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
      const [data, leadData] = await Promise.all([
        eventsApi.dashboard(nextEventId, token),
        leadsApi.list(token, { eventId: nextEventId }),
      ]);
      setDashboard(data as RecordMap);
      setSalesLeads(list(leadData));
    } else {
      setDashboard(null);
      setSalesLeads([]);
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
  const leadTemperatureBreakdown = list(dashboard?.leadTemperature);
  const nextActions = list(dashboard?.nextActions);
  const kpiRecords = list(dashboard?.kpiRecords);
  const leads = list(dashboard?.leads);
  const campaigns = list(dashboard?.campaigns);
  const daysRemaining = daysUntil(event.eventDate);
  const filteredSalesLeads = useMemo(
    () => salesLeads.filter(lead => {
      const status = leadStatus(lead.leadStatus || lead.status);
      const temperature = leadTemp(lead.leadTemperature);
      const channel = text(lead.channelAttribution || lead.platform, 'manual');
      if (leadFilters.status !== 'all' && status !== leadFilters.status) return false;
      if (leadFilters.temperature !== 'all' && temperature !== leadFilters.temperature) return false;
      if (leadFilters.channel !== 'all' && channel !== leadFilters.channel) return false;
      return true;
    }),
    [leadFilters.channel, leadFilters.status, leadFilters.temperature, salesLeads],
  );
  const selectedLead = useMemo(
    () => filteredSalesLeads.find(lead => String(lead.id) === selectedLeadId) || filteredSalesLeads[0] || salesLeads[0] || null,
    [filteredSalesLeads, salesLeads, selectedLeadId],
  );
  const selectedStatus = leadStatus(selectedLead?.leadStatus || selectedLead?.status);
  const allowedStatuses = nextAllowedStatuses(selectedLead);
  const salesCounts = useMemo((): { total: number; newLeads: number; contacted: number; meetings: number; attended: number; noShows: number; purchases: number; hot: number } => {
    return salesLeads.reduce<{ total: number; newLeads: number; contacted: number; meetings: number; attended: number; noShows: number; purchases: number; hot: number }>(
      (counts, lead) => {
        const status = leadStatus(lead.leadStatus || lead.status);
        counts.total += 1;
        if (status === 'new_lead') counts.newLeads += 1;
        if (status === 'contacted') counts.contacted += 1;
        if (status === 'meeting_booked') counts.meetings += 1;
        if (status === 'meeting_attended') counts.attended += 1;
        if (status === 'no_show') counts.noShows += 1;
        if (status === 'purchased') counts.purchases += 1;
        if (leadTemp(lead.leadTemperature) === 'hot') counts.hot += 1;
        return counts;
      },
      { total: 0, newLeads: 0, contacted: 0, meetings: 0, attended: 0, noShows: 0, purchases: 0, hot: 0 },
    );
  }, [salesLeads]);

  function selectLeadForWork(lead: RecordMap) {
    setSelectedLeadId(String(lead.id || ''));
    setLeadUpdateForm({
      nextAction: text(lead.nextAction, ''),
      followUpDate: lead.followUpDate ? dateInputValue(lead.followUpDate) : '',
      salesNotes: text(lead.salesNotes, ''),
      temperature: leadTemp(lead.leadTemperature),
    });
    setMeetingForm(current => ({
      ...current,
      meetingDate: lead.meetingDate ? dateInputValue(lead.meetingDate) : current.meetingDate,
      meetingType: text(lead.meetingType, current.meetingType),
      meetingOutcome: text(lead.meetingOutcome, current.meetingOutcome),
    }));
    setPurchaseForm(current => ({
      ...current,
      purchaseDate: lead.purchaseDate ? dateInputValue(lead.purchaseDate) : current.purchaseDate,
      purchaseAmount: lead.purchaseAmount != null ? String(numberValue(lead.purchaseAmount)) : current.purchaseAmount,
      purchaseReference: text(lead.purchaseReference, current.purchaseReference),
    }));
  }

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

  async function refreshSalesWorkflow(successMessage?: string) {
    await load(selectedEventId);
    if (successMessage) setMessage(successMessage);
  }

  async function createLead() {
    if (!token || !selectedEventId) return;
    setLoading('create-lead');
    setMessage('');
    try {
      const created = await leadsApi.create({
        eventId: selectedEventId,
        leadName: leadForm.leadName || undefined,
        leadEmail: leadForm.leadEmail || undefined,
        leadPhone: leadForm.leadPhone || undefined,
        platform: leadForm.platform || leadForm.channelAttribution,
        audienceSource: leadForm.audienceSource,
        channelAttribution: leadForm.channelAttribution,
        salesNotes: leadForm.salesNotes || undefined,
      }, token) as RecordMap;
      selectLeadForWork(created);
      setLeadForm({
        leadName: '',
        leadEmail: '',
        leadPhone: '',
        audienceSource: 'follower',
        channelAttribution: 'instagram',
        platform: 'instagram',
        salesNotes: '',
      });
      await refreshSalesWorkflow('Lead captured and linked to this event.');
    } catch (error) {
      setMessage(`Could not capture lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function updateSelectedLead() {
    if (!token || !selectedLead) return;
    setLoading('update-lead');
    setMessage('');
    try {
      await leadsApi.update(String(selectedLead.id), {
        nextAction: leadUpdateForm.nextAction || null,
        followUpDate: leadUpdateForm.followUpDate ? toIsoFromLocalInput(leadUpdateForm.followUpDate) : null,
        salesNotes: leadUpdateForm.salesNotes || null,
      }, token);
      await leadsApi.setTemperature(String(selectedLead.id), {
        temperature: leadUpdateForm.temperature,
        reason: 'Updated from event sales workflow',
      }, token);
      await refreshSalesWorkflow('Lead follow-up details updated.');
    } catch (error) {
      setMessage(`Could not update lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function transitionSelectedLead(toStatus: LeadStatus, reason: string) {
    if (!token || !selectedLead) return;
    setLoading(`transition-${toStatus}`);
    setMessage('');
    try {
      await leadsApi.transition(String(selectedLead.id), { toStatus, reason }, token);
      await refreshSalesWorkflow(`Lead moved to ${titleCase(toStatus)}.`);
    } catch (error) {
      setMessage(`Could not move lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function recordMeeting() {
    if (!token || !selectedLead) return;
    setLoading('record-meeting');
    setMessage('');
    try {
      await leadsApi.recordMeeting(String(selectedLead.id), {
        meetingDate: toIsoFromLocalInput(meetingForm.meetingDate),
        meetingType: meetingForm.meetingType,
        meetingOutcome: meetingForm.meetingOutcome || undefined,
      }, token);
      await refreshSalesWorkflow('Meeting booked for selected lead.');
    } catch (error) {
      setMessage(`Could not book meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function recordPurchase() {
    if (!token || !selectedLead) return;
    setLoading('record-purchase');
    setMessage('');
    try {
      await leadsApi.recordPurchase(String(selectedLead.id), {
        purchaseDate: toIsoFromLocalInput(purchaseForm.purchaseDate),
        purchaseAmount: Number(purchaseForm.purchaseAmount || 0),
        purchaseReference: purchaseForm.purchaseReference || undefined,
      }, token);
      await refreshSalesWorkflow('Purchase recorded for selected lead.');
    } catch (error) {
      setMessage(`Could not record purchase: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          <SecondaryAction onClick={() => navigate('/events/master')}>Portfolio Dashboard</SecondaryAction>
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
                  items={leadTemperatureBreakdown.map(item => ({
                    label: text(item.label),
                    value: numberValue(item.value),
                    tone: text(item.label).toLowerCase().includes('buyer') ? 'good' : text(item.label).toLowerCase().includes('no') ? 'warn' : 'info',
                  }))}
                />
              </ProductCard>
            </div>

            <ProductCard
              title="Sales Workflow"
              subtitle="Capture event leads, assign follow-up, and move each prospect from interest to meeting, no-show recovery, or purchase."
              action={<ProductStatus tone={salesCounts.total ? 'good' : 'warn'}>{salesCounts.total} event lead(s)</ProductStatus>}
            >
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Capture lead</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Add a lead from a form, DM, WhatsApp conversation, live event inquiry, or manual sales note.
                    </p>
                  </div>
                  <Field label="Lead name">
                    <input
                      value={leadForm.leadName}
                      onChange={event => setLeadForm(current => ({ ...current, leadName: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Example: Ahmed Al-Rashid"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={leadForm.leadEmail}
                      onChange={event => setLeadForm(current => ({ ...current, leadEmail: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="name@example.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={leadForm.leadPhone}
                      onChange={event => setLeadForm(current => ({ ...current, leadPhone: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="+966..."
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Audience">
                      <select
                        value={leadForm.audienceSource}
                        onChange={event => setLeadForm(current => ({ ...current, audienceSource: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {AUDIENCE_SOURCES.map(source => <option key={source} value={source}>{titleCase(source)}</option>)}
                      </select>
                    </Field>
                    <Field label="Channel">
                      <select
                        value={leadForm.channelAttribution}
                        onChange={event => setLeadForm(current => ({ ...current, channelAttribution: event.target.value, platform: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {CHANNEL_ATTRIBUTIONS.map(channel => <option key={channel} value={channel}>{titleCase(channel)}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Sales note">
                    <textarea
                      value={leadForm.salesNotes}
                      onChange={event => setLeadForm(current => ({ ...current, salesNotes: event.target.value }))}
                      className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="What did the lead ask for? What problem did they mention?"
                    />
                  </Field>
                  <PrimaryAction onClick={createLead} disabled={loading === 'create-lead' || !selectedEventId}>
                    {loading === 'create-lead' ? 'Capturing...' : 'Capture Lead'}
                  </PrimaryAction>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <MetricCard label="Total" value={salesCounts.total} detail="Linked to this event" tone={salesCounts.total ? 'info' : 'default'} />
                    <MetricCard label="Meetings" value={salesCounts.meetings} detail={`${salesCounts.attended} attended`} tone={salesCounts.meetings ? 'warn' : 'default'} />
                    <MetricCard label="No-shows" value={salesCounts.noShows} detail="Needs recovery" tone={salesCounts.noShows ? 'warn' : 'default'} />
                    <MetricCard label="Purchases" value={salesCounts.purchases} detail="Recorded sales" tone={salesCounts.purchases ? 'good' : 'default'} />
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Status">
                        <select
                          value={leadFilters.status}
                          onChange={event => setLeadFilters(current => ({ ...current, status: event.target.value }))}
                          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        >
                          <option value="all">All statuses</option>
                          {LEAD_STATUSES.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}
                        </select>
                      </Field>
                      <Field label="Temperature">
                        <select
                          value={leadFilters.temperature}
                          onChange={event => setLeadFilters(current => ({ ...current, temperature: event.target.value }))}
                          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        >
                          <option value="all">All temperatures</option>
                          {LEAD_TEMPERATURES.map(temp => <option key={temp} value={temp}>{titleCase(temp)}</option>)}
                        </select>
                      </Field>
                      <Field label="Channel">
                        <select
                          value={leadFilters.channel}
                          onChange={event => setLeadFilters(current => ({ ...current, channel: event.target.value }))}
                          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        >
                          <option value="all">All channels</option>
                          {CHANNEL_ATTRIBUTIONS.map(channel => <option key={channel} value={channel}>{titleCase(channel)}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>

                  {filteredSalesLeads.length ? (
                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                      <div className="max-h-[520px] overflow-y-auto divide-y divide-neutral-100 bg-white">
                        {filteredSalesLeads.map(lead => {
                          const status = leadStatus(lead.leadStatus || lead.status);
                          const active = String(lead.id) === String(selectedLead?.id || '');
                          return (
                            <button
                              key={String(lead.id)}
                              type="button"
                              onClick={() => selectLeadForWork(lead)}
                              className={`w-full p-4 text-left transition ${active ? 'bg-neutral-950 text-white' : 'bg-white hover:bg-neutral-50'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">{leadName(lead)}</div>
                                  <div className={`mt-1 text-sm ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                                    {titleCase(text(lead.channelAttribution || lead.platform, 'manual'))} / {titleCase(leadTemp(lead.leadTemperature))}
                                  </div>
                                </div>
                                <ProductStatus tone={active ? 'muted' : statusTone(status)}>{titleCase(status)}</ProductStatus>
                              </div>
                              <div className={`mt-3 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                                {text(lead.nextAction, 'No next action set')}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <EmptyProductState
                      title="No matching leads"
                      message="Capture a lead or clear the filters. Leads appear here only when they are linked to the selected event."
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-950">{leadName(selectedLead)}</div>
                        <div className="mt-1 text-sm leading-6 text-neutral-500">
                          {selectedLead
                            ? `${text(selectedLead.leadEmail, 'No email')} / ${text(selectedLead.leadPhone, 'No phone')}`
                            : 'Select or capture a lead to operate it.'}
                        </div>
                      </div>
                      {selectedLead && <ProductStatus tone={statusTone(selectedStatus)}>{titleCase(selectedStatus)}</ProductStatus>}
                    </div>
                  </div>

                  {selectedLead ? (
                    <>
                      <ProductCard title="Next sales action" subtitle="Keep the sales team aligned before CRM/WhatsApp automation is enabled.">
                        <div className="space-y-4">
                          <Field label="Lead temperature">
                            <select
                              value={leadUpdateForm.temperature}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, temperature: event.target.value as LeadTemperature }))}
                              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            >
                              {LEAD_TEMPERATURES.map(temp => <option key={temp} value={temp}>{titleCase(temp)}</option>)}
                            </select>
                          </Field>
                          <Field label="Next action">
                            <input
                              value={leadUpdateForm.nextAction}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, nextAction: event.target.value }))}
                              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              placeholder="Example: Confirm event package and book strategy call"
                            />
                          </Field>
                          <Field label="Follow-up date">
                            <input
                              type="datetime-local"
                              value={leadUpdateForm.followUpDate}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, followUpDate: event.target.value }))}
                              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            />
                          </Field>
                          <Field label="Sales notes">
                            <textarea
                              value={leadUpdateForm.salesNotes}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, salesNotes: event.target.value }))}
                              className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            />
                          </Field>
                          <PrimaryAction onClick={updateSelectedLead} disabled={loading === 'update-lead'}>
                            {loading === 'update-lead' ? 'Saving...' : 'Save Follow-up'}
                          </PrimaryAction>
                        </div>
                      </ProductCard>

                      <ProductCard title="Lifecycle actions" subtitle="Every action is recorded by the backend. External CRM, WhatsApp, and voice execution stay controlled.">
                        <div className="flex flex-wrap gap-2">
                          {allowedStatuses.includes('contacted') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('contacted', 'Contacted from event sales workflow')} disabled={loading === 'transition-contacted'}>
                              Mark Contacted
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('qualified') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('qualified', 'Qualified from event sales workflow')} disabled={loading === 'transition-qualified'}>
                              Mark Qualified
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('nurturing') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('nurturing', 'Moved to nurturing from event sales workflow')} disabled={loading === 'transition-nurturing'}>
                              Move To Nurture
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('follow_up_needed') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('follow_up_needed', 'Follow-up needed from event sales workflow')} disabled={loading === 'transition-follow_up_needed'}>
                              Follow-up Needed
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('meeting_attended') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('meeting_attended', 'Meeting attended')} disabled={loading === 'transition-meeting_attended'}>
                              Mark Attended
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('no_show') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('no_show', 'Meeting no-show')} disabled={loading === 'transition-no_show'}>
                              Mark No-show
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('lost') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('lost', 'Lost from event sales workflow')} disabled={loading === 'transition-lost'}>
                              Mark Lost
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('archived') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('archived', 'Archived after completion')} disabled={loading === 'transition-archived'}>
                              Archive
                            </SecondaryAction>
                          )}
                        </div>
                      </ProductCard>

                      {(allowedStatuses.includes('meeting_booked') || selectedStatus === 'meeting_booked') && (
                        <ProductCard title="Book meeting" subtitle="Use this after the lead has been contacted or qualified.">
                          <div className="space-y-4">
                            <Field label="Meeting date">
                              <input
                                type="datetime-local"
                                value={meetingForm.meetingDate}
                                onChange={event => setMeetingForm(current => ({ ...current, meetingDate: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Meeting type">
                              <input
                                value={meetingForm.meetingType}
                                onChange={event => setMeetingForm(current => ({ ...current, meetingType: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Meeting note">
                              <textarea
                                value={meetingForm.meetingOutcome}
                                onChange={event => setMeetingForm(current => ({ ...current, meetingOutcome: event.target.value }))}
                                className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <PrimaryAction onClick={recordMeeting} disabled={loading === 'record-meeting'}>
                              {loading === 'record-meeting' ? 'Booking...' : 'Book Meeting'}
                            </PrimaryAction>
                          </div>
                        </ProductCard>
                      )}

                      {allowedStatuses.includes('purchased') && (
                        <ProductCard title="Record purchase" subtitle="Use this after the meeting was attended and the customer purchased.">
                          <div className="space-y-4">
                            <Field label="Purchase date">
                              <input
                                type="datetime-local"
                                value={purchaseForm.purchaseDate}
                                onChange={event => setPurchaseForm(current => ({ ...current, purchaseDate: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Amount">
                              <input
                                type="number"
                                min="0"
                                value={purchaseForm.purchaseAmount}
                                onChange={event => setPurchaseForm(current => ({ ...current, purchaseAmount: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                                placeholder="0"
                              />
                            </Field>
                            <Field label="Reference">
                              <input
                                value={purchaseForm.purchaseReference}
                                onChange={event => setPurchaseForm(current => ({ ...current, purchaseReference: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                                placeholder="Invoice, GHL deal, or manual reference"
                              />
                            </Field>
                            <PrimaryAction onClick={recordPurchase} disabled={loading === 'record-purchase' || !purchaseForm.purchaseAmount}>
                              {loading === 'record-purchase' ? 'Recording...' : 'Record Purchase'}
                            </PrimaryAction>
                          </div>
                        </ProductCard>
                      )}

                      <Notice tone="info">
                        GHL, WhatsApp, and SmartLabs handoff stay preparation-only until the customer connects tenant-owned credentials and authorizes execution.
                      </Notice>
                    </>
                  ) : (
                    <EmptyProductState
                      title="Select a lead"
                      message="Capture a new lead or choose one from the list to operate the sales workflow."
                    />
                  )}
                </div>
              </div>
            </ProductCard>

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
              {(salesLeads.length || leads.length) ? (
                <ProductTable
                  columns={['Lead', 'Channel', 'Temperature', 'Status', 'Next Action', 'Email', 'Created']}
                  rows={(salesLeads.length ? salesLeads : leads).map(lead => [
                    leadName(lead),
                    titleCase(text(lead.channelAttribution || lead.platform, 'manual')),
                    titleCase(leadTemp(lead.leadTemperature)),
                    titleCase(leadStatus(lead.leadStatus || lead.status)),
                    text(lead.nextAction, 'Not set'),
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
