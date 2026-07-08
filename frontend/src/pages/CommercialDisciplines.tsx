import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  Handshake,
  Megaphone,
  MessageSquareText,
  Repeat2,
  Settings2,
} from 'lucide-react';
import { commercialCommandCenterApi, commercialDisciplinesApi } from '../api';
import {
  AieroActionButton,
  AieroGhostButton,
  AieroLightPanel,
  AieroMetricCard,
  AieroPage,
  AieroPanel,
  AieroStatusPill,
} from '../components/AieroUX';
import {
  EmptyProductState,
  Field,
  Notice,
  ProductStatus,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

const DISCIPLINE_ICONS = {
  brand_positioning: MessageSquareText,
  acquisition: Megaphone,
  conversion_closing: Handshake,
  growth_retention: Repeat2,
  commercial_operations: Settings2,
};

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['draft', 'active', 'blocked', 'completed', 'archived'];

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(status: string): 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (status === 'active' || status === 'completed') return 'good';
  if (status === 'blocked' || status === 'critical') return 'danger';
  if (status === 'high') return 'warn';
  if (status === 'draft') return 'info';
  return 'muted';
}

function makeDraft(discipline = '', category = '') {
  return {
    id: '',
    discipline,
    category,
    title: '',
    summary: '',
    details: '',
    priority: 'medium',
    status: 'active',
    revenueLineId: '',
    commercialPlanId: '',
    eventId: '',
  };
}

