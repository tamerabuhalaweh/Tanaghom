import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { commercialWeeklyOperationsApi } from '../api';
import { formatCurrency } from '../lib/currency';
import { Field } from './ProductUI';
import { OpsEmpty, OpsNotice, OpsSection, OpsSkeleton, OpsStatus } from './OperationalUI';
import './WeeklyOperatingWorkspace.css';

type WeeklyStatus =
  | 'planned'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled';

type WeeklyPriority = 'low' | 'medium' | 'high' | 'critical';
type WeeklyLinkType = 'content_item' | 'campaign' | 'event' | 'lead' | 'discipline_record' | 'connector_evidence';

interface WeeklyWorkItem {
  id: string;
  commercialPlanId: string;
  weekStartDate: string;
  weekEndDate: string;
  title: string;
  businessOutcome: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: WeeklyStatus;
  priority: WeeklyPriority;
  budgetGuardrail: number | null;
  currency: 'AED' | 'USD';
  linkType: WeeklyLinkType | null;
  linkObjectId: string | null;
  linkLabel: string | null;
  blockerReason: string | null;
  completionEvidence: string | null;
  revision: number;
  createdByUserId: string;
}

interface WeeklyWorkspace {
  timezone: string;
  selectedWeek: { startDate: string; endDate: string; label: string };
  plan: {
    id: string;
    title: string;
    status: string;
    currency: 'AED' | 'USD';
    budgetTarget: number | null;
    revenueTarget: number | null;
    revenueLineName: string;
    annualPlanId: string | null;
    annualPlanTitle: string | null;
    annualPlanYear: number | null;
    monthlyPortfolioItemId: string | null;
    monthlyPortfolioTitle: string | null;
    monthlyPortfolioMonth: number | null;
    periodStartDate: string | null;
    periodEndDate: string | null;
  };
  rollup: {
    itemCount: number;
    completedCount: number;
    blockedCount: number;
    awaitingApprovalCount: number;
    budgetGuardrail: number;
    remainingPlanBudget: number | null;
  };
  owners: Array<{ id: string; name: string; role: string }>;
  linkOptions: Array<{ type: WeeklyLinkType; id: string; label: string }>;
  items: WeeklyWorkItem[];
}

interface WeeklyDraft {
  title: string;
  businessOutcome: string;
  ownerUserId: string;
  startDate: string;
  dueDate: string;
  priority: WeeklyPriority;
  budgetGuardrail: string;
  linkKey: string;
}

