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
} from 'lucide-react';
import {
  annualCommercialPlanningApi,
  commercialAssessmentApi,
  commercialCommandCenterApi,
  eventsApi,
} from '../api';
import { CommercialWorkspaceNav } from '../components/CommercialWorkspaceNav';
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
  const [decisionReason, setDecisionReason] = useState('');
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
        annualList.find((candidate) => ['active', 'approved'].includes(text(candidate.status))) ||
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
    action: 'submit' | 'approve' | 'reject' | 'activate' | 'close' | 'archive',
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
        archive: 'archived',
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

  function startNewItem(month: number) {
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

  function monthItems(month: number) {
    return items.filter((item) => numberValue(item.month) === month);
  }

  const stitchiPrompt = `Help me prepare the ${year} annual commercial strategy. Review approved historical learning, annual AED budget and revenue targets, then propose the monthly product and event portfolio. Do not save or call external systems without approval.`;

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
                navigate(`/stitchi?mode=prepare&prompt=${encodeURIComponent(stitchiPrompt)}`)
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
            {plans.length > 1 ? (
              <label>
                <span>Plan version</span>
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
                />
              </OpsSection>

              <OpsSection
                title="Twelve-month portfolio"
                subtitle="Place each product or event in its intended month. Empty months are valid planning decisions."
                action={
                  editable ? (
                    <button
                      className="ops-button is-primary"
                      type="button"
                      onClick={() => startNewItem(1)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add initiative
                    </button>
                  ) : undefined
                }
              >
                <div className="annual-quarter-grid">
                  {QUARTERS.map((quarter) => (
                    <section
                      key={quarter.label}
                      className="annual-quarter"
                      aria-labelledby={`quarter-${quarter.label}`}
                    >
                      <header>
                        <strong id={`quarter-${quarter.label}`}>{quarter.label}</strong>
                        <span>
                          {quarter.months.reduce(
                            (total, month) => total + monthItems(month).length,
                            0,
                          )}{' '}
                          planned
                        </span>
                      </header>
                      {quarter.months.map((month) => {
                        const records = monthItems(month);
                        return (
                          <div className="annual-month" key={month}>
                            <div className="annual-month-heading">
                              <div>
                                <strong>{MONTHS[month - 1]}</strong>
                                <small>
                                  {records.length
                                    ? `${records.length} initiative${records.length === 1 ? '' : 's'}`
                                    : 'Intentionally open'}
                                </small>
                              </div>
                              {editable ? (
                                <button
                                  type="button"
                                  aria-label={`Add initiative to ${MONTHS[month - 1]}`}
                                  onClick={() => startNewItem(month)}
                                >
                                  <Plus size={16} />
                                </button>
                              ) : null}
                            </div>
                            <div className="annual-month-items">
                              {records.map((item) => {
                                const line = asData(item.revenueLine);
                                return (
                                  <button
                                    key={text(item.id)}
                                    type="button"
                                    className="annual-initiative"
                                    onClick={() => editItem(item)}
                                  >
                                    <span>
                                      <strong>{text(item.title)}</strong>
                                      <small>
                                        {text(line.name)} /{' '}
                                        {money(
                                          item.budgetAllocation,
                                          text(item.currency, defaultCurrency),
                                        )}
                                      </small>
                                    </span>
                                    <OpsStatus tone={statusTone(text(item.readiness))}>
                                      {titleCase(text(item.readiness))}
                                    </OpsStatus>
                                    <ChevronRight size={16} aria-hidden="true" />
                                  </button>
                                );
                              })}
                              {!records.length ? <p>No product or event planned.</p> : null}
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </div>
              </OpsSection>

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
                      <Field label="Detailed commercial plan">
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
                          <option value="">Link later</option>
                          {compatibleExecutionPlans.map((candidate) => (
                            <option key={text(candidate.id)} value={text(candidate.id)}>
                              {text(candidate.title)}
                            </option>
                          ))}
                        </select>
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

              {asList(rollup.currencies).length > 1 ? (
                <OpsNotice tone="info">
                  This portfolio contains more than one currency. Tanaghum keeps each currency in a
                  separate rollup and does not convert or combine them.
                </OpsNotice>
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
}: {
  status: string;
  canManage: boolean;
  canApprove: boolean;
  saving: boolean;
  reason: string;
  setReason: (value: string) => void;
  onTransition: (
    action: 'submit' | 'approve' | 'reject' | 'activate' | 'close' | 'archive',
  ) => void;
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
            onClick={() => onTransition('archive')}
          >
            <Archive size={15} />
            Archive
          </button>
        ) : null}
      </div>
    </div>
  );
}