export default function CommercialDisciplines() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<RecordMap[]>([]);
  const [revenueLines, setRevenueLines] = useState<RecordMap[]>([]);
  const [plans, setPlans] = useState<RecordMap[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState('brand_positioning');
  const [draft, setDraft] = useState(makeDraft('brand_positioning', 'research_note'));
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);

  const selectedWorkspace = useMemo(
    () => workspaces.find(workspace => text(workspace.id) === selectedDiscipline) || workspaces[0] || {},
    [selectedDiscipline, workspaces],
  );
  const records = list(selectedWorkspace.records);
  const categories = list(selectedWorkspace.categories).map(item => text(item)).filter(Boolean);
  const activeRecords = records.filter(record => text(record.status) === 'active').length;
  const blockedRecords = records.filter(record => text(record.status) === 'blocked').length;
  const completedRecords = records.filter(record => text(record.status) === 'completed').length;
  const highPriorityRecords = records.filter(record => ['high', 'critical'].includes(text(record.priority))).length;
  const SelectedIcon = DISCIPLINE_ICONS[selectedDiscipline as keyof typeof DISCIPLINE_ICONS] || BriefcaseBusiness;

  async function load() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const [workspaceRows, lineRows, planRows] = await Promise.all([
        commercialDisciplinesApi.workspaces(token),
        commercialCommandCenterApi.revenueLines(token),
        commercialCommandCenterApi.plans(token),
      ]);
      const safeWorkspaces = list(workspaceRows);
      setWorkspaces(safeWorkspaces);
      setRevenueLines(list(lineRows).filter(line => Boolean(line.configured)));
      setPlans(list(planRows));
      const nextDiscipline = safeWorkspaces.some(workspace => text(workspace.id) === selectedDiscipline)
        ? selectedDiscipline
        : text(safeWorkspaces[0]?.id, 'brand_positioning');
      setSelectedDiscipline(nextDiscipline);
      const nextWorkspace = safeWorkspaces.find(workspace => text(workspace.id) === nextDiscipline) || safeWorkspaces[0] || {};
      const firstCategory = text(list(nextWorkspace.categories)[0], 'research_note');
      setDraft(current => current.id || current.title ? current : makeDraft(nextDiscipline, firstCategory));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not load discipline workspaces.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    const loadTimer = window.setTimeout(() => {
      load().catch(err => setMessage(err instanceof Error ? err.message : 'Could not load discipline workspaces.'));
    }, 0);
    return () => window.clearTimeout(loadTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function chooseWorkspace(workspace: RecordMap) {
    const discipline = text(workspace.id);
    const category = text(list(workspace.categories)[0], '');
    setSelectedDiscipline(discipline);
    setDraft(makeDraft(discipline, category));
  }

  function editRecord(record: RecordMap) {
    setDraft({
      id: text(record.id),
      discipline: text(record.discipline),
      category: text(record.category),
      title: text(record.title),
      summary: text(record.summary),
      details: text(record.details),
      priority: text(record.priority, 'medium'),
      status: text(record.status, 'active'),
      revenueLineId: text(record.revenueLineId),
      commercialPlanId: text(record.commercialPlanId),
      eventId: text(record.eventId),
    });
  }

  async function saveRecord() {
    if (!token) return;
    setMessage('');
    if (!draft.discipline || !draft.category || !draft.title.trim()) {
      setMessage('Choose a workspace, choose a record type, and enter a title.');
      return;
    }
    setSaving(true);
    const payload = {
      discipline: draft.discipline,
      category: draft.category,
      title: draft.title.trim(),
      summary: draft.summary || null,
      details: draft.details || null,
      priority: draft.priority,
      status: draft.status,
      sourceType: 'manual',
      revenueLineId: draft.revenueLineId || null,
      commercialPlanId: draft.commercialPlanId || null,
      eventId: draft.eventId || null,
    };
    try {
      if (draft.id) {
        await commercialDisciplinesApi.updateRecord(draft.id, payload, token);
        setMessage('Workspace record updated.');
      } else {
        await commercialDisciplinesApi.createRecord(payload, token);
        setMessage('Workspace record created.');
      }
      setDraft(makeDraft(draft.discipline, draft.category));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save workspace record.');
    } finally {
      setSaving(false);
    }
  }

  function stitchiPrompt() {
    const label = text(selectedWorkspace.label, titleCase(selectedDiscipline));
    const category = text(draft.category, text(categories[0], 'research_note'));
    return `Create a ${label} workspace record. Category: ${titleCase(category)}. Link it to the selected revenue line if useful. Ask one follow-up if information is missing.`;
  }

  const stitchiParams = new URLSearchParams({
    mode: 'prepare',
    prompt: stitchiPrompt(),
    discipline: selectedDiscipline,
    ...(draft.revenueLineId ? { revenueLineId: draft.revenueLineId } : {}),
    ...(draft.commercialPlanId ? { commercialPlanId: draft.commercialPlanId } : {}),
  });

  return (
    <AieroPage
      eyebrow="Commercial Department"
      title="Discipline workspaces for daily commercial execution."
      subtitle="Capture brand, acquisition, conversion, growth, and operations work in one governed place. Stitchi can draft records, but managers approve before anything is saved."
      action={(
        <>
          <AieroGhostButton onClick={() => navigate(`/stitchi?${stitchiParams.toString()}`)}>Ask Stitchi</AieroGhostButton>
          <AieroActionButton onClick={() => navigate('/command-center')}>Command Center</AieroActionButton>
        </>
      )}
    >
      {message && <Notice tone={message.toLowerCase().includes('could not') ? 'warn' : 'info'}>{message}</Notice>}

      <div className="grid gap-4 lg:grid-cols-4">
        <AieroMetricCard label="Active work" value={loading ? '-' : activeRecords} detail="Open records in this workspace" accent="teal" />
        <AieroMetricCard label="Blocked" value={loading ? '-' : blockedRecords} detail="Needs manager attention" accent="rose" />
        <AieroMetricCard label="High priority" value={loading ? '-' : highPriorityRecords} detail="High or critical priority" accent="amber" />
        <AieroMetricCard label="Completed" value={loading ? '-' : completedRecords} detail="Closed operating records" accent="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AieroLightPanel title="Workspaces" subtitle="Choose the commercial discipline you want to operate.">
          <div className="space-y-3">
            {workspaces.map(workspace => {
              const id = text(workspace.id);
              const Icon = DISCIPLINE_ICONS[id as keyof typeof DISCIPLINE_ICONS] || BriefcaseBusiness;
              const active = id === selectedDiscipline;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseWorkspace(workspace)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active ? 'border-neutral-950 bg-neutral-950 text-white shadow-lg' : 'border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{text(workspace.label, titleCase(id))}</span>
                      <span className={`mt-1 block text-xs leading-5 ${active ? 'text-white/62' : 'text-neutral-500'}`}>
                        {text(workspace.purpose)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ProductStatus tone={active ? 'good' : 'muted'}>{Number(workspace.recordCount || 0)} records</ProductStatus>
                    {Number(workspace.blockedCount || 0) > 0 && <ProductStatus tone="danger">{Number(workspace.blockedCount)} blocked</ProductStatus>}
                  </div>
                </button>
              );
            })}
          </div>
        </AieroLightPanel>

        <AieroPanel
          title={text(selectedWorkspace.label, 'Selected workspace')}
          subtitle={text(selectedWorkspace.purpose, 'Capture and manage discipline work.')}
          action={<AieroStatusPill>{categories.length} record types</AieroStatusPill>}
        >
          <div className="grid gap-5 lg:grid-cols-[0.52fr_1fr]">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-950">
                <SelectedIcon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">{text(selectedWorkspace.label, titleCase(selectedDiscipline))}</h3>
              <p className="mt-3 text-sm leading-6 text-white/55">{text(selectedWorkspace.purpose)}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {categories.slice(0, 5).map(category => (
                  <AieroStatusPill key={category} accent="blue">{titleCase(category)}</AieroStatusPill>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {records.slice(0, 4).map(record => (
                <button
                  key={text(record.id)}
                  type="button"
                  onClick={() => editRecord(record)}
                  className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.08]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 font-semibold text-white">{text(record.title, 'Untitled record')}</div>
                      <div className="mt-1 text-xs text-white/48">{titleCase(text(record.category))}</div>
                    </div>
                    <ProductStatus tone={statusTone(text(record.status))}>{titleCase(text(record.status))}</ProductStatus>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/52">{text(record.summary, 'No summary yet.')}</p>
                </button>
              ))}
              {!records.length && (
                <div className="sm:col-span-2 rounded-[1.25rem] border border-dashed border-white/14 bg-white/[0.04] p-6">
                  <EmptyProductState title="No records yet" message="Create the first operating record for this discipline, or ask Stitchi to draft one." />
                </div>
              )}
            </div>
          </div>
        </AieroPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AieroLightPanel
          title={draft.id ? 'Edit workspace record' : 'Create workspace record'}
          subtitle="Use this for real daily work: scripts, research notes, campaign observations, data-quality issues, and operating tasks."
          action={draft.id ? <SecondaryAction onClick={() => setDraft(makeDraft(selectedDiscipline, text(categories[0], '')))}>New record</SecondaryAction> : null}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Workspace">
              <select
                value={draft.discipline}
                onChange={event => {
                  const nextWorkspace = workspaces.find(workspace => text(workspace.id) === event.target.value) || {};
                  const nextCategory = text(list(nextWorkspace.categories)[0], '');
                  setSelectedDiscipline(event.target.value);
                  setDraft(current => ({ ...current, discipline: event.target.value, category: nextCategory }));
                }}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                {workspaces.map(workspace => <option key={text(workspace.id)} value={text(workspace.id)}>{text(workspace.label)}</option>)}
              </select>
            </Field>
            <Field label="Record type">
              <select
                value={draft.category}
                onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                {categories.map(category => <option key={category} value={category}>{titleCase(category)}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={draft.priority}
                onChange={event => setDraft(current => ({ ...current, priority: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                {PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                {STATUS_OPTIONS.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}
              </select>
            </Field>
            <Field label="Revenue line">
              <select
                value={draft.revenueLineId}
                onChange={event => setDraft(current => ({ ...current, revenueLineId: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">Not linked</option>
                {revenueLines.map(line => <option key={text(line.id)} value={text(line.id)}>{text(line.name)}</option>)}
              </select>
            </Field>
            <Field label="Commercial plan">
              <select
                value={draft.commercialPlanId}
                onChange={event => setDraft(current => ({ ...current, commercialPlanId: event.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">Not linked</option>
                {plans.map(plan => <option key={text(plan.id)} value={text(plan.id)}>{text(plan.title)}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                placeholder="Example: Price objection answer for warm buyers"
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Summary">
              <textarea
                value={draft.summary}
                onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))}
                rows={3}
                placeholder="Short summary for the team."
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
            <Field label="Details">
              <textarea
                value={draft.details}
                onChange={event => setDraft(current => ({ ...current, details: event.target.value }))}
                rows={5}
                placeholder="Add the script, research note, action detail, or operating instruction."
                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <AieroActionButton onClick={saveRecord} disabled={saving}>
              {saving ? 'Saving...' : draft.id ? 'Save changes' : 'Create record'}
            </AieroActionButton>
            <SecondaryAction onClick={() => navigate(`/stitchi?${stitchiParams.toString()}`)}>Ask Stitchi to draft</SecondaryAction>
          </div>
        </AieroLightPanel>

        <AieroLightPanel title="All records in this workspace" subtitle="Business records only. External systems are not called from here.">
          {records.length ? (
            <div className="space-y-3">
              {records.map(record => (
                <button
                  key={text(record.id)}
                  type="button"
                  onClick={() => editRecord(record)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    text(record.id) === draft.id ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-950 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 font-semibold">{text(record.title, 'Untitled record')}</div>
                      <div className={`mt-1 text-xs ${text(record.id) === draft.id ? 'text-white/60' : 'text-neutral-500'}`}>
                        {titleCase(text(record.category))} - {titleCase(text(record.priority))}
                      </div>
                    </div>
                    <ProductStatus tone={statusTone(text(record.status))}>{titleCase(text(record.status))}</ProductStatus>
                  </div>
                  <p className={`mt-3 line-clamp-3 text-sm leading-6 ${text(record.id) === draft.id ? 'text-white/62' : 'text-neutral-600'}`}>
                    {text(record.summary, 'No summary yet.')}
                  </p>
                  {(text(record.revenueLineName) || text(record.commercialPlanTitle) || text(record.eventName)) && (
                    <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${text(record.id) === draft.id ? 'bg-white/10 text-white/70' : 'bg-white text-neutral-500'}`}>
                      {[text(record.revenueLineName), text(record.commercialPlanTitle), text(record.eventName)].filter(Boolean).join(' / ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <EmptyProductState title="Nothing recorded yet" message="Capture the first note, script, blocker, or operating task for this discipline." />
          )}
        </AieroLightPanel>
      </div>

      <AieroPanel title="How this connects to the rest of Tanaghum" subtitle="The discipline records are not isolated notes. They feed commercial planning, Stitchi context, and later executive reporting.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
            <BarChart3 className="h-6 w-6 text-[#70f5df]" />
            <h3 className="mt-4 font-semibold text-white">Commercial plans</h3>
            <p className="mt-2 text-sm leading-6 text-white/52">Link records to revenue lines and commercial plans so daily work supports business targets.</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
            <SelectedIcon className="h-6 w-6 text-[#ffd166]" />
            <h3 className="mt-4 font-semibold text-white">Department roles</h3>
            <p className="mt-2 text-sm leading-6 text-white/52">Specialists can create records. Managers control updates and approvals through governed backend permissions.</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-5">
            <BriefcaseBusiness className="h-6 w-6 text-[#c4b5fd]" />
            <h3 className="mt-4 font-semibold text-white">Stitchi-ready</h3>
            <p className="mt-2 text-sm leading-6 text-white/52">Stitchi can draft workspace records for approval and read these records when helping the team.</p>
          </div>
        </div>
      </AieroPanel>
    </AieroPage>
  );
}
