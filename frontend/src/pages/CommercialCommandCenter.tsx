import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  BookOpen,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  LineChart,
  Network,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { commercialCommandCenterApi } from '../api';
import {
  AieroActionButton,
  AieroGhostButton,
  AieroLightPanel,
  AieroMetricCard,
  AieroNumberedStep,
  AieroPage,
  AieroPanel,
  AieroProgress,
} from '../components/AieroUX';
import {
  EmptyProductState,
  Field,
  Notice,
  ProductStatus,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';

type RecordMap = Record<string, unknown>;

const STAGES = [
  {
    id: 'assess',
    number: '1',
    title: 'Assess',
    detail: 'Read demand, blockers, customer signals, and data readiness before deciding the plan.',
  },
  {
    id: 'strategy_planning',
    number: '2',
    title: 'Plan',
    detail: 'Set the objective, audience, offer, channel plan, budget, owner, and expected result.',
  },
  {
    id: 'implementation_engagement',
    number: '3',
    title: 'Operate',
    detail: 'Coordinate campaigns, events, leads, follow-up, and learning until revenue is visible.',
  },
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

function statusTone(status: string): 'good' | 'warn' | 'muted' | 'info' {
  if (status === 'active') return 'good';
  if (status === 'future') return 'info';
  if (status === 'not_configured' || status === 'draft') return 'warn';
  if (status === 'paused') return 'info';
  return 'muted';
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

export default function CommercialCommandCenter() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [selectedType, setSelectedType] = useState('live_event');
  const [lineDashboard, setLineDashboard] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [planDraft, setPlanDraft] = useState(makePlanDraft());

  const revenueLines = useMemo(() => list(dashboard?.revenueLines), [dashboard]);
  const configuredRevenueLines = revenueLines.filter(line => Boolean(line.configured) && text(line.status) !== 'archived');
  const selectedLine = object(lineDashboard?.revenueLine || revenueLines.find(line => text(line.revenueLineType) === selectedType));
  const rollups = object(lineDashboard?.rollups);
  const rollupCurrency = text(rollups.currency, 'USD');
  const currencyBreakdown = list(rollups.currencyBreakdown);
  const dataStatus = object(lineDashboard?.dataStatus);
  const plans = list(lineDashboard?.plans);
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
        setMessage(err instanceof Error ? err.message : 'Could not load the Commercial Center.');
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load, token]);

  useEffect(() => {
    if (!token) return;
    const refresh = () => {
      load().catch(err => {
        setMessage(err instanceof Error ? err.message : 'Could not refresh the Commercial Center.');
      });
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
  }

  async function savePlan() {
    if (!token) return;
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
    <AieroPage
      eyebrow="Commercial Command Center"
      title="Run the commercial business lines, not only events."
      subtitle="Assess each revenue line, create plans, link events when needed, track real outcomes, and ask Stitchi to prepare governed work."
      action={(
        <>
          <AieroGhostButton onClick={() => navigate(stitchiPath())}>Ask Stitchi</AieroGhostButton>
          <AieroActionButton onClick={() => navigate('/events')}>Event Operations</AieroActionButton>
        </>
      )}
    >
      {message && (
        <Notice tone={message.toLowerCase().includes('could not') ? 'warn' : 'info'}>
          {message}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <AieroMetricCard
          label="Revenue target"
          value={loading ? '-' : rollupCurrency === 'mixed' ? 'Mixed currencies' : formatMoney(rollups.plannedRevenueTarget, rollupCurrency)}
          detail="Grouped by product/revenue line"
          accent="teal"
        />
        <AieroMetricCard
          label="Known revenue"
          value={loading ? '-' : rollupCurrency === 'mixed' ? 'Review by currency' : formatMoney(rollups.knownRevenue, rollupCurrency)}
          detail="From real lead/purchase records"
          accent="violet"
        />
        <AieroMetricCard
          label="Known spend"
          value={loading ? '-' : rollupCurrency === 'mixed' ? 'Review by currency' : formatMoney(rollups.knownSpend, rollupCurrency)}
          detail="From KPI/import records"
          accent="amber"
        />
        <AieroMetricCard label="Leads / purchases" value={loading ? '-' : `${numberValue(rollups.leads)} / ${numberValue(rollups.purchases)}`} detail={`${percent(rollups.leadToPurchaseRate)} conversion`} accent="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <AieroLightPanel
          title="Revenue lines"
          subtitle="Choose the business line you want to operate today."
        >
          <div className="space-y-3">
            {revenueLines.map(line => {
              const type = text(line.revenueLineType);
              const Icon = REVENUE_ICONS[type as keyof typeof REVENUE_ICONS] || Users;
              const status = text(line.status, 'not_configured');
              const future = text(line.availability) === 'future' && !line.configured;
              const active = type === selectedType;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => loadLine(type)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active ? 'border-neutral-950 bg-neutral-950 text-white shadow-lg' : 'border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-white text-neutral-950' : 'bg-white text-neutral-950'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{text(line.name, titleCase(type))}</span>
                      <span className={`mt-1 block text-xs leading-5 ${active ? 'text-white/62' : 'text-neutral-500'}`}>
                        {numberValue(line.planCount)} plans, {numberValue(line.openSignalCount)} signals
                      </span>
                    </span>
                    <ProductStatus tone={statusTone(future ? 'future' : status)}>
                      {future ? 'Future' : status === 'not_configured' ? 'Setup' : titleCase(status)}
                    </ProductStatus>
                  </div>
                </button>
              );
            })}
          </div>
        </AieroLightPanel>

        <AieroPanel
          title={text(selectedLine.name, 'Selected revenue line')}
          subtitle={text(selectedLine.description, 'Configure this revenue line and start planning.')}
          action={<ProductStatus tone={statusTone(text(selectedLine.availability) === 'future' && !selectedLine.configured ? 'future' : text(selectedLine.status, 'not_configured'))}>{text(selectedLine.availability) === 'future' && !selectedLine.configured ? 'Future line' : text(selectedLine.status) === 'not_configured' ? 'Needs setup' : titleCase(text(selectedLine.status))}</ProductStatus>}
        >
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1fr]">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-950">
                  <SelectedIcon className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white/62">Operating readiness</div>
                  <div className="mt-1 text-4xl font-semibold tracking-tight text-white">{readinessScore}%</div>
                </div>
              </div>
              <div className="mt-5">
                <AieroProgress value={readinessScore} />
              </div>
              <p className="mt-4 text-sm leading-6 text-white/54">
                Based on setup, linked operating work, KPI records, lead records, and planning coverage.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="Budget variance" value={rollupCurrency === 'mixed' ? 'Review by currency' : formatMoney(rollups.budgetVariance, rollupCurrency)} />
              <Fact label="Cost per lead" value={rollupCurrency === 'mixed' ? 'Review by currency' : formatMoney(rollups.costPerLead, rollupCurrency)} />
              <Fact label="Cost per purchase" value={rollupCurrency === 'mixed' ? 'Review by currency' : formatMoney(rollups.costPerPurchase, rollupCurrency)} />
              <Fact label="Meetings / no-shows" value={`${numberValue(rollups.meetingsBooked)} / ${numberValue(rollups.noShows)}`} />
            </div>
          </div>

          {text(selectedLine.status) === 'not_configured' && text(selectedLine.availability) !== 'future' && (
            <div className="mt-5">
              <AieroActionButton onClick={() => configureRevenueLine(selectedLine)} disabled={saving}>
                Configure this revenue line
              </AieroActionButton>
            </div>
          )}
          {text(selectedLine.status) === 'not_configured' && text(selectedLine.availability) === 'future' && (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/58">
              This revenue line is captured for future expansion. Ask Stitchi for discovery notes, but do not operate it as an active line until leadership enables it.
            </p>
          )}
        </AieroPanel>
      </div>

      <AieroPanel title="Three-stage workspace" subtitle="Use these stages to keep the commercial work focused and easy to explain.">
        <div className="grid gap-4 lg:grid-cols-3">
          {STAGES.map(stage => {
            const count = plans.filter(plan => text(plan.stage) === stage.id).length || numberValue(stageSummary[stage.id]);
            return (
              <AieroNumberedStep
                key={stage.id}
                number={stage.number}
                title={`${stage.title} (${count})`}
                detail={stage.detail}
                accent={stage.id === 'assess' ? 'blue' : stage.id === 'strategy_planning' ? 'violet' : 'teal'}
              />
            );
          })}
        </div>
      </AieroPanel>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <AieroLightPanel
          title={planDraft.id ? 'Edit commercial plan' : 'Create commercial plan'}
          subtitle="Keep the plan clear enough for a manager to run and for Stitchi to help with later."
          action={planDraft.id ? <SecondaryAction onClick={() => setPlanDraft(makePlanDraft(text(selectedLine.id)))}>New plan</SecondaryAction> : null}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Revenue line">
              <select
                value={planDraft.revenueLineId || text(selectedLine.id)}
                onChange={event => setPlanDraft(current => ({ ...current, revenueLineId: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">Choose configured line</option>
                {configuredRevenueLines.map(line => (
                  <option key={text(line.id)} value={text(line.id)}>{text(line.name)}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={planDraft.status}
                onChange={event => setPlanDraft(current => ({ ...current, status: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Plan title">
              <input
                value={planDraft.title}
                onChange={event => setPlanDraft(current => ({ ...current, title: event.target.value }))}
                placeholder="Example: Q3 online course growth plan"
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Linked event">
              <select
                value={planDraft.linkedEventId}
                onChange={event => setPlanDraft(current => ({ ...current, linkedEventId: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">No event linked</option>
                {eventChoices.map(event => (
                  <option key={text(event.id)} value={text(event.id)}>
                    {text(event.name)} - {titleCase(text(event.status, 'draft'))}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Link this commercial plan to the event it supports. Event execution stays in Event Operations.
              </p>
            </Field>
            <Field label="Horizon">
              <select
                value={planDraft.horizon}
                onChange={event => setPlanDraft(current => ({ ...current, horizon: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="quarterly">Quarterly</option>
                <option value="product_or_event">Product or event</option>
                <option value="one_year">One year</option>
                <option value="three_year">Three year</option>
              </select>
            </Field>
            <Field label="Plan currency">
              <select
                value={planDraft.currency}
                onChange={event => setPlanDraft(current => ({ ...current, currency: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                {PLAN_CURRENCIES.map(option => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select
                value={planDraft.stage}
                onChange={event => setPlanDraft(current => ({ ...current, stage: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="assess">Assess</option>
                <option value="strategy_planning">Strategy & Planning</option>
                <option value="implementation_engagement">Implementation & Engagement</option>
              </select>
            </Field>
            <Field label="Budget target">
              <input
                value={planDraft.budgetTarget}
                onChange={event => setPlanDraft(current => ({ ...current, budgetTarget: event.target.value }))}
                type="number"
                min="0"
                placeholder="0"
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Revenue target">
              <input
                value={planDraft.revenueTarget}
                onChange={event => setPlanDraft(current => ({ ...current, revenueTarget: event.target.value }))}
                type="number"
                min="0"
                placeholder="0"
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Objective">
              <textarea
                value={planDraft.objective}
                onChange={event => setPlanDraft(current => ({ ...current, objective: event.target.value }))}
                placeholder="What outcome should this plan create?"
                rows={3}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Audience">
              <textarea
                value={planDraft.audience}
                onChange={event => setPlanDraft(current => ({ ...current, audience: event.target.value }))}
                placeholder="Who is this plan for?"
                rows={2}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Action plan">
              <textarea
                value={planDraft.actionPlan}
                onChange={event => setPlanDraft(current => ({ ...current, actionPlan: event.target.value }))}
                placeholder="What will the team do next?"
                rows={3}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <AieroActionButton onClick={savePlan} disabled={saving || !text(selectedLine.id)}>
              {saving ? 'Saving...' : planDraft.id ? 'Save changes' : 'Create plan'}
            </AieroActionButton>
            <SecondaryAction onClick={() => navigate(stitchiPath('Prepare a commercial plan for this revenue line.'))}>Ask Stitchi to prepare</SecondaryAction>
          </div>
        </AieroLightPanel>

        <AieroLightPanel title="Planning records" subtitle="Click a plan to edit it. These are internal operating records, not external execution.">
          {plans.length ? (
            <div className="space-y-3">
              {plans.map(plan => (
                <button
                  key={text(plan.id)}
                  type="button"
                  onClick={() => editPlan(plan)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    text(plan.id) === planDraft.id ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{text(plan.title, 'Untitled plan')}</div>
                      <div className={`mt-1 text-sm ${text(plan.id) === planDraft.id ? 'text-white/62' : 'text-neutral-500'}`}>
                        {stageLabel(text(plan.stage))} - {titleCase(text(plan.horizon))}
                      </div>
                    </div>
                    <ProductStatus tone={statusTone(text(plan.status))}>{titleCase(text(plan.status))}</ProductStatus>
                  </div>
                  <div className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${text(plan.id) === planDraft.id ? 'text-white/58' : 'text-neutral-500'}`}>
                    <span>Budget: {formatMoney(plan.budgetTarget, text(plan.currency, 'USD'))}</span>
                    <span>Target: {formatMoney(plan.revenueTarget, text(plan.currency, 'USD'))}</span>
                  </div>
                  <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${text(plan.id) === planDraft.id ? 'bg-white/10 text-white/70' : 'bg-white text-neutral-500'}`}>
                    {text(plan.linkedEventName)
                      ? `Supports event: ${customerLabel(plan.linkedEventName)}`
                      : 'No event linked yet'}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyProductState
              title="No plans yet"
              message="Create the first commercial plan for this revenue line. Plans are where objectives, budgets, audiences, and execution stage become clear."
            />
          )}
        </AieroLightPanel>
      </div>

      {currencyBreakdown.length > 0 && (
        <AieroLightPanel title="Currency view" subtitle="Targets are shown by product/revenue line and currency. Tanaghum does not convert currencies without an approved finance rule.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {currencyBreakdown.map(row => (
              <div key={text(row.currency)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{text(row.currency)}</div>
                <div className="mt-2 text-xl font-semibold text-neutral-950">{formatMoney(row.plannedRevenueTarget, text(row.currency))}</div>
                <div className="mt-1 text-sm text-neutral-500">Revenue target across {numberValue(row.planCount)} plan(s)</div>
                <div className="mt-3 text-sm text-neutral-700">Budget: {formatMoney(row.plannedBudget, text(row.currency))}</div>
              </div>
            ))}
          </div>
        </AieroLightPanel>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AieroLightPanel
          title="Operating bridge"
          subtitle="Events remain the detailed operating workspace. The Commercial Center shows how those events support revenue lines."
          action={<SecondaryAction onClick={() => navigate('/events')}>Open events</SecondaryAction>}
        >
          {linkedEvents.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {linkedEvents.slice(0, 6).map(event => (
                <div key={text(event.id)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-950">{customerLabel(event.name, 'Linked live event')}</div>
                      <div className="mt-1 text-sm text-neutral-500">{dateLabel(event.eventDate)}</div>
                    </div>
                    <ProductStatus tone={statusTone(text(event.status))}>{titleCase(text(event.status))}</ProductStatus>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-neutral-500">
                    <span>Budget: {formatMoney(event.plannedBudget, rollupCurrency)}</span>
                    <span>Target: {formatMoney(event.revenueTarget, rollupCurrency)}</span>
                  </div>
                  <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-neutral-500">
                    {numberValue(event.linkedPlanCount)} supporting plan{numberValue(event.linkedPlanCount) === 1 ? '' : 's'}
                    {Array.isArray(event.linkedPlanTitles) && event.linkedPlanTitles.length ? (
                      <span className="mt-1 block font-medium text-neutral-700">
                        {(event.linkedPlanTitles as string[]).slice(0, 2).join(', ')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyProductState
              title="No operating work linked yet"
              message="Link an event or campaign when this revenue line has execution activity. Until then, the dashboard will stay in planning mode."
              action={<SecondaryAction onClick={() => navigate('/events')}>Go to events</SecondaryAction>}
            />
          )}
        </AieroLightPanel>

        <AieroPanel title="Next best action" subtitle="Based on setup, planning records, linked events, data, and lead flow.">
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950">
                <LineChart className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white">{text(nextAction.label, 'Review this revenue line')}</div>
                <p className="mt-2 text-sm leading-6 text-white/58">{text(nextAction.description, 'Ask Stitchi to summarize the next commercial action from available records.')}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <AieroActionButton onClick={() => navigate(text(nextAction.path, '/stitchi'))}>Do next action</AieroActionButton>
              <AieroGhostButton onClick={() => navigate(stitchiPath())}>Ask Stitchi</AieroGhostButton>
            </div>
          </div>

          {missing.length > 0 && (
            <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-semibold text-white">Missing data sources</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/56">
                {missing.map(item => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          )}
        </AieroPanel>
      </div>

      {openSignals.length > 0 && (
        <AieroLightPanel title="Open commercial signals" subtitle="Signals explain what may block growth or needs management attention.">
          <div className="grid gap-3 lg:grid-cols-2">
            {openSignals.map(signal => (
              <div key={text(signal.id)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-950">{text(signal.title)}</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      {text(signal.recommendedAction, text(signal.finding, 'Review and assign next action.'))}
                    </p>
                  </div>
                  <ProductStatus tone={text(signal.severity) === 'critical' ? 'danger' : text(signal.severity) === 'risk' ? 'warn' : 'info'}>
                    {titleCase(text(signal.severity))}
                  </ProductStatus>
                </div>
              </div>
            ))}
          </div>
        </AieroLightPanel>
      )}
    </AieroPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/42">{label}</div>
      <div className="mt-2 break-words text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
