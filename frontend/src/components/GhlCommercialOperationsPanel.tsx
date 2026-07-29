import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Clock3, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { ghlOperationsApi } from '../api';
import { Notice, ProductCard, ProductStatus } from './ProductUI';

type RecordMap = Record<string, unknown>;
type Task = 'customer' | 'tags' | 'sale' | 'meeting' | 'whatsapp';

const TASKS: Array<{ id: Task; label: string; helper: string }> = [
  { id: 'customer', label: 'Customer', helper: 'Create or refresh the CRM contact' },
  { id: 'tags', label: 'Tags', helper: 'Apply CRM segmentation' },
  { id: 'sale', label: 'Sale & payment', helper: 'Update pipeline, value and payment' },
  { id: 'meeting', label: 'Meeting', helper: 'Book or update an appointment' },
  { id: 'whatsapp', label: 'WhatsApp', helper: 'Prepare an approved customer message' },
];

const APPROVER_ROLES = ['admin', 'cco', 'department_head'];
const PREPARER_ROLES = [
  'admin',
  'cco',
  'department_head',
  'marketing_manager',
  'sales_manager',
  'lead_qualification_manager',
];

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function records(value: unknown): RecordMap[] {
  return Array.isArray(value) ? (value as RecordMap[]) : [];
}

function record(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordMap) : {};
}

function titleCase(value: unknown): string {
  return text(value, 'not available')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not specified';
  if (Array.isArray(value))
    return value.length ? value.map((item) => String(item)).join(', ') : 'None';
  if (typeof value === 'object') {
    return Object.entries(record(value))
      .map(([key, item]) => `${titleCase(key)}: ${displayValue(item)}`)
      .join(' / ');
  }
  return String(value);
}

