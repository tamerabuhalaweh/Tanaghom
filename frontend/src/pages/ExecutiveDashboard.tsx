import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileText,
  Filter,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { commercialExecutiveApi } from '../api';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { Field } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';
import './CommercialR1D.css';

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

const REPORT_SECTIONS = [
  { value: 'executive_summary', label: 'Executive summary' },
  { value: 'revenue_lines', label: 'Revenue lines' },
  { value: 'channel_performance', label: 'Channel performance' },
  { value: 'lead_funnel', label: 'Lead funnel' },
  { value: 'data_freshness', label: 'Data freshness' },
  { value: 'connector_readiness', label: 'Connector readiness' },
  { value: 'department_work', label: 'Department work' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'missing_data', label: 'Missing data' },
];

const DELIVERY_CHANNELS = [
  { value: 'email', label: 'Email report' },
  { value: 'whatsapp', label: 'WhatsApp notification' },
  { value: 'dashboard', label: 'Dashboard preview' },
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

function confidenceTone(confidence: string): 'neutral' | 'positive' | 'warning' {
  if (confidence === 'high') return 'positive';
  if (confidence === 'medium') return 'warning';
  return 'neutral';
}

function alertTone(severity: string): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  if (severity === 'critical') return 'danger';
  if (severity === 'risk') return 'warning';
  if (severity === 'watch') return 'info';
  return 'neutral';
}

