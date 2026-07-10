import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  HeartHandshake,
  Network,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { commercialCommandCenterApi } from '../api';
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
import './CommercialR1D.css';

type RecordMap = Record<string, unknown>;

const STAGES = [
  { id: 'assess', number: '1', title: 'Assess', detail: 'Review demand, blockers, customer signals, and data readiness.' },
  { id: 'strategy_planning', number: '2', title: 'Strategy & Planning', detail: 'Set the objective, audience, offer, channels, budget, and expected result.' },
  { id: 'implementation_engagement', number: '3', title: 'Implementation & Engagement', detail: 'Coordinate campaigns, leads, follow-up, and learning until revenue is visible.' },
] as const;

const REVENUE_ICONS = {
  live_event: CalendarDays,
  online_course: GraduationCap,
  book: BookOpen,
  merchandise: ShoppingBag,
  b2b: BriefcaseBusiness,
  platinum_elite: Sparkles,
  certified_trainer_network: Network,
  loyalty_community: HeartHandshake,
};

const PLAN_CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'AED', label: 'AED - UAE Dirham' },
] as const;

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function object(value: unknown): RecordMap {
  return value && typeof value === 'object' ? value as RecordMap : {};
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function customerLabel(value: unknown, fallback = ''): string {
  const raw = text(value, fallback);
  if (/^Sprint\s*\d+\s+Acceptance\s+Event/i.test(raw)) return 'Linked live event';
  if (/^Sprint\s*\d+\s+Acceptance\s+Lead/i.test(raw)) return 'Captured lead';
  return raw
    .replace(/\bSprint\s*\d+\s+Acceptance\s*/gi, '')
    .replace(/\bSprint\s*\d+\b/gi, 'this launch')
    .replace(/\bAcceptance\s+(Event|Lead|Truth)\b/gi, '$1')
    .trim();
}

function maybeText(value: unknown): string | undefined {
  const safe = text(value);
  return safe || undefined;
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

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(status: string): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  if (status === 'active' || status === 'completed') return 'positive';
  if (status === 'not_configured' || status === 'draft') return 'warning';
  if (status === 'blocked' || status === 'critical') return 'danger';
  if (status === 'paused' || status === 'future') return 'info';
  return 'neutral';
}

function formatMoney(value: unknown, currency?: string): string {
  const parsed = nullableNumber(value);
  return parsed == null ? 'Not available' : formatCurrency(parsed, currency === 'AED' || currency === 'USD' ? currency : undefined);
}

function percent(value: unknown): string {
  const parsed = nullableNumber(value);
  return parsed == null ? 'Not available' : `${parsed.toFixed(parsed % 1 === 0 ? 0 : 1)}%`;
}

function dateLabel(value: unknown): string {
  const raw = text(value);
  if (!raw) return 'Date not set';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function stageLabel(stage: string): string {
  if (stage === 'strategy_planning') return 'Strategy & Planning';
  if (stage === 'implementation_engagement') return 'Implementation & Engagement';
  return titleCase(stage || 'assess');
}

function makePlanDraft(lineId = '') {
  return {
    id: '',
    revenueLineId: lineId,
    linkedEventId: '',
    title: '',
    horizon: 'quarterly',
    stage: 'strategy_planning',
    status: 'draft',
    currency: 'USD',
    objective: '',
    audience: '',
    budgetTarget: '',
    revenueTarget: '',
    strategySummary: '',
    actionPlan: '',
  };
}

function normalizeRoleFromUser(user: unknown): string {
  if (!user || typeof user !== 'object') return 'unknown';
  const value = (user as RecordMap).role;
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_')
    : 'unknown';
}

export default function CommercialCommandCenter() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const userRole = normalizeRoleFromUser(user);
  const canManagePlans = ['admin', 'cco', 'department_head'].includes(userRole);
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [selectedType, setSelectedType] = useState('live_event');
  const [lineDashboard, setLineDashboard] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [planDraft, setPlanDraft] = useState(makePlanDraft());

  const revenueLines = useMemo(() => list(dashboard?.revenueLines), [dashboard]);
  const configuredRevenueLines = revenueLines.filter(line => Boolean(line.configured) && text(line.status) !== 'archived');
  const activeRevenueLines = revenueLines.filter(line => text(line.availability) !== 'future' && text(line.status) !== 'archived');
  const futureRevenueLines = revenueLines.filter(line => text(line.availability) === 'future' && text(line.status) !== 'archived');
  const selectedLine = object(lineDashboard?.revenueLine || revenueLines.find(line => text(line.revenueLineType) === selectedType));
  const rollups = object(lineDashboard?.rollups);
  const rollupCurrency = text(rollups.currency, 'USD');
  const currencyBreakdown = list(rollups.currencyBreakdown);
  const dataStatus = object(lineDashboard?.dataStatus);
  const plans = list(lineDashboard?.plans);
  const primaryPlan = plans.find(plan => text(plan.status) === 'active') || plans[0] || {};
  const linkedEvents = list(lineDashboard?.linkedEvents);
  const availableEvents = list(lineDashboard?.availableEvents);
  const eventChoices = availableEvents.length ? availableEvents : linkedEvents;
  const openSignals = list(lineDashboard?.openSignals);
  const nextAction = object(lineDashboard?.nextAction);
  const stageSummary = dashboard?.stageSummary && typeof dashboard.stageSummary === 'object' ? dashboard.stageSummary as RecordMap : {};

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    const main = await commercialCommandCenterApi.dashboard(token) as RecordMap;
    setDashboard(main);
    const lines = list(main.revenueLines);
    const targetType = lines.some(line => text(line.revenueLineType) === selectedType)
      ? selectedType
      : text(lines[0]?.revenueLineType, 'live_event');
    setSelectedType(targetType);
    const detail = await commercialCommandCenterApi.revenueLineDashboard(targetType, token) as RecordMap;
    setLineDashboard(detail);
    setPlanDraft(current => current.revenueLineId ? current : makePlanDraft(text(object(detail.revenueLine).id)));
    setLoading(false);
  }, [selectedType, token]);

  const loadLine = useCallback(async (revenueLineType: string) => {
    if (!token) return;
    setSelectedType(revenueLineType);
    setMessage('');
    const detail = await commercialCommandCenterApi.revenueLineDashboard(revenueLineType, token) as RecordMap;
    setLineDashboard(detail);
    setPlanDraft(makePlanDraft(text(object(detail.revenueLine).id)));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const loadTimer = window.setTimeout(() => {
      load().catch(err => {
        setMessage(err instanceof Error ? err.message : 'Could not load commercial plans.');
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load, token]);

  useEffect(() => {
    if (!token) return;
    const refresh = () => {
      load().catch(err => setMessage(err instanceof Error ? err.message : 'Could not refresh commercial plans.'));
    };
    window.addEventListener('tanaghum:commercial-data-changed', refresh);
    return () => window.removeEventListener('tanaghum:commercial-data-changed', refresh);
  }, [load, token]);

  function stitchiPath(prompt?: string): string {
    const params = new URLSearchParams();
    if (text(selectedLine.id)) params.set('revenueLineId', text(selectedLine.id));
    if (text(selectedLine.revenueLineType, selectedType)) params.set('revenueLineType', text(selectedLine.revenueLineType, selectedType));
    if (prompt) {
      params.set('prompt', prompt);
      params.set('mode', 'prepare');
    }
    const query = params.toString();
    return `/stitchi${query ? `?${query}` : ''}`;
  }

  async function configureRevenueLine(line: RecordMap) {
    if (!token) return;
    if (!canManagePlans) {
      setMessage('Ask Stitchi to prepare this work for leadership approval. Direct setup is limited to workspace leaders.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const created = await commercialCommandCenterApi.createRevenueLine({
        revenueLineType: text(line.revenueLineType),
        name: text(line.name, titleCase(text(line.revenueLineType))),
        description: maybeText(line.description),
      }, token) as RecordMap;
      setSelectedType(text(created.revenueLineType));
      await loadLine(text(created.revenueLineType));
      setMessage(`${text(created.name, 'Revenue line')} is ready for planning.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not configure revenue line.');
    } finally {
      setSaving(false);
    }
  }

  function editPlan(plan: RecordMap) {
    if (!canManagePlans) return;
    setPlanDraft({
      id: text(plan.id),
      revenueLineId: text(plan.revenueLineId),
      linkedEventId: text(plan.linkedEventId),
      title: text(plan.title),
      horizon: text(plan.horizon, 'quarterly'),
      stage: text(plan.stage, 'strategy_planning'),
      status: text(plan.status, 'draft'),
      currency: text(plan.currency, 'USD'),
      objective: text(plan.objective),
      audience: text(plan.audience),
      budgetTarget: nullableNumber(plan.budgetTarget)?.toString() || '',
      revenueTarget: nullableNumber(plan.revenueTarget)?.toString() || '',
      strategySummary: text(plan.strategySummary),
      actionPlan: text(plan.actionPlan),
    });
    document.getElementById('commercial-plan-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function savePlan() {
    if (!token) return;
    if (!canManagePlans) {
      setMessage('Ask Stitchi to prepare this plan for leadership approval. Direct editing is limited to workspace leaders.');
      return;
    }
    setMessage('');
    if (!planDraft.revenueLineId || !planDraft.title.trim()) {
      setMessage('Choose a revenue line and enter a clear plan title.');
      return;
    }
    setSaving(true);
    const payload = {
      revenueLineId: planDraft.revenueLineId,
      linkedEventId: planDraft.linkedEventId || null,
      title: planDraft.title.trim(),
      horizon: planDraft.horizon,
      stage: planDraft.stage,
      status: planDraft.status,
      currency: planDraft.currency,
      objective: planDraft.objective || null,
      audience: planDraft.audience || null,
      budgetTarget: planDraft.budgetTarget ? Number(planDraft.budgetTarget) : null,
      revenueTarget: planDraft.revenueTarget ? Number(planDraft.revenueTarget) : null,
      strategySummary: planDraft.strategySummary || null,
      actionPlan: planDraft.actionPlan || null,
    };
    try {
      if (planDraft.id) {
        await commercialCommandCenterApi.updatePlan(planDraft.id, payload, token);
        await loadLine(selectedType);
        setMessage('Commercial plan updated.');
      } else {
        await commercialCommandCenterApi.createPlan(payload, token);
        await loadLine(selectedType);
        setMessage('Commercial plan created.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save commercial plan.');
    } finally {
      setSaving(false);
    }
  }

  const readinessScore = [
    Boolean(selectedLine.configured),
    Boolean(dataStatus.hasLinkedEvents),
    Boolean(dataStatus.hasKpiRecords),
    Boolean(dataStatus.hasLeadRecords),
    Boolean(plans.length),
  ].filter(Boolean).length * 20;
  const missing = Array.isArray(dataStatus.missingDataSources) ? dataStatus.missingDataSources as string[] : [];
  const selectedTypeKey = text(selectedLine.revenueLineType, selectedType) as keyof typeof REVENUE_ICONS;
  const SelectedIcon = REVENUE_ICONS[selectedTypeKey] || Target;

  return (
    <OpsPage className="commercial-r1d-page commercial-plans-page">
      <OpsPageHeader
        eyebrow="Strategy & Planning"
        title="Commercial Plans"
        subtitle="Turn leadership priorities into approved plans for each active product and revenue line."
        actions={(
          <>
            <button className="ops-button is-secondary" type="button" onClick={() => navigate(stitchiPath())}><Sparkles size={17} aria-hidden="true" />Ask Stitchi</button>
            <button className="ops-button is-primary" type="button" onClick={() => {
              setPlanDraft(makePlanDraft(text(selectedLine.id)));
              document.getElementById('commercial-plan-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}><Plus size={17} aria-hidden="true" />Create plan</button>
          </>
        )}
      />

      <CommercialWorkspaceNav />

      {message ? <OpsNotice tone={message.toLowerCase().includes('could not') ? 'danger' : 'info'}>{message}</OpsNotice> : null}

      {loading ? (
        <div className="commercial-r1d-loading"><OpsSkeleton rows={4} /><OpsSkeleton rows={4} /></div>
      ) : (
        <>
          <div className="commercial-plan-overview">
            <OpsSection title="Revenue lines" subtitle="Daily work shows active lines first." action={<Search size={18} aria-hidden="true" />} className="commercial-revenue-list">
              <div className="commercial-list-label"><span>Active now</span><strong>{activeRevenueLines.length}</strong></div>
              <div className="commercial-revenue-rows">
                {activeRevenueLines.map(line => (
                  <RevenueLineButton key={text(line.revenueLineType)} line={line} selected={text(line.revenueLineType) === selectedType} onClick={() => loadLine(text(line.revenueLineType))} />
                ))}
              </div>
              {futureRevenueLines.length ? (
                <details className="commercial-future-lines">
                  <summary>Future revenue lines <span>{futureRevenueLines.length}</span></summary>
                  <div>{futureRevenueLines.map(line => <button key={text(line.revenueLineType)} type="button" onClick={() => loadLine(text(line.revenueLineType))}>{text(line.name, titleCase(text(line.revenueLineType)))}</button>)}</div>
                </details>
              ) : null}
            </OpsSection>

            <OpsSection
              title={customerLabel(primaryPlan.title, text(selectedLine.name, 'Selected revenue line'))}
              subtitle={`${text(selectedLine.name, titleCase(selectedType))} / ${primaryPlan.id ? stageLabel(text(primaryPlan.stage)) : 'Planning setup'}`}
              action={<OpsStatus tone={statusTone(text(primaryPlan.status, text(selectedLine.status, 'draft')))}>{titleCase(text(primaryPlan.status, text(selectedLine.status, 'draft')))}</OpsStatus>}
              className="commercial-plan-summary"
            >
              <div className="commercial-plan-summary-head">
                <span className="commercial-selected-icon"><SelectedIcon size={21} aria-hidden="true" /></span>
                <div><small>Operating readiness</small><strong>{readinessScore}%</strong><span><i style={{ width: `${readinessScore}%` }} /></span></div>
                {text(selectedLine.status) === 'not_configured' && text(selectedLine.availability) !== 'future' ? (
                  <button className="ops-button is-secondary" type="button" onClick={() => configureRevenueLine(selectedLine)} disabled={saving}>{canManagePlans ? 'Set up line' : 'Request setup'}</button>
                ) : null}
              </div>

              <div className="commercial-plan-facts">
                <MetricFact label="Revenue target" value={formatMoney(primaryPlan.revenueTarget ?? rollups.plannedRevenueTarget, text(primaryPlan.currency, rollupCurrency))} detail={`Known revenue: ${formatMoney(rollups.knownRevenue, rollupCurrency)}`} />
                <MetricFact label="Budget target" value={formatMoney(primaryPlan.budgetTarget ?? rollups.plannedBudget, text(primaryPlan.currency, rollupCurrency))} detail={`Known spend: ${formatMoney(rollups.knownSpend, rollupCurrency)}`} />
                <MetricFact label="Leads and purchases" value={`${numberValue(rollups.leads)} / ${numberValue(rollups.purchases)}`} detail={`${percent(rollups.leadToPurchaseRate)} conversion`} />
              </div>

              <div className="commercial-stage-flow">
                {STAGES.map((stage, index) => {
                  const active = text(primaryPlan.stage, 'strategy_planning') === stage.id;
                  const complete = stage.id === 'assess' && text(primaryPlan.stage) !== 'assess';
                  const count = plans.filter(plan => text(plan.stage) === stage.id).length || numberValue(stageSummary[stage.id]);
                  return (
                    <div className={active ? 'is-active' : complete ? 'is-complete' : ''} key={stage.id}>
                      <span>{complete ? <CheckCircle2 size={17} aria-hidden="true" /> : index + 1}</span>
                      <div><strong>{stage.title}</strong><small>{count} record{count === 1 ? '' : 's'} / {active ? 'Current stage' : stage.detail}</small></div>
                    </div>
                  );
                })}
              </div>

              <div className="commercial-next-decision">
                <span><Target size={20} aria-hidden="true" /></span>
                <div><small>Next required action</small><strong>{text(nextAction.label, plans.length ? 'Review the current commercial plan' : 'Create the first commercial plan')}</strong><p>{text(nextAction.description, 'Confirm the objective, audience, budget, revenue target, and owner before implementation begins.')}</p></div>
                <button className="ops-button is-primary" type="button" onClick={() => navigate(text(nextAction.path, stitchiPath()))}>Take action</button>
              </div>
            </OpsSection>
          </div>

          <section className="commercial-event-boundary">
            <span><CalendarDays size={21} aria-hidden="true" /></span>
            <div><strong>Continue in Event Operations</strong><p>Commercial Plans sets targets and direction. Event Operations manages logistics, event KPIs, leads, risks, and closeout in its own workspace.</p></div>
            <button className="ops-button is-secondary" type="button" onClick={() => navigate('/events')}>Open Event Operations <ArrowRight size={16} aria-hidden="true" /></button>
          </section>

          <div className="commercial-kpi-strip" aria-label="Selected revenue line performance">
            <CompactMetric label="Known revenue" value={formatMoney(rollups.knownRevenue, rollupCurrency)} detail="Verified purchase records" />
            <CompactMetric label="Known spend" value={formatMoney(rollups.knownSpend, rollupCurrency)} detail="KPI and import records" />
            <CompactMetric label="Cost per lead" value={formatMoney(rollups.costPerLead, rollupCurrency)} detail="When spend and leads exist" />
            <CompactMetric label="Meetings / no-shows" value={`${numberValue(rollups.meetingsBooked)} / ${numberValue(rollups.noShows)}`} detail="Lead lifecycle records" />
          </div>

          <div className="commercial-plan-workspace" id="commercial-plan-editor">
            <OpsSection
              title={canManagePlans ? (planDraft.id ? 'Edit commercial plan' : 'Create commercial plan') : 'Prepare a plan request'}
              subtitle={canManagePlans ? 'Capture the information the team needs to run this plan.' : 'Ask Stitchi to prepare a governed proposal for leadership approval.'}
              action={canManagePlans && planDraft.id ? <button className="ops-button is-secondary" type="button" onClick={() => setPlanDraft(makePlanDraft(text(selectedLine.id)))}>New plan</button> : undefined}
            >
              {canManagePlans ? (
                <div className="commercial-form">
                  <div className="commercial-form-grid">
                    <Field label="Revenue line"><select value={planDraft.revenueLineId || text(selectedLine.id)} onChange={event => setPlanDraft(current => ({ ...current, revenueLineId: event.target.value }))}><option value="">Choose configured line</option>{configuredRevenueLines.map(line => <option key={text(line.id)} value={text(line.id)}>{text(line.name)}</option>)}</select></Field>
                    <Field label="Plan title"><input value={planDraft.title} onChange={event => setPlanDraft(current => ({ ...current, title: event.target.value }))} placeholder="Example: Q3 book launch plan" /></Field>
                    <Field label="Linked event"><select value={planDraft.linkedEventId} onChange={event => setPlanDraft(current => ({ ...current, linkedEventId: event.target.value }))}><option value="">No event linked</option>{eventChoices.map(event => <option key={text(event.id)} value={text(event.id)}>{customerLabel(event.name)} - {titleCase(text(event.status, 'draft'))}</option>)}</select><p>Use this only when the commercial plan supports a live event. Event execution stays in Event Operations.</p></Field>
                    <Field label="Stage"><select value={planDraft.stage} onChange={event => setPlanDraft(current => ({ ...current, stage: event.target.value }))}><option value="assess">Assess</option><option value="strategy_planning">Strategy & Planning</option><option value="implementation_engagement">Implementation & Engagement</option></select></Field>
                    <Field label="Horizon"><select value={planDraft.horizon} onChange={event => setPlanDraft(current => ({ ...current, horizon: event.target.value }))}><option value="quarterly">Quarterly</option><option value="product_or_event">Product or event</option><option value="one_year">One year</option><option value="three_year">Three year</option></select></Field>
                    <Field label="Status"><select value={planDraft.status} onChange={event => setPlanDraft(current => ({ ...current, status: event.target.value }))}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option></select></Field>
                    <Field label="Currency"><select value={planDraft.currency} onChange={event => setPlanDraft(current => ({ ...current, currency: event.target.value }))}>{PLAN_CURRENCIES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}</select></Field>
                    <Field label="Budget target"><input value={planDraft.budgetTarget} onChange={event => setPlanDraft(current => ({ ...current, budgetTarget: event.target.value }))} type="number" min="0" placeholder="0" /></Field>
                    <Field label="Revenue target"><input value={planDraft.revenueTarget} onChange={event => setPlanDraft(current => ({ ...current, revenueTarget: event.target.value }))} type="number" min="0" placeholder="0" /></Field>
                  </div>
                  <Field label="Objective"><textarea value={planDraft.objective} onChange={event => setPlanDraft(current => ({ ...current, objective: event.target.value }))} placeholder="What outcome should this plan create?" rows={3} /></Field>
                  <Field label="Audience"><textarea value={planDraft.audience} onChange={event => setPlanDraft(current => ({ ...current, audience: event.target.value }))} placeholder="Who is this plan for?" rows={2} /></Field>
                  <Field label="Strategy summary"><textarea value={planDraft.strategySummary} onChange={event => setPlanDraft(current => ({ ...current, strategySummary: event.target.value }))} placeholder="What strategic direction should guide the work?" rows={3} /></Field>
                  <Field label="Action plan"><textarea value={planDraft.actionPlan} onChange={event => setPlanDraft(current => ({ ...current, actionPlan: event.target.value }))} placeholder="What will the team do next?" rows={3} /></Field>
                  <div className="ops-inline-actions"><button className="ops-button is-primary" type="button" onClick={savePlan} disabled={saving || !text(selectedLine.id)}>{saving ? 'Saving...' : planDraft.id ? 'Save changes' : 'Create plan'}</button><button className="ops-button is-secondary" type="button" onClick={() => navigate(stitchiPath('Prepare a commercial plan for this revenue line.'))}><Sparkles size={16} aria-hidden="true" />Ask Stitchi to prepare</button></div>
                </div>
              ) : (
                <OpsEmpty title="Ask Stitchi to prepare the plan" message="Stitchi can collect the objective, audience, budget, revenue target, action plan, and event link, then prepare an approval card. Nothing is saved until a manager approves it." action={<button className="ops-button is-primary" type="button" onClick={() => navigate(stitchiPath('Prepare a commercial plan for this revenue line.'))}>Ask Stitchi</button>} />
              )}
            </OpsSection>

            <OpsSection title="Planning records" subtitle={canManagePlans ? 'Choose a plan to review or edit it.' : 'Review active plans and ask Stitchi to prepare changes.'}>
              {plans.length ? (
                <div className="commercial-plan-list">
                  {plans.map(plan => (
                    <button key={text(plan.id)} type="button" onClick={() => editPlan(plan)} disabled={!canManagePlans} className={text(plan.id) === planDraft.id ? 'is-selected' : ''}>
                      <div><strong>{customerLabel(plan.title, 'Untitled plan')}</strong><small>{stageLabel(text(plan.stage))} / {titleCase(text(plan.horizon))}</small></div>
                      <OpsStatus tone={statusTone(text(plan.status))}>{titleCase(text(plan.status))}</OpsStatus>
                      <dl><div><dt>Budget</dt><dd>{formatMoney(plan.budgetTarget, text(plan.currency, 'USD'))}</dd></div><div><dt>Target</dt><dd>{formatMoney(plan.revenueTarget, text(plan.currency, 'USD'))}</dd></div></dl>
                      <p>{text(plan.linkedEventName) ? `Supports event: ${customerLabel(plan.linkedEventName)}` : 'No event linked'}</p>
                    </button>
                  ))}
                </div>
              ) : <OpsEmpty title="No plans yet" message="Create the first plan for this revenue line to connect objectives, budgets, audience, and operating work." />}
            </OpsSection>
          </div>

          {currencyBreakdown.length ? (
            <OpsSection title="Currency view" subtitle="Targets remain separated by currency. Tanaghum never performs an unapproved conversion.">
              <div className="commercial-currency-grid">{currencyBreakdown.map(row => <article key={text(row.currency)}><span>{text(row.currency)}</span><strong>{formatMoney(row.plannedRevenueTarget, text(row.currency))}</strong><p>Revenue target across {numberValue(row.planCount)} plan(s)</p><small>Budget: {formatMoney(row.plannedBudget, text(row.currency))}</small></article>)}</div>
            </OpsSection>
          ) : null}

          <div className="commercial-bottom-grid">
            <OpsSection title="Linked event operations" subtitle="Commercial plans set direction; event teams manage operational execution." action={<button className="ops-button is-secondary" type="button" onClick={() => navigate('/events')}>Open Event Operations</button>}>
              {linkedEvents.length ? <div className="commercial-event-list">{linkedEvents.slice(0, 6).map(event => <article key={text(event.id)}><div><strong>{customerLabel(event.name, 'Linked live event')}</strong><small>{dateLabel(event.eventDate)}</small></div><OpsStatus tone={statusTone(text(event.status))}>{titleCase(text(event.status))}</OpsStatus><p>{numberValue(event.linkedPlanCount)} supporting plan{numberValue(event.linkedPlanCount) === 1 ? '' : 's'}</p></article>)}</div> : <OpsEmpty title="No event linked" message="Link an existing event only when this revenue line needs event execution. Otherwise the plan remains commercial work." action={<button className="ops-button is-secondary" type="button" onClick={() => navigate('/events')}>Open Event Operations</button>} />}
            </OpsSection>

            <OpsSection title="Data and planning readiness" subtitle="Missing customer data is shown honestly and never replaced with estimates.">
              <div className="commercial-readiness-list">
                <ReadinessRow label="Commercial plan" ready={plans.length > 0} />
                <ReadinessRow label="Linked operating work" ready={Boolean(dataStatus.hasLinkedEvents)} />
                <ReadinessRow label="Performance data" ready={Boolean(dataStatus.hasKpiRecords)} />
                <ReadinessRow label="Lead outcomes" ready={Boolean(dataStatus.hasLeadRecords)} />
              </div>
              {missing.length ? <div className="commercial-missing-data"><CircleAlert size={18} aria-hidden="true" /><div><strong>Data sources still needed</strong><ul>{missing.map(item => <li key={item}>{item}</li>)}</ul></div></div> : null}
            </OpsSection>
          </div>

          {openSignals.length ? (
            <OpsSection title="Open commercial signals" subtitle="Current risks and opportunities that need ownership.">
              <div className="commercial-signal-list">{openSignals.map(signal => <article key={text(signal.id)}><div><strong>{text(signal.title)}</strong><p>{text(signal.recommendedAction, text(signal.finding, 'Review and assign the next action.'))}</p></div><OpsStatus tone={statusTone(text(signal.severity))}>{titleCase(text(signal.severity))}</OpsStatus></article>)}</div>
            </OpsSection>
          ) : null}
        </>
      )}
    </OpsPage>
  );
}

function RevenueLineButton({ line, selected, onClick }: { line: RecordMap; selected: boolean; onClick: () => void }) {
  const type = text(line.revenueLineType);
  const Icon = REVENUE_ICONS[type as keyof typeof REVENUE_ICONS] || Users;
  return (
    <button className={selected ? 'is-selected' : ''} type="button" onClick={onClick}>
      <span><Icon size={18} aria-hidden="true" /></span>
      <span><strong>{text(line.name, titleCase(type))}</strong><small>{numberValue(line.planCount)} plan{numberValue(line.planCount) === 1 ? '' : 's'} / {numberValue(line.openSignalCount)} signal{numberValue(line.openSignalCount) === 1 ? '' : 's'}</small></span>
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

function MetricFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function CompactMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return <div><span className={ready ? 'is-ready' : ''}>{ready ? <CheckCircle2 size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}</span><strong>{label}</strong><small>{ready ? 'Ready' : 'Needs attention'}</small></div>;
}