function localDateTime(hoursFromNow = 24): string {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function GhlCommercialOperationsPanel({
  token,
  role,
  eventId,
  lead,
  onRefresh,
}: {
  token: string;
  role: string;
  eventId: string;
  lead: RecordMap;
  onRefresh: () => void;
}) {
  const leadId = text(lead.id);
  const [task, setTask] = useState<Task>('customer');
  const [referenceData, setReferenceData] = useState<RecordMap>({});
  const [operation, setOperation] = useState<RecordMap | null>(null);
  const [previewActionSignature, setPreviewActionSignature] = useState('');
  const [history, setHistory] = useState<RecordMap[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [pipelineId, setPipelineId] = useState(text(lead.externalPipelineId));
  const [stageId, setStageId] = useState(text(lead.externalStageId));
  const [opportunityName, setOpportunityName] = useState(
    `${text(lead.leadName, text(lead.name, 'Customer'))} opportunity`,
  );
  const [opportunityStatus, setOpportunityStatus] = useState('open');
  const [monetaryValue, setMonetaryValue] = useState(String(numberValue(lead.saleValue) || ''));
  const [amountPaid, setAmountPaid] = useState(String(numberValue(lead.amountPaid) || ''));
  const [ticketQuantity, setTicketQuantity] = useState(
    String(numberValue(lead.ticketQuantity) || ''),
  );
  const [paymentStatus, setPaymentStatus] = useState(text(lead.paymentStatus, 'unknown'));
  const [paymentDate, setPaymentDate] = useState('');
  const [tagToAdd, setTagToAdd] = useState('');
  const [tagToRemove, setTagToRemove] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('Sales consultation');
  const [meetingStart, setMeetingStart] = useState(localDateTime());
  const [meetingEnd, setMeetingEnd] = useState(localDateTime(25));
  const [meetingStatus, setMeetingStatus] = useState('confirmed');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const pipelines = records(referenceData.pipelines);
  const tags = records(referenceData.tags);
  const calendars = records(referenceData.calendars);
  const selectedPipeline = pipelines.find((item) => text(item.id) === pipelineId);
  const stages = records(selectedPipeline?.stages);
  const capabilities = record(referenceData.capabilities);
  const canPrepare =
    typeof capabilities.prepare === 'boolean'
      ? capabilities.prepare
      : PREPARER_ROLES.includes(role);
  const canApprove =
    typeof capabilities.approve === 'boolean'
      ? capabilities.approve
      : APPROVER_ROLES.includes(role);
  const setupStatus = text(referenceData.status, 'loading');

  const action = useMemo(() => {
    if (!leadId) return null;
    if (task === 'customer') {
      return { type: 'contact_upsert', leadId, source: 'Tanaghum Commercial Operations' };
    }
    if (task === 'tags') {
      return {
        type: 'contact_tags_update',
        leadId,
        addTags: tagToAdd ? [tagToAdd] : [],
        removeTags: tagToRemove ? [tagToRemove] : [],
      };
    }
    if (task === 'sale') {
      const total = monetaryValue ? Number(monetaryValue) : undefined;
      const paid = amountPaid ? Number(amountPaid) : undefined;
      return {
        type: 'opportunity_upsert',
        leadId,
        ...(text(lead.externalOpportunityId)
          ? { opportunityId: text(lead.externalOpportunityId) }
          : {}),
        pipelineId,
        stageId,
        name: opportunityName,
        status: opportunityStatus,
        ...(total !== undefined ? { monetaryValue: total } : {}),
        payment: {
          ...(total !== undefined ? { totalSaleValue: total } : {}),
          ...(paid !== undefined ? { amountPaid: paid } : {}),
          ...(total !== undefined && paid !== undefined
            ? { outstandingBalance: Math.max(0, total - paid) }
            : {}),
          paymentStatus,
          ...(paymentDate
            ? { paymentDate: new Date(`${paymentDate}T12:00:00Z`).toISOString() }
            : {}),
          ...(ticketQuantity ? { ticketQuantity: Number(ticketQuantity) } : {}),
        },
        customFields: {},
      };
    }
    if (task === 'meeting') {
      return {
        type: 'appointment_upsert',
        leadId,
        ...(text(lead.externalAppointmentId)
          ? { appointmentId: text(lead.externalAppointmentId) }
          : {}),
        calendarId,
        title: meetingTitle,
        startTime: toIsoDateTime(meetingStart),
        endTime: toIsoDateTime(meetingEnd),
        status: meetingStatus,
      };
    }
    return { type: 'whatsapp_send', leadId, message: whatsappMessage };
  }, [
    amountPaid,
    calendarId,
    lead,
    leadId,
    meetingEnd,
    meetingStart,
    meetingStatus,
    meetingTitle,
    monetaryValue,
    opportunityName,
    opportunityStatus,
    paymentDate,
    paymentStatus,
    pipelineId,
    stageId,
    tagToAdd,
    tagToRemove,
    task,
    ticketQuantity,
    whatsappMessage,
  ]);
  const actionSignature = JSON.stringify(action);
  const visibleOperation =
    operation && previewActionSignature === actionSignature ? operation : null;
  const preview = record(visibleOperation?.preview);
  const summary = record(preview.summary);
  const blockers = Array.isArray(preview.blockers)
    ? preview.blockers.filter((item): item is string => typeof item === 'string')
    : [];
  const status = text(visibleOperation?.status, '');

  const load = useCallback(async () => {
    if (!leadId) return;
    const [references, operations] = await Promise.allSettled([
      ghlOperationsApi.referenceData(token),
      ghlOperationsApi.list(token, { eventId, leadId, limit: 12 }),
    ]);
    if (references.status === 'fulfilled') {
      setReferenceData(record(references.value));
    }
    if (operations.status === 'fulfilled') {
      setHistory(records(operations.value));
    }
    const failure =
      references.status === 'rejected'
        ? references.reason
        : operations.status === 'rejected'
          ? operations.reason
          : null;
    if (failure) {
      setMessage(failure instanceof Error ? failure.message : 'CRM actions could not be loaded.');
    }
  }, [eventId, leadId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function prepare() {
    if (!action || !canPrepare) return;
    setBusy('prepare');
    setMessage('');
    try {
      const result = await ghlOperationsApi.preview(
        {
          eventId,
          action,
        },
        token,
      );
      setOperation(record(result));
      setPreviewActionSignature(actionSignature);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The CRM action could not be prepared.');
    } finally {
      setBusy('');
    }
  }

  async function submit() {
    if (!visibleOperation) return;
    await mutate('submit', () =>
      ghlOperationsApi.submit(
        text(visibleOperation.id),
        {
          previewHash: text(visibleOperation.previewHash),
          expectedVersion: numberValue(visibleOperation.version),
          reason: `Customer operation prepared from Event Operations: ${task}`,
        },
        token,
      ),
    );
  }

  async function decide(decision: 'approve' | 'reject') {
    if (!visibleOperation) return;
    await mutate(decision, () =>
      ghlOperationsApi.decide(
        text(visibleOperation.id),
        {
          previewHash: text(visibleOperation.previewHash),
          expectedVersion: numberValue(visibleOperation.version),
          decision,
          notes:
            decision === 'approve'
              ? 'Approved by the responsible commercial manager.'
              : 'Rejected by the responsible commercial manager.',
        },
        token,
      ),
    );
  }

  async function mutate(name: string, call: () => Promise<unknown>) {
    setBusy(name);
    setMessage('');
    try {
      const result = record(await call());
      setOperation(result);
      await load();
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The CRM action could not be completed.');
    } finally {
      setBusy('');
    }
  }

  function askStitchi() {
    if (!visibleOperation || status !== 'previewed' || blockers.length) return;
    const query = new URLSearchParams({
      mode: 'prepare',
      eventId,
      leadId,
      ghlOperationId: text(visibleOperation.id),
      prompt: `Submit the reviewed GHL ${task} action for manager approval. Do not change or execute it.`,
      returnTo: `/events/${eventId}`,
    });
    window.location.assign(`/stitchi?${query}`);
  }

  return (
    <ProductCard
      title="Take action in GoHighLevel"
      subtitle="Work from Tanaghum. Every CRM change is reviewed, approved and checked against GHL."
      action={
        <button type="button" className="ops-text-button" onClick={() => void load()}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      }
    >
      <div className="ghl-operations">
        <div className="ghl-task-grid" role="tablist" aria-label="Customer action">
          {TASKS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`ghl-task-${item.id}`}
              aria-controls="ghl-task-panel"
              aria-selected={task === item.id}
              className={`ghl-task ${task === item.id ? 'is-active' : ''}`}
              onClick={() => {
                setTask(item.id);
                setOperation(null);
                setMessage('');
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.helper}</span>
            </button>
          ))}
        </div>

        {!canPrepare ? (
          <Notice tone="info">
            You can review this customer&apos;s CRM action history. Preparing CRM changes is limited
            to the responsible commercial roles.
          </Notice>
        ) : setupStatus === 'setup_required' ? (
          <Notice tone="warn">
            Connect and validate the customer-owned GoHighLevel account before preparing CRM work.
          </Notice>
        ) : null}

        <div
          id="ghl-task-panel"
          role="tabpanel"
          aria-labelledby={`ghl-task-${task}`}
          className="ghl-task-panel"
        >
          {canPrepare && task === 'customer' ? (
            <Notice tone="info">
              Tanaghum will create or refresh this customer in GHL using the saved name, email,
              phone and source.
            </Notice>
          ) : null}

          {canPrepare && task === 'tags' ? (
            <div className="ghl-form-grid">
              <Field label="Add tag">
                <select
                  value={tagToAdd}
                  onChange={(event) => {
                    setTagToAdd(event.target.value);
                    if (event.target.value) setTagToRemove('');
                  }}
                >
                  <option value="">No tag to add</option>
                  {tags.map((item) => (
                    <option
                      key={text(item.id)}
                      value={text(item.name)}
                      disabled={item.approved !== true}
                    >
                      {text(item.name)}
                      {item.approved === true ? '' : ' - mapping required'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Remove tag">
                <select
                  value={tagToRemove}
                  onChange={(event) => {
                    setTagToRemove(event.target.value);
                    if (event.target.value) setTagToAdd('');
                  }}
                >
                  <option value="">No tag to remove</option>
                  {tags.map((item) => (
                    <option
                      key={text(item.id)}
                      value={text(item.name)}
                      disabled={item.approved !== true}
                    >
                      {text(item.name)}
                      {item.approved === true ? '' : ' - mapping required'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {canPrepare && task === 'sale' ? (
            <div className="ghl-form-grid">
              <Field label="Pipeline">
                <select
                  value={pipelineId}
                  onChange={(event) => {
                    setPipelineId(event.target.value);
                    setStageId('');
                  }}
                >
                  <option value="">Select pipeline</option>
                  {pipelines.map((item) => (
                    <option
                      key={text(item.id)}
                      value={text(item.id)}
                      disabled={item.approved !== true}
                    >
                      {text(item.name)}
                      {item.approved === true ? '' : ' - mapping required'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select value={stageId} onChange={(event) => setStageId(event.target.value)}>
                  <option value="">Select stage</option>
                  {stages.map((item) => (
                    <option
                      key={text(item.id)}
                      value={text(item.id)}
                      disabled={item.approved !== true}
                    >
                      {text(item.name)}
                      {item.approved === true ? '' : ' - mapping required'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Opportunity name">
                <input
                  value={opportunityName}
                  onChange={(event) => setOpportunityName(event.target.value)}
                />
              </Field>
              <Field label="Status">
                <select
                  value={opportunityStatus}
                  onChange={(event) => setOpportunityStatus(event.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </Field>
              <Field label="Total sale value">
                <input
                  type="number"
                  min="0"
                  value={monetaryValue}
                  onChange={(event) => setMonetaryValue(event.target.value)}
                />
              </Field>
              <Field label="Amount paid">
                <input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                />
              </Field>
              <Field label="Ticket quantity">
                <input
                  type="number"
                  min="0"
                  value={ticketQuantity}
                  onChange={(event) => setTicketQuantity(event.target.value)}
                />
              </Field>
              <Field label="Payment status">
                <select
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="partial">Partially paid</option>
                  <option value="paid_in_full">Paid in full</option>
                  <option value="refunded">Refunded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
              <Field label="Payment date">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {canPrepare && task === 'meeting' ? (
            <div className="ghl-form-grid">
              {text(lead.externalAppointmentId) ? (
                <Notice tone="info">
                  This will update the meeting already linked to this customer.
                </Notice>
              ) : null}
              <Field label="Calendar">
                <select value={calendarId} onChange={(event) => setCalendarId(event.target.value)}>
                  <option value="">Select calendar</option>
                  {calendars.map((item) => (
                    <option key={text(item.id)} value={text(item.id)}>
                      {text(item.name)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Meeting title">
                <input
                  value={meetingTitle}
                  onChange={(event) => setMeetingTitle(event.target.value)}
                />
              </Field>
              <Field label="Start">
                <input
                  type="datetime-local"
                  value={meetingStart}
                  onChange={(event) => setMeetingStart(event.target.value)}
                />
              </Field>
              <Field label="End">
                <input
                  type="datetime-local"
                  value={meetingEnd}
                  onChange={(event) => setMeetingEnd(event.target.value)}
                />
              </Field>
              <Field label="Meeting status">
                <select
                  value={meetingStatus}
                  onChange={(event) => setMeetingStatus(event.target.value)}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="showed">Attended</option>
                  <option value="noshow">No show</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>
          ) : null}

          {canPrepare && task === 'whatsapp' ? (
            <Field label="Customer message">
              <textarea
                rows={4}
                value={whatsappMessage}
                onChange={(event) => setWhatsappMessage(event.target.value)}
                placeholder="Write the exact approved message."
              />
            </Field>
          ) : null}

          {message ? <Notice tone="warn">{message}</Notice> : null}

          {canPrepare ? (
            <div className="ghl-action-row">
              <button
                className="ops-button is-primary"
                type="button"
                onClick={() => void prepare()}
                disabled={Boolean(busy)}
              >
                {busy === 'prepare' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}{' '}
                Review change
              </button>
              <button
                className="ops-button is-secondary"
                type="button"
                onClick={askStitchi}
                disabled={
                  !operation || status !== 'previewed' || blockers.length > 0 || Boolean(busy)
                }
              >
                <Sparkles size={16} /> Continue with Stitchi
              </button>
            </div>
          ) : null}
        </div>

        {visibleOperation ? (
          <section className="ghl-review" aria-live="polite">
            <div className="ghl-review-heading">
              <div>
                <small>Review before CRM execution</small>
                <h4>{text(summary.title, titleCase(visibleOperation.operationType))}</h4>
              </div>
              <ProductStatus
                tone={
                  status === 'reconciled'
                    ? 'good'
                    : status === 'failed' || status === 'blocked'
                      ? 'danger'
                      : 'info'
                }
              >
                {titleCase(status)}
              </ProductStatus>
            </div>
            {blockers.length ? <Notice tone="warn">{blockers.join(' ')}</Notice> : null}
            <div className="ghl-review-facts">
              {Object.entries(summary)
                .filter(([key]) => key !== 'title')
                .slice(0, 8)
                .map(([key, value]) => (
                  <span key={key}>
                    <strong>{titleCase(key)}</strong>
                    {displayValue(value)}
                  </span>
                ))}
            </div>
            <div className="ghl-action-row">
              {status === 'previewed' && !blockers.length ? (
                <button
                  className="ops-button is-primary"
                  type="button"
                  onClick={() => void submit()}
                  disabled={Boolean(busy)}
                >
                  Send for approval
                </button>
              ) : null}
              {status === 'pending_approval' && canApprove ? (
                <button
                  className="ops-button is-primary"
                  type="button"
                  onClick={() => void decide('approve')}
                  disabled={Boolean(busy)}
                >
                  Approve
                </button>
              ) : null}
              {status === 'pending_approval' && canApprove ? (
                <button
                  className="ops-button is-secondary"
                  type="button"
                  onClick={() => void decide('reject')}
                  disabled={Boolean(busy)}
                >
                  Reject
                </button>
              ) : null}
            </div>
            {status === 'approved' ? (
              <Notice tone="info">
                Approved and queued. Tanaghum will execute it through the governed CRM worker when
                live GHL writes are enabled.
              </Notice>
            ) : null}
            {status === 'provider_accepted' || status === 'reconciliation_pending' ? (
              <Notice tone="info">
                GoHighLevel accepted the request. Tanaghum is waiting for verified read-back or
                webhook confirmation.
              </Notice>
            ) : null}
          </section>
        ) : null}

        {history.length ? (
          <section className="ghl-history">
            <h4>Recent customer actions</h4>
            {history.slice(0, 5).map((item) => (
              <div key={text(item.id)} className="ghl-history-row">
                <Clock3 size={15} aria-hidden="true" />
                <span>
                  <strong>{titleCase(item.operationType)}</strong>
                  <small>
                    {titleCase(item.status)} /{' '}
                    {new Date(text(item.updatedAt, text(item.createdAt))).toLocaleString()}
                  </small>
                </span>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </ProductCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ghl-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
