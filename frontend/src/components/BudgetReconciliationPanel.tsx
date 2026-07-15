import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  CornerDownRight,
  LockKeyhole,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { commercialBudgetApi } from '../api';
import { formatCurrency } from '../lib/currency';
import { Field } from './ProductUI';
import { OpsEmpty, OpsNotice, OpsSection, OpsSkeleton, OpsStatus } from './OperationalUI';
import './BudgetReconciliationPanel.css';

type Data = Record<string, unknown>;
type Props = {
  token: string;
  annualPlanId: string;
  planRevision: number;
  onMessage: (message: string) => void;
};

function data(value: unknown): Data {
  return value && typeof value === 'object' ? (value as Data) : {};
}

function list(value: unknown): Data[] {
  return Array.isArray(value) ? (value as Data[]) : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency: string) {
  return formatCurrency(numberValue(value), currency === 'USD' ? 'USD' : 'AED');
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function flattenAllocations(records: Data[]): Data[] {
  return records.flatMap((record) => [record, ...flattenAllocations(list(record.children))]);
}

function statusTone(status: string): 'neutral' | 'positive' | 'warning' | 'info' {
  if (status === 'committed') return 'positive';
  if (status === 'approved') return 'info';
  if (status === 'planned') return 'warning';
  return 'neutral';
}

export function BudgetReconciliationPanel({ token, annualPlanId, planRevision, onMessage }: Props) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [createTargetKey, setCreateTargetKey] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [allowException, setAllowException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(data(await commercialBudgetApi.reconciliation(annualPlanId, token)));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Budget reconciliation could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [annualPlanId, onMessage, token]);

  useEffect(() => {
    if (!Number.isFinite(planRevision)) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, planRevision]);

  const allocations = useMemo(
    () => flattenAllocations(list(summary?.allocations)),
    [summary],
  );
  const selected = allocations.find((allocation) => text(allocation.id) === selectedAllocationId);
  const permissions = data(summary?.permissions);
  const canManage = Boolean(permissions.canManage);
  const canApprove = Boolean(permissions.canApprove);
  const annualPlan = data(summary?.annualPlan);
  const monthlyItems = useMemo(() => list(summary?.monthlyItems), [summary]);
  const availableTargets = useMemo(() => list(summary?.availableTargets), [summary]);
  const allocatedTargetIds = useMemo(
    () => new Set(allocations.map((allocation) => text(data(allocation.target).id)).filter(Boolean)),
    [allocations],
  );
  const createOptions = useMemo(() => {
    const roots = monthlyItems
      .filter((item) => !text(item.allocationId))
      .map((item) => ({
        key: `monthly_item:${text(item.id)}:root`,
        level: 'monthly_item',
        id: text(item.id),
        label: `${text(item.title)} - ${titleCase(text(item.revenueLineName))}`,
        parentAllocationId: null,
        currency: text(item.currency, text(annualPlan.currency, 'AED')),
        suggestedAmount: numberValue(item.requestedTarget),
      }));
    const children = availableTargets
      .filter((target) => !allocatedTargetIds.has(text(target.id)))
      .map((target) => {
        const parent = allocations.find(
          (allocation) => text(data(allocation.target).id) === text(target.parentTargetId),
        );
        if (!parent) return null;
        return {
          key: `${text(target.level)}:${text(target.id)}:${text(parent.id)}`,
          level: text(target.level),
          id: text(target.id),
          label: `${titleCase(text(target.level))}: ${text(target.label)}`,
          parentAllocationId: text(parent.id),
          currency: text(parent.currency, 'AED'),
          suggestedAmount: 0,
        };
      })
      .filter(Boolean) as Array<{
        key: string;
        level: string;
        id: string;
        label: string;
        parentAllocationId: string | null;
        currency: string;
        suggestedAmount: number;
      }>;
    return [...roots, ...children];
  }, [allocations, allocatedTargetIds, annualPlan.currency, availableTargets, monthlyItems]);

  const selectedCreate = createOptions.find((option) => option.key === createTargetKey);

  function startCreate(key: string) {
    const option = createOptions.find((candidate) => candidate.key === key);
    setSelectedAllocationId('');
    setCreateTargetKey(key);
    setAmount(String(option?.suggestedAmount || ''));
    setReason('Allocate budget for approved commercial work');
    setAllowException(false);
    setExceptionReason('');
  }

  function startEdit(allocation: Data) {
    setCreateTargetKey('');
    setSelectedAllocationId(text(allocation.id));
    setAmount(String(numberValue(allocation.amount)));
    setReason('Update allocation based on the latest approved plan');
    setAllowException(false);
    setExceptionReason('');
  }

  async function createAllocation() {
    if (!selectedCreate || !amount || reason.trim().length < 3) return;
    setSaving(true);
    try {
      const targetFields: Record<string, string> = {
        monthly_item: 'monthlyPortfolioItemId',
        commercial_plan: 'commercialPlanId',
        event: 'eventId',
        campaign: 'campaignId',
      };
      const result = await commercialBudgetApi.createAllocation(
        annualPlanId,
        {
          level: selectedCreate.level,
          parentAllocationId: selectedCreate.parentAllocationId,
          [targetFields[selectedCreate.level]]: selectedCreate.id,
          currency: selectedCreate.currency,
          amount: Number(amount),
          reason: reason.trim(),
          allowOverAllocation: allowException,
          exceptionReason: allowException ? exceptionReason.trim() : undefined,
        },
        token,
      );
      setSummary(data(result));
      setCreateTargetKey('');
      onMessage('Budget allocation saved. It remains planned until an executive approves it.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Budget allocation could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function reallocate() {
    if (!selected || !amount || reason.trim().length < 3) return;
    setSaving(true);
    try {
      const result = await commercialBudgetApi.reallocate(
        annualPlanId,
        text(selected.id),
        {
          expectedRevision: numberValue(selected.revision),
          amount: Number(amount),
          reason: reason.trim(),
          allowOverAllocation: allowException,
          exceptionReason: allowException ? exceptionReason.trim() : undefined,
        },
        token,
      );
      setSummary(data(result));
      setSelectedAllocationId('');
      onMessage('Budget reallocated with a permanent audit record.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Budget could not be reallocated.');
    } finally {
      setSaving(false);
    }
  }

  async function transition(action: 'approve' | 'commit' | 'archive') {
    if (!selected || reason.trim().length < 3) return;
    setSaving(true);
    try {
      const result = await commercialBudgetApi.transition(
        annualPlanId,
        text(selected.id),
        action,
        { expectedRevision: numberValue(selected.revision), reason: reason.trim() },
        token,
      );
      setSummary(data(result));
      setSelectedAllocationId('');
      onMessage(`Budget ${action === 'approve' ? 'approved' : action === 'commit' ? 'committed' : 'archived'}.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Budget status could not be changed.');
    } finally {
      setSaving(false);
    }
  }

  function askStitchi() {
    const params = new URLSearchParams({ annualPlanId, mode: 'prepare' });
    if (selected) {
      params.set('budgetAllocationId', text(selected.id));
      params.set('budgetRevision', String(numberValue(selected.revision)));
      params.set('budgetLevel', text(selected.level));
      params.set('budgetTargetId', text(data(selected.target).id));
      params.set('budgetCurrency', text(selected.currency, 'AED'));
      params.set('prompt', `Review this ${titleCase(text(selected.level))} budget allocation and tell me whether it should be reallocated, approved, or committed. Current amount: ${numberValue(selected.amount)} ${text(selected.currency, 'AED')}. Do not change it until I approve.`);
    } else if (selectedCreate) {
      params.set('budgetLevel', selectedCreate.level);
      params.set('budgetTargetId', selectedCreate.id);
      params.set('budgetCurrency', selectedCreate.currency);
      if (selectedCreate.parentAllocationId) params.set('parentAllocationId', selectedCreate.parentAllocationId);
      params.set('prompt', `Help me allocate budget to ${selectedCreate.label}. Ask for the amount if I have not supplied it, then prepare the governed allocation for approval.`);
    }
    navigate(`/stitchi?${params.toString()}`);
  }

  if (loading) {
    return (
      <OpsSection title="Budget control" subtitle="Reconciling the approved envelope and verified spend.">
        <OpsSkeleton rows={4} />
      </OpsSection>
    );
  }

  if (!summary) return null;
  const evidence = data(summary.evidence);

  return (
    <OpsSection
      title="Budget control"
      subtitle="Move the annual budget through months, plans, events, and campaigns. Actual spend counts only after evidence is verified."
      action={
        <button className="ops-icon-button" type="button" onClick={() => void load()} aria-label="Refresh budget control" title="Refresh budget control">
          <RefreshCw size={17} />
        </button>
      }
    >
      <div className="budget-currency-grid" aria-label="Budget reconciliation by currency">
        {list(summary.currencies).map((currency) => {
          const code = text(currency.currency, 'AED');
          const envelope = currency.annualEnvelope == null ? null : numberValue(currency.annualEnvelope);
          const allocated = numberValue(currency.allocated);
          const percentage = envelope && envelope > 0 ? Math.min(100, (allocated / envelope) * 100) : 0;
          return (
            <article className="budget-currency" key={code}>
              <div className="budget-currency-heading">
                <span><CircleDollarSign size={18} /> {code} budget</span>
                <OpsStatus tone={currency.overAllocated === true ? 'warning' : 'positive'}>
                  {currency.envelopeMissing === true ? 'Separate envelope' : currency.overAllocated === true ? 'Over allocated' : 'In balance'}
                </OpsStatus>
              </div>
              <strong>{envelope == null ? 'No annual envelope' : money(envelope, code)}</strong>
              <div className="budget-progress" aria-label={`${code} allocation progress`}>
                <span style={{ width: `${percentage}%` }} />
              </div>
              <dl>
                <div><dt>Allocated</dt><dd>{money(currency.allocated, code)}</dd></div>
                <div><dt>Committed</dt><dd>{money(currency.committed, code)}</dd></div>
                <div><dt>Verified actual</dt><dd>{money(currency.verifiedActual, code)}</dd></div>
                <div><dt>Unallocated</dt><dd>{currency.remaining == null ? 'Not combined' : money(currency.remaining, code)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>

      {evidence.sourceMissing === true ? (
        <OpsNotice tone="warning">
          No verified actual-spend source is available yet. Connect an analytics source or submit KPI evidence for executive review; unverified entries are excluded.
        </OpsNotice>
      ) : (
        <OpsNotice tone="positive">
          {numberValue(evidence.verifiedCount)} verified record(s) support actual spend. {numberValue(evidence.unverifiedCount)} unverified record(s) remain excluded.
        </OpsNotice>
      )}

      <div className="budget-workspace" data-testid="budget-reconciliation-workspace">
        <div className="budget-allocation-list">
          <header>
            <div>
              <strong>Allocation path</strong>
              <p>Requested targets stay visible; governed amounts move only through this control.</p>
            </div>
            {canManage && createOptions.length ? (
              <select value={createTargetKey} onChange={(event) => startCreate(event.target.value)} aria-label="Choose work to allocate">
                <option value="">Add allocation...</option>
                {createOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            ) : null}
          </header>
          {!allocations.length ? (
            <OpsEmpty title="No governed allocations yet" message="Start with a monthly initiative, then allocate its linked plan, event, or campaign." />
          ) : (
            <div className="budget-rows">
              {allocations.map((allocation) => {
                const target = data(allocation.target);
                const depth = text(allocation.level) === 'monthly_item' ? 0 : text(allocation.level) === 'commercial_plan' ? 1 : 2;
                return (
                  <button
                    key={text(allocation.id)}
                    data-allocation-id={text(allocation.id)}
                    type="button"
                    className={selectedAllocationId === text(allocation.id) ? 'is-selected' : ''}
                    onClick={() => startEdit(allocation)}
                    style={{ '--budget-depth': depth } as CSSProperties}
                  >
                    <span className="budget-row-title">
                      {depth ? <CornerDownRight size={15} aria-hidden="true" /> : null}
                      <span><strong>{text(target.label)}</strong><small>{titleCase(text(allocation.level))}</small></span>
                    </span>
                    <span className="budget-row-money"><strong>{money(allocation.amount, text(allocation.currency))}</strong><small>{money(allocation.verifiedActual, text(allocation.currency))} actual</small></span>
                    <OpsStatus tone={statusTone(text(allocation.status))}>{titleCase(text(allocation.status))}</OpsStatus>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="budget-editor" aria-label="Governed budget editor">
          {!selected && !selectedCreate ? (
            <div className="budget-editor-empty">
              <LockKeyhole size={24} />
              <strong>Select an allocation</strong>
              <p>Review its balance, change the amount, or move it through approval.</p>
            </div>
          ) : (
            <>
              <header>
                <strong>{selectedCreate ? `Allocate ${selectedCreate.label}` : text(data(selected?.target).label)}</strong>
                <small>{selectedCreate ? 'New planned allocation' : `${titleCase(text(selected?.status))} / revision ${numberValue(selected?.revision)}`}</small>
              </header>
              <Field label={`Amount (${selectedCreate?.currency || text(selected?.currency, 'AED')})`}>
                <input type="number" min="0" step="0.01" value={amount} disabled={!canManage} onChange={(event) => setAmount(event.target.value)} />
              </Field>
              <Field label="Business reason">
                <textarea rows={3} value={reason} disabled={!canManage && !canApprove} onChange={(event) => setReason(event.target.value)} />
              </Field>
              {canApprove ? (
                <label className="budget-exception-toggle">
                  <input type="checkbox" checked={allowException} onChange={(event) => setAllowException(event.target.checked)} />
                  <span>Approve an exception if this exceeds the parent envelope</span>
                </label>
              ) : null}
              {allowException ? (
                <Field label="Exception reason">
                  <textarea rows={2} value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} />
                </Field>
              ) : null}
              {selected ? (
                <div className="budget-editor-balance">
                  <span>Child allocations <strong>{money(selected.childAllocated, text(selected.currency))}</strong></span>
                  <span>Available to children <strong>{money(selected.childRemaining, text(selected.currency))}</strong></span>
                  <span>Verified actual <strong>{money(selected.verifiedActual, text(selected.currency))}</strong></span>
                  <span>Variance <strong>{money(selected.variance, text(selected.currency))}</strong></span>
                </div>
              ) : null}
              <div className="budget-editor-actions">
                <button className="ops-button is-secondary" type="button" onClick={askStitchi}>Ask Stitchi</button>
                {selectedCreate && canManage ? (
                  <button className="ops-button is-primary" type="button" disabled={saving} onClick={() => void createAllocation()}><Plus size={16} /> Save allocation</button>
                ) : null}
                {selected && canManage && text(selected.status) !== 'committed' ? (
                  <button className="ops-button is-primary" type="button" disabled={saving} onClick={() => void reallocate()}><Check size={16} /> Save change</button>
                ) : null}
                {selected && canApprove && text(selected.status) === 'planned' ? (
                  <button className="ops-button is-secondary" type="button" disabled={saving} onClick={() => void transition('approve')}>Approve</button>
                ) : null}
                {selected && canApprove && text(selected.status) === 'approved' ? (
                  <button className="ops-button is-secondary" type="button" disabled={saving} onClick={() => void transition('commit')}>Commit</button>
                ) : null}
                {selected && canManage && text(selected.status) !== 'committed' ? (
                  <button className="ops-button is-ghost" type="button" disabled={saving} onClick={() => void transition('archive')}>Archive</button>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>

      {numberValue(evidence.verifiedCount) > 0 ? (
        <details className="budget-evidence">
          <summary>View verified spend evidence</summary>
          <div className="budget-evidence-list">
            {list(evidence.records).map((record) => (
              <div key={text(record.id)}>
                <span><strong>{text(record.sourceName, titleCase(text(record.sourceType)))}</strong><small>{new Date(text(record.metricDate)).toLocaleDateString()} / {titleCase(text(record.channel))}</small></span>
                <strong>{money(record.spend, text(record.currency, 'AED'))}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {list(summary.currencies).some((currency) => Boolean(currency.overAllocated)) ? (
        <p className="budget-warning"><AlertTriangle size={16} /> An approved exception exists or an envelope is exceeded. Keep currencies separate and review the recorded reason before execution.</p>
      ) : null}
    </OpsSection>
  );
}
