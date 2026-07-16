import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DollarSign,
  Plus,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react';
import { commercialCommandCenterApi } from '../api';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency, getCurrencyPreference, isCurrencyCode } from '../lib/currency';
import './CommercialToday.css';

type RecordMap = Record<string, unknown>;

type PriorityItem = {
  id: string;
  title: string;
  context: string;
  action: string;
  path: string;
  tone: 'danger' | 'warning' | 'neutral';
};

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function object(value: unknown): RecordMap {
  return value && typeof value === 'object' ? value as RecordMap : {};
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
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function customerLabel(value: unknown, fallback: string): string {
  return text(value, fallback)
    .replace(/^Sprint\s*\d+\s+Acceptance\s+(Event|Lead)\s*\d*/i, '$1')
    .replace(/\bSprint\s*\d+\b/gi, '')
    .trim() || fallback;
}

function money(value: unknown, currency: string): string {
  if (currency === 'mixed') return 'Mixed currencies';
  const targetCurrency = isCurrencyCode(currency) ? currency : getCurrencyPreference();
  return formatCurrency(numberValue(value), targetCurrency);
}

export default function CommercialToday() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [lineDashboard, setLineDashboard] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const main = await commercialCommandCenterApi.dashboard(token) as RecordMap;
      const lines = list(main.revenueLines);
      const preferred = lines.find(line => Boolean(line.configured) && text(line.status) === 'active')
        ?? lines.find(line => Boolean(line.configured))
        ?? lines[0];
      const type = text(preferred?.revenueLineType, 'live_event');
      const detail = await commercialCommandCenterApi.revenueLineDashboard(type, token) as RecordMap;
      setDashboard(main);
      setLineDashboard(detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The commercial workspace could not load.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener('tanaghum:commercial-data-changed', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('tanaghum:commercial-data-changed', refresh);
    };
  }, [load]);

  const rollups = object(lineDashboard?.rollups);
  const dataStatus = object(lineDashboard?.dataStatus);
  const plans = list(lineDashboard?.plans);
  const signals = list(lineDashboard?.openSignals);
  const nextAction = object(lineDashboard?.nextAction);
  const revenueLine = object(lineDashboard?.revenueLine);
  const stageSummary = object(dashboard?.stageSummary);
  const currency = text(rollups.currency, getCurrencyPreference());
  const activePlan = plans.find(plan => text(plan.status) === 'active') ?? plans[0] ?? null;

  const priorities = (() => {
    const rows: PriorityItem[] = [];
    if (text(nextAction.label)) {
      rows.push({
        id: `next-${text(nextAction.label)}`,
        title: text(nextAction.label),
        context: text(nextAction.description, 'Review the next commercial action.'),
        action: 'Open',
        path: text(nextAction.path, '/commercial-plans'),
        tone: 'warning',
      });
    }
    for (const signal of signals.slice(0, 2)) {
      rows.push({
        id: text(signal.id, text(signal.title)),
        title: text(signal.title, 'Review a commercial signal'),
        context: text(signal.recommendedAction, text(signal.finding, 'Assign the next action.')),
        action: 'Review',
        path: '/commercial-plans',
        tone: text(signal.severity) === 'critical' ? 'danger' : 'warning',
      });
    }
    const missing = Array.isArray(dataStatus.missingDataSources) ? dataStatus.missingDataSources as string[] : [];
    if (missing.length) {
      rows.push({
        id: 'missing-data',
        title: 'Complete the customer data setup',
        context: missing.slice(0, 3).join(', '),
        action: 'Set Up',
        path: '/integration-credentials',
        tone: 'neutral',
      });
    }
    if (!plans.length) {
      rows.push({
        id: 'first-plan',
        title: 'Create the first execution plan',
        context: 'Set the objective, audience, budget, and revenue target.',
        action: 'Create',
        path: '/commercial-plans',
        tone: 'neutral',
      });
    }
    return rows.slice(0, 4);
  })();

  const pipeline = [
    { label: 'Assess', value: numberValue(stageSummary.assess) },
    { label: 'Plan', value: numberValue(stageSummary.strategy_planning) },
    { label: 'Operate', value: numberValue(stageSummary.implementation_engagement) },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map(item => item.value));
  const revenueTarget = numberValue(activePlan?.revenueTarget ?? rollups.plannedRevenueTarget);
  const knownRevenue = numberValue(rollups.knownRevenue);
  const targetProgress = revenueTarget > 0 ? Math.min(100, Math.round((knownRevenue / revenueTarget) * 100)) : 0;
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <OpsPage className="commercial-today">
      <OpsPageHeader
        eyebrow={today}
        title="Today's Commercial Priorities"
        subtitle="Real plans, lead outcomes, and decisions that need attention now."
        actions={(
          <>
            <Link className="ops-button is-secondary" to="/stitchi?mode=prepare&prompt=What%20should%20I%20focus%20on%20today%3F"><Sparkles size={17} aria-hidden="true" />Plan With Stitchi</Link>
            <Link className="ops-button is-primary" to="/commercial-planning"><Plus size={17} aria-hidden="true" />Plan the Year</Link>
          </>
        )}
      />

      {error ? <OpsNotice tone="danger">{error} <button className="ops-text-button" type="button" onClick={() => void load()}>Try Again</button></OpsNotice> : null}

      {loading ? (
        <div className="commercial-today-loading"><OpsSkeleton rows={4} /><OpsSkeleton rows={4} /></div>
      ) : (
        <>
          <section className="commercial-metrics" aria-label="Commercial performance summary">
            <TodayMetric label="Known Revenue" value={money(rollups.knownRevenue, currency)} detail="Verified purchase records" icon={DollarSign} tone="positive" />
            <TodayMetric label="Captured Leads" value={numberValue(rollups.leads).toLocaleString()} detail="Current revenue line" icon={UsersRound} />
            <TodayMetric label="Purchases" value={numberValue(rollups.purchases).toLocaleString()} detail={`${numberValue(rollups.leadToPurchaseRate).toFixed(1)}% conversion`} icon={CheckCircle2} tone="positive" />
            <TodayMetric label="Known Spend" value={money(rollups.knownSpend, currency)} detail="Verified KPI/import records" icon={Target} />
          </section>

          <div className="commercial-today-grid">
            <OpsSection title="Needs Your Attention" subtitle={`${priorities.length} current action${priorities.length === 1 ? '' : 's'}.`} className="commercial-priorities">
              {priorities.length ? (
                <div className="commercial-priority-list">
                  {priorities.map((priority, index) => (
                    <article className="commercial-priority-row" key={priority.id}>
                      <span className={`commercial-priority-number is-${priority.tone}`}>{index + 1}</span>
                      <div><h3>{priority.title}</h3><p>{priority.context}</p></div>
                      <span className="commercial-priority-state"><Clock3 size={14} aria-hidden="true" />Open</span>
                      <Link className="ops-button is-secondary" to={priority.path}>{priority.action}</Link>
                    </article>
                  ))}
                </div>
              ) : (
                <OpsEmpty title="No urgent actions" message="No open commercial signals or missing planning steps were returned by the backend." action={<Link className="ops-button is-secondary" to="/commercial-planning">Review Annual Plan</Link>} />
              )}
            </OpsSection>

            <OpsSection title="Commercial Pipeline" subtitle="Current records by operating stage." className="commercial-pipeline">
              <div className="commercial-pipeline-bars">
                {pipeline.map(item => (
                  <div key={item.label}>
                    <span><strong>{item.label}</strong><small>{item.value} record{item.value === 1 ? '' : 's'}</small></span>
                    <div aria-label={`${item.label}: ${item.value} records`}><span style={{ width: `${item.value ? Math.max(12, (item.value / pipelineMax) * 100) : 0}%` }} /></div>
                  </div>
                ))}
              </div>
              <Link className="ops-text-button commercial-pipeline-link" to="/commercial-plans">Open Execution Plans <ArrowRight size={15} aria-hidden="true" /></Link>
            </OpsSection>

            <OpsSection
              title="Active Commercial Plan"
              subtitle={customerLabel(revenueLine.name, 'Selected revenue line')}
              action={activePlan ? <OpsStatus tone={text(activePlan.status) === 'active' ? 'positive' : 'info'}>{titleCase(text(activePlan.status, 'draft'))}</OpsStatus> : undefined}
              className="commercial-active-plan"
            >
              {activePlan ? (
                <div className="commercial-plan-body">
                  <div className="commercial-plan-facts">
                    <div><span>Plan</span><strong>{customerLabel(activePlan.title, 'Untitled plan')}</strong></div>
                    <div><span>Revenue Target</span><strong>{money(activePlan.revenueTarget, text(activePlan.currency, currency))}</strong></div>
                    <div><span>Known Revenue</span><strong>{money(rollups.knownRevenue, currency)}</strong></div>
                  </div>
                  {revenueTarget > 0 ? (
                    <><div className="commercial-progress-copy"><span>{targetProgress}% of target</span><span>{money(revenueTarget - knownRevenue, currency)} remaining</span></div><div className="commercial-progress"><span style={{ width: `${targetProgress}%` }} /></div></>
                  ) : <p className="commercial-plan-missing">Add a revenue target to calculate progress.</p>}
                  <Link className="ops-button is-secondary commercial-plan-open" to="/commercial-plans">Open Execution Plan <ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
              ) : (
                <OpsEmpty title="No execution plan selected" message="Start in the annual plan, choose a monthly initiative, then create its execution plan." action={<Link className="ops-button is-primary" to="/commercial-planning">Open Annual Plan</Link>} />
              )}
            </OpsSection>

            <section className="commercial-decision">
              <span><CircleAlert size={20} aria-hidden="true" /></span>
              <div><span>Next Decision</span><h2>{text(nextAction.label, signals.length ? text(signals[0].title) : 'Review the execution plan')}</h2><p>{text(nextAction.description, signals.length ? text(signals[0].recommendedAction, text(signals[0].finding)) : 'Confirm priorities and assign the next valid action.')}</p></div>
              <Link className="ops-button is-primary" to={text(nextAction.path, '/commercial-plans')}>Take Action</Link>
            </section>
          </div>
        </>
      )}
    </OpsPage>
  );
}

function TodayMetric({ label, value, detail, icon: Icon, tone = 'neutral' }: { label: string; value: string; detail: string; icon: typeof CalendarDays; tone?: 'neutral' | 'positive' }) {
  return (
    <div className="commercial-metric">
      <span className={`commercial-metric-icon is-${tone}`}><Icon size={18} aria-hidden="true" /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}
