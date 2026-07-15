import { useEffect, useMemo, useState } from 'react';
import { Check, History, Search, Sparkles, X } from 'lucide-react';
import { campaignsApi, commercialAssessmentApi, commercialCommandCenterApi, eventsApi } from '../api';
import { CommercialWorkspaceNav } from '../components/CommercialWorkspaceNav';
import {
  OpsEmpty,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSection,
  OpsSkeleton,
  OpsStatus,
} from '../components/OperationalUI';
import { Field } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';
import './CommercialAssessment.css';

type RecordMap = Record<string, unknown>;

function object(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordMap : {};
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateLabel(value: unknown): string {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function titleCase(value: unknown): string {
  return text(value, 'unknown').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(value: unknown): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  const status = text(value);
  if (['approved', 'generated', 'evidence_ready', 'active'].includes(status)) return 'positive';
  if (status === 'failed' || status === 'rejected') return 'danger';
  if (status === 'generating' || status === 'pending') return 'warning';
  return 'neutral';
}

function normalizeRole(user: unknown): string {
  return text(object(user).role, 'unknown').toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

async function fetchAssessmentWorkspace(token: string, activeRunId?: string) {
  const [dashboardResult, runsResult, learningResult, eventsResult, campaignsResult] = await Promise.all([
    commercialCommandCenterApi.dashboard(token),
    commercialAssessmentApi.list(token),
    commercialAssessmentApi.learningSets(token),
    eventsApi.list(token),
    campaignsApi.list(token),
  ]);
  const dashboard = dashboardResult as RecordMap;
  const runs = Array.isArray(runsResult) ? runsResult as RecordMap[] : [];
  const selectedId = activeRunId || text(runs[0]?.id);
  const selectedRun = selectedId
    ? await commercialAssessmentApi.get(selectedId, token) as RecordMap
    : null;
  return {
    revenueLines: list(dashboard.revenueLines).filter(line => Boolean(line.configured)),
    runs,
    learningSets: Array.isArray(learningResult) ? learningResult as RecordMap[] : [],
    events: Array.isArray(eventsResult) ? (eventsResult as RecordMap[]).filter(event => text(event.status) === 'completed') : [],
    campaigns: Array.isArray(campaignsResult) ? campaignsResult as RecordMap[] : [],
    selectedRun,
  };
}

export default function CommercialAssessment() {
  const { token, user } = useAuth();
  const role = normalizeRole(user);
  const canCreate = ['admin', 'cco', 'department_head', 'marketing_manager'].includes(role);
  const canApprove = ['admin', 'cco'].includes(role);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [revenueLines, setRevenueLines] = useState<RecordMap[]>([]);
  const [runs, setRuns] = useState<RecordMap[]>([]);
  const [learningSets, setLearningSets] = useState<RecordMap[]>([]);
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [selectedRun, setSelectedRun] = useState<RecordMap | null>(null);
  const [preview, setPreview] = useState<RecordMap | null>(null);
  const [title, setTitle] = useState('Annual commercial performance assessment');
  const [revenueLineId, setRevenueLineId] = useState('');
  const [eventId, setEventId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [audienceQuery, setAudienceQuery] = useState('');
  const [channel, setChannel] = useState('');
  const [dateFrom, setDateFrom] = useState(dateInput(oneYearAgo));
  const [dateTo, setDateTo] = useState(dateInput(new Date()));
  const [loading, setLoading] = useState(Boolean(token));
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  async function refreshAssessment(activeRunId?: string) {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const workspace = await fetchAssessmentWorkspace(token, activeRunId);
      setRevenueLines(workspace.revenueLines);
      setRuns(workspace.runs);
      setLearningSets(workspace.learningSets);
      setEvents(workspace.events);
      setCampaigns(workspace.campaigns);
      setSelectedRun(workspace.selectedRun);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Historical assessment could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchAssessmentWorkspace(token)
        .then(workspace => {
          if (cancelled) return;
          setRevenueLines(workspace.revenueLines);
          setRuns(workspace.runs);
          setLearningSets(workspace.learningSets);
          setEvents(workspace.events);
          setCampaigns(workspace.campaigns);
          setSelectedRun(workspace.selectedRun);
        })
        .catch(error => {
          if (!cancelled) setMessage(error instanceof Error ? error.message : 'Historical assessment could not be loaded.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token]);

  const scopePayload = useMemo(() => ({
    revenueLineId: revenueLineId || null,
    eventIds: eventId ? [eventId] : [],
    campaignIds: campaignId ? [campaignId] : [],
    audienceQuery: audienceQuery.trim() || null,
    channels: channel ? [channel] : [],
    dateFrom: `${dateFrom}T00:00:00.000Z`,
    dateTo: `${dateTo}T23:59:59.999Z`,
  }), [audienceQuery, campaignId, channel, dateFrom, dateTo, eventId, revenueLineId]);

  async function previewEvidence() {
    if (!token) return;
    setWorking(true);
    setMessage('');
    try {
      setPreview(await commercialAssessmentApi.preview(scopePayload, token) as RecordMap);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Evidence preview failed.');
    } finally {
      setWorking(false);
    }
  }

  async function saveSnapshot() {
    if (!token || !preview || !title.trim()) return;
    setWorking(true);
    setMessage('');
    try {
      const created = await commercialAssessmentApi.create({ ...scopePayload, title }, token) as RecordMap;
      setSelectedRun(created);
      setPreview(null);
      await refreshAssessment(text(created.id));
      setMessage('Historical evidence was saved as an immutable assessment snapshot.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Assessment snapshot could not be created.');
    } finally {
      setWorking(false);
    }
  }

  async function openRun(id: string) {
    if (!token) return;
    setWorking(true);
    try {
      setSelectedRun(await commercialAssessmentApi.get(id, token) as RecordMap);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Assessment could not be opened.');
    } finally {
      setWorking(false);
    }
  }

  async function generateFindings() {
    if (!token || !selectedRun?.id) return;
    setWorking(true);
    setMessage('');
    try {
      const generated = await commercialAssessmentApi.generate(text(selectedRun.id), token) as RecordMap;
      setSelectedRun(generated);
      await refreshAssessment(text(generated.id));
      setMessage('Stitchi generated evidence-backed findings. A manager must review each one before it becomes reusable learning.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI assessment generation failed.');
    } finally {
      setWorking(false);
    }
  }

  async function decideFinding(id: string, decision: 'approved' | 'rejected') {
    if (!token) return;
    setWorking(true);
    setMessage('');
    try {
      const updated = await commercialAssessmentApi.decideFinding(id, { decision }, token) as RecordMap;
      setSelectedRun(updated);
      await refreshAssessment(text(updated.id));
      setMessage(decision === 'approved' ? 'Finding approved for future planning.' : 'Finding rejected and excluded from reusable learning.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Finding decision failed.');
    } finally {
      setWorking(false);
    }
  }

  const previewSummary = object(preview?.summary);
  const runSummary = object(selectedRun?.evidence_summary);
  const missingData = listOfStrings(preview?.missingData || selectedRun?.missing_data);
  const findings = list(selectedRun?.findings);
  const evidence = list(selectedRun?.evidence);
  const evidenceById = new Map(evidence.map(item => [text(item.id), item]));

  return (
    <OpsPage className="commercial-assessment-page">
      <OpsPageHeader
        eyebrow="Commercial intelligence"
        title="Historical Assessment"
        subtitle="Study previous plans, completed events, verified performance, lead outcomes, and barriers before planning what comes next."
        actions={<OpsStatus tone="info">Evidence first</OpsStatus>}
      />
      <CommercialWorkspaceNav />

      {message ? <OpsNotice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not') ? 'danger' : 'info'}>{message}</OpsNotice> : null}

      <div className="assessment-steps" aria-label="Assessment workflow">
        <article className="is-active"><span>1</span><div><strong>Select history</strong><small>Choose the period and business line.</small></div></article>
        <article><span>2</span><div><strong>Verify evidence</strong><small>See exactly what Tanaghum found.</small></div></article>
        <article><span>3</span><div><strong>Generate learning</strong><small>Approve only findings supported by evidence.</small></div></article>
      </div>

      <div className="assessment-layout">
        <OpsSection title="Assessment scope" subtitle="This creates a frozen, tenant-scoped evidence snapshot. It does not change any commercial plan.">
          <div className="assessment-form-grid">
            <Field label="Assessment title"><input value={title} onChange={event => setTitle(event.target.value)} /></Field>
            <Field label="Business line">
              <select value={revenueLineId} onChange={event => setRevenueLineId(event.target.value)}>
                <option value="">All configured business lines</option>
                {revenueLines.map(line => <option key={text(line.id)} value={text(line.id)}>{text(line.name)}</option>)}
              </select>
            </Field>
            <Field label="From"><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></Field>
            <Field label="To"><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></Field>
          </div>
          <details className="assessment-scope-filters">
            <summary>Refine by event, campaign, audience, or channel</summary>
            <div>
              <Field label="Completed event">
                <select value={eventId} onChange={event => setEventId(event.target.value)}>
                  <option value="">All completed events in the period</option>
                  {events.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.name, 'Unnamed event')}</option>)}
                </select>
              </Field>
              <Field label="Campaign">
                <select value={campaignId} onChange={event => setCampaignId(event.target.value)}>
                  <option value="">All campaigns in the period</option>
                  {campaigns.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.objective, text(item.topic, 'Untitled campaign'))}</option>)}
                </select>
              </Field>
              <Field label="Audience contains"><input value={audienceQuery} onChange={event => setAudienceQuery(event.target.value)} placeholder="Example: previous buyers" /></Field>
              <Field label="Channel">
                <select value={channel} onChange={event => setChannel(event.target.value)}>
                  <option value="">All channels</option>
                  {['meta', 'instagram', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral'].map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
                </select>
              </Field>
            </div>
          </details>
          <div className="assessment-actions">
            <button className="ops-button is-primary" type="button" onClick={previewEvidence} disabled={working || !dateFrom || !dateTo}><Search size={16} /> Review available evidence</button>
            {preview && canCreate ? <button className="ops-button is-secondary" type="button" onClick={saveSnapshot} disabled={working || !title.trim()}><History size={16} /> Save evidence snapshot</button> : null}
          </div>
          {preview ? <EvidenceSummary summary={previewSummary} missingData={missingData} evidenceCount={list(preview.evidence).length} /> : null}
        </OpsSection>

        <OpsSection title="Assessment history" subtitle="Open a saved evidence snapshot or review its current status.">
          {loading ? <OpsSkeleton rows={4} /> : runs.length ? (
            <div className="assessment-run-list">
              {runs.map(run => {
                const active = text(run.id) === text(selectedRun?.id);
                const counts = object(run._count);
                return (
                  <button key={text(run.id)} className={active ? 'is-active' : ''} type="button" onClick={() => openRun(text(run.id))}>
                    <span><strong>{text(run.title)}</strong><small>{dateLabel(run.date_from)} - {dateLabel(run.date_to)}</small></span>
                    <span><OpsStatus tone={statusTone(run.status)}>{titleCase(run.status)}</OpsStatus><small>{numberValue(counts.evidence)} evidence item(s)</small></span>
                  </button>
                );
              })}
            </div>
          ) : <OpsEmpty title="No assessment yet" message="Choose a period, review the available evidence, then save the first historical assessment." />}
        </OpsSection>
      </div>

      {selectedRun ? (
        <OpsSection
          title={text(selectedRun.title)}
          subtitle={`${dateLabel(selectedRun.date_from)} to ${dateLabel(selectedRun.date_to)}. AI findings remain proposals until an authorized manager approves them.`}
          action={<OpsStatus tone={statusTone(selectedRun.status)}>{titleCase(selectedRun.status)}</OpsStatus>}
        >
          <EvidenceSummary summary={runSummary} missingData={missingData} evidenceCount={evidence.length} />
          <div className="assessment-generate-row">
            <div><strong>Stitchi historical analysis</strong><p>Gemma receives the bounded evidence snapshot without lead names, emails, phone numbers, credentials, or raw secrets.</p></div>
            {canCreate && ['evidence_ready', 'failed'].includes(text(selectedRun.status)) ? (
              <button className="ops-button is-primary" type="button" onClick={generateFindings} disabled={working || evidence.length === 0}><Sparkles size={16} /> Generate findings</button>
            ) : null}
          </div>

          {findings.length ? (
            <div className="assessment-findings">
              {findings.map(finding => {
                const references = Array.isArray(finding.evidence_ids) ? finding.evidence_ids.map(value => evidenceById.get(String(value))).filter(Boolean) as RecordMap[] : [];
                return (
                  <article key={text(finding.id)}>
                    <header><OpsStatus tone={findingTone(text(finding.finding_type))}>{titleCase(finding.finding_type)}</OpsStatus><span>{Math.round(numberValue(finding.confidence) * 100)}% confidence</span></header>
                    <h3>{text(finding.title)}</h3>
                    <p>{text(finding.summary)}</p>
                    <div className="assessment-recommendation"><strong>Use in future planning</strong><p>{text(finding.recommendation)}</p></div>
                    <details><summary>{references.length} supporting evidence item(s)</summary><div>{references.map(reference => <span key={text(reference.id)}>{text(reference.source_name, titleCase(reference.evidence_type))}: {titleCase(reference.metric_key)}</span>)}</div></details>
                    <footer>
                      <OpsStatus tone={statusTone(finding.decision)}>{titleCase(finding.decision)}</OpsStatus>
                      {canApprove && text(finding.decision) === 'pending' ? <span><button type="button" onClick={() => decideFinding(text(finding.id), 'approved')} disabled={working}><Check size={15} /> Approve</button><button type="button" onClick={() => decideFinding(text(finding.id), 'rejected')} disabled={working}><X size={15} /> Reject</button></span> : null}
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : <OpsEmpty title="No AI findings yet" message={evidence.length ? 'Generate findings when the evidence scope is ready.' : 'This assessment has no evidence to analyze.'} />}
        </OpsSection>
      ) : null}

      <OpsSection title="Approved learning" subtitle="Only manager-approved findings appear here for reuse in future planning.">
        {learningSets.length ? <div className="learning-set-list">{learningSets.map(set => <article key={text(set.id)}><div><strong>{text(set.title)}</strong><small>Approved {dateLabel(set.approved_at)}</small></div><OpsStatus tone="positive">{list(set.findings).length} approved finding(s)</OpsStatus></article>)}</div> : <OpsEmpty title="No approved learning yet" message="Generate an assessment and approve its evidence-backed findings first." />}
      </OpsSection>
    </OpsPage>
  );
}

function EvidenceSummary({ summary, missingData, evidenceCount }: { summary: RecordMap; missingData: string[]; evidenceCount: number }) {
  const actuals = object(summary.operatingActuals);
  const eventComparison = list(summary.eventComparison);
  return (
    <div className="assessment-evidence-summary">
      <div className="assessment-metrics">
        <article><span>Completed events</span><strong>{numberValue(summary.completedEvents)}</strong><small>{summary.comparisonReady ? 'Comparison ready' : 'More history improves comparison'}</small></article>
        <article><span>Commercial plans</span><strong>{numberValue(summary.commercialPlans)}</strong><small>Within the selected period</small></article>
        <article><span>Evidence records</span><strong>{evidenceCount}</strong><small>Frozen and traceable</small></article>
        <article><span>Known outcomes</span><strong>{numberValue(actuals.purchases)} purchases</strong><small>{numberValue(actuals.leads)} leads in verified records</small></article>
      </div>
      {eventComparison.length >= 2 ? (
        <div className="assessment-comparison">
          <div><strong>Completed event comparison</strong><small>Deterministic outcomes from the frozen evidence snapshot</small></div>
          <div className="assessment-comparison-scroll">
            <table>
              <thead><tr><th>Event</th><th>Reach</th><th>Leads</th><th>Purchases</th><th>Spend</th><th>Known revenue</th></tr></thead>
              <tbody>{eventComparison.map(event => {
                const currency = text(event.currency) === 'mixed' ? 'mixed' : text(event.currency) === 'USD' ? 'USD' : 'AED';
                const money = (value: unknown) => currency === 'mixed' ? 'Currency required' : formatCurrency(numberValue(value), currency);
                return <tr key={text(event.eventId)}><th>{text(event.eventName, 'Completed event')}<small>{dateLabel(event.eventDate)}</small></th><td>{numberValue(event.reach).toLocaleString()}</td><td>{numberValue(event.leads).toLocaleString()}</td><td>{numberValue(event.purchases).toLocaleString()}</td><td>{money(event.knownSpend)}</td><td>{money(event.knownRevenue)}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      ) : null}
      {missingData.length ? <div className="assessment-missing"><strong>Known data gaps</strong>{missingData.map(item => <span key={item}>{item}</span>)}</div> : <OpsNotice tone="positive">The selected history includes completed events, performance, lead outcomes, and connector provenance.</OpsNotice>}
    </div>
  );
}

function listOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') as string[] : [];
}

function findingTone(value: string): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  if (value === 'repeat') return 'positive';
  if (value === 'avoid') return 'danger';
  if (value === 'improve') return 'warning';
  return 'info';
}
