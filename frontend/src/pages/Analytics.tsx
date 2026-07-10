import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Mail,
  MessageSquare,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react';
import { analyticsApi, ghlApi, leadsApi, smartLabsApi, socialGrowthApi } from '../api';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import './EventSalesWorkspaces.css';

type RecordMap = Record<string, unknown>;
type SalesView = 'pipeline' | 'follow-up' | 'performance' | 'readiness';

const CREATE_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist'];
const QUALIFY_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager', 'sales_manager', 'lead_qualification_manager'];

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function normalizedRole(user: unknown): string {
  if (!user || typeof user !== 'object') return 'viewer';
  return text((user as RecordMap).role, 'viewer').toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

const internalCustomerTextPattern = /\b(sprint\s*\d+|acceptance|smoke)\b/i;

function isInternalCustomerText(value: unknown): boolean {
  return typeof value === 'string' && internalCustomerTextPattern.test(value);
}

function sourceLabel(lead: RecordMap): string {
  return titleCase(text(lead.sourcePlatform || lead.channelAttribution || lead.externalSourceProvider || lead.sourceOfTruth, 'manual'));
}

function customerLeadName(lead: RecordMap, fallbackIndex?: number): string {
  const rawName = text(lead.leadName || lead.name, '');
  if (rawName && !isInternalCustomerText(rawName)) return rawName;
  const crmProvider = text(lead.sourceOfTruth || lead.externalSourceProvider, '');
  if (crmProvider) return `${titleCase(crmProvider)} lead`;
  const suffix = typeof fallbackIndex === 'number' ? ` ${fallbackIndex + 1}` : '';
  return `${sourceLabel(lead)} lead${suffix}`;
}

function customerLeadContact(lead: RecordMap): string {
  const email = text(lead.leadEmail || lead.email, '');
  if (email && !isInternalCustomerText(email) && !email.toLowerCase().endsWith('@example.com')) return email;
  const phone = text(lead.leadPhone || lead.phone, '');
  if (phone && !isInternalCustomerText(phone)) return phone;
  return 'Contact details pending';
}

function leadStatus(lead: RecordMap): string {
  return text(lead.leadStatus || lead.status, 'new_lead').toLowerCase();
}

function leadTemperature(lead: RecordMap): string {
  return text(lead.leadTemperature || lead.temperature, 'cold').toLowerCase();
}

function metricTotal(snapshots: RecordMap[], key: string): number {
  return snapshots.reduce((total, snapshot) => {
    const metrics = (snapshot.normalizedMetrics || snapshot.metrics || {}) as RecordMap;
    return total + numberValue(metrics[key]);
  }, 0);
}

function statusTone(value: unknown): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  const status = text(value, '').toLowerCase();
  if (['active', 'configured', 'qualified', 'converted', 'purchased', 'meeting_attended', 'buyer', 'hot'].includes(status)) return 'positive';
  if (['warm', 'meeting_booked', 'follow_up_needed', 'nurturing', 'pending'].includes(status)) return 'warning';
  if (['lost', 'no_show', 'denied', 'failed'].includes(status)) return 'danger';
  if (['new_lead', 'contacted'].includes(status)) return 'info';
  return 'neutral';
}

function leadNextAction(lead: RecordMap): string {
  const configured = text(lead.nextAction, '');
  if (configured) return configured;
  const status = leadStatus(lead);
  if (status === 'new_lead') return 'Review and assign the first follow-up';
  if (status === 'meeting_booked') return 'Confirm the booked meeting';
  if (status === 'no_show') return 'Start no-show recovery';
  if (status === 'purchased') return 'Confirm onboarding handoff';
  return 'Review the next sales action';
}

