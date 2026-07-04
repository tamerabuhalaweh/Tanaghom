import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api';
import {
  DetailGrid,
  Field,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';

type EventType = 'tagyeer_wa_irtaqi' | 'moaaskar_al_tamayoz' | 'business_camp' | 'virtual_event';

type EventForm = {
  name: string;
  eventType: EventType;
  eventDate: string;
  location: string;
  campaignStartDate: string;
  campaignEndDate: string;
  expectedAttendance: string;
  revenueTarget: string;
  plannedBudget: string;
  offer: string;
  audience: string;
  geography: string;
  fomoAngle: string;
  upsellPlan: string;
  selectedChannels: string[];
  contentDepartmentRequirements: string;
  salesTeamRequirements: string;
};

const EVENT_TYPES: Array<{ id: EventType; label: string; detail: string }> = [
  {
    id: 'tagyeer_wa_irtaqi',
    label: 'Tagyeer wa Irtaqi',
    detail: 'Two-day live stage course with strong transformation, reminders, and sales follow-up.',
  },
  {
    id: 'moaaskar_al_tamayoz',
    label: 'Moaaskar Al Tamayoz',
    detail: 'Seven-day camp journey with location pressure, commitment, and premium positioning.',
  },
  {
    id: 'business_camp',
    label: 'Business Camp',
    detail: 'Business audience offer with authority, case studies, and consultation-driven sales.',
  },
  {
    id: 'virtual_event',
    label: 'Virtual Event',
    detail: 'Online event, commonly Ramadan-focused, with wider reach and nurture sequences.',
  },
];

const CHANNELS = [
  'instagram',
  'meta_ads',
  'youtube',
  'email',
  'whatsapp',
  'dark_ads',
  'ghl',
  'smartlabs_voice',
];

const TEMPLATE_BY_TYPE: Record<EventType, Partial<EventForm>> = {
  tagyeer_wa_irtaqi: {
    name: 'Tagyeer wa Irtaqi - New Event',
    offer: 'Two-day live transformation course with limited seats and clear next-step registration.',
    audience: 'Followers and warm prospects interested in personal development, discipline, and life coaching.',
    fomoAngle: 'Limited seats, live experience, date-based urgency, and social proof from previous attendees.',
    upsellPlan: 'Upsell existing customers through email and WhatsApp reminders before public campaign pressure rises.',
    selectedChannels: ['instagram', 'meta_ads', 'email', 'whatsapp', 'ghl'],
    contentDepartmentRequirements: 'Awareness reels, proof-led testimonials, registration reminder posts, stories, and landing page assets.',
    salesTeamRequirements: 'Respond to WhatsApp inquiries, qualify interested leads, book calls, recover no-shows, and update lead status.',
  },
  moaaskar_al_tamayoz: {
    name: 'Moaaskar Al Tamayoz - New Camp',
    offer: 'Seven-day premium camp with location-specific positioning and commitment-based enrollment.',
    audience: 'High-intent followers who want immersive development and can commit to the camp location and schedule.',
    fomoAngle: 'Limited camp capacity, location exclusivity, previous camp results, and closing registration window.',
    upsellPlan: 'Segment existing attendees and warm leads for VIP follow-up and early access registration.',
    selectedChannels: ['instagram', 'meta_ads', 'youtube', 'email', 'whatsapp', 'ghl'],
    contentDepartmentRequirements: 'Camp announcement, venue/location content, testimonial clips, long-form video, and daily countdown stories.',
    salesTeamRequirements: 'Qualify serious buyers, explain camp logistics, handle objections, and confirm payment readiness.',
  },
  business_camp: {
    name: 'Business Camp - New Cohort',
    offer: 'Business-focused camp for owners and professionals who need stronger execution and growth systems.',
    audience: 'Business owners, executives, and growth-minded professionals with budget and urgency.',
    fomoAngle: 'Selective cohort, business results, limited consultation slots, and practical implementation value.',
    upsellPlan: 'Use CRM tags for business owners, warm leads, and previous buyers, then drive consultation booking.',
    selectedChannels: ['linkedin', 'instagram', 'meta_ads', 'email', 'ghl', 'smartlabs_voice'],
    contentDepartmentRequirements: 'Authority posts, business case studies, lead magnet, consultation CTA, and objection-handling content.',
    salesTeamRequirements: 'Book discovery calls, qualify business fit, track close probability, and follow up on no-shows.',
  },
  virtual_event: {
    name: 'Virtual Event - New Campaign',
    offer: 'Online event with accessible registration and automated reminders.',
    audience: 'Followers, non-followers, and warm database segments who can attend remotely.',
    fomoAngle: 'Date-based urgency, limited replay access, seasonal timing, and topic relevance.',
    upsellPlan: 'Nurture registered leads through email, WhatsApp, and SmartLabs follow-up after the event.',
    selectedChannels: ['instagram', 'youtube', 'email', 'whatsapp', 'ghl'],
    contentDepartmentRequirements: 'Announcement posts, reminder stories, short video hooks, email copy, and registration page copy.',
    salesTeamRequirements: 'Track registrations, answer questions, confirm attendance, and follow up after the live session.',
  },
};

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoFromDate(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00Z`).toISOString();
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function textOrUndefined(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function initialForm(): EventForm {
  return {
    name: 'Tagyeer wa Irtaqi - New Event',
    eventType: 'tagyeer_wa_irtaqi',
    eventDate: todayPlus(30),
    location: 'To be confirmed',
    campaignStartDate: '',
    campaignEndDate: '',
    expectedAttendance: '200',
    revenueTarget: '120000',
    plannedBudget: '35000',
    offer: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.offer || '',
    audience: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.audience || '',
    geography: 'GCC and Jordan',
    fomoAngle: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.fomoAngle || '',
    upsellPlan: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.upsellPlan || '',
    selectedChannels: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.selectedChannels || [],
    contentDepartmentRequirements: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.contentDepartmentRequirements || '',
    salesTeamRequirements: TEMPLATE_BY_TYPE.tagyeer_wa_irtaqi.salesTeamRequirements || '',
  };
}

function countCompletedSections(form: EventForm): number {
  const checks = [
    form.name && form.eventDate && form.eventType,
    form.offer && form.audience && form.geography,
    form.selectedChannels.length > 0,
    form.contentDepartmentRequirements,
    form.salesTeamRequirements,
    form.plannedBudget || form.revenueTarget,
  ];
  return checks.filter(Boolean).length;
}

export default function EventStrategyWizard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<EventForm>(initialForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const completedSections = countCompletedSections(form);
  const readiness = Math.round((completedSections / 6) * 100);

  const summary = useMemo(
    () => [
      { label: 'Campaign Timing', value: form.campaignStartDate ? `${form.campaignStartDate} to ${form.eventDate}` : `Auto-starts 30 days before ${form.eventDate}` },
      { label: 'Target Audience', value: form.audience || 'Not set' },
      { label: 'Channels', value: form.selectedChannels.length ? form.selectedChannels.map(titleCase).join(', ') : 'Not set' },
      { label: 'Budget', value: form.plannedBudget ? formatCurrency(form.plannedBudget) : 'Not set' },
      { label: 'Revenue Target', value: form.revenueTarget ? formatCurrency(form.revenueTarget) : 'Not set' },
      { label: 'FOMO Angle', value: form.fomoAngle || 'Not set' },
    ],
    [form],
  );

  function update<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function applyTemplate(eventType: EventType) {
    const template = TEMPLATE_BY_TYPE[eventType];
    setForm(current => ({
      ...current,
      ...template,
      eventType,
      selectedChannels: template.selectedChannels || current.selectedChannels,
    }));
  }

  function toggleChannel(channel: string) {
    setForm(current => ({
      ...current,
      selectedChannels: current.selectedChannels.includes(channel)
        ? current.selectedChannels.filter(item => item !== channel)
        : [...current.selectedChannels, channel],
    }));
  }

  async function saveEvent() {
    if (!token) return;
    setMessage('');
    if (!form.name.trim() || !form.eventDate) {
      setMessage('Event name and event date are required before saving.');
      return;
    }
    if (form.selectedChannels.length === 0) {
      setMessage('Choose at least one channel so the team knows where this event will be marketed.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        eventType: form.eventType,
        eventDate: isoFromDate(form.eventDate),
        campaignStartDate: isoFromDate(form.campaignStartDate),
        campaignEndDate: isoFromDate(form.campaignEndDate),
        location: textOrUndefined(form.location),
        expectedAttendance: numberOrUndefined(form.expectedAttendance),
        revenueTarget: numberOrUndefined(form.revenueTarget),
        plannedBudget: numberOrUndefined(form.plannedBudget),
        offer: textOrUndefined(form.offer),
        audience: textOrUndefined(form.audience),
        geography: textOrUndefined(form.geography),
        fomoAngle: textOrUndefined(form.fomoAngle),
        upsellPlan: textOrUndefined(form.upsellPlan),
        selectedChannels: form.selectedChannels,
        contentDepartmentRequirements: textOrUndefined(form.contentDepartmentRequirements),
        salesTeamRequirements: textOrUndefined(form.salesTeamRequirements),
      };

      const created = await eventsApi.create(payload, token) as { id?: string };
      if (!created.id) throw new Error('Event was created but no event ID was returned.');
      navigate(`/events/${created.id}`);
    } catch (error) {
      setMessage(`Could not create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductPage
      eyebrow="Event Strategy"
      title="Create Event Strategy"
      subtitle="Turn an event plan into a trackable operating workspace for content, sales, budget, leads, meetings, purchases, and learning."
      action={<ProductStatus tone={readiness >= 80 ? 'good' : 'warn'}>{readiness}% ready</ProductStatus>}
    >
      {message && <Notice tone={message.startsWith('Could not') || message.includes('required') || message.includes('Choose') ? 'warn' : 'info'}>{message}</Notice>}

      <WorkflowRail
        steps={[
          { label: 'Event', state: form.name && form.eventDate ? 'done' : 'active' },
          { label: 'Offer', state: form.offer && form.audience ? 'done' : 'active' },
          { label: 'Channels', state: form.selectedChannels.length ? 'done' : 'waiting' },
          { label: 'Content', state: form.contentDepartmentRequirements ? 'done' : 'waiting' },
          { label: 'Sales', state: form.salesTeamRequirements ? 'done' : 'waiting' },
          { label: 'Dashboard', state: 'waiting' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <ProductCard title="1. Event Type" subtitle="Start from the real event model the customer sells. Templates only prefill the form; the saved event is real workspace data.">
            <div className="grid gap-3 md:grid-cols-2">
              {EVENT_TYPES.map(item => {
                const active = form.eventType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyTemplate(item.id)}
                    className={`rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                  >
                    <div className="font-semibold">{item.label}</div>
                    <div className={`mt-2 text-sm leading-6 ${active ? 'text-white/65' : 'text-neutral-500'}`}>{item.detail}</div>
                  </button>
                );
              })}
            </div>
          </ProductCard>

          <ProductCard title="2. Event Basics" subtitle="Define the date, location, budget, and sales target before content work starts.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Event Name">
                <input className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.name} onChange={event => update('name', event.target.value)} />
              </Field>
              <Field label="Event Date">
                <input type="date" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.eventDate} onChange={event => update('eventDate', event.target.value)} />
              </Field>
              <Field label="Location">
                <input className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.location} onChange={event => update('location', event.target.value)} />
              </Field>
              <Field label="Expected Attendance">
                <input type="number" min="0" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.expectedAttendance} onChange={event => update('expectedAttendance', event.target.value)} />
              </Field>
              <Field label="Revenue Target">
                <input type="number" min="0" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.revenueTarget} onChange={event => update('revenueTarget', event.target.value)} />
              </Field>
              <Field label="Planned Budget">
                <input type="number" min="0" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.plannedBudget} onChange={event => update('plannedBudget', event.target.value)} />
              </Field>
              <Field label="Campaign Start" helper="Leave empty to auto-start 30 days before the event.">
                <input type="date" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.campaignStartDate} onChange={event => update('campaignStartDate', event.target.value)} />
              </Field>
              <Field label="Campaign End">
                <input type="date" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.campaignEndDate} onChange={event => update('campaignEndDate', event.target.value)} />
              </Field>
            </div>
          </ProductCard>

          <ProductCard title="3. Offer, Audience, and FOMO" subtitle="This is the marketing strategy your team builds before content and sales execution.">
            <div className="grid gap-4">
              <Field label="Offer">
                <textarea className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.offer} onChange={event => update('offer', event.target.value)} />
              </Field>
              <Field label="Audience">
                <textarea className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.audience} onChange={event => update('audience', event.target.value)} />
              </Field>
              <Field label="Geography">
                <input className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.geography} onChange={event => update('geography', event.target.value)} />
              </Field>
              <Field label="FOMO Angle">
                <textarea className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.fomoAngle} onChange={event => update('fomoAngle', event.target.value)} />
              </Field>
              <Field label="Upsell Plan">
                <textarea className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.upsellPlan} onChange={event => update('upsellPlan', event.target.value)} />
              </Field>
            </div>
          </ProductCard>

          <ProductCard title="4. Channels and Team Requirements" subtitle="Tell content and sales exactly what must be prepared for this event.">
            <div className="space-y-5">
              <Field label="Channels">
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map(channel => {
                    const active = form.selectedChannels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => toggleChannel(channel)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
                      >
                        {titleCase(channel)}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Content Department Requirements">
                <textarea className="min-h-28 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.contentDepartmentRequirements} onChange={event => update('contentDepartmentRequirements', event.target.value)} />
              </Field>
              <Field label="Sales Team Requirements">
                <textarea className="min-h-28 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm" value={form.salesTeamRequirements} onChange={event => update('salesTeamRequirements', event.target.value)} />
              </Field>
            </div>
          </ProductCard>
        </div>

        <div className="space-y-6">
          <ProductCard title="Strategy Summary" subtitle="Review before creating the event workspace.">
            <DetailGrid items={summary} />
          </ProductCard>

          <ProductCard title="What Happens After Saving" subtitle="No external messages or ads are sent by this action.">
            <div className="space-y-3 text-sm leading-6 text-neutral-600">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                A real event record is created and tenant-scoped to this workspace.
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
                Your team can track event KPIs, leads, meetings, purchases, no-shows, and budget from the Events dashboard.
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                Connectors for Meta, YouTube, Formaloo, GHL, WhatsApp, and SmartLabs still require customer-owned credentials before automatic ingestion.
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <PrimaryAction onClick={saveEvent} disabled={saving}>
                {saving ? 'Creating Event...' : 'Create Event Workspace'}
              </PrimaryAction>
              <SecondaryAction onClick={() => navigate('/events')} disabled={saving}>
                Back to Events
              </SecondaryAction>
            </div>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