export default function ExecutiveDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ revenueLineType: '', channel: '', startDate: '', endDate: '' });
  const [reportDraft, setReportDraft] = useState({
    cadence: 'daily',
    title: 'Daily 9 AM commercial executive report',
    recipients: '',
    deliveryChannels: ['email', 'whatsapp'],
    reportLanguage: 'English',
    reportSections: REPORT_SECTIONS.map(section => section.value),
    workingDaysOnly: true,
    sendHour: '9',
    sendMinute: '0',
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
  const workflow = object(reports.workflow);
  const deliveryReadiness = list(workflow.deliveryReadiness);
  const readinessSignals = [
    numberValue(metrics.plannedRevenueTarget) > 0,
    numberValue(metrics.knownSpend) > 0 || channels.length > 0,
    numberValue(metrics.leads) > 0,
    numberValue(metrics.purchases) > 0,
    numberValue(connectorReadiness.synced) > 0,
  ];
  const confidence = text(dashboard?.confidence, 'low');
  const confidenceCap = confidence === 'high' ? 100 : confidence === 'medium' ? 80 : 60;
  const missingDataPenalty = Math.min(40, missingSources.length * 10);
  const readinessScore = Math.max(0, Math.min(confidenceCap, readinessSignals.filter(Boolean).length * 20 - missingDataPenalty));

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
    const recipients = reportDraft.recipients.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
    try {
      await commercialExecutiveApi.createSchedule({
        cadence: reportDraft.cadence,
        recipients,
        recipientRoles: ['admin', 'cco'],
        deliveryChannels: reportDraft.deliveryChannels,
        reportLanguage: reportDraft.reportLanguage,
        reportSections: reportDraft.reportSections,
        workingDaysOnly: reportDraft.workingDaysOnly,
        sendHour: Number(reportDraft.sendHour || 9),
        sendMinute: Number(reportDraft.sendMinute || 0),
        approvalRequired: false,
      }, token);
      await load();
      setMessage('Executive report workflow saved. Email and WhatsApp delivery remain unavailable until those channels are configured.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save report schedule.');
    } finally {
      setSaving(false);
    }
  }

  function stitchiPrompt(): string {
    return 'Summarize the executive commercial dashboard, explain the biggest revenue risks, and propose safe internal next actions. Do not call external systems.';
  }

  function toggleDeliveryChannel(channel: string) {
    setReportDraft(current => {
      const exists = current.deliveryChannels.includes(channel);
      const deliveryChannels = exists ? current.deliveryChannels.filter(item => item !== channel) : [...current.deliveryChannels, channel];
      return { ...current, deliveryChannels: deliveryChannels.length ? deliveryChannels : ['dashboard'] };
    });
  }

  function toggleReportSection(section: string) {
    setReportDraft(current => {
      const exists = current.reportSections.includes(section);
      const reportSections = exists ? current.reportSections.filter(item => item !== section) : [...current.reportSections, section];
      return { ...current, reportSections: reportSections.length ? reportSections : ['executive_summary'] };
    });
  }

  return (
    <OpsPage className="commercial-r1d-page executive-r1d-page">
      <OpsPageHeader
        eyebrow="Executive view"
        title="Executive Dashboard"
        subtitle="Commercial performance, decisions, and reporting for authorized leadership."
        actions={(
          <>
            <a className="ops-button is-secondary" href="#executive-report-workflow"><FileText size={17} aria-hidden="true" />Reports</a>
            <button className="ops-button is-primary" type="button" onClick={() => navigate(`/stitchi?prompt=${encodeURIComponent(stitchiPrompt())}&mode=prepare`)}><Sparkles size={17} aria-hidden="true" />Ask Stitchi</button>
          </>
        )}
      />

      {message ? <OpsNotice tone={message.toLowerCase().includes('could not') ? 'danger' : 'info'}>{message}</OpsNotice> : null}

      <nav className="executive-subnav" aria-label="Executive dashboard sections">
        <a className="is-active" href="#executive-performance">Commercial performance</a>
        <a href="#executive-decisions">Decisions</a>
        <a href="#executive-report-workflow">Executive reports</a>
        <a href="#executive-data-readiness">Data readiness</a>
      </nav>

      <details className="executive-filter-panel">
        <summary><Filter size={17} aria-hidden="true" /><span><strong>Filter executive results</strong><small>Revenue line, channel, and date range</small></span></summary>
        <div className="executive-filter-grid">
          <Field label="Revenue line"><select value={filters.revenueLineType} onChange={event => setFilters(current => ({ ...current, revenueLineType: event.target.value }))}>{REVENUE_LINE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="Channel"><input value={filters.channel} onChange={event => setFilters(current => ({ ...current, channel: event.target.value }))} placeholder="Meta, WhatsApp, email..." /></Field>
          <Field label="Start date"><input type="date" value={filters.startDate} onChange={event => setFilters(current => ({ ...current, startDate: event.target.value }))} /></Field>
          <Field label="End date"><input type="date" value={filters.endDate} onChange={event => setFilters(current => ({ ...current, endDate: event.target.value }))} /></Field>
          <button className="ops-button is-primary" type="button" onClick={load} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? 'Loading...' : 'Apply filters'}</button>
        </div>
      </details>

      {loading ? (
        <div className="commercial-r1d-loading"><OpsSkeleton rows={5} /><OpsSkeleton rows={5} /></div>
      ) : (
        <>
          <section className="executive-metrics" id="executive-performance" aria-label="Executive commercial summary">
            <ExecutiveMetric label="Known revenue" value={formatMoney(metrics.knownRevenue)} detail="Verified internal records" tone="positive" />
            <ExecutiveMetric label="Revenue target" value={formatMoney(metrics.plannedRevenueTarget)} detail="Across active products" />
            <ExecutiveMetric label="Qualified leads" value={String(numberValue(metrics.leads))} detail={`${numberValue(metrics.purchases)} recorded purchases`} />
            <ExecutiveMetric label="Data confidence" value={`${readinessScore}%`} detail={`${numberValue(connectorReadiness.readyForSync)} connectors ready for sync`} tone="warning" />
          </section>

          <div className="executive-overview">
            <OpsSection title="Revenue by active product" subtitle="Targets and known outcomes. Missing connector data is never estimated." className="executive-revenue-section">
              {revenueLines.length ? (
                <div className="executive-revenue-table" role="table" aria-label="Revenue by active product">
                  <div className="executive-revenue-head" role="row"><span>Product</span><span>Target</span><span>Known revenue</span><span>Spend</span><span>Results</span></div>
                  {revenueLines.map(line => {
                    const target = numberValue(line.plannedRevenueTarget);
                    const known = numberValue(line.knownRevenue);
                    const progress = target > 0 ? Math.min(100, Math.round((known / target) * 100)) : 0;
                    return (
                      <div className="executive-revenue-row" role="row" key={text(line.type)}>
                        <div><strong>{text(line.name, titleCase(text(line.type)))}</strong><small>{numberValue(line.leads)} leads / {numberValue(line.purchases)} purchases</small></div>
                        <span>{formatMoney(line.plannedRevenueTarget)}</span>
                        <span>{formatMoney(line.knownRevenue)}</span>
                        <span>{formatMoney(line.knownSpend)}</span>
                        <div><strong>{progress}%</strong><span><i style={{ width: `${progress}%` }} /></span></div>
                      </div>
                    );
                  })}
                </div>
              ) : <OpsEmpty title="No revenue data yet" message="Configure an active revenue line and add verified internal or connector records to populate this view." />}
            </OpsSection>

            <OpsSection title="Decisions required" subtitle="Only items needing executive attention." action={<OpsStatus tone={alerts.length ? 'warning' : 'positive'}>{alerts.length}</OpsStatus>} className="executive-decisions" >
              <div id="executive-decisions">
                {alerts.length ? alerts.slice(0, 5).map(alert => (
                  <article key={`${text(alert.code)}-${text(alert.title)}`}>
                    <span><AlertTriangle size={18} aria-hidden="true" /></span>
                    <div><strong>{text(alert.title, 'Executive decision')}</strong><p>{text(alert.detail)}</p><small>{text(alert.recommendedAction)}</small></div>
                    <OpsStatus tone={alertTone(text(alert.severity))}>{titleCase(text(alert.severity, 'watch'))}</OpsStatus>
                  </article>
                )) : <OpsEmpty title="No active executive alerts" message="Spend, conversion, no-shows, connector, and department alerts will appear here when current records require a decision." />}
              </div>
            </OpsSection>
          </div>

          <section className="executive-report-band">
            <div><span><FileText size={18} aria-hidden="true" /></span><div><strong>Next executive report</strong><p>{schedules.length ? `${titleCase(text(schedules[0].cadence, 'scheduled'))} / ${text(schedules[0].sendTimeLabel, '09:00 working days')} / ${text(schedules[0].reportLanguage, 'English')}` : 'No schedule saved yet'}</p></div></div>
            <div><OpsStatus tone={deliveryReadiness.every(item => text(item.status) === 'ready') && deliveryReadiness.length ? 'positive' : 'warning'}>{deliveryReadiness.every(item => text(item.status) === 'ready') && deliveryReadiness.length ? 'Delivery ready' : 'Delivery setup required'}</OpsStatus><a className="ops-button is-secondary" href="#executive-report-workflow">Review workflow</a></div>
          </section>

          <div className="executive-detail-grid" id="executive-data-readiness">
            <OpsSection title="Data freshness" subtitle="Current, stale, and missing sources used by executive reporting.">
              <div className="executive-freshness-list">{freshness.length ? freshness.map(item => <article key={text(item.source)}><div><strong>{text(item.source)}</strong><p>{text(item.detail)}</p><small>Last seen: {dateLabel(item.lastSeenAt)}</small></div><OpsStatus tone={text(item.status) === 'current' ? 'positive' : text(item.status) === 'stale' ? 'warning' : 'neutral'}>{titleCase(text(item.status))}</OpsStatus></article>) : <OpsEmpty title="No freshness evidence" message="Freshness appears after internal records or customer-owned connectors provide data." />}</div>
            </OpsSection>

            <OpsSection title="Channel efficiency" subtitle="Spend, reach, leads, purchases, and cost efficiency by available channel.">
              <div className="executive-channel-list">{channels.length ? channels.map(channel => <article key={text(channel.channel)}><div><strong>{titleCase(text(channel.channel, 'manual'))}</strong><p>Reach {numberValue(channel.reach)} / Leads {numberValue(channel.leads)} / Purchases {numberValue(channel.purchases)}</p></div><div><strong>{formatMoney(channel.spend)}</strong><small>CPL {formatMoney(channel.costPerLead)}</small></div></article>) : <OpsEmpty title="Channel data is not connected" message="Connect analytics or approve an import to see real channel efficiency. Tanaghum will not estimate it." />}</div>
            </OpsSection>
          </div>

          <OpsSection
            title="Executive report workflow"
            subtitle="Create dashboard previews and schedule reports for authorized executive recipients. Delivery starts only when email and WhatsApp are configured."
            action={<OpsStatus tone={schedules.length ? 'positive' : 'warning'}>{schedules.length} active</OpsStatus>}
            className="executive-report-workflow"
          >
            <div id="executive-report-workflow" className="executive-delivery-readiness">
              {deliveryReadiness.length ? deliveryReadiness.map(item => <article key={text(item.channel)}><div><strong>{titleCase(text(item.channel))}</strong><p>{text(item.detail)}</p></div><OpsStatus tone={text(item.status) === 'ready' ? 'positive' : 'warning'}>{titleCase(text(item.status))}</OpsStatus></article>) : <p>Save the report workflow to calculate delivery readiness.</p>}
            </div>

            <div className="executive-report-form">
              <div className="executive-report-form-grid">
                <Field label="Report cadence"><select value={reportDraft.cadence} onChange={event => setReportDraft(current => ({ ...current, cadence: event.target.value }))}>{CADENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Report language"><select value={reportDraft.reportLanguage} onChange={event => setReportDraft(current => ({ ...current, reportLanguage: event.target.value }))}><option value="English">English</option><option value="Arabic">Arabic</option></select></Field>
                <Field label="Report title"><input value={reportDraft.title} onChange={event => setReportDraft(current => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Local send time"><div className="executive-time-grid"><input aria-label="Send hour" type="number" min={0} max={23} value={reportDraft.sendHour} onChange={event => setReportDraft(current => ({ ...current, sendHour: event.target.value }))} /><input aria-label="Send minute" type="number" min={0} max={59} value={reportDraft.sendMinute} onChange={event => setReportDraft(current => ({ ...current, sendMinute: event.target.value }))} /></div></Field>
                <Field label="Additional recipients"><textarea value={reportDraft.recipients} onChange={event => setReportDraft(current => ({ ...current, recipients: event.target.value }))} placeholder="Admin and CCO roles are included by the current policy." rows={3} /></Field>
                <Field label="Working-day policy"><label className="executive-checkbox"><input type="checkbox" checked={reportDraft.workingDaysOnly} onChange={event => setReportDraft(current => ({ ...current, workingDaysOnly: event.target.checked }))} />Send on working days only</label></Field>
              </div>

              <ChoiceGroup title="Delivery channels" options={DELIVERY_CHANNELS} selected={reportDraft.deliveryChannels} onToggle={toggleDeliveryChannel} />
              <ChoiceGroup title="Report sections" options={REPORT_SECTIONS} selected={reportDraft.reportSections} onToggle={toggleReportSection} />
              <OpsNotice>Dashboard previews are available now. Email reports and WhatsApp notifications are not delivered until customer credentials and the delivery worker are ready.</OpsNotice>
              <div className="ops-inline-actions"><button className="ops-button is-primary" type="button" onClick={generatePreview} disabled={saving}>Generate preview</button><button className="ops-button is-secondary" type="button" onClick={createSchedule} disabled={saving}>Save schedule</button></div>

              <div className="executive-report-history"><ReportList title="Recent previews" items={recentReports} empty="No report previews yet." /><ScheduleList items={schedules} /></div>
            </div>
          </OpsSection>

          {missingSources.length ? (
            <OpsSection title="Missing data checklist" subtitle="Customer-owned data and configuration gaps that currently reduce report confidence.">
              <div className="executive-missing-grid">{missingSources.map(item => <article key={item}><Filter size={17} aria-hidden="true" /><span>{item}</span></article>)}</div>
            </OpsSection>
          ) : null}

          <section className="executive-confidence-note">
            <span className={readinessScore >= 80 ? 'is-ready' : ''}>{readinessScore >= 80 ? <CheckCircle2 size={19} aria-hidden="true" /> : <CircleAlert size={19} aria-hidden="true" />}</span>
            <div><strong>Executive confidence: {titleCase(confidence)}</strong><p>Based on commercial plans, lead outcomes, verified KPI records, connector evidence, and discipline work. Synced connectors: {numberValue(connectorReadiness.synced)}. Blocked discipline work: {numberValue(disciplineSummary.blocked)}.</p></div>
            <OpsStatus tone={confidenceTone(confidence)}>{readinessScore}% ready</OpsStatus>
          </section>
        </>
      )}
    </OpsPage>
  );
}

function ExecutiveMetric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'positive' | 'warning' }) {
  return <article className={`is-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ChoiceGroup({ title, options, selected, onToggle }: { title: string; options: Array<{ value: string; label: string }>; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset className="executive-choice-group"><legend>{title}</legend><div>{options.map(option => <button type="button" key={option.value} className={selected.includes(option.value) ? 'is-selected' : ''} onClick={() => onToggle(option.value)}>{option.label}</button>)}</div></fieldset>;
}

function ReportList({ title, items, empty }: { title: string; items: RecordMap[]; empty: string }) {
  return (
    <section><header><FileText size={17} aria-hidden="true" /><strong>{title}</strong></header>{items.length ? <div>{items.slice(0, 4).map(item => <article key={text(item.id)}><strong>{text(item.title, 'Report preview')}</strong><small>{titleCase(text(item.cadence))} / {titleCase(text(item.status))} / {dateLabel(item.createdAt)}</small></article>)}</div> : <p>{empty}</p>}</section>
  );
}

function ScheduleList({ items }: { items: RecordMap[] }) {
  return (
    <section><header><CalendarClock size={17} aria-hidden="true" /><strong>Active schedules</strong></header>{items.length ? <div>{items.slice(0, 4).map(item => <article key={text(item.id)}><strong>{titleCase(text(item.cadence))}</strong><small>{text(item.sendTimeLabel, '09:00 working days')} / {text(item.reportLanguage, 'English')}</small><p>Recipients: {Array.isArray(item.resolvedRecipients) && item.resolvedRecipients.length ? (item.resolvedRecipients as RecordMap[]).map(recipient => text(recipient.email)).filter(Boolean).join(', ') : 'Admin and CCO roles'}</p></article>)}</div> : <p>No schedule yet. Save one after confirming recipients with the customer.</p>}</section>
  );
}
