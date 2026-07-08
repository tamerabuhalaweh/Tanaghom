import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, BriefcaseBusiness, CalendarDays, GraduationCap, HeartHandshake, Network, Sparkles, Users } from 'lucide-react';
import { commercialCommandCenterApi } from '../api';
import {
  AieroActionButton,
  AieroGhostButton,
  AieroIconTile,
  AieroLightPanel,
  AieroMetricCard,
  AieroNumberedStep,
  AieroPage,
  AieroPanel,
} from '../components/AieroUX';
import { ProductStatus, SecondaryAction } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

const STAGES = [
  {
    id: 'assess',
    number: '1',
    title: 'Assess',
    detail: 'Understand current demand, sales blockers, audience signals, and data readiness.',
  },
  {
    id: 'strategy_planning',
    number: '2',
    title: 'Strategy & Planning',
    detail: 'Shape offers, audience plans, channels, budgets, content needs, and sales workflow.',
  },
  {
    id: 'implementation_engagement',
    number: '3',
    title: 'Implementation & Engagement',
    detail: 'Operate campaigns, track leads, coordinate follow-up, and prepare closeout learning.',
  },
] as const;

const REVENUE_ICONS = {
  live_event: CalendarDays,
  online_course: GraduationCap,
  b2b: BriefcaseBusiness,
  platinum_elite: Sparkles,
  certified_trainer_network: Network,
  loyalty_community: HeartHandshake,
};

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

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(status: string): 'good' | 'warn' | 'muted' | 'info' {
  if (status === 'active') return 'good';
  if (status === 'not_configured') return 'warn';
  if (status === 'paused') return 'info';
  return 'muted';
}

