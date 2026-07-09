import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  Filter,
  LineChart,
} from 'lucide-react';
import { commercialExecutiveApi } from '../api';
import {
  AieroActionButton,
  AieroGhostButton,
  AieroLightPanel,
  AieroMetricCard,
  AieroPage,
  AieroPanel,
  AieroProgress,
} from '../components/AieroUX';
import { Field, Notice, ProductStatus, SecondaryAction } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';

type RecordMap = Record<string, unknown>;

const REVENUE_LINE_OPTIONS = [
  { value: '', label: 'All revenue lines' },
  { value: 'live_event', label: 'Live Events' },
  { value: 'online_course', label: 'Online Courses' },
  { value: 'book', label: 'Books' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'b2b', label: 'B2B' },
  { value: 'platinum_elite', label: 'Platinum Elite' },
  { value: 'certified_trainer_network', label: 'Certified Trainer Network' },
  { value: 'loyalty_community', label: 'Loyalty & Community' },
];

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

function object(value: unknown): RecordMap {
  return value && typeof value === 'object' ? value as RecordMap : {};
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = ''): string {
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

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown): string {
  const parsed = nullableNumber(value);
  return parsed == null ? 'Not available' : formatCurrency(parsed);
}

function percent(value: unknown): string {
  const parsed = nullableNumber(value);
  return parsed == null ? 'Not available' : `${parsed.toFixed(parsed % 1 === 0 ? 0 : 1)}%`;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function dateLabel(value: unknown): string {
  const raw = text(value);
  if (!raw) return 'Not available';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toneForConfidence(confidence: string): 'good' | 'warn' | 'muted' {
  if (confidence === 'high') return 'good';
  if (confidence === 'medium') return 'warn';
  return 'muted';
}

function toneForAlert(severity: string): 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (severity === 'critical') return 'danger';
  if (severity === 'risk') return 'warn';
  if (severity === 'watch') return 'info';
  return 'muted';
}

export default function ExecutiveDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ revenueLineType: '', channel: '', startDate: '', endDate: '' });
  const [reportDraft, setReportDraft] = useState({
    cadence: 'weekly',
    title: 'Weekly commercial executive report',
    recipients: '',
    deliveryChannel: 'dashboard',
  });
  const [saving, setSaving] = useState(false);

  const metrics = object(dashboard?.metrics);
  const connectorReadiness = object(dashboard?.connectorReadiness);
  const disciplineSummary = object(dashboard?.disciplineSummary);
  const reports = object(dashboard?.reports);
  const alerts = list(dashboard?.alerts);
  const missingSources = Array.isArray(dashboard?.missingSources) ? dashboard?.missingSources as string[] : [];
  const revenueLines = list(dashboard?.revenueLines);
  const channels = list(dashboard?.channelPerformance);
  const freshness = list(dashboard?.dataFreshness);
  const recentReports = list(reports.recent);
  const schedules = list(reports.activeSchedules);
  const readinessScore = useMemo(() => {
    const pieces = [
      numberValue(metrics.plannedRevenueTarget) > 0,
      numberValue(metrics.knownSpend) > 0 || channels.length > 0,
      numberValue(metrics.leads) > 0,
      numberValue(metrics.purchases) > 0,
      numberValue(connectorReadiness.synced) > 0 || numberValue(connectorReadiness.readyForSync) > 0,
    ];
    return pieces.filter(Boolean).length * 20;
  }, [channels.length, connectorReadiness.readyForSync, connectorReadiness.synced, metrics.knownSpend, metrics.leads, metrics.plannedRevenueTarget, metrics.purchases]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    const query: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) query[key] = value.trim();
    });
    const data = await commercialExecutiveApi.dashboard(token, query) as RecordMap;
    setDashboard(data);
    setLoading(false);
  }, [filters, token]);

  useEffect(() => {
    if (!token) return;
    const loadTimer = window.setTimeout(() => {
      load().catch(err => {
        setMessage(err instanceof Error ? err.message : 'Could not load executive dashboard.');
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load, token]);

  async function generatePreview() {
    if (!token) return;
    setSaving(true);
    setMessage('');
    const payload: Record<string, unknown> = {
      cadence: reportDraft.cadence,
      title: reportDraft.title,
      revenueLineType: filters.revenueLineType || undefined,
      channel: filters.channel || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    };
    try {
      await commercialExecutiveApi.createReportPreview(payload, token);
      await load();
      setMessage('Report preview created. No email or WhatsApp message was sent.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not create report preview.');
    } finally {
      setSaving(false);
    }
  }

  async function createSchedule() {
    if (!token) return;
    setSaving(true);
    setMessage('');
    const recipients = reportDraft.recipients
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean);
    try {
      await commercialExecutiveApi.createSchedule({
        cadence: reportDraft.cadence,
        recipients,
        deliveryChannels: [reportDraft.deliveryChannel],
        approvalRequired: true,
      }, token);
      await load();
      setMessage('Report schedule saved for dashboard preview. Sending still requires customer approval and configured delivery credentials.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save report schedule.');
    } finally {
      setSaving(false);
    }
  }

  function stitchiPrompt(): string {
    return 'Summarize the CEO commercial dashboard, explain the biggest revenue risks, and propose safe internal next actions. Do not call external systems.';
  }

  return (
    <AieroPage
      eyebrow="Executive Analytics"
      title="CEO commercial dashboard and report center"
      subtitle="Read revenue targets, spend, leads, purchases, data freshness, and commercial blockers from real Tanaghum records and customer-owned imports."
      action={(
        <>
          <AieroGhostButton onClick={() => navigate(`/stitchi?prompt=${encodeURIComponent(stitchiPrompt())}&mode=prepare`)}>
            Ask Stitchi
          </AieroGhostButton>
          <AieroActionButton onClick={() => load()}>Refresh</AieroActionButton>
        </>
      )}
    >
      {message && (
        <Notice tone={message.toLowerCase().includes('could not') ? 'warn' : 'info'}>
          {message}
        </Notice>
      )}

      <AieroLightPanel title="Executive filters" subtitle="Use these filters before generating a report preview. Empty filters show the whole commercial workspace.">
        <div className="grid gap-4 lg:grid-cols-5">
          <Field label="Revenue line">
            <select
              value={filters.revenueLineType}
              onChange={event => setFilters(current => ({ ...current, revenueLineType: event.target.value }))}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
            >
              {REVENUE_LINE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Channel">
            <input
              value={filters.channel}
              onChange={event => setFilters(current => ({ ...current, channel: event.target.value }))}
              placeholder="meta, whatsapp, email..."
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
            />
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={filters.startDate}
              onChange={event => setFilters(current => ({ ...current, startDate: event.target.value }))}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={filters.endDate}
              onChange={event => setFilters(current => ({ ...current, endDate: event.target.value }))}
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
            />
          </Field>
          <div className="flex items-end">
            <AieroActionButton onClick={load} disabled={loading}>
              {loading ? 'Loading...' : 'Apply filters'}
            </AieroActionButton>
          </div>
        </div>
      </AieroLightPanel>

      <div className="grid gap-4 lg:grid-cols-4">
        <AieroMetricCard label="Revenue target" value={loading ? '-' : formatMoney(metrics.plannedRevenueTarget)} detail={`Known revenue: ${formatMoney(metrics.knownRevenue)}`} accent="teal" />
        <AieroMetricCard label="Budget vs spend" value={loading ? '-' : formatMoney(metrics.knownSpend)} detail={`Budget: ${formatMoney(metrics.plannedBudget)}`} accent="amber" />
        <AieroMetricCard label="Leads to purchases" value={loading ? '-' : `${numberValue(metrics.leads)} -> ${numberValue(metrics.purchases)}`} detail={`${percent(metrics.leadToPurchaseRate)} purchase rate`} accent="violet" />
        <AieroMetricCard label="Meetings" value={loading ? '-' : `${numberValue(metrics.meetingsAttended)} / ${numberValue(metrics.meetingsBooked)}`} detail={`${percent(metrics.meetingShowRate)} show rate`} accent="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <AieroPanel
          title="Executive confidence"
          subtitle="Confidence rises when connector/imported KPI data, CRM leads, and sync evidence are present."
          action={<ProductStatus tone={toneForConfidence(text(dashboard?.confidence, 'low'))}>{titleCase(text(dashboard?.confidence, 'low'))}</ProductStatus>}
        >
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white/58">Reporting readiness</div>
                <div className="mt-2 text-5xl font-semibold tracking-tight text-white">{readinessScore}%</div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#080813]">
                <LineChart className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-5">
              <AieroProgress value={readinessScore} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DarkFact label="Synced connectors" value={numberValue(connectorReadiness.synced).toString()} />
              <DarkFact label="Ready connectors" value={numberValue(connectorReadiness.readyForSync).toString()} />
              <DarkFact label="Blocked work" value={numberValue(disciplineSummary.blocked).toString()} />
              <DarkFact label="Critical work" value={numberValue(disciplineSummary.critical).toString()} />
            </div>
          </div>
        </AieroPanel>

        <AieroLightPanel
          title="Executive alerts"
          subtitle="Only rule-based alerts from current Tanaghum data are shown here."
          action={<ProductStatus tone={alerts.length ? 'warn' : 'good'}>{alerts.length} alert(s)</ProductStatus>}
        >
          {alerts.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {alerts.map(alert => (
                <div key={`${text(alert.code)}-${text(alert.title)}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold text-neutral-950">{text(alert.title, 'Executive alert')}</h3>
                        <ProductStatus tone={toneForAlert(text(alert.severity))}>{titleCase(text(alert.severity, 'watch'))}</ProductStatus>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-neutral-500">{text(alert.detail)}</p>
                      <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-neutral-600">{text(alert.recommendedAction)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
              <div className="font-semibold">No active executive alerts</div>
              <p className="mt-2 text-sm text-neutral-500">When spend, conversion, no-shows, connectors, or department work need attention, alerts will appear here.</p>
            </div>
          )}
        </AieroLightPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AieroLightPanel title="Revenue line performance" subtitle="Target, spend, revenue, leads and purchases by business line.">
          <div className="overflow-hidden rounded-2xl border border-neutral-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Revenue line</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Spend</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Purchases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {revenueLines.length ? revenueLines.map(line => (
                  <tr key={text(line.type)} className="bg-white">
                    <td className="px-4 py-3 font-semibold text-neutral-950">{text(line.name, titleCase(text(line.type)))}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatMoney(line.plannedRevenueTarget)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatMoney(line.knownRevenue)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatMoney(line.knownSpend)}</td>
                    <td className="px-4 py-3 text-neutral-600">{numberValue(line.leads)}</td>
                    <td className="px-4 py-3 text-neutral-600">{numberValue(line.purchases)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-neutral-500" colSpan={6}>No revenue line data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AieroLightPanel>

        <AieroLightPanel title="Data freshness" subtitle="Shows whether executive reporting is current, stale, or missing.">
          <div className="space-y-3">
            {freshness.map(item => (
              <div key={text(item.source)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-neutral-950">{text(item.source)}</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">{text(item.detail)}</p>
                  </div>
                  <ProductStatus tone={text(item.status) === 'current' ? 'good' : text(item.status) === 'stale' ? 'warn' : 'muted'}>
                    {titleCase(text(item.status))}
                  </ProductStatus>
                </div>
                <div className="mt-3 text-xs text-neutral-500">Last seen: {dateLabel(item.lastSeenAt)}</div>
              </div>
            ))}
          </div>
        </AieroLightPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AieroLightPanel title="Channel efficiency" subtitle="Spend, reach, leads, purchases, CPL and CPP by channel.">
          <div className="space-y-3">
            {channels.length ? channels.map(channel => (
              <div key={text(channel.channel)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-950">{titleCase(text(channel.channel, 'manual'))}</div>
                    <div className="mt-1 text-sm text-neutral-500">Reach {numberValue(channel.reach)} - Leads {numberValue(channel.leads)} - Purchases {numberValue(channel.purchases)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-neutral-950">{formatMoney(channel.spend)}</div>
                    <div className="mt-1 text-xs text-neutral-500">CPL {formatMoney(channel.costPerLead)}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-neutral-500">
                Connect analytics or import KPI data to see channel efficiency.
              </div>
            )}
          </div>
        </AieroLightPanel>

        <AieroLightPanel
          title="Scheduled reports"
          subtitle="Create report previews and save schedules. Delivery remains approval-gated until customer policy and credentials are ready."
          action={<ProductStatus tone="info">{schedules.length} active</ProductStatus>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Report cadence">
              <select
                value={reportDraft.cadence}
                onChange={event => setReportDraft(current => ({ ...current, cadence: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                {CADENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Delivery mode">
              <select
                value={reportDraft.deliveryChannel}
                onChange={event => setReportDraft(current => ({ ...current, deliveryChannel: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="dashboard">Dashboard preview</option>
                <option value="email">Email after approval</option>
                <option value="whatsapp">WhatsApp after approval</option>
              </select>
            </Field>
            <Field label="Report title">
              <input
                value={reportDraft.title}
                onChange={event => setReportDraft(current => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Recipients">
              <textarea
                value={reportDraft.recipients}
                onChange={event => setReportDraft(current => ({ ...current, recipients: event.target.value }))}
                placeholder="name@example.com, manager@example.com"
                rows={3}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <AieroActionButton onClick={generatePreview} disabled={saving}>Generate preview</AieroActionButton>
            <SecondaryAction onClick={createSchedule} disabled={saving}>Save schedule</SecondaryAction>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ReportList title="Recent previews" items={recentReports} empty="No report previews yet." />
            <ScheduleList items={schedules} />
          </div>
        </AieroLightPanel>
      </div>

      {missingSources.length > 0 && (
        <AieroPanel title="Missing data checklist" subtitle="These are not bugs. They are customer-owned data, credential, or configuration gaps that affect report confidence.">
          <div className="grid gap-3 lg:grid-cols-2">
            {missingSources.map(item => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-6 text-white/62">
                <Filter className="mb-3 h-5 w-5 text-white" />
                {item}
              </div>
            ))}
          </div>
        </AieroPanel>
      )}
    </AieroPage>
  );
}

function DarkFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function ReportList({ title, items, empty }: { title: string; items: RecordMap[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-neutral-950">
        <FileText className="h-4 w-4" />
        {title}
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.slice(0, 4).map(item => (
            <div key={text(item.id)} className="rounded-xl bg-white p-3">
              <div className="font-semibold text-neutral-950">{text(item.title, 'Report preview')}</div>
              <div className="mt-1 text-xs text-neutral-500">{titleCase(text(item.cadence))} - {titleCase(text(item.status))} - {dateLabel(item.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">{empty}</div>
      )}
    </div>
  );
}

function ScheduleList({ items }: { items: RecordMap[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-neutral-950">
        <CalendarClock className="h-4 w-4" />
        Active schedules
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.slice(0, 4).map(item => (
            <div key={text(item.id)} className="rounded-xl bg-white p-3">
              <div className="font-semibold text-neutral-950">{titleCase(text(item.cadence))}</div>
              <div className="mt-1 text-xs text-neutral-500">
                {Array.isArray(item.deliveryChannels) ? (item.deliveryChannels as string[]).join(', ') : 'dashboard'} - approval required
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          No schedule yet. Save a schedule after confirming recipients with the customer.
        </div>
      )}
    </div>
  );
}
