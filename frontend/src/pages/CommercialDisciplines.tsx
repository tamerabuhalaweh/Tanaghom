import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Handshake,
  Megaphone,
  MessageSquareText,
  Plus,
  Repeat2,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { commercialCommandCenterApi, commercialDisciplinesApi } from '../api';
import { CommercialWorkspaceNav } from '../components/CommercialWorkspaceNav';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { Field } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';
import './CommercialR1D.css';

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

function statusTone(status: string): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' {
  if (status === 'active' || status === 'completed') return 'positive';
  if (status === 'blocked' || status === 'critical') return 'danger';
  if (status === 'high') return 'warning';
  if (status === 'draft') return 'info';
  return 'neutral';
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
  const { token, user } = useAuth();
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
  const userRole = text((user as RecordMap | null)?.role);
  const canCreateRecord = !['reviewer', 'viewer'].includes(userRole);
  const canUpdateRecord = ['admin', 'cco', 'department_head', 'marketing_manager'].includes(userRole);

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
    if (!canUpdateRecord) {
      setMessage('You can review workspace records. A manager can update approved operating records.');
      return;
    }
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
    document.getElementById('discipline-record-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveRecord() {
    if (!token) return;
    setMessage('');
    if (draft.id && !canUpdateRecord) {
      setMessage('A manager must update existing workspace records.');
      return;
    }
    if (!draft.id && !canCreateRecord) {
      setMessage('Your role can review workspace records but cannot create new ones.');
      return;
    }
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
      const successMessage = draft.id ? 'Workspace record updated.' : 'Workspace record created.';
      if (draft.id) {
        await commercialDisciplinesApi.updateRecord(draft.id, payload, token);
      } else {
        await commercialDisciplinesApi.createRecord(payload, token);
      }
      setDraft(makeDraft(draft.discipline, draft.category));
      await load();
      setMessage(successMessage);
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
    <OpsPage className="commercial-r1d-page commercial-disciplines-page">
      <OpsPageHeader
        eyebrow="Commercial Department"
        title="Discipline Workspaces"
        subtitle="Give each commercial discipline one focused operating view while leadership keeps the full picture."
        actions={(
          <>
            <button className="ops-button is-secondary" type="button" onClick={() => navigate(`/stitchi?${stitchiParams.toString()}`)}><Sparkles size={17} aria-hidden="true" />Ask Stitchi</button>
            {canCreateRecord ? <button className="ops-button is-primary" type="button" onClick={() => {
              setDraft(makeDraft(selectedDiscipline, text(categories[0], '')));
              document.getElementById('discipline-record-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}><Plus size={17} aria-hidden="true" />New work item</button> : null}
          </>
        )}
      />

      <CommercialWorkspaceNav />
      {message ? <OpsNotice tone={message.toLowerCase().includes('could not') ? 'danger' : 'info'}>{message}</OpsNotice> : null}

      {loading ? (
        <div className="commercial-r1d-loading"><OpsSkeleton rows={5} /><OpsSkeleton rows={5} /></div>
      ) : (
        <>
          <div className="commercial-discipline-overview">
            <OpsSection title="Commercial disciplines" subtitle="Choose the team responsible for the work." className="commercial-discipline-list">
              {workspaces.map((workspace, index) => {
                const id = text(workspace.id);
                const active = id === selectedDiscipline;
                const Icon = DISCIPLINE_ICONS[id as keyof typeof DISCIPLINE_ICONS] || BriefcaseBusiness;
                const blocked = Number(workspace.blockedCount || 0);
                return (
                  <button key={id} className={active ? 'is-selected' : ''} type="button" onClick={() => chooseWorkspace(workspace)}>
                    <span>{index + 1}</span>
                    <Icon size={17} aria-hidden="true" />
                    <div><strong>{text(workspace.label, titleCase(id))}</strong><small>{text(workspace.purpose, 'Commercial operating work')}</small></div>
                    <em>{blocked ? `${blocked} blocked` : `${Number(workspace.recordCount || 0)} records`}</em>
                  </button>
                );
              })}
            </OpsSection>

            <OpsSection
              title={text(selectedWorkspace.label, titleCase(selectedDiscipline))}
              subtitle={text(selectedWorkspace.purpose, 'Capture and manage discipline work.')}
              action={<OpsStatus tone={blockedRecords ? 'danger' : 'positive'}>{blockedRecords ? `${blockedRecords} blocked` : 'Operating'}</OpsStatus>}
              className="commercial-discipline-detail"
            >
              <div className="commercial-discipline-summary">
                <DisciplineMetric label="Today" value={`${activeRecords} active`} detail={`${highPriorityRecords} high-priority item${highPriorityRecords === 1 ? '' : 's'}`} />
                <DisciplineMetric label="Blocked work" value={String(blockedRecords)} detail="Needs manager attention" />
                <DisciplineMetric label="Completed" value={String(completedRecords)} detail="Closed operating records" />
              </div>

              {records.length ? (
                <div className="commercial-discipline-queue">
                  {records.slice(0, 4).map(record => (
                    <button type="button" key={text(record.id)} onClick={() => editRecord(record)}>
                      <OpsStatus tone={statusTone(text(record.priority))}>{titleCase(text(record.priority, 'normal'))}</OpsStatus>
                      <div><strong>{text(record.title, 'Untitled work item')}</strong><small>{text(record.summary, titleCase(text(record.category)))}</small></div>
                      <span>{titleCase(text(record.status, 'active'))}</span>
                    </button>
                  ))}
                </div>
              ) : <OpsEmpty title="No work recorded" message="Create the first research note, script, blocker, or operating task for this discipline." />}
            </OpsSection>
          </div>

          <section className="commercial-department-boundary">
            <BriefcaseBusiness size={20} aria-hidden="true" />
            <div><strong>Department boundary</strong><p>Content and Event Operations receive approved briefs and requests. Their internal execution remains in their own department workspaces.</p></div>
          </section>

          <div className="commercial-discipline-workspace" id="discipline-record-editor">
            <OpsSection
              title={canCreateRecord || canUpdateRecord ? (draft.id ? 'Edit work item' : 'Create work item') : 'Read-only workspace'}
              subtitle={canCreateRecord || canUpdateRecord ? 'Capture useful daily work and connect it to the commercial outcome it supports.' : 'Your role can review work. Ask a manager or Stitchi when something must change.'}
              action={draft.id && canUpdateRecord ? <button className="ops-button is-secondary" type="button" onClick={() => setDraft(makeDraft(selectedDiscipline, text(categories[0], '')))}>New item</button> : undefined}
            >
              {!canCreateRecord && !canUpdateRecord ? <OpsNotice>This workspace is read-only for your role. You can still review context and ask Stitchi what needs attention.</OpsNotice> : null}
              <div className="commercial-form">
                <div className="commercial-form-grid">
                  <Field label="Workspace"><select value={draft.discipline} onChange={event => {
                    const nextWorkspace = workspaces.find(workspace => text(workspace.id) === event.target.value) || {};
                    const nextCategory = text(list(nextWorkspace.categories)[0], '');
                    setSelectedDiscipline(event.target.value);
                    setDraft(current => ({ ...current, discipline: event.target.value, category: nextCategory }));
                  }}>{workspaces.map(workspace => <option key={text(workspace.id)} value={text(workspace.id)}>{text(workspace.label)}</option>)}</select></Field>
                  <Field label="Work type"><select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}>{categories.map(category => <option key={category} value={category}>{titleCase(category)}</option>)}</select></Field>
                  <Field label="Priority"><select value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value }))}>{PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{titleCase(priority)}</option>)}</select></Field>
                  <Field label="Status"><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}</select></Field>
                  <Field label="Revenue line"><select value={draft.revenueLineId} onChange={event => setDraft(current => ({ ...current, revenueLineId: event.target.value }))}><option value="">Not linked</option>{revenueLines.map(line => <option key={text(line.id)} value={text(line.id)}>{text(line.name)}</option>)}</select></Field>
                  <Field label="Commercial plan"><select value={draft.commercialPlanId} onChange={event => setDraft(current => ({ ...current, commercialPlanId: event.target.value }))}><option value="">Not linked</option>{plans.map(plan => <option key={text(plan.id)} value={text(plan.id)}>{text(plan.title)}</option>)}</select></Field>
                </div>
                <Field label="Title"><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Example: Price objection answer for warm buyers" /></Field>
                <Field label="Summary"><textarea value={draft.summary} onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))} rows={3} placeholder="Short summary for the team." /></Field>
                <Field label="Details"><textarea value={draft.details} onChange={event => setDraft(current => ({ ...current, details: event.target.value }))} rows={5} placeholder="Add the script, research note, action detail, or operating instruction." /></Field>
                <div className="ops-inline-actions">
                  {canCreateRecord || canUpdateRecord ? <button className="ops-button is-primary" type="button" onClick={saveRecord} disabled={saving || (Boolean(draft.id) && !canUpdateRecord)}>{saving ? 'Saving...' : draft.id ? 'Save changes' : 'Create work item'}</button> : null}
                  <button className="ops-button is-secondary" type="button" onClick={() => navigate(`/stitchi?${stitchiParams.toString()}`)}><Sparkles size={16} aria-hidden="true" />Ask Stitchi to draft</button>
                </div>
              </div>
            </OpsSection>

            <OpsSection title="All work in this discipline" subtitle="Business records only. External systems are not called from here.">
              {records.length ? (
                <div className="commercial-record-list">
                  {records.map(record => (
                    <button key={text(record.id)} type="button" onClick={() => editRecord(record)} className={text(record.id) === draft.id ? 'is-selected' : ''}>
                      <div><strong>{text(record.title, 'Untitled work item')}</strong><small>{titleCase(text(record.category))} / {titleCase(text(record.priority))}</small></div>
                      <OpsStatus tone={statusTone(text(record.status))}>{titleCase(text(record.status))}</OpsStatus>
                      <p>{text(record.summary, 'No summary yet.')}</p>
                      {text(record.revenueLineName) || text(record.commercialPlanTitle) || text(record.eventName) ? <small>{[text(record.revenueLineName), text(record.commercialPlanTitle), text(record.eventName)].filter(Boolean).join(' / ')}</small> : null}
                    </button>
                  ))}
                </div>
              ) : <OpsEmpty title="Nothing recorded yet" message="Capture the first note, script, blocker, or operating task for this discipline." />}
            </OpsSection>
          </div>
        </>
      )}
    </OpsPage>
  );
}

function DisciplineMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>;
}
