import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  CalendarRange,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Plus,
  Save,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import {
  annualCommercialPlanningApi,
  commercialAssessmentApi,
  commercialCommandCenterApi,
  eventsApi,
} from '../api';
import { CommercialWorkspaceNav } from '../components/CommercialWorkspaceNav';
import { CommercialTraceabilityPanel } from '../components/CommercialTraceabilityPanel';
import { BudgetReconciliationPanel } from '../components/BudgetReconciliationPanel';
import { Field } from '../components/ProductUI';
import {
  OpsEmpty,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSection,
  OpsSkeleton,
  OpsStatus,
} from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import { formatCurrency } from '../lib/currency';
import './AnnualCommercialPlanning.css';

type Data = Record<string, unknown>;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const QUARTERS = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, index) => CURRENT_YEAR - 1 + index);
const MANAGER_ROLES = ['admin', 'cco', 'department_head'];
const APPROVER_ROLES = ['admin', 'cco'];

function asData(value: unknown): Data {
  return value && typeof value === 'object' ? (value as Data) : {};
}

function asList(value: unknown): Data[] {
  return Array.isArray(value) ? (value as Data[]) : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  const valueNumber = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

function roleValue(user: unknown): string {
  return text(asData(user).role).toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  if (['approved', 'active', 'completed', 'ready'].includes(status)) return 'positive';
  if (['pending_approval', 'needs_brief', 'planned'].includes(status)) return 'warning';
  if (['rejected', 'blocked'].includes(status)) return 'danger';
  if (['closed', 'archived'].includes(status)) return 'neutral';
  return 'info';
}

function money(value: unknown, currency = 'AED'): string {
  return formatCurrency(numberValue(value), currency === 'USD' ? 'USD' : 'AED');
}

function dateInput(value: unknown): string {
  const raw = text(value);
  return raw ? raw.slice(0, 10) : '';
}

function emptyAnnualDraft(year: number, currency = 'AED') {
  return {
    title: `${year} Commercial Strategy`,
    strategy: '',
    currency,
    budgetTarget: '',
    revenueTarget: '',
  };
}

function emptyItemDraft(month: number, currency = 'AED') {
  return {
    id: '',
    month,
    revenueLineId: '',
    commercialPlanId: '',
    eventId: '',
    title: '',
    plannedStartDate: '',
    plannedEndDate: '',
    currency,
    budgetAllocation: '',
    revenueTarget: '',
    priority: 'medium',
    readiness: 'planned',
  };
}

function emptyExecutionPlanDraft(item: Data) {
  return {
    itemId: text(item.id),
    title: text(item.title),
    objective: '',
    audience: '',
    strategySummary: '',
    actionPlan: '',
  };
}

export default function AnnualCommercialPlanning() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const role = roleValue(user);
  const canManage = MANAGER_ROLES.includes(role);
  const canApprove = APPROVER_ROLES.includes(role);
  const [year, setYear] = useState(CURRENT_YEAR + 1);
  const [plans, setPlans] = useState<Data[]>([]);
  const [plan, setPlan] = useState<Data | null>(null);
  const [revenueLines, setRevenueLines] = useState<Data[]>([]);
  const [executionPlans, setExecutionPlans] = useState<Data[]>([]);
  const [events, setEvents] = useState<Data[]>([]);
  const [learningSets, setLearningSets] = useState<Data[]>([]);
  const [selectedLearningIds, setSelectedLearningIds] = useState<string[]>([]);
  const [annualDraft, setAnnualDraft] = useState(emptyAnnualDraft(CURRENT_YEAR + 1));
  const [itemDraft, setItemDraft] = useState(emptyItemDraft(1));
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [executionPlanDraft, setExecutionPlanDraft] = useState<ReturnType<
    typeof emptyExecutionPlanDraft
  > | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [lifecycleDialog, setLifecycleDialog] = useState<'archive' | 'duplicate' | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const defaultCurrency = text(plan?.currency, annualDraft.currency || 'AED');
  const rollup = asData(plan?.rollup);
  const items = useMemo(() => asList(plan?.items), [plan]);
  const planStatus = text(plan?.status);
  const editable = canManage && ['draft', 'rejected'].includes(planStatus);
  const configuredLines = useMemo(
    () => revenueLines.filter((line) => text(line.id) && text(line.status) !== 'archived'),
    [revenueLines],
  );
  const selectedItemLine = configuredLines.find(
    (line) => text(line.id) === itemDraft.revenueLineId,
  );
  const compatibleExecutionPlans = executionPlans.filter(
    (candidate) =>
      !itemDraft.revenueLineId || text(candidate.revenueLineId) === itemDraft.revenueLineId,
  );

  const applyPlan = useCallback((next: Data | null) => {
    setPlan(next);
    if (!next) return;
    setAnnualDraft({
      title: text(next.title),
      strategy: text(next.strategy),
      currency: text(next.currency, 'AED'),
      budgetTarget: String(numberValue(next.budgetTarget)),
      revenueTarget: String(numberValue(next.revenueTarget)),
    });
    setSelectedLearningIds(
      asList(next.learningSets)
        .map((set) => text(set.id))
        .filter(Boolean),
    );
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const [annualRecords, lineRecords, commercialRecords, eventRecords, learningRecords] =
        await Promise.all([
          annualCommercialPlanningApi.list(token, { year: String(year) }),
          commercialCommandCenterApi.revenueLines(token),
          commercialCommandCenterApi.plans(token),
          eventsApi.list(token),
          commercialAssessmentApi.learningSets(token),
        ]);
      const annualList = asList(annualRecords);
      setPlans(annualList);
      setRevenueLines(asList(lineRecords));
      setExecutionPlans(asList(commercialRecords));
      setEvents(asList(eventRecords));
      setLearningSets(asList(learningRecords));
      const preferred =
        annualList.find((candidate) => text(candidate.status) !== 'archived') ||
        annualList[0] ||
        null;
      applyPlan(preferred);
      if (!preferred) {
        setAnnualDraft(emptyAnnualDraft(year));
        setSelectedLearningIds([]);
        setShowItemEditor(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Annual planning could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [applyPlan, token, year]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function updatePlanInState(nextValue: unknown) {
    const next = asData(nextValue);
    applyPlan(next);
    setPlans((current) =>
      current.map((candidate) => (text(candidate.id) === text(next.id) ? next : candidate)),
    );
    window.dispatchEvent(new Event('tanaghum:commercial-data-changed'));
  }

  async function createAnnualPlan() {
    if (!token || !canManage) return;
    if (!annualDraft.title.trim()) return setMessage('Enter a clear annual plan title.');
    setSaving(true);
    setMessage('');
    try {
      const created = await annualCommercialPlanningApi.create(
        {
          year,
          title: annualDraft.title.trim(),
          strategy: annualDraft.strategy.trim() || null,
          currency: annualDraft.currency,
          budgetTarget: Number(annualDraft.budgetTarget || 0),
          revenueTarget: Number(annualDraft.revenueTarget || 0),
          learningSetIds: selectedLearningIds,
        },
        token,
      );
      const next = asData(created);
      setPlans((current) => [next, ...current]);
      applyPlan(next);
      setMessage('Annual plan created. Add the monthly products and events that will deliver it.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Annual plan could not be created.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAnnualDetails() {
    if (!token || !plan || !editable) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await annualCommercialPlanningApi.update(
        text(plan.id),
        {
          expectedRevision: numberValue(plan.revision),
          title: annualDraft.title.trim(),
          strategy: annualDraft.strategy.trim() || null,
          currency: annualDraft.currency,
          budgetTarget: Number(annualDraft.budgetTarget || 0),
          revenueTarget: Number(annualDraft.revenueTarget || 0),
        },
        token,
      );
      updatePlanInState(updated);
      setMessage('Annual direction and targets saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Annual plan could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function saveLearningLinks() {
    if (!token || !plan || !editable) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await annualCommercialPlanningApi.updateLearningSets(
        text(plan.id),
        {
          expectedRevision: numberValue(plan.revision),
          learningSetIds: selectedLearningIds,
        },
        token,
      );
      updatePlanInState(updated);
      setMessage('Approved historical learning linked to this plan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Learning could not be linked.');
    } finally {
      setSaving(false);
    }
  }

  async function transition(
    action: 'submit' | 'approve' | 'reject' | 'activate' | 'close',
  ) {
    if (!token || !plan) return;
    if (action === 'reject' && decisionReason.trim().length < 3)
      return setMessage('Enter a clear reason before requesting changes.');
    setSaving(true);
    setMessage('');
    try {
      const updated = await annualCommercialPlanningApi.transition(
        text(plan.id),
        action,
        {
          expectedRevision: numberValue(plan.revision),
          reason: decisionReason.trim() || undefined,
        },
        token,
      );
      updatePlanInState(updated);
      setDecisionReason('');
      const resultLabels = {
        submit: 'submitted for approval',
        approve: 'approved',
        reject: 'returned for changes',
        activate: 'activated',
        close: 'closed',
      };
      setMessage(`Annual plan ${resultLabels[action]}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Annual plan status could not be changed.',
      );
    } finally {
      setSaving(false);
    }
  }

  function openLifecycleDialog(action: 'archive' | 'duplicate') {
    setLifecycleReason('');
    setLifecycleDialog(action);
  }

  async function confirmLifecycleAction() {
    if (!token || !plan || !lifecycleDialog || lifecycleReason.trim().length < 3) return;
    setSaving(true);
    setMessage('');
    try {
      if (lifecycleDialog === 'archive') {
        const updated = await annualCommercialPlanningApi.transition(
          text(plan.id),
          'archive',
          {
            expectedRevision: numberValue(plan.revision),
            reason: lifecycleReason.trim(),
            confirmation: 'ARCHIVE',
          },
          token,
        );
        updatePlanInState(updated);
        setMessage(
          'Annual plan archived. It is preserved as read-only evidence; create a new draft scenario to continue planning.',
        );
      } else {
        const created = await annualCommercialPlanningApi.duplicateAsDraft(
          text(plan.id),
          {
            expectedRevision: numberValue(plan.revision),
            reason: lifecycleReason.trim(),
          },
          token,
        );
        const next = asData(created);
        setPlans((current) => [next, ...current]);
        applyPlan(next);
        setShowItemEditor(false);
        setMessage(
          `Draft scenario ${numberValue(next.scenarioVersion)} created. Annual direction and approved learning were copied; monthly execution starts clean.`,
        );
      }
      setLifecycleDialog(null);
      setLifecycleReason('');
      window.dispatchEvent(new Event('tanaghum:commercial-data-changed'));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The annual plan lifecycle action could not be completed.',
      );
    } finally {
      setSaving(false);
    }
  }

  function startNewItem(month: number) {
    setSelectedMonth(month);
    setExecutionPlanDraft(null);
    setItemDraft(emptyItemDraft(month, defaultCurrency));
    setShowItemEditor(true);
    window.setTimeout(
      () =>
        document
          .getElementById('portfolio-item-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }

  function editItem(item: Data) {
    const revenueLine = asData(item.revenueLine);
    const commercialPlan = asData(item.commercialPlan);
    const event = asData(item.event);
    setSelectedMonth(numberValue(item.month));
    setExecutionPlanDraft(null);
    setItemDraft({
      id: text(item.id),
      month: numberValue(item.month),
      revenueLineId: text(revenueLine.id),
      commercialPlanId: text(commercialPlan.id),
      eventId: text(event.id),
      title: text(item.title),
      plannedStartDate: dateInput(item.plannedStartDate),
      plannedEndDate: dateInput(item.plannedEndDate),
      currency: text(item.currency, defaultCurrency),
      budgetAllocation: String(numberValue(item.budgetAllocation)),
      revenueTarget: String(numberValue(item.revenueTarget)),
      priority: text(item.priority, 'medium'),
      readiness: text(item.readiness, 'planned'),
    });
    setShowItemEditor(true);
    window.setTimeout(
      () =>
        document
          .getElementById('portfolio-item-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }

  async function saveItem() {
    if (!token || !plan || !editable) return;
    if (!itemDraft.title.trim() || !itemDraft.revenueLineId)
      return setMessage('Choose a revenue line and enter an initiative title.');
    setSaving(true);
    setMessage('');
    const payload = {
      expectedRevision: numberValue(plan.revision),
      month: itemDraft.month,
      revenueLineId: itemDraft.revenueLineId,
      commercialPlanId: itemDraft.commercialPlanId || null,
      eventId: itemDraft.eventId || null,
      title: itemDraft.title.trim(),
      plannedStartDate: itemDraft.plannedStartDate || null,
      plannedEndDate: itemDraft.plannedEndDate || null,
      currency: itemDraft.currency,
      budgetAllocation: Number(itemDraft.budgetAllocation || 0),
      revenueTarget: Number(itemDraft.revenueTarget || 0),
      priority: itemDraft.priority,
      readiness: itemDraft.readiness,
    };
    try {
      const updated = itemDraft.id
        ? await annualCommercialPlanningApi.updateItem(text(plan.id), itemDraft.id, payload, token)
        : await annualCommercialPlanningApi.createItem(text(plan.id), payload, token);
      updatePlanInState(updated);
      setSelectedMonth(itemDraft.month);
      setShowItemEditor(false);
      setItemDraft(emptyItemDraft(itemDraft.month, defaultCurrency));
      setMessage(
        itemDraft.id
          ? 'Monthly initiative updated.'
          : 'Monthly initiative added to the annual portfolio.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Monthly initiative could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveItem() {
    if (!token || !plan || !itemDraft.id || !editable) return;
    setSaving(true);
    try {
      const updated = await annualCommercialPlanningApi.archiveItem(
        text(plan.id),
        itemDraft.id,
        { expectedRevision: numberValue(plan.revision) },
        token,
      );
      updatePlanInState(updated);
      setShowItemEditor(false);
      setMessage('Monthly initiative archived. Annual totals have been recalculated.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Monthly initiative could not be archived.',
      );
    } finally {
      setSaving(false);
    }
  }

  function startExecutionPlan(item: Data) {
    if (!editable || !text(item.id) || text(asData(item.commercialPlan).id)) return;
    setSelectedMonth(numberValue(item.month));
    setShowItemEditor(false);
    setExecutionPlanDraft({
      ...emptyExecutionPlanDraft(item),
      strategySummary: annualDraft.strategy,
    });
    window.setTimeout(
      () =>
        document
          .getElementById('execution-plan-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }

  async function createExecutionPlan() {
    if (!token || !plan || !executionPlanDraft || !editable) return;
    if (!executionPlanDraft.title.trim()) {
      setMessage('Enter a clear execution plan title.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = asData(
        await annualCommercialPlanningApi.createExecutionPlan(
          text(plan.id),
          executionPlanDraft.itemId,
          {
            expectedRevision: numberValue(plan.revision),
            title: executionPlanDraft.title.trim(),
            objective: executionPlanDraft.objective.trim() || null,
            audience: executionPlanDraft.audience.trim() || null,
            strategySummary: executionPlanDraft.strategySummary.trim() || null,
            actionPlan: executionPlanDraft.actionPlan.trim() || null,
          },
          token,
        ),
      );
      updatePlanInState(result.annualPlan);
      setExecutionPlanDraft(null);
      await load();
      setMessage(
        'Execution plan created and linked to its annual plan, month, revenue line, targets, and event.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Execution plan could not be created.');
    } finally {
      setSaving(false);
    }
  }

  function monthItems(month: number) {
    return items.filter((item) => numberValue(item.month) === month);
  }

  const selectedMonthItems = monthItems(selectedMonth);
  const selectedMonthBudget = selectedMonthItems.reduce(
    (total, item) => total + numberValue(item.budgetAllocation),
    0,
  );
  const selectedMonthRevenue = selectedMonthItems.reduce(
    (total, item) => total + numberValue(item.revenueTarget),
    0,
  );
  const stitchiPrompt = `Help me prepare the ${year} annual commercial strategy. Review approved historical learning, annual AED budget and revenue targets, then propose the monthly product and event portfolio. Create execution plans from their annual monthly initiatives, not as standalone records, unless I explicitly request and justify an exception. Do not save or call external systems without approval.`;

  return (
    <OpsPage className="annual-planning-page">
      <OpsPageHeader
        eyebrow="Strategy & Planning"
        title="Annual Commercial Plan"
        subtitle="Set the yearly direction, allocate products and events by month, then open each initiative for detailed execution."
        actions={
          <>
            <button
              className="ops-button is-secondary"
              type="button"
              onClick={() =>
                navigate(`/stitchi?mode=prepare&annualPlanId=${encodeURIComponent(text(plan?.id))}&prompt=${encodeURIComponent(stitchiPrompt)}`)
              }
            >
              <Sparkles size={17} aria-hidden="true" />
              Plan with Stitchi
            </button>
            {plan && editable ? (
              <button
                className="ops-button is-primary"
                type="button"
                onClick={() => startNewItem(new Date().getMonth() + 1)}
              >
                <Plus size={17} aria-hidden="true" />
                Add initiative
              </button>
            ) : null}
          </>
        }
      />

      <CommercialWorkspaceNav />
      {message ? (
        <OpsNotice
          tone={
            /could not|cannot|another user|must|enter|choose/i.test(message) ? 'danger' : 'info'
          }
        >
          {message}
        </OpsNotice>
      ) : null}

      {loading ? (
        <div className="annual-loading">
          <OpsSkeleton rows={5} />
          <OpsSkeleton rows={5} />
        </div>
      ) : (
        <>
          <div className="annual-year-toolbar">
            <label>
              <span>Planning year</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {YEAR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {plans.length ? (
              <label>
                <span>Scenario version</span>
                <select
                  value={text(plan?.id)}
                  onChange={(event) =>
                    applyPlan(
                      plans.find((candidate) => text(candidate.id) === event.target.value) || null,
                    )
                  }
                >
                  {plans.map((candidate) => (
                    <option key={text(candidate.id)} value={text(candidate.id)}>
                      Version {numberValue(candidate.scenarioVersion)} -{' '}
                      {titleCase(text(candidate.status))}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {plan ? (
              <div className="annual-current-state">
                <span>Current status</span>
                <OpsStatus tone={statusTone(planStatus)}>{titleCase(planStatus)}</OpsStatus>
              </div>
            ) : null}
          </div>

          {planStatus === 'archived' ? (
            <div className="annual-readonly-banner" id="annual-plan-read-only" role="status">
              <Archive size={20} aria-hidden="true" />
              <div>
                <strong>This annual plan is archived and read-only</strong>
                <p>
                  Its direction, learning, and history are preserved. Monthly initiatives cannot be
                  added to an archived scenario.
                </p>
              </div>
              {canManage ? (
                <button
                  className="ops-button is-primary"
                  type="button"
                  onClick={() => openLifecycleDialog('duplicate')}
                >
                  <Plus size={16} aria-hidden="true" />
                  Create new draft scenario
                </button>
              ) : null}
            </div>
          ) : null}

          {!plan ? (
            <OpsSection
              title={`Create the ${year} annual plan`}
              subtitle="Start with leadership targets and approved learning. Monthly initiatives come next."
            >
              {canManage ? (
                <div className="annual-create-form">
                  <Field label="Plan title">
                    <input
                      value={annualDraft.title}
                      onChange={(event) =>
                        setAnnualDraft((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Currency">
                    <select
                      value={annualDraft.currency}
                      onChange={(event) =>
                        setAnnualDraft((current) => ({ ...current, currency: event.target.value }))
                      }
                    >
                      <option value="AED">AED - UAE Dirham</option>
                      <option value="USD">USD - US Dollar</option>
                    </select>
                  </Field>
                  <Field label="Annual budget target">
                    <input
                      type="number"
                      min="0"
                      value={annualDraft.budgetTarget}
                      onChange={(event) =>
                        setAnnualDraft((current) => ({
                          ...current,
                          budgetTarget: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Annual revenue target">
                    <input
                      type="number"
                      min="0"
                      value={annualDraft.revenueTarget}
                      onChange={(event) =>
                        setAnnualDraft((current) => ({
                          ...current,
                          revenueTarget: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Annual strategy">
                    <textarea
                      rows={4}
                      value={annualDraft.strategy}
                      onChange={(event) =>
                        setAnnualDraft((current) => ({ ...current, strategy: event.target.value }))
                      }
                      placeholder="What should the commercial portfolio achieve this year?"
                    />
                  </Field>
                  <LearningSelector
                    learningSets={learningSets}
                    selected={selectedLearningIds}
                    onChange={setSelectedLearningIds}
                  />
                  <button
                    className="ops-button is-primary"
                    type="button"
                    disabled={saving}
                    onClick={createAnnualPlan}
                  >
                    {saving ? 'Creating...' : 'Create annual plan'}
                  </button>
                </div>
              ) : (
                <OpsEmpty
                  title="No annual plan for this year"
                  message="A commercial leader must create the annual plan before the team can review monthly work."
                />
              )}
            </OpsSection>
          ) : (
            <>
              <section className="annual-summary-band" aria-label="Annual plan totals">
                <AnnualMetric
                  label="Annual budget"
                  value={money(rollup.annualBudgetTarget, defaultCurrency)}
                  detail={`${defaultCurrency} plan target`}
                  icon={<Target size={18} />}
                />
                <AnnualMetric
                  label="Allocated"
                  value={money(rollup.allocatedBudget, defaultCurrency)}
                  detail={`${items.length} initiative${items.length === 1 ? '' : 's'}`}
                  icon={<CalendarRange size={18} />}
                />
                <AnnualMetric
                  label={
                    numberValue(rollup.unallocatedBudget) < 0 ? 'Over allocation' : 'Unallocated'
                  }
                  value={money(Math.abs(numberValue(rollup.unallocatedBudget)), defaultCurrency)}
                  detail={
                    numberValue(rollup.unallocatedBudget) < 0
                      ? 'Reduce monthly allocations'
                      : 'Available for future months'
                  }
                  warning={numberValue(rollup.unallocatedBudget) < 0}
                  icon={<CircleAlert size={18} />}
                />
                <AnnualMetric
                  label="Revenue target"
                  value={money(rollup.annualRevenueTarget, defaultCurrency)}
                  detail={`${money(rollup.allocatedRevenueTarget, defaultCurrency)} allocated`}
                  icon={<ArrowRight size={18} />}
                />
              </section>

              <OpsSection
                title={text(plan.title)}
                subtitle={`Version ${numberValue(plan.scenarioVersion)} for ${year}. Financial targets stay separated by currency; no automatic conversion is applied.`}
                action={
                  editable ? (
                    <button
                      className="ops-button is-secondary"
                      type="button"
                      onClick={saveAnnualDetails}
                      disabled={saving}
                    >
                      <Save size={16} aria-hidden="true" />
                      Save direction
                    </button>
                  ) : undefined
                }
              >
                <div className="annual-direction-grid">
                  <div className="annual-direction-form">
                    <Field label="Plan title">
                      <input
                        disabled={!editable}
                        value={annualDraft.title}
                        onChange={(event) =>
                          setAnnualDraft((current) => ({ ...current, title: event.target.value }))
                        }
                      />
                    </Field>
                    <div className="annual-target-fields">
                      <Field label="Currency">
                        <select
                          disabled={!editable}
                          value={annualDraft.currency}
                          onChange={(event) =>
                            setAnnualDraft((current) => ({
                              ...current,
                              currency: event.target.value,
                            }))
                          }
                        >
                          <option value="AED">AED - UAE Dirham</option>
                          <option value="USD">USD - US Dollar</option>
                        </select>
                      </Field>
                      <Field label="Annual budget">
                        <input
                          disabled={!editable}
                          type="number"
                          min="0"
                          value={annualDraft.budgetTarget}
                          onChange={(event) =>
                            setAnnualDraft((current) => ({
                              ...current,
                              budgetTarget: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Annual revenue target">
                        <input
                          disabled={!editable}
                          type="number"
                          min="0"
                          value={annualDraft.revenueTarget}
                          onChange={(event) =>
                            setAnnualDraft((current) => ({
                              ...current,
                              revenueTarget: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Annual strategy">
                      <textarea
                        disabled={!editable}
                        rows={5}
                        value={annualDraft.strategy}
                        onChange={(event) =>
                          setAnnualDraft((current) => ({
                            ...current,
                            strategy: event.target.value,
                          }))
                        }
                        placeholder="State the portfolio direction, audience priorities, seasonality, and expected outcomes."
                      />
                    </Field>
                  </div>
                  <div className="annual-learning-panel">
                    <LearningSelector
                      learningSets={learningSets}
                      selected={selectedLearningIds}
                      onChange={setSelectedLearningIds}
                      disabled={!editable}
                    />
                    {editable ? (
                      <button
                        className="ops-button is-secondary"
                        type="button"
                        onClick={saveLearningLinks}
                        disabled={saving}
                      >
                        Save learning links
                      </button>
                    ) : null}
                    <p>
                      Only findings approved in Assessment can guide this plan. They never change
                      budgets or initiatives automatically.
                    </p>
                  </div>
                </div>
                <AnnualStatusActions
                  status={planStatus}
                  canManage={canManage}
                  canApprove={canApprove}
                  saving={saving}
                  reason={decisionReason}
                  setReason={setDecisionReason}
                  onTransition={transition}
                  onArchiveRequest={() => openLifecycleDialog('archive')}
                />
              </OpsSection>

              <OpsSection
                title="Monthly execution workspace"
                subtitle="Choose a month, confirm its initiatives, then create each execution plan from that monthly decision."
                action={
                  editable ? (
                    <button
                      className="ops-button is-primary"
                      type="button"
                      onClick={() => startNewItem(selectedMonth)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add to {MONTHS[selectedMonth - 1]}
                    </button>
                  ) : canManage && planStatus === 'archived' ? (
                    <button
                      className="ops-button is-primary"
                      type="button"
                      disabled
                      aria-describedby="annual-plan-read-only"
                      title="Create a new draft scenario before adding monthly initiatives"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add to {MONTHS[selectedMonth - 1]}
                    </button>
                  ) : undefined
                }
              >
                <div className="annual-month-tabs" role="tablist" aria-label="Planning month">
                  {MONTHS.map((monthName, index) => {
                    const month = index + 1;
                    const count = monthItems(month).length;
                    return (
                      <button
                        key={monthName}
                        type="button"
                        role="tab"
                        aria-selected={selectedMonth === month}
                        className={selectedMonth === month ? 'is-active' : ''}
                        onClick={() => setSelectedMonth(month)}
                      >
                        <span>{monthName.slice(0, 3)}</span>
                        <small>{count || '-'}</small>
                      </button>
                    );
                  })}
                </div>

                <div className="annual-month-workspace" role="tabpanel">
                  <header>
                    <div>
                      <span>{year} portfolio month</span>
                      <h3>{MONTHS[selectedMonth - 1]}</h3>
                      <p>
                        {selectedMonthItems.length
                          ? `${selectedMonthItems.length} initiative${selectedMonthItems.length === 1 ? '' : 's'} ready for planning decisions.`
                          : 'No initiative is planned yet. Add one only when it supports the annual strategy.'}
                      </p>
                    </div>
                    <dl>
                      <div><dt>Allocated budget</dt><dd>{money(selectedMonthBudget, defaultCurrency)}</dd></div>
                      <div><dt>Revenue target</dt><dd>{money(selectedMonthRevenue, defaultCurrency)}</dd></div>
                      <div><dt>Execution plans</dt><dd>{selectedMonthItems.filter((item) => text(asData(item.commercialPlan).id)).length} / {selectedMonthItems.length}</dd></div>
                    </dl>
                  </header>

                  {selectedMonthItems.length ? (
                    <div className="annual-month-focus-list">
                      {selectedMonthItems.map((item) => {
                        const line = asData(item.revenueLine);
                        const childPlan = asData(item.commercialPlan);
                        const linkedEvent = asData(item.event);
                        return (
                          <article key={text(item.id)}>
                            <div className="annual-month-focus-main">
                              <div>
                                <span>{text(line.name)} / {titleCase(text(item.priority, 'medium'))} priority</span>
                                <strong>{text(item.title)}</strong>
                                <small>
                                  {money(item.budgetAllocation, text(item.currency, defaultCurrency))} budget /{' '}
                                  {money(item.revenueTarget, text(item.currency, defaultCurrency))} target
                                </small>
                              </div>
                              <OpsStatus tone={statusTone(text(item.readiness))}>
                                {titleCase(text(item.readiness))}
                              </OpsStatus>
                            </div>
                            <div className="annual-month-focus-links">
                              <span className={text(childPlan.id) ? 'is-ready' : ''}>
                                {text(childPlan.id) ? `Execution plan: ${text(childPlan.title)}` : 'Execution plan not created'}
                              </span>
                              <span className={text(linkedEvent.id) ? 'is-ready' : ''}>
                                {text(linkedEvent.id) ? `Event: ${text(linkedEvent.name)}` : 'No event linked'}
                              </span>
                            </div>
                            <div className="annual-month-focus-actions">
                              <button className="ops-button is-secondary" type="button" onClick={() => editItem(item)}>
                                Review initiative
                              </button>
                              {text(childPlan.id) ? (
                                <button
                                  className="ops-button is-primary"
                                  type="button"
                                  onClick={() => navigate(`/commercial-plans?revenueLineType=${encodeURIComponent(text(line.type))}&planId=${encodeURIComponent(text(childPlan.id))}`)}
                                >
                                  Open execution plan <ArrowRight size={15} aria-hidden="true" />
                                </button>
                              ) : editable ? (
                                <button className="ops-button is-primary" type="button" onClick={() => startExecutionPlan(item)}>
                                  Create execution plan <ArrowRight size={15} aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <OpsEmpty
                      title={`Nothing planned for ${MONTHS[selectedMonth - 1]}`}
                      message="An open month is valid. Add an initiative only after leadership confirms the product, event, budget, and expected revenue."
                      action={editable ? <button className="ops-button is-primary" type="button" onClick={() => startNewItem(selectedMonth)}>Add initiative</button> : canManage && planStatus === 'archived' ? <button className="ops-button is-primary" type="button" disabled aria-describedby="annual-plan-read-only">Add initiative</button> : undefined}
                    />
                  )}
                </div>

                <details className="annual-year-overview">
                  <summary>View all twelve months</summary>
                  <div className="annual-quarter-grid">
                    {QUARTERS.map((quarter) => (
                      <section key={quarter.label} className="annual-quarter" aria-labelledby={`quarter-${quarter.label}`}>
                        <header><strong id={`quarter-${quarter.label}`}>{quarter.label}</strong><span>{quarter.months.reduce((total, month) => total + monthItems(month).length, 0)} planned</span></header>
                        {quarter.months.map((month) => (
                          <button className={selectedMonth === month ? 'annual-month is-selected' : 'annual-month'} key={month} type="button" onClick={() => setSelectedMonth(month)}>
                            <span><strong>{MONTHS[month - 1]}</strong><small>{monthItems(month).length ? `${monthItems(month).length} initiative${monthItems(month).length === 1 ? '' : 's'}` : 'Open'}</small></span>
                            <ChevronRight size={16} aria-hidden="true" />
                          </button>
                        ))}
                      </section>
                    ))}
                  </div>
                </details>
              </OpsSection>

              <CommercialTraceabilityPanel
                token={token || ''}
                annualPlan={plan}
                executionPlans={executionPlans}
                events={events}
                canManage={canManage}
                canApproveException={canApprove}
                onChanged={load}
                onMessage={setMessage}
              />

              <BudgetReconciliationPanel
                token={token || ''}
                annualPlanId={text(plan.id)}
                planRevision={numberValue(plan.revision)}
                onMessage={setMessage}
              />

              {showItemEditor ? (
                <div id="portfolio-item-editor">
                  <OpsSection
                    title={
                      itemDraft.id
                        ? 'Edit monthly initiative'
                        : `Add initiative to ${MONTHS[itemDraft.month - 1]}`
                    }
                    subtitle="Set the portfolio allocation here. Detailed campaigns and event operations remain in their own workspaces."
                  >
                    <div className="annual-item-form">
                      <Field label="Month">
                        <select
                          disabled={!editable}
                          value={itemDraft.month}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              month: Number(event.target.value),
                              plannedStartDate: '',
                              plannedEndDate: '',
                            }))
                          }
                        >
                          {MONTHS.map((month, index) => (
                            <option value={index + 1} key={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Revenue line">
                        <select
                          disabled={!editable}
                          value={itemDraft.revenueLineId}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              revenueLineId: event.target.value,
                              commercialPlanId: '',
                            }))
                          }
                        >
                          <option value="">Choose revenue line</option>
                          {configuredLines.map((line) => (
                            <option key={text(line.id)} value={text(line.id)}>
                              {text(line.name)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Initiative title">
                        <input
                          disabled={!editable}
                          value={itemDraft.title}
                          onChange={(event) =>
                            setItemDraft((current) => ({ ...current, title: event.target.value }))
                          }
                          placeholder="Example: Ramadan leadership course"
                        />
                      </Field>
                      <Field label="Priority">
                        <select
                          disabled={!editable}
                          value={itemDraft.priority}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              priority: event.target.value,
                            }))
                          }
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </Field>
                      <Field label="Readiness">
                        <select
                          disabled={!editable}
                          value={itemDraft.readiness}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              readiness: event.target.value,
                            }))
                          }
                        >
                          <option value="planned">Planned</option>
                          <option value="needs_brief">Needs brief</option>
                          <option value="ready">Ready</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed</option>
                        </select>
                      </Field>
                      <Field label="Currency">
                        <select
                          disabled={!editable}
                          value={itemDraft.currency}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              currency: event.target.value,
                            }))
                          }
                        >
                          <option value="AED">AED</option>
                          <option value="USD">USD</option>
                        </select>
                      </Field>
                      <Field label="Budget allocation">
                        <input
                          disabled={!editable}
                          type="number"
                          min="0"
                          value={itemDraft.budgetAllocation}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              budgetAllocation: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Revenue target">
                        <input
                          disabled={!editable}
                          type="number"
                          min="0"
                          value={itemDraft.revenueTarget}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              revenueTarget: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Start date">
                        <input
                          disabled={!editable}
                          type="date"
                          value={itemDraft.plannedStartDate}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              plannedStartDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="End date">
                        <input
                          disabled={!editable}
                          type="date"
                          value={itemDraft.plannedEndDate}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              plannedEndDate: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Existing execution plan">
                        <select
                          disabled={!editable}
                          value={itemDraft.commercialPlanId}
                          onChange={(event) =>
                            setItemDraft((current) => ({
                              ...current,
                              commercialPlanId: event.target.value,
                            }))
                          }
                        >
                          <option value="">Create after saving (recommended)</option>
                          {compatibleExecutionPlans.map((candidate) => (
                            <option key={text(candidate.id)} value={text(candidate.id)}>
                              {text(candidate.title)}
                            </option>
                          ))}
                        </select>
                        <p>
                          Use an existing plan only for a deliberate legacy assignment. The normal
                          path is to save this initiative, then create its execution plan here.
                        </p>
                      </Field>
                      <Field label="Event Operations link">
                        <select
                          disabled={!editable}
                          value={itemDraft.eventId}
                          onChange={(event) =>
                            setItemDraft((current) => ({ ...current, eventId: event.target.value }))
                          }
                        >
                          <option value="">No event link</option>
                          {events.map((event) => (
                            <option key={text(event.id)} value={text(event.id)}>
                              {text(event.name)} - {dateInput(event.eventDate) || 'date pending'}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="annual-item-actions">
                      {editable ? (
                        <button
                          className="ops-button is-primary"
                          type="button"
                          onClick={saveItem}
                          disabled={saving}
                        >
                          <Save size={16} />
                          {saving ? 'Saving...' : 'Save initiative'}
                        </button>
                      ) : null}
                      <button
                        className="ops-button is-secondary"
                        type="button"
                        onClick={() => setShowItemEditor(false)}
                      >
                        Close
                      </button>
                      {itemDraft.id && editable ? (
                        <button
                          className="ops-text-button is-danger"
                          type="button"
                          onClick={archiveItem}
                        >
                          <Archive size={16} />
                          Archive
                        </button>
                      ) : null}
                      {itemDraft.commercialPlanId ? (
                        <button
                          className="ops-text-button"
                          type="button"
                          onClick={() =>
                            navigate(
                              `/commercial-plans?revenueLineType=${encodeURIComponent(text(selectedItemLine?.revenueLineType))}&planId=${encodeURIComponent(itemDraft.commercialPlanId)}`,
                            )
                          }
                        >
                          Open detailed plan <ArrowRight size={15} />
                        </button>
                      ) : null}
                      {itemDraft.eventId ? (
                        <button
                          className="ops-text-button"
                          type="button"
                          onClick={() => navigate(`/events/${itemDraft.eventId}`)}
                        >
                          Open Event Operations <ArrowRight size={15} />
                        </button>
                      ) : null}
                    </div>
                  </OpsSection>
                </div>
              ) : null}

              {executionPlanDraft ? (
                <div id="execution-plan-editor">
                  <OpsSection
                    title={`Create ${MONTHS[selectedMonth - 1]} execution plan`}
                    subtitle="This child plan will inherit its annual plan, month, revenue line, currency, budget, revenue target, event, and approved learning."
                  >
                    <div className="annual-execution-inheritance">
                      <div><span>Annual plan</span><strong>{text(plan.title)}</strong></div>
                      <div><span>Month</span><strong>{MONTHS[selectedMonth - 1]} {year}</strong></div>
                      <div><span>Budget</span><strong>{money(selectedMonthItems.find((item) => text(item.id) === executionPlanDraft.itemId)?.budgetAllocation, defaultCurrency)}</strong></div>
                      <div><span>Revenue target</span><strong>{money(selectedMonthItems.find((item) => text(item.id) === executionPlanDraft.itemId)?.revenueTarget, defaultCurrency)}</strong></div>
                    </div>
                    <div className="annual-execution-form">
                      <Field label="Execution plan title">
                        <input
                          value={executionPlanDraft.title}
                          onChange={(event) => setExecutionPlanDraft((current) => current ? ({ ...current, title: event.target.value }) : current)}
                          placeholder="Example: March leadership course launch"
                        />
                      </Field>
                      <Field label="Objective">
                        <textarea
                          rows={3}
                          value={executionPlanDraft.objective}
                          onChange={(event) => setExecutionPlanDraft((current) => current ? ({ ...current, objective: event.target.value }) : current)}
                          placeholder="What measurable result should this initiative deliver?"
                        />
                      </Field>
                      <Field label="Audience">
                        <textarea
                          rows={3}
                          value={executionPlanDraft.audience}
                          onChange={(event) => setExecutionPlanDraft((current) => current ? ({ ...current, audience: event.target.value }) : current)}
                          placeholder="Who are we selling to, and why are they likely to buy?"
                        />
                      </Field>
                      <Field label="Strategy">
                        <textarea
                          rows={4}
                          value={executionPlanDraft.strategySummary}
                          onChange={(event) => setExecutionPlanDraft((current) => current ? ({ ...current, strategySummary: event.target.value }) : current)}
                          placeholder="How should approved historical learning shape this launch?"
                        />
                      </Field>
                      <Field label="Action plan">
                        <textarea
                          rows={4}
                          value={executionPlanDraft.actionPlan}
                          onChange={(event) => setExecutionPlanDraft((current) => current ? ({ ...current, actionPlan: event.target.value }) : current)}
                          placeholder="List the content, campaign, CRM follow-up, sales, and reporting work."
                        />
                      </Field>
                    </div>
                    <div className="annual-item-actions">
                      <button className="ops-button is-primary" type="button" onClick={createExecutionPlan} disabled={saving}>
                        <Save size={16} aria-hidden="true" />
                        {saving ? 'Creating...' : 'Create and link execution plan'}
                      </button>
                      <button className="ops-button is-secondary" type="button" onClick={() => setExecutionPlanDraft(null)}>
                        Cancel
                      </button>
                      <button
                        className="ops-button is-secondary"
                        type="button"
                        onClick={() => navigate(`/stitchi?mode=prepare&annualPlanId=${encodeURIComponent(text(plan.id))}&monthlyPortfolioItemId=${encodeURIComponent(executionPlanDraft.itemId)}&prompt=${encodeURIComponent(`Prepare an execution plan for the ${MONTHS[selectedMonth - 1]} monthly initiative. Inherit its approved annual strategy, targets, event, and learning. Ask for any missing objective or audience before proposing the governed save action.`)}`)}
                      >
                        <Sparkles size={16} aria-hidden="true" />
                        Prepare with Stitchi
                      </button>
                    </div>
                  </OpsSection>
                </div>
              ) : null}

              {asList(rollup.currencies).length > 1 ? (
                <OpsNotice tone="info">
                  This portfolio contains more than one currency. Tanaghum keeps each currency in a
                  separate rollup and does not convert or combine them.
                </OpsNotice>
              ) : null}

              {lifecycleDialog ? (
                <div className="annual-dialog-backdrop" role="presentation">
                  <section
                    className="annual-lifecycle-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="annual-lifecycle-dialog-title"
                  >
                    <header>
                      <div>
                        <span>{lifecycleDialog === 'archive' ? 'Lifecycle control' : 'Scenario recovery'}</span>
                        <h2 id="annual-lifecycle-dialog-title">
                          {lifecycleDialog === 'archive'
                            ? 'Archive this annual plan?'
                            : 'Create a new draft scenario?'}
                        </h2>
                      </div>
                      <button
                        className="ops-icon-button"
                        type="button"
                        aria-label="Close dialog"
                        onClick={() => setLifecycleDialog(null)}
                        disabled={saving}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </header>
                    <p>
                      {lifecycleDialog === 'archive'
                        ? 'Archiving makes this scenario permanently read-only. Monthly initiatives can no longer be added or edited. The record remains available for audit and comparison.'
                        : 'Tanaghum will preserve this archived scenario and create the next version as a draft. Annual direction and approved learning will be copied; historical monthly execution links will not be reused.'}
                    </p>
                    <Field
                      label={lifecycleDialog === 'archive' ? 'Reason for archiving' : 'Reason for the new scenario'}
                    >
                      <textarea
                        autoFocus
                        rows={3}
                        value={lifecycleReason}
                        onChange={(event) => setLifecycleReason(event.target.value)}
                        placeholder={
                          lifecycleDialog === 'archive'
                            ? 'Example: Year closed and final results recorded.'
                            : 'Example: Continue monthly planning after the previous scenario was archived.'
                        }
                      />
                    </Field>
                    <footer>
                      <button
                        className="ops-button is-secondary"
                        type="button"
                        onClick={() => setLifecycleDialog(null)}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className={lifecycleDialog === 'archive' ? 'ops-button is-danger' : 'ops-button is-primary'}
                        type="button"
                        onClick={confirmLifecycleAction}
                        disabled={saving || lifecycleReason.trim().length < 3}
                      >
                        {saving
                          ? 'Saving...'
                          : lifecycleDialog === 'archive'
                            ? 'Confirm archive'
                            : 'Create draft scenario'}
                      </button>
                    </footer>
                  </section>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </OpsPage>
  );
}

function AnnualMetric({
  label,
  value,
  detail,
  icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={warning ? 'is-warning' : ''}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function LearningSelector({
  learningSets,
  selected,
  onChange,
  disabled = false,
}: {
  learningSets: Data[];
  selected: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="annual-learning-selector" disabled={disabled}>
      <legend>Approved historical learning</legend>
      {learningSets.length ? (
        learningSets.map((set) => {
          const id = text(set.id);
          const checked = selected.includes(id);
          return (
            <label key={id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(checked ? selected.filter((value) => value !== id) : [...selected, id])
                }
              />
              <span>
                <strong>{text(set.title, 'Approved learning')}</strong>
                <small>
                  {asList(set.findings).length} approved finding
                  {asList(set.findings).length === 1 ? '' : 's'}
                </small>
              </span>
            </label>
          );
        })
      ) : (
        <p>No approved learning sets are available yet. Complete Assessment first.</p>
      )}
    </fieldset>
  );
}

function AnnualStatusActions({
  status,
  canManage,
  canApprove,
  saving,
  reason,
  setReason,
  onTransition,
  onArchiveRequest,
}: {
  status: string;
  canManage: boolean;
  canApprove: boolean;
  saving: boolean;
  reason: string;
  setReason: (value: string) => void;
  onTransition: (
    action: 'submit' | 'approve' | 'reject' | 'activate' | 'close',
  ) => void;
  onArchiveRequest: () => void;
}) {
  return (
    <div className="annual-status-actions">
      <div>
        <Clock3 size={17} aria-hidden="true" />
        <span>
          <strong>Governed lifecycle</strong>
          <small>
            Draft, approval, activation, closeout, and archive are recorded in the activity log.
          </small>
        </span>
      </div>
      <div className="annual-status-buttons">
        {canManage && ['draft', 'rejected'].includes(status) ? (
          <button
            className="ops-button is-primary"
            type="button"
            disabled={saving}
            onClick={() => onTransition('submit')}
          >
            <Check size={16} />
            Submit for approval
          </button>
        ) : null}
        {canApprove && status === 'pending_approval' ? (
          <button
            className="ops-button is-primary"
            type="button"
            disabled={saving}
            onClick={() => onTransition('approve')}
          >
            <Check size={16} />
            Approve
          </button>
        ) : null}
        {canApprove && status === 'pending_approval' ? (
          <label>
            <span>Reason for changes</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What must change?"
            />
            <button
              className="ops-button is-secondary"
              type="button"
              disabled={saving}
              onClick={() => onTransition('reject')}
            >
              Request changes
            </button>
          </label>
        ) : null}
        {canManage && status === 'approved' ? (
          <button
            className="ops-button is-primary"
            type="button"
            disabled={saving}
            onClick={() => onTransition('activate')}
          >
            Activate plan
          </button>
        ) : null}
        {canManage && status === 'active' ? (
          <button
            className="ops-button is-secondary"
            type="button"
            disabled={saving}
            onClick={() => onTransition('close')}
          >
            Close year
          </button>
        ) : null}
        {canManage && ['draft', 'rejected', 'approved', 'closed'].includes(status) ? (
          <button
            className="ops-text-button"
            type="button"
            disabled={saving}
            onClick={onArchiveRequest}
          >
            <Archive size={15} />
            Archive
          </button>
        ) : null}
      </div>
    </div>
  );
}