function formatDateTime(value: unknown): string {
  if (!value) return 'Due date not set';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Due date not set';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Analytics() {
  const { token, user } = useAuth();
  const role = normalizedRole(user);
  const [sources, setSources] = useState<RecordMap[]>([]);
  const [snapshots, setSnapshots] = useState<RecordMap[]>([]);
  const [reports, setReports] = useState<RecordMap[]>([]);
  const [leads, setLeads] = useState<RecordMap[]>([]);
  const [leadStats, setLeadStats] = useState<RecordMap | null>(null);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
  const [activeView, setActiveView] = useState<SalesView>('pipeline');
  const [mobileDetail, setMobileDetail] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [ghlPreview, setGhlPreview] = useState<RecordMap | null>(null);
  const [voicePreview, setVoicePreview] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [growthSummary, setGrowthSummary] = useState<RecordMap | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leadForm, setLeadForm] = useState({ sourcePlatform: 'linkedin', leadName: '', leadEmail: '', leadPhone: '', consentStatus: 'pending' });

  async function load() {
    if (!token) return;
    const [sourceData, snapshotData, reportData, leadData, statsData, growthData] = await Promise.all([
      analyticsApi.sources(token),
      analyticsApi.snapshots(token),
      analyticsApi.reports(token),
      leadsApi.list(token),
      leadsApi.stats(token),
      socialGrowthApi.summary(token).catch(() => null),
    ]);
    setSources(list(sourceData));
    setSnapshots(list(snapshotData));
    setReports(list(reportData));
    setLeads(list(leadData));
    setLeadStats(statsData as RecordMap);
    setGrowthSummary(growthData as RecordMap | null);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        await load();
      } catch (error) {
        if (!cancelled) setMessage(`Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!message || /failed|could not/i.test(message)) return;
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setMessage(''), 5000);
    return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, [message]);

  const selectedLead = leads[selectedLeadIndex] || leads[0] || null;
  const selectedLeadName = selectedLead ? customerLeadName(selectedLead, selectedLeadIndex) : '';
  const totalLeads = numberValue(leadStats?.total, leads.length);
  const qualified = numberValue(leadStats?.qualified, leads.filter(lead => leadStatus(lead) === 'qualified').length);
  const hotOrQualified = leads.filter(lead => ['hot', 'buyer'].includes(leadTemperature(lead)) || ['qualified', 'purchased'].includes(leadStatus(lead))).length;
  const meetingsBooked = leads.filter(lead => leadStatus(lead) === 'meeting_booked').length;
  const purchases = leads.filter(lead => leadStatus(lead) === 'purchased').length;
  const noShows = leads.filter(lead => leadStatus(lead) === 'no_show').length;
  const actionDue = leads.filter(lead => ['new_lead', 'follow_up_needed', 'no_show', 'meeting_booked'].includes(leadStatus(lead))).length;
  const reach = metricTotal(snapshots, 'reach');
  const impressions = metricTotal(snapshots, 'impressions');
  const engagement = metricTotal(snapshots, 'engagement');
  const growthKpis = (growthSummary?.kpis || {}) as RecordMap;
  const growthIntegrations = (growthSummary?.integrations || {}) as RecordMap;
  const growthFunnel = list(growthSummary?.funnel);
  const hasAnalyticsData = snapshots.length > 0 || reports.length > 0;
  const canCreateLead = CREATE_ROLES.includes(role);
  const canQualifyLead = QUALIFY_ROLES.includes(role);

  async function captureLead() {
    if (!token) return;
    setLoading('capture-lead');
    setMessage('');
    try {
      await leadsApi.create(leadForm, token);
      setLeadForm({ sourcePlatform: 'linkedin', leadName: '', leadEmail: '', leadPhone: '', consentStatus: 'pending' });
      setShowLeadForm(false);
      setMessage('Lead saved to the workspace.');
      await load();
    } catch (error) {
      setMessage(`Could not capture lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function qualifyLead() {
    if (!token || !selectedLead) return;
    setLoading('qualify-lead');
    setMessage('');
    try {
      await leadsApi.qualify(String(selectedLead.id), token);
      setMessage('Lead marked as qualified.');
      await load();
    } catch (error) {
      setMessage(`Could not qualify lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function previewGhlPayload() {
    if (!token || !selectedLead) return;
    setLoading('ghl-preview');
    setMessage('');
    try {
      const result = await ghlApi.sandboxContact({ leadId: selectedLead.id, mode: 'preview' }, token) as RecordMap;
      setGhlPreview(result);
      setMessage('CRM handoff preview prepared. No external data was sent.');
    } catch (error) {
      setMessage(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function previewVoicePayload() {
    if (!token || !selectedLead) return;
    setLoading('voice-preview');
    setMessage('');
    try {
      const result = await smartLabsApi.leadHandoffPreview(String(selectedLead.id), {
        message: `Prepare a follow-up conversation for ${selectedLeadName}. Source: ${sourceLabel(selectedLead)}. Interest score: ${numberValue(selectedLead.qualificationScore)}. Goal: answer course questions and guide the lead to the right next step.`,
        escalationReason: 'Lead requested course guidance or sales follow-up.',
        nextAction: 'Review the SmartLabs package, then execute only after customer authorization.',
        ownerRole: 'sales_manager',
      }, token) as RecordMap;
      setVoicePreview(result);
      setMessage('Voice/chat handoff preview prepared. No external call was made.');
    } catch (error) {
      setMessage(`Voice/chat preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  function selectLead(index: number) {
    setSelectedLeadIndex(index);
    setGhlPreview(null);
    setVoicePreview(null);
    setMobileDetail(true);
    window.requestAnimationFrame(() => {
      const tabs = document.querySelector<HTMLElement>('.sales-tabs');
      if (tabs && window.matchMedia('(max-width: 767px)').matches) {
        window.scrollTo({ top: Math.max(0, tabs.offsetTop - 72), behavior: 'auto' });
      }
    });
  }

  if (pageLoading) {
    return <OpsPage className="sales-leads-page"><OpsPageHeader title="Sales & Leads" subtitle="Loading the customer pipeline." /><div className="sales-loading"><OpsSkeleton rows={5} /><OpsSkeleton rows={5} /></div></OpsPage>;
  }

  return (
    <OpsPage className="sales-leads-page">
      <OpsPageHeader
        title="Sales & Leads"
        subtitle="See who needs attention, complete the next follow-up, and track progress to purchase."
        actions={(
          <>
            <Link className="ops-button is-secondary" to="/stitchi?mode=prepare&prompt=Review%20my%20sales%20pipeline%20and%20tell%20me%20which%20leads%20need%20attention%20today.&returnTo=%2Fanalytics"><Sparkles size={17} aria-hidden="true" />Ask Stitchi</Link>
            {canCreateLead ? <button className="ops-button is-primary" type="button" onClick={() => setShowLeadForm(open => !open)}><Plus size={17} aria-hidden="true" />{showLeadForm ? 'Close Form' : 'Add Lead'}</button> : null}
          </>
        )}
      />

      {message ? <OpsNotice tone={/failed|could not/i.test(message) ? 'danger' : 'positive'}>{message}</OpsNotice> : null}

      {showLeadForm ? (
        <OpsSection title="Add a lead" subtitle="Use this only when the lead did not arrive from the customer CRM or form connection." className="sales-lead-form">
          <div className="sales-form-grid">
            <label><span>Source</span><select value={leadForm.sourcePlatform} onChange={event => setLeadForm(current => ({ ...current, sourcePlatform: event.target.value }))}><option value="linkedin">LinkedIn</option><option value="instagram">Instagram</option><option value="x">X / Twitter</option><option value="manual">Manual entry</option></select></label>
            <label><span>Name</span><input value={leadForm.leadName} onChange={event => setLeadForm(current => ({ ...current, leadName: event.target.value }))} placeholder="Customer name" /></label>
            <label><span>Email</span><input type="email" value={leadForm.leadEmail} onChange={event => setLeadForm(current => ({ ...current, leadEmail: event.target.value }))} placeholder="customer@company.com" /></label>
            <label><span>Phone</span><input value={leadForm.leadPhone} onChange={event => setLeadForm(current => ({ ...current, leadPhone: event.target.value }))} placeholder="Customer phone" /></label>
            <label><span>Consent</span><select value={leadForm.consentStatus} onChange={event => setLeadForm(current => ({ ...current, consentStatus: event.target.value }))}><option value="pending">Pending</option><option value="granted">Granted</option><option value="denied">Denied</option></select></label>
          </div>
          <div className="sales-form-actions"><button className="ops-button is-secondary" type="button" onClick={() => setShowLeadForm(false)}>Cancel</button><button className="ops-button is-primary" type="button" disabled={loading === 'capture-lead' || (!leadForm.leadEmail && !leadForm.leadPhone)} onClick={() => void captureLead()}>{loading === 'capture-lead' ? 'Saving...' : 'Save Lead'}</button></div>
        </OpsSection>
      ) : null}

      <section className="r1d2-summary-grid is-sales sales-summary" aria-label="Sales operating summary">
        <SalesMetric label="Open leads" value={String(totalLeads)} detail={`${actionDue} need action`} icon={UsersRound} tone={actionDue ? 'warning' : 'neutral'} />
        <SalesMetric label="Hot or qualified" value={String(hotOrQualified || qualified)} detail="Ready for direct follow-up" icon={Target} tone="positive" />
        <SalesMetric label="Meetings booked" value={String(meetingsBooked)} detail="Current pipeline" icon={CalendarDays} />
        <SalesMetric label="Purchases" value={String(purchases)} detail="Recorded outcomes" icon={CheckCircle2} tone="positive" />
        <SalesMetric label="No-shows" value={String(noShows)} detail={noShows ? 'Recovery needed' : 'No recovery due'} icon={CircleAlert} tone={noShows ? 'warning' : 'neutral'} />
      </section>

      <nav className="r1d2-tabs sales-tabs" aria-label="Sales and lead views">
        {([
          ['pipeline', 'Lead Pipeline', 'Pipeline'],
          ['follow-up', 'Follow-up', 'Follow-up'],
          ['performance', 'Performance', 'Results'],
          ['readiness', 'Data Readiness', 'Data'],
        ] as Array<[SalesView, string, string]>).map(([id, label, mobile]) => (
          <button key={id} type="button" className={activeView === id ? 'is-active' : ''} aria-pressed={activeView === id} onClick={() => { setActiveView(id); setMobileDetail(false); }}><span className="r1d2-tab-full">{label}</span><span className="r1d2-tab-short">{mobile}</span></button>
        ))}
      </nav>

      {activeView === 'pipeline' ? (
        <div className={`r1d2-sales-workspace sales-workspace${mobileDetail ? ' is-detail' : ''}`}>
          <LeadQueue leads={leads} selectedIndex={selectedLeadIndex} actionDue={actionDue} onSelect={selectLead} />
          <LeadDetail
            lead={selectedLead}
            leadName={selectedLeadName}
            loading={loading}
            canQualify={canQualifyLead}
            ghlPreview={ghlPreview}
            voicePreview={voicePreview}
            onBack={() => setMobileDetail(false)}
            onQualify={() => void qualifyLead()}
            onGhl={() => void previewGhlPayload()}
            onVoice={() => void previewVoicePayload()}
          />
        </div>
      ) : null}

      {activeView === 'follow-up' ? <FollowUpView leads={leads} onOpen={index => { setActiveView('pipeline'); selectLead(index); }} /> : null}
      {activeView === 'performance' ? <PerformanceView growthFunnel={growthFunnel} growthKpis={growthKpis} totalLeads={totalLeads} qualified={qualified} reach={reach} impressions={impressions} engagement={engagement} hasData={hasAnalyticsData} reports={reports.length} /> : null}
      {activeView === 'readiness' ? <ReadinessView sources={sources} snapshots={snapshots} reports={reports} integrations={growthIntegrations} /> : null}
    </OpsPage>
  );
}

function SalesMetric({ label, value, detail, icon: Icon, tone = 'neutral' }: { label: string; value: string; detail: string; icon: typeof UsersRound; tone?: 'neutral' | 'positive' | 'warning' }) {
  return <article className={`r1d2-summary-metric is-${tone}`}><span><Icon size={18} aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function LeadQueue({ leads, selectedIndex, actionDue, onSelect }: { leads: RecordMap[]; selectedIndex: number; actionDue: number; onSelect: (index: number) => void }) {
  return <OpsSection title="Lead pipeline" subtitle="Ordered by current status and next action." action={<OpsStatus tone={actionDue ? 'warning' : 'positive'}>{actionDue} need action</OpsStatus>} className="r1d2-lead-queue sales-lead-queue">
    <div className="r1d2-lead-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="sales-lead-search">Search leads</label><input id="sales-lead-search" type="search" placeholder="Search leads" /></div>
    {leads.length ? <div className="r1d2-lead-list">{leads.map((lead, index) => {
      const name = customerLeadName(lead, index);
      const temperature = leadTemperature(lead);
      return <button key={text(lead.id, String(index))} type="button" className={selectedIndex === index ? 'is-active' : ''} onClick={() => onSelect(index)} aria-pressed={selectedIndex === index}>
        <span className="r1d2-lead-avatar">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
        <span><strong>{name}</strong><small>{titleCase(leadStatus(lead))} - {sourceLabel(lead)}</small><em>{leadNextAction(lead)}</em></span>
        <OpsStatus tone={statusTone(temperature)}>{titleCase(temperature)}</OpsStatus>
      </button>;
    })}</div> : <OpsEmpty title="No leads yet" message="Leads will appear after CRM/form sync or after an authorized user adds one." />}
  </OpsSection>;
}

function LeadDetail({ lead, leadName, loading, canQualify, ghlPreview, voicePreview, onBack, onQualify, onGhl, onVoice }: { lead: RecordMap | null; leadName: string; loading: string; canQualify: boolean; ghlPreview: RecordMap | null; voicePreview: RecordMap | null; onBack: () => void; onQualify: () => void; onGhl: () => void; onVoice: () => void }) {
  if (!lead) return <OpsSection className="r1d2-lead-detail sales-lead-detail"><OpsEmpty title="Select a lead" message="Choose a customer to review status, follow-up, and governed handoff actions." /></OpsSection>;
  const status = leadStatus(lead);
  const temperature = leadTemperature(lead);
  const contact = customerLeadContact(lead);
  return <OpsSection className="r1d2-lead-detail sales-lead-detail">
    <header className="sales-lead-detail-header"><button type="button" className="r1d2-mobile-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />Back to leads</button><div><h2>{leadName}</h2><p>{titleCase(status)} - {titleCase(temperature)} lead</p></div><OpsStatus tone={statusTone(temperature)}>{titleCase(temperature)}</OpsStatus></header>
    <div className="r1d2-lead-summary">
      <div className="r1d2-lead-contact"><span className="r1d2-lead-avatar is-large">{leadName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{leadName}</strong><span className="sales-contact">{contact}</span><p>{lead.campaignId ? 'Linked to campaign' : 'No campaign linked'}</p></div></div>
      <dl><div><dt>Source</dt><dd>{sourceLabel(lead)}</dd></div><div><dt>Status</dt><dd>{titleCase(status)}</dd></div><div><dt>Owner</dt><dd>{titleCase(text(lead.ownerRole, 'Sales team'))}</dd></div><div><dt>Consent</dt><dd>{titleCase(text(lead.consentStatus, 'pending'))}</dd></div></dl>
    </div>
    <section className="r1d2-next-follow-up"><span><Clock3 size={18} aria-hidden="true" /></span><div><small>Next follow-up</small><h3>{leadNextAction(lead)}</h3><p>{formatDateTime(lead.followUpDate)}</p></div>{canQualify && status !== 'qualified' ? <button className="ops-button is-primary" type="button" disabled={loading === 'qualify-lead'} onClick={onQualify}>{loading === 'qualify-lead' ? 'Updating...' : 'Mark Qualified'}</button> : status === 'qualified' ? <OpsStatus tone="positive">Qualified</OpsStatus> : null}</section>
    <div className="r1d2-lead-actions">
      <button type="button" onClick={onGhl} disabled={loading === 'ghl-preview'}><Database size={17} aria-hidden="true" /><span><strong>Prepare CRM handoff</strong><small>{ghlPreview ? 'Preview ready - nothing sent' : 'Uses customer GHL setup'}</small></span><ArrowRight size={16} /></button>
      <button type="button" onClick={onGhl} disabled={loading === 'ghl-preview'}><MessageSquare size={17} aria-hidden="true" /><span><strong>WhatsApp follow-up</strong><small>Prepare through approved CRM flow</small></span><ArrowRight size={16} /></button>
      <button type="button" onClick={onVoice} disabled={loading === 'voice-preview'}><PhoneCall size={17} aria-hidden="true" /><span><strong>Voice/chat handoff</strong><small>{voicePreview ? 'Preview ready - no call made' : 'Requires consent and setup'}</small></span><ArrowRight size={16} /></button>
    </div>
    <footer><button className="ops-button is-secondary" type="button"><Mail size={16} aria-hidden="true" />Add note</button>{ghlPreview || voicePreview ? <OpsStatus tone="info">Preview only - no external action</OpsStatus> : null}</footer>
  </OpsSection>;
}

function FollowUpView({ leads, onOpen }: { leads: RecordMap[]; onOpen: (index: number) => void }) {
  const queue = leads.map((lead, index) => ({ lead, index })).filter(({ lead }) => ['new_lead', 'follow_up_needed', 'meeting_booked', 'no_show'].includes(leadStatus(lead)));
  return <OpsSection title="Follow-up queue" subtitle="Calls, meetings, messages, and no-show recovery that need a human owner." action={<OpsStatus tone={queue.length ? 'warning' : 'positive'}>{queue.length} open</OpsStatus>}>
    {queue.length ? <div className="sales-followup-list">{queue.map(({ lead, index }) => <article key={text(lead.id, String(index))}><span><Clock3 size={17} aria-hidden="true" /></span><div><h3>{customerLeadName(lead, index)}</h3><p>{leadNextAction(lead)}</p><small>{titleCase(leadStatus(lead))} - {sourceLabel(lead)}</small></div><button className="ops-button is-secondary" type="button" onClick={() => onOpen(index)}>Open lead</button></article>)}</div> : <OpsEmpty title="No follow-up due" message="No lead currently has a follow-up, meeting, or recovery action." />}
  </OpsSection>;
}

function PerformanceView({ growthFunnel, growthKpis, totalLeads, qualified, reach, impressions, engagement, hasData, reports }: { growthFunnel: RecordMap[]; growthKpis: RecordMap; totalLeads: number; qualified: number; reach: number; impressions: number; engagement: number; hasData: boolean; reports: number }) {
  const rows = growthFunnel.length ? growthFunnel : [
    { label: 'Campaigns', value: numberValue(growthKpis.activeCampaigns) },
    { label: 'Content', value: numberValue(growthKpis.postsPrepared) },
    { label: 'Leads', value: totalLeads },
    { label: 'Qualified', value: qualified },
  ];
  const maximum = Math.max(1, ...rows.map(row => numberValue(row.value)));
  return <div className="sales-performance-grid">
    <OpsSection title="Customer journey" subtitle="Recorded movement from campaign work to qualified customer interest."><div className="sales-funnel">{rows.map(row => <div key={text(row.label)}><span><strong>{text(row.label)}</strong><small>{numberValue(row.value).toLocaleString()}</small></span><div><i style={{ width: `${numberValue(row.value) ? Math.max(8, (numberValue(row.value) / maximum) * 100) : 0}%` }} /></div></div>)}</div></OpsSection>
    <OpsSection title="Content performance" subtitle="Only verified analytics snapshots and reports are counted.">{hasData ? <dl className="sales-performance-facts"><div><dt>Reach</dt><dd>{reach.toLocaleString()}</dd></div><div><dt>Impressions</dt><dd>{impressions.toLocaleString()}</dd></div><div><dt>Engagement</dt><dd>{engagement.toLocaleString()}</dd></div><div><dt>Reports</dt><dd>{reports}</dd></div></dl> : <OpsEmpty title="Performance data is not connected" message="Connect customer-owned analytics or import verified data. Tanaghum will not invent results." action={<Link className="ops-button is-secondary" to="/integration-credentials">Open Integrations</Link>} />}</OpsSection>
  </div>;
}

function ReadinessView({ sources, snapshots, reports, integrations }: { sources: RecordMap[]; snapshots: RecordMap[]; reports: RecordMap[]; integrations: RecordMap }) {
  const items = [
    { label: 'Analytics sources', ready: sources.length > 0, detail: sources.length ? `${sources.length} source(s) recorded` : 'Connect or import customer analytics' },
    { label: 'Analytics snapshots', ready: snapshots.length > 0, detail: snapshots.length ? `${snapshots.length} snapshot(s) available` : 'No verified snapshots yet' },
    { label: 'GoHighLevel CRM', ready: text(integrations.goHighLevel, '') === 'configured', detail: text(integrations.goHighLevel, 'Customer credentials required') },
    { label: 'SmartLabs voice/chat', ready: text(integrations.smartLabsVoice, '') === 'configured', detail: text(integrations.smartLabsVoice, 'Customer tenant key required') },
    { label: 'Performance reports', ready: reports.length > 0, detail: reports.length ? `${reports.length} report(s) available` : 'Reports appear after verified activity' },
  ];
  return <OpsSection title="Data readiness" subtitle="Customer-owned systems and verified records that support sales reporting." action={<Link className="ops-button is-primary" to="/integration-credentials">Open Setup</Link>}><div className="sales-readiness-list">{items.map(item => <article key={item.label}><span className={item.ready ? 'is-ready' : ''}>{item.ready ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}</span><div><h3>{item.label}</h3><p>{titleCase(item.detail)}</p></div><OpsStatus tone={item.ready ? 'positive' : 'warning'}>{item.ready ? 'Ready' : 'Setup needed'}</OpsStatus></article>)}</div></OpsSection>;
}