export default function CommercialCommandCenter() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [planDraft, setPlanDraft] = useState({
    revenueLineId: '',
    title: '',
    horizon: 'quarterly',
    stage: 'strategy_planning',
    objective: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setMessage('');
    const data = await commercialCommandCenterApi.dashboard(token);
    setDashboard(data as RecordMap);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      load()
        .catch(err => setMessage(err instanceof Error ? err.message : 'Could not load the Commercial Center.'))
        .finally(() => setLoading(false));
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [load, token]);

  const revenueLines = useMemo(() => list(dashboard?.revenueLines), [dashboard]);
  const configuredRevenueLines = revenueLines.filter(line => Boolean(line.configured) && text(line.status) !== 'archived');
  const recentPlans = list(dashboard?.recentPlans);
  const openSignals = list(dashboard?.openSignals);
  const stageSummary = dashboard?.stageSummary && typeof dashboard.stageSummary === 'object' ? dashboard.stageSummary as RecordMap : {};
  const planSummary = dashboard?.planSummary && typeof dashboard.planSummary === 'object' ? dashboard.planSummary as RecordMap : {};
  const signalSummary = dashboard?.signalSummary && typeof dashboard.signalSummary === 'object' ? dashboard.signalSummary as RecordMap : {};
  const eventBridge = dashboard?.eventBridge && typeof dashboard.eventBridge === 'object' ? dashboard.eventBridge as RecordMap : {};

  async function configureRevenueLine(line: RecordMap) {
    if (!token) return;
    setMessage('');
    try {
      const created = await commercialCommandCenterApi.createRevenueLine({
        revenueLineType: text(line.revenueLineType),
        name: text(line.name, titleCase(text(line.revenueLineType))),
        description: text(line.description, null as unknown as string) || undefined,
      }, token) as RecordMap;
      setPlanDraft(current => ({ ...current, revenueLineId: text(created.id) }));
      await load();
      setMessage(`${text(created.name, 'Revenue line')} is ready for planning.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not configure revenue line.');
    }
  }

  async function createPlan() {
    if (!token) return;
    setMessage('');
    if (!planDraft.revenueLineId || !planDraft.title.trim()) {
      setMessage('Choose a revenue line and enter a clear plan title.');
      return;
    }
    try {
      await commercialCommandCenterApi.createPlan({
        revenueLineId: planDraft.revenueLineId,
        title: planDraft.title,
        horizon: planDraft.horizon,
        stage: planDraft.stage,
        objective: planDraft.objective || undefined,
      }, token);
      setPlanDraft(current => ({ ...current, title: '', objective: '' }));
      await load();
      setMessage('Commercial plan created.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not create commercial plan.');
    }
  }

  return (
    <AieroPage
      eyebrow="Commercial Command Center"
      title="Assess demand, plan revenue, and coordinate engagement from one place."
      subtitle="Use this workspace for the commercial department: revenue lines, planning stages, event bridge, sales signals, and Stitchi-assisted operating work."
      action={(
        <>
          <AieroGhostButton onClick={() => navigate('/stitchi')}>Ask Stitchi</AieroGhostButton>
          <AieroActionButton onClick={() => navigate('/events')}>Open Event Operations</AieroActionButton>
        </>
      )}
    >
      {message && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/75">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <AieroMetricCard label="Revenue lines" value={loading ? '-' : configuredRevenueLines.length} detail="Configured for this tenant" accent="teal" />
        <AieroMetricCard label="Active plans" value={numberValue(planSummary.active)} detail={`${numberValue(planSummary.total)} total planning records`} accent="violet" />
        <AieroMetricCard label="Open signals" value={numberValue(signalSummary.open)} detail={`${numberValue(signalSummary.critical)} critical`} accent="amber" />
        <AieroMetricCard label="Event bridge" value={numberValue(eventBridge.activeEvents)} detail={`${numberValue(eventBridge.planningEvents)} planning events`} accent="rose" />
      </div>

      <AieroPanel
        title="Three-stage operating model"
        subtitle="The customer should think in business steps, not technical modules."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {STAGES.map(stage => (
            <AieroNumberedStep
              key={stage.id}
              number={stage.number}
              title={`${stage.title} (${numberValue(stageSummary[stage.id])})`}
              detail={stage.detail}
              accent={stage.id === 'assess' ? 'blue' : stage.id === 'strategy_planning' ? 'violet' : 'teal'}
            />
          ))}
        </div>
      </AieroPanel>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <AieroLightPanel
          title="Revenue lines"
          subtitle="These are the commercial business lines from the SRD. Configure the ones the customer operates, then create plans under them."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {revenueLines.map(line => {
              const type = text(line.revenueLineType);
              const Icon = REVENUE_ICONS[type as keyof typeof REVENUE_ICONS] || Users;
              const status = text(line.status, 'not_configured');
              return (
                <div key={type} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-neutral-950">{text(line.name, titleCase(type))}</h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-500">{text(line.description, 'No description yet.')}</p>
                      </div>
                    </div>
                    <ProductStatus tone={statusTone(status)}>{status === 'not_configured' ? 'Needs setup' : titleCase(status)}</ProductStatus>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                    <span>{numberValue(line.planCount)} plan(s)</span>
                    <span>•</span>
                    <span>{numberValue(line.openSignalCount)} open signal(s)</span>
                  </div>
                  {status === 'not_configured' && (
                    <button
                      type="button"
                      onClick={() => configureRevenueLine(line)}
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white"
                    >
                      Configure line
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </AieroLightPanel>

        <AieroLightPanel
          title="Start a planning item"
          subtitle="Create the first planning record for a configured revenue line."
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Revenue line</span>
              <select
                value={planDraft.revenueLineId}
                onChange={event => setPlanDraft(current => ({ ...current, revenueLineId: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">Choose configured line</option>
                {configuredRevenueLines.map(line => (
                  <option key={text(line.id)} value={text(line.id)}>{text(line.name)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Plan title</span>
              <input
                value={planDraft.title}
                onChange={event => setPlanDraft(current => ({ ...current, title: event.target.value }))}
                placeholder="Example: Q3 online course growth plan"
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Horizon</span>
                <select
                  value={planDraft.horizon}
                  onChange={event => setPlanDraft(current => ({ ...current, horizon: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="product_or_event">Product or event</option>
                  <option value="one_year">One year</option>
                  <option value="three_year">Three year</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Stage</span>
                <select
                  value={planDraft.stage}
                  onChange={event => setPlanDraft(current => ({ ...current, stage: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="assess">Assess</option>
                  <option value="strategy_planning">Strategy & Planning</option>
                  <option value="implementation_engagement">Implementation & Engagement</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Objective</span>
              <textarea
                value={planDraft.objective}
                onChange={event => setPlanDraft(current => ({ ...current, objective: event.target.value }))}
                placeholder="What outcome should this plan create?"
                rows={4}
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </label>
            <SecondaryAction onClick={createPlan} disabled={!configuredRevenueLines.length}>
              Create plan
            </SecondaryAction>
          </div>
        </AieroLightPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <AieroPanel title="Event operations bridge" subtitle="Events stay powerful, but they are now one commercial revenue line, not the whole system.">
          <AieroIconTile
            icon={CalendarDays}
            title="Open event workspace"
            detail="Plan event campaigns, KPI records, lead funnel, barriers, closeout and learning from the event section."
            accent="rose"
          />
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Go to events <ArrowRight className="h-4 w-4" />
          </button>
        </AieroPanel>

        <AieroPanel title="Stitchi assistance" subtitle="Ask Stitchi to prepare commercial work. Approval is still required before internal changes execute.">
          <AieroIconTile
            icon={Bot}
            title="Agentic help"
            detail="Example: 'Assess our online course revenue line and prepare a quarterly planning item.'"
            accent="teal"
          />
          <button
            type="button"
            onClick={() => navigate('/stitchi')}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            Chat with Stitchi <ArrowRight className="h-4 w-4" />
          </button>
        </AieroPanel>

        <AieroLightPanel title="Recent commercial plans" subtitle="Latest planning records across revenue lines.">
          <div className="space-y-3">
            {recentPlans.length ? recentPlans.map(plan => (
              <div key={text(plan.id)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-950">{text(plan.title, 'Untitled plan')}</h3>
                    <p className="mt-1 text-xs text-neutral-500">{text(plan.revenueLineName)} • {titleCase(text(plan.stage))}</p>
                  </div>
                  <ProductStatus tone={text(plan.status) === 'active' ? 'good' : 'muted'}>{titleCase(text(plan.status))}</ProductStatus>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-sm leading-6 text-neutral-500">
                No commercial plans yet. Configure a revenue line and create the first planning item.
              </div>
            )}
          </div>
        </AieroLightPanel>
      </div>

      {openSignals.length > 0 && (
        <AieroLightPanel title="Open commercial signals" subtitle="Assessment findings that need management attention.">
          <div className="grid gap-3 lg:grid-cols-2">
            {openSignals.map(signal => (
              <div key={text(signal.id)} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-950">{text(signal.title)}</h3>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">{text(signal.recommendedAction, text(signal.finding, 'Review and assign next action.'))}</p>
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