const MANAGER_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];
const CONTRIBUTOR_ROLES = [...MANAGER_ROLES, 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TRANSITIONS: Record<WeeklyStatus, WeeklyStatus[]> = {
  planned: ['ready', 'in_progress', 'blocked', 'awaiting_approval', 'cancelled'],
  ready: ['in_progress', 'blocked', 'awaiting_approval', 'cancelled'],
  in_progress: ['blocked', 'awaiting_approval', 'completed', 'cancelled'],
  blocked: ['ready', 'in_progress', 'awaiting_approval', 'cancelled'],
  awaiting_approval: ['planned', 'ready', 'cancelled'],
  completed: [],
  cancelled: [],
};

function emptyDraft(): WeeklyDraft {
  return {
    title: '',
    businessOutcome: '',
    ownerUserId: '',
    startDate: '',
    dueDate: '',
    priority: 'medium',
    budgetGuardrail: '',
    linkKey: '',
  };
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

function dateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? 'Not set'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function label(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function timezoneLabel(value: string): string {
  const location = value.split('/').at(-1)?.replaceAll('_', ' ') || value;
  return `${location} time`;
}

function statusTone(status: WeeklyStatus): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  if (status === 'completed' || status === 'ready') return 'positive';
  if (status === 'blocked' || status === 'cancelled') return 'danger';
  if (status === 'awaiting_approval' || status === 'planned') return 'warning';
  if (status === 'in_progress') return 'info';
  return 'neutral';
}

function priorityTone(priority: WeeklyPriority): 'neutral' | 'warning' | 'danger' | 'info' {
  if (priority === 'critical') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'info';
  return 'neutral';
}

function money(value: number | null, currency: 'AED' | 'USD'): string {
  return value == null ? 'Not set' : formatCurrency(value, currency);
}

function draftFrom(item: WeeklyWorkItem): WeeklyDraft {
  return {
    title: item.title,
    businessOutcome: item.businessOutcome,
    ownerUserId: item.ownerUserId || '',
    startDate: item.startDate || '',
    dueDate: item.dueDate || '',
    priority: item.priority,
    budgetGuardrail: item.budgetGuardrail?.toString() || '',
    linkKey: item.linkType && item.linkObjectId ? `${item.linkType}::${item.linkObjectId}` : '',
  };
}

export function WeeklyOperatingWorkspace({
  commercialPlanId,
  token,
  currentUserId,
  currentUserRole,
  onAskStitchi,
}: {
  commercialPlanId?: string;
  token: string;
  currentUserId?: string;
  currentUserRole: string;
  onAskStitchi: (weekStart: string) => void;
}) {
  const role = normalizeRole(currentUserRole);
  const canManage = MANAGER_ROLES.includes(role);
  const canContribute = CONTRIBUTOR_ROLES.includes(role);
  const canApprove = role === 'cco';
  const [weekOf, setWeekOf] = useState(() => dateInTimezone('Asia/Dubai'));
  const [workspace, setWorkspace] = useState<WeeklyWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [draft, setDraft] = useState<WeeklyDraft>(emptyDraft());
  const [transitionTarget, setTransitionTarget] = useState<WeeklyStatus | ''>('');
  const [transitionDetail, setTransitionDetail] = useState('');

  const load = useCallback(async (preferredItemId?: string) => {
    if (!commercialPlanId || !token) return;
    setLoading(true);
    setFeedback('');
    try {
      const result = await commercialWeeklyOperationsApi.workspace(commercialPlanId, token, weekOf) as WeeklyWorkspace;
      setWorkspace(result);
      setSelectedItemId(current => {
        const requested = preferredItemId || current;
        if (requested && result.items.some(item => item.id === requested)) return requested;
        return result.items.find(item => item.ownerUserId === currentUserId)?.id || result.items[0]?.id || '';
      });
    } catch (error) {
      setWorkspace(null);
      setFeedback(error instanceof Error ? error.message : 'Could not load weekly operations.');
    } finally {
      setLoading(false);
    }
  }, [commercialPlanId, currentUserId, token, weekOf]);

  useEffect(() => {
    if (!commercialPlanId || !token) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [commercialPlanId, load, token]);

  const selectedItem = useMemo(
    () => workspace?.items.find(item => item.id === selectedItemId) || null,
    [selectedItemId, workspace?.items],
  );
  const selectedOwner = workspace?.owners.find(owner => owner.id === draft.ownerUserId);
  const selectedLink = workspace?.linkOptions.find(option => `${option.type}::${option.id}` === draft.linkKey);
  const planBudget = workspace?.plan.budgetTarget ?? null;
  const remainingBudget = workspace?.rollup.remainingPlanBudget ?? null;
  const allocatedBudget = planBudget != null && remainingBudget != null ? Math.max(0, planBudget - remainingBudget) : null;
  const budgetUsedPercent = planBudget && allocatedBudget != null ? Math.min(100, Math.round((allocatedBudget / planBudget) * 100)) : 0;
  const isAssigned = Boolean(selectedItem && currentUserId && selectedItem.ownerUserId === currentUserId);
  const canUpdateSelected = Boolean(selectedItem && (canManage || (canContribute && isAssigned)));
  const availableTransitions = selectedItem
    ? TRANSITIONS[selectedItem.status].filter(target => {
        if (selectedItem.status === 'awaiting_approval') {
          if (target === 'ready') return canApprove;
          return canManage;
        }
        return canUpdateSelected;
      })
    : [];

  function navigateWeek(days: number) {
    if (!workspace) return;
    setEditorMode(null);
    setTransitionTarget('');
    setTransitionDetail('');
    setWeekOf(addDays(workspace.selectedWeek.startDate, days));
  }

  function openCreate() {
    setDraft(emptyDraft());
    setEditorMode('create');
    setFeedback('');
  }

  function openEdit(item: WeeklyWorkItem) {
    setSelectedItemId(item.id);
    setDraft(draftFrom(item));
    setEditorMode('edit');
    setFeedback('');
  }

  async function saveItem() {
    if (!workspace || !commercialPlanId || !token) return;
    if (draft.title.trim().length < 3 || draft.businessOutcome.trim().length < 3) {
      setFeedback('Enter a clear work title and the business outcome it should create.');
      return;
    }
    setSaving(true);
    setFeedback('');
    const payload = {
      title: draft.title.trim(),
      businessOutcome: draft.businessOutcome.trim(),
      ownerUserId: draft.ownerUserId || null,
      ownerRole: selectedOwner?.role || null,
      startDate: draft.startDate || null,
      dueDate: draft.dueDate || null,
      priority: draft.priority,
      budgetGuardrail: draft.budgetGuardrail === '' ? null : Number(draft.budgetGuardrail),
      currency: workspace.plan.currency,
      linkType: selectedLink?.type || null,
      linkObjectId: selectedLink?.id || null,
      linkLabel: selectedLink?.label || null,
    };
    try {
      let saved: WeeklyWorkItem;
      if (editorMode === 'edit' && selectedItem) {
        saved = await commercialWeeklyOperationsApi.updateItem(
          commercialPlanId,
          selectedItem.id,
          { ...payload, expectedRevision: selectedItem.revision },
          token,
        ) as WeeklyWorkItem;
      } else {
        saved = await commercialWeeklyOperationsApi.createItem(
          commercialPlanId,
          { ...payload, weekStartDate: workspace.selectedWeek.startDate, status: 'planned' },
          token,
        ) as WeeklyWorkItem;
      }
      setEditorMode(null);
      setDraft(emptyDraft());
      await load(saved.id);
      setFeedback(editorMode === 'edit' ? 'Weekly work updated.' : 'Weekly work added to this execution plan.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not save weekly work.');
    } finally {
      setSaving(false);
    }
  }

  async function transitionItem(targetOverride?: WeeklyStatus) {
    if (!selectedItem || !commercialPlanId || !token) return;
    const targetStatus = targetOverride || transitionTarget;
    if (!targetStatus) {
      setFeedback('Choose the next status.');
      return;
    }
    if ((targetStatus === 'blocked' || targetStatus === 'completed') && transitionDetail.trim().length < 3) {
      setFeedback(targetStatus === 'blocked' ? 'Explain what is blocking this work.' : 'Add evidence that confirms completion.');
      return;
    }
    setSaving(true);
    setFeedback('');
    const detail = transitionDetail.trim();
    const payload = {
      expectedRevision: selectedItem.revision,
      targetStatus,
      ...(targetStatus === 'blocked' ? { blockerReason: detail } : {}),
      ...(targetStatus === 'completed' ? { completionEvidence: detail } : {}),
      ...(detail.length >= 3 && targetStatus !== 'blocked' && targetStatus !== 'completed' ? { reason: detail } : {}),
      ...(targetStatus === 'ready' && selectedItem.status === 'awaiting_approval' ? { reason: 'Approved by CCO' } : {}),
    };
    try {
      const updated = await commercialWeeklyOperationsApi.transitionItem(
        commercialPlanId,
        selectedItem.id,
        payload,
        token,
      ) as WeeklyWorkItem;
      setTransitionTarget('');
      setTransitionDetail('');
      await load(updated.id);
      setFeedback(targetStatus === 'ready' && selectedItem.status === 'awaiting_approval'
        ? 'Weekly work approved and ready for the team.'
        : `Weekly work moved to ${label(targetStatus).toLowerCase()}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not update weekly work status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <OpsSection
      className="weekly-operating-workspace"
      title="Weekly operations"
      subtitle="Turn the selected execution plan into owned work for one operating week."
      action={commercialPlanId && workspace ? (
        <div className="weekly-header-actions">
          <button className="ops-button is-secondary" type="button" onClick={() => onAskStitchi(workspace.selectedWeek.startDate)}>
            <Sparkles size={16} aria-hidden="true" />Ask Stitchi
          </button>
          {canManage ? <button className="ops-button is-primary" type="button" onClick={openCreate}><Plus size={16} aria-hidden="true" />Add weekly work</button> : null}
        </div>
      ) : undefined}
    >
      {!commercialPlanId ? (
        <OpsEmpty
          title="Select an execution plan"
          message="Choose an execution plan above to see its weekly owners, priorities, blockers, approvals, and budget guardrails."
        />
      ) : loading && !workspace ? (
        <OpsSkeleton rows={4} />
      ) : !workspace ? (
        <div className="weekly-load-error">
          {feedback ? <OpsNotice tone="danger">{feedback}</OpsNotice> : null}
          <button className="ops-button is-secondary" type="button" onClick={() => void load()}>Try again</button>
        </div>
      ) : (
        <>
          <div className="weekly-context-band">
            <div className="weekly-plan-context">
              <span>{workspace.plan.revenueLineName}</span>
              <strong>{workspace.plan.title}</strong>
              <small>
                {workspace.plan.annualPlanTitle
                  ? `${workspace.plan.annualPlanYear || ''} ${workspace.plan.annualPlanTitle}`
                  : 'Standalone execution plan'}
                {workspace.plan.monthlyPortfolioMonth
                  ? ` / ${MONTHS[workspace.plan.monthlyPortfolioMonth - 1]}${workspace.plan.monthlyPortfolioTitle ? ` - ${workspace.plan.monthlyPortfolioTitle}` : ''}`
                  : ''}
              </small>
            </div>
            <div className="weekly-week-navigation" aria-label="Choose operating week">
              <button className="ops-icon-button" type="button" onClick={() => navigateWeek(-7)} aria-label="Previous week" title="Previous week"><ChevronLeft size={18} aria-hidden="true" /></button>
              <div><CalendarDays size={17} aria-hidden="true" /><span><strong>{workspace.selectedWeek.label}</strong><small>{timezoneLabel(workspace.timezone)}</small></span></div>
              <button className="ops-icon-button" type="button" onClick={() => navigateWeek(7)} aria-label="Next week" title="Next week"><ChevronRight size={18} aria-hidden="true" /></button>
              <button className="ops-text-button" type="button" onClick={() => setWeekOf(dateInTimezone(workspace.timezone))}>Current week</button>
            </div>
          </div>

          <div className="weekly-rollup" aria-label="Weekly operations summary">
            <article><ListChecks size={18} aria-hidden="true" /><span><small>Work items</small><strong>{workspace.rollup.itemCount}</strong></span></article>
            <article><CheckCircle2 size={18} aria-hidden="true" /><span><small>Completed</small><strong>{workspace.rollup.completedCount}</strong></span></article>
            <article className={workspace.rollup.blockedCount ? 'has-alert' : ''}><AlertTriangle size={18} aria-hidden="true" /><span><small>Blocked</small><strong>{workspace.rollup.blockedCount}</strong></span></article>
            <article className={workspace.rollup.awaitingApprovalCount ? 'needs-decision' : ''}><Clock3 size={18} aria-hidden="true" /><span><small>Awaiting approval</small><strong>{workspace.rollup.awaitingApprovalCount}</strong></span></article>
            <article className="weekly-budget-rollup">
              <CircleDollarSign size={18} aria-hidden="true" />
              <span><small>Weekly guardrail</small><strong>{money(workspace.rollup.budgetGuardrail, workspace.plan.currency)}</strong></span>
              <div aria-label={`${budgetUsedPercent}% of execution plan budget allocated`}><span style={{ width: `${budgetUsedPercent}%` }} /></div>
              <small>{planBudget == null ? 'Set a plan budget to monitor allocation' : `${money(remainingBudget, workspace.plan.currency)} remains across the plan`}</small>
            </article>
          </div>

          {feedback ? <div className="weekly-feedback"><OpsNotice tone={/could not|enter|choose|explain|add evidence|changed while/i.test(feedback) ? 'danger' : 'positive'}>{feedback}</OpsNotice></div> : null}

          {editorMode ? (
            <div className="weekly-editor">
              <header><div><strong>{editorMode === 'edit' ? 'Edit weekly work' : 'Add weekly work'}</strong><p>Keep the task specific, owned, measurable, and inside the selected week.</p></div><button className="ops-icon-button" type="button" onClick={() => setEditorMode(null)} aria-label="Close weekly work editor" title="Close"><X size={18} aria-hidden="true" /></button></header>
              <div className="weekly-editor-grid">
                <Field label="Work title"><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Example: Launch warm-audience ad set" /></Field>
                <Field label="Owner"><select value={draft.ownerUserId} onChange={event => setDraft(current => ({ ...current, ownerUserId: event.target.value }))}><option value="">Assign later</option>{workspace.owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} - {label(owner.role)}</option>)}</select></Field>
                <Field label="Start date" helper={`${formatDate(workspace.selectedWeek.startDate)} to ${formatDate(workspace.selectedWeek.endDate)}`}><input type="date" min={workspace.selectedWeek.startDate} max={workspace.selectedWeek.endDate} value={draft.startDate} onChange={event => setDraft(current => ({ ...current, startDate: event.target.value }))} /></Field>
                <Field label="Due date"><input type="date" min={workspace.selectedWeek.startDate} max={workspace.selectedWeek.endDate} value={draft.dueDate} onChange={event => setDraft(current => ({ ...current, dueDate: event.target.value }))} /></Field>
                <Field label="Priority"><select value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value as WeeklyPriority }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
                <Field label={`Budget guardrail (${workspace.plan.currency})`} helper="The maximum planned amount for this work, not actual spend."><input type="number" min="0" step="0.01" value={draft.budgetGuardrail} onChange={event => setDraft(current => ({ ...current, budgetGuardrail: event.target.value }))} placeholder="0" /></Field>
                <Field label="Linked evidence" helper="Connect the work to an event, campaign, lead, content item, discipline record, or imported evidence."><select value={draft.linkKey} onChange={event => setDraft(current => ({ ...current, linkKey: event.target.value }))}><option value="">No linked evidence</option>{workspace.linkOptions.map(option => <option key={`${option.type}-${option.id}`} value={`${option.type}::${option.id}`}>{label(option.type)} - {option.label}</option>)}</select></Field>
                <Field label="Business outcome"><textarea value={draft.businessOutcome} onChange={event => setDraft(current => ({ ...current, businessOutcome: event.target.value }))} placeholder="What measurable business result should this work create?" rows={3} /></Field>
              </div>
              <div className="weekly-editor-actions"><button className="ops-button is-primary" type="button" onClick={() => void saveItem()} disabled={saving}>{saving ? 'Saving...' : editorMode === 'edit' ? 'Save changes' : 'Add to week'}</button><button className="ops-button is-secondary" type="button" onClick={() => setEditorMode(null)}>Cancel</button></div>
            </div>
          ) : null}

          {workspace.items.length ? (
            <div className="weekly-board">
              <div className="weekly-work-list" aria-label="Weekly work items">
                {workspace.items.map(item => (
                  <button key={item.id} className={item.id === selectedItemId ? 'is-selected' : ''} type="button" onClick={() => { setSelectedItemId(item.id); setEditorMode(null); setTransitionTarget(''); setTransitionDetail(''); }} aria-pressed={item.id === selectedItemId}>
                    <span className="weekly-row-status"><OpsStatus tone={statusTone(item.status)}>{label(item.status)}</OpsStatus><OpsStatus tone={priorityTone(item.priority)}>{label(item.priority)}</OpsStatus></span>
                    <strong>{item.title}</strong>
                    <p>{item.businessOutcome}</p>
                    <span className="weekly-row-meta"><span><UserRound size={14} aria-hidden="true" />{item.ownerName || item.ownerRole ? item.ownerName || label(item.ownerRole || '') : 'Owner not assigned'}</span><span><CalendarDays size={14} aria-hidden="true" />Due {formatDate(item.dueDate)}</span></span>
                  </button>
                ))}
              </div>

              <div className="weekly-work-detail">
                {selectedItem ? (
                  <>
                    <header><div><span>Selected work</span><strong>{selectedItem.title}</strong></div>{canManage && !['awaiting_approval', 'completed', 'cancelled'].includes(selectedItem.status) ? <button className="ops-icon-button" type="button" onClick={() => openEdit(selectedItem)} aria-label="Edit weekly work" title="Edit details"><Pencil size={17} aria-hidden="true" /></button> : null}</header>
                    <p className="weekly-outcome">{selectedItem.businessOutcome}</p>
                    <dl>
                      <div><dt>Owner</dt><dd>{selectedItem.ownerName || (selectedItem.ownerRole ? label(selectedItem.ownerRole) : 'Not assigned')}</dd></div>
                      <div><dt>Dates</dt><dd>{formatDate(selectedItem.startDate)} - {formatDate(selectedItem.dueDate)}</dd></div>
                      <div><dt>Budget guardrail</dt><dd>{money(selectedItem.budgetGuardrail, selectedItem.currency)}</dd></div>
                      <div><dt>Linked evidence</dt><dd>{selectedItem.linkLabel ? <span><Link2 size={14} aria-hidden="true" />{selectedItem.linkLabel}</span> : 'None linked'}</dd></div>
                    </dl>
                    {selectedItem.blockerReason ? <div className="weekly-evidence is-blocker"><AlertTriangle size={17} aria-hidden="true" /><div><strong>Current blocker</strong><p>{selectedItem.blockerReason}</p></div></div> : null}
                    {selectedItem.completionEvidence ? <div className="weekly-evidence"><CheckCircle2 size={17} aria-hidden="true" /><div><strong>Completion evidence</strong><p>{selectedItem.completionEvidence}</p></div></div> : null}

                    {selectedItem.status === 'awaiting_approval' && canApprove ? (
                      <div className="weekly-approval-action">
                        <div><strong>CCO decision required</strong><p>Approval moves this work to Ready. The person who prepared it cannot approve the same record.</p></div>
                        <button className="ops-button is-primary" type="button" onClick={() => void transitionItem('ready')} disabled={saving || selectedItem.createdByUserId === currentUserId}>{saving ? 'Approving...' : 'Approve work'}</button>
                        {selectedItem.createdByUserId === currentUserId ? <small>Ask another CCO to approve this work.</small> : null}
                      </div>
                    ) : null}

                    {availableTransitions.filter(status => !(selectedItem.status === 'awaiting_approval' && status === 'ready')).length ? (
                      <div className="weekly-status-control">
                        <div><strong>Update status</strong><p>{isAssigned && !canManage ? 'You can update work assigned to you.' : 'Record the next governed step for this work.'}</p></div>
                        <Field label="Next status"><select value={transitionTarget} onChange={event => { setTransitionTarget(event.target.value as WeeklyStatus); setTransitionDetail(''); }}><option value="">Choose status</option>{availableTransitions.filter(status => !(selectedItem.status === 'awaiting_approval' && status === 'ready')).map(status => <option key={status} value={status}>{label(status)}</option>)}</select></Field>
                        {transitionTarget ? <Field label={transitionTarget === 'blocked' ? 'Blocker reason' : transitionTarget === 'completed' ? 'Completion evidence' : 'Decision note'} helper={transitionTarget === 'blocked' || transitionTarget === 'completed' ? 'Required before this status can be saved.' : 'Optional context for the audit record.'}><textarea value={transitionDetail} onChange={event => setTransitionDetail(event.target.value)} rows={3} placeholder={transitionTarget === 'blocked' ? 'What is preventing progress?' : transitionTarget === 'completed' ? 'What confirms the work is complete?' : 'Why is this status changing?'} /></Field> : null}
                        <button className="ops-button is-primary" type="button" onClick={() => void transitionItem()} disabled={saving || !transitionTarget}>{saving ? 'Saving...' : 'Save status'}</button>
                      </div>
                    ) : selectedItem.status !== 'awaiting_approval' && selectedItem.status !== 'completed' && selectedItem.status !== 'cancelled' ? (
                      <p className="weekly-read-only-note">Only the assigned owner or a workspace manager can update this work.</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <OpsEmpty
              title="No weekly work planned"
              message="Break this execution plan into a few owned outcomes for the selected week. Add the work directly or ask Stitchi to prepare it for review."
              action={<div className="weekly-empty-actions">{canManage ? <button className="ops-button is-primary" type="button" onClick={openCreate}><Plus size={16} aria-hidden="true" />Add weekly work</button> : null}<button className="ops-button is-secondary" type="button" onClick={() => onAskStitchi(workspace.selectedWeek.startDate)}><Sparkles size={16} aria-hidden="true" />Ask Stitchi</button></div>}
            />
          )}
        </>
      )}
    </OpsSection>
  );
}
