import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
  XCircle,
} from 'lucide-react';
import { ApiError, stitchiApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { AieroPanel, AieroStatusPill } from './AieroUX';

type RecordMap = Record<string, unknown>;
type ChatMode = 'ask' | 'prepare';

interface Conversation {
  id: string;
  title: string;
  eventId?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  pending?: boolean;
}

interface ActionRun {
  id: string;
  actionType: string;
  status: string;
  riskLevel?: string;
  requiresApproval?: boolean;
  previewPayload?: unknown;
  resultPayload?: unknown;
}

const STARTER_PROMPTS = [
  'What should I focus on today?',
  'Create an Online Courses plan for a leadership course launch. Objective: sell to entrepreneurs. Audience: warm followers and previous buyers. Budget target: 5000. Revenue target: 30000. Action plan: content, ads, GHL follow-up, WhatsApp reminders. Link it to the next available live event if suitable.',
  'Prepare the event marketing and sales plan.',
  'Record this blocker: WhatsApp follow-up is taking too long.',
  'Check whether CRM and social data are ready.',
];

const APPROVER_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

function getUserRole(user: unknown): string {
  if (!user || typeof user !== 'object') return 'unknown';
  return normalizeRole(text((user as RecordMap).role, 'unknown'));
}

function mapConversation(value: unknown): Conversation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as RecordMap;
  const id = text(record.id);
  if (!id) return null;
  return {
    id,
    title: text(record.title, 'Stitchi conversation'),
    eventId: text(record.eventId || record.event_id, '') || null,
  };
}

function mapMessage(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as RecordMap;
  const id = text(record.id);
  const role = text(record.role, 'assistant') as Message['role'];
  const content = text(record.content);
  if (!id || !content) return null;
  return {
    id,
    role,
    content,
    createdAt: text(record.createdAt || record.created_at),
  };
}

function mapAction(value: unknown): ActionRun | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as RecordMap;
  const id = text(record.id);
  if (!id) return null;
  return {
    id,
    actionType: text(record.actionType || record.action_type, 'action'),
    status: text(record.status, 'proposed'),
    riskLevel: text(record.riskLevel || record.risk_level, 'medium'),
    requiresApproval: record.requiresApproval === true || record.requires_approval === true,
    previewPayload: record.previewPayload || record.preview_payload,
    resultPayload: record.resultPayload || record.result_payload,
  };
}

function extractEventId(pathname: string): string | undefined {
  const match = pathname.match(/^\/events\/([0-9a-fA-F-]{36})/);
  return match?.[1];
}

function actionTitle(actionType: string): string {
  const labels: Record<string, string> = {
    create_event_problem: 'Record event blocker',
    update_event_strategy: 'Update event plan',
    create_event_kpi_record: 'Save KPI record',
    update_lead_status: 'Update lead status',
    set_lead_temperature: 'Update lead temperature',
    create_commercial_revenue_line: 'Set up revenue line',
    create_commercial_plan: 'Create commercial plan',
    update_commercial_plan: 'Update commercial plan',
    create_commercial_assessment_signal: 'Record commercial signal',
  };
  return labels[actionType] || actionType.replaceAll('_', ' ');
}

function actionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    awaiting_approval: 'Needs approval',
    approved: 'Approved',
    rejected: 'Rejected',
    running: 'Saving',
    completed: 'Saved',
    failed: 'Failed',
    cancelled: 'Cancelled',
    proposed: 'Prepared',
  };
  return labels[status] || status.replaceAll('_', ' ');
}

function statusAccent(status: string): 'teal' | 'amber' | 'rose' | 'blue' | 'violet' {
  if (['completed', 'approved'].includes(status)) return 'teal';
  if (['awaiting_approval', 'proposed', 'running'].includes(status)) return 'amber';
  if (['rejected', 'failed', 'cancelled'].includes(status)) return 'rose';
  return 'blue';
}

export function StitchiFloatingAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] inline-flex min-h-14 items-center gap-3 rounded-full bg-[#080813] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_70px_rgba(8,8,19,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_90px_rgba(8,8,19,0.42)]"
        aria-label="Open Stitchi assistant"
      >
        <Sparkles className="h-5 w-5 text-[#70f5df]" />
        <span className="hidden sm:inline">Ask Stitchi</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/45 p-3 backdrop-blur-sm">
          <div className="ml-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-[#080813] text-white shadow-[0_28px_110px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#080813]">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold">Stitchi</div>
                  <div className="text-xs text-white/45">Your governed work assistant</div>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 p-2 text-white/70" aria-label="Close Stitchi">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <StitchiChatPanel compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function StitchiChatPanel({ compact = false }: { compact?: boolean }) {
  const { token, user } = useAuth();
  const location = useLocation();
  const role = getUserRole(user);
  const canApprove = APPROVER_ROLES.includes(role);
  const routeEventId = useMemo(() => extractEventId(location.pathname), [location.pathname]);
  const searchContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      eventId: routeEventId || text(params.get('eventId')),
      revenueLineId: text(params.get('revenueLineId')),
      revenueLineType: text(params.get('revenueLineType')),
      prompt: text(params.get('prompt')),
      mode: text(params.get('mode')),
    };
  }, [location.search, routeEventId]);
  const eventId = searchContext.eventId || undefined;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<ActionRun[]>([]);
  const [input, setInput] = useState(() => searchContext.prompt || '');
  const [mode, setMode] = useState<ChatMode>(() => searchContext.mode === 'prepare' ? 'prepare' : 'ask');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadConversation = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const conversations = await stitchiApi.conversations(token, eventId ? { eventId } : undefined);
      const existing = (Array.isArray(conversations) ? conversations : [])
        .map(mapConversation)
        .find(Boolean) as Conversation | undefined;
      const active = existing || mapConversation(await stitchiApi.createConversation({
        title: eventId ? 'Event work with Stitchi' : 'Daily work with Stitchi',
        ...(eventId ? { eventId } : {}),
      }, token));
      if (!active) throw new Error('Could not start Stitchi conversation');
      setConversation(active);
      const [messageRows, actionRows] = await Promise.all([
        stitchiApi.messages(active.id, token),
        stitchiApi.actions(active.id, token),
      ]);
      setMessages((Array.isArray(messageRows) ? messageRows : []).map(mapMessage).filter(Boolean) as Message[]);
      setActions((Array.isArray(actionRows) ? actionRows : []).map(mapAction).filter(Boolean) as ActionRun[]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Stitchi could not load.');
    } finally {
      setLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversation();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  async function refreshActions(conversationId = conversation?.id) {
    if (!token || !conversationId) return;
    const rows = await stitchiApi.actions(conversationId, token);
    setActions((Array.isArray(rows) ? rows : []).map(mapAction).filter(Boolean) as ActionRun[]);
  }

  function requestPayload(content: string) {
    return {
      content,
      ...(eventId ? { eventId } : {}),
      metadata: {
        currentPath: `${location.pathname}${location.search}`,
        ...(searchContext.revenueLineId ? { revenueLineId: searchContext.revenueLineId } : {}),
        ...(searchContext.revenueLineType ? { revenueLineType: searchContext.revenueLineType } : {}),
      },
    };
  }

  async function sendMessage(nextMode = mode, prompt = input) {
    if (!token || !conversation || sending) return;
    const content = prompt.trim();
    if (!content) return;
    setInput('');
    setSending(true);
    setMessage('');
    const localUser: Message = { id: `local-user-${Date.now()}`, role: 'user', content, pending: true };
    setMessages(prev => [...prev, localUser]);

    try {
      if (nextMode === 'prepare') {
        const result = await stitchiApi.orchestrate(conversation.id, requestPayload(content), token) as RecordMap;
        const userMessage = mapMessage(result.userMessage);
        const assistantMessage = mapMessage(result.assistantMessage);
        const actionRun = mapAction(result.actionRun);
        setMessages(prev => [
          ...prev.filter(item => item.id !== localUser.id),
          ...(userMessage ? [userMessage] : [localUser]),
          ...(assistantMessage ? [assistantMessage] : []),
        ]);
        if (actionRun) setActions(prev => [actionRun, ...prev.filter(item => item.id !== actionRun.id)]);
        await refreshActions(conversation.id);
        return;
      }

      const assistantId = `local-assistant-${Date.now()}`;
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', pending: true }]);
      await stitchiApi.respondStream(conversation.id, requestPayload(content), token, (event) => {
        const data = event.data as RecordMap;
        if (event.event === 'stitchi.token' && typeof data.text === 'string') {
          setMessages(prev => prev.map(item => item.id === assistantId ? { ...item, content: `${item.content}${data.text}` } : item));
        }
      });
      const [messageRows, actionRows] = await Promise.all([
        stitchiApi.messages(conversation.id, token),
        stitchiApi.actions(conversation.id, token),
      ]);
      setMessages((Array.isArray(messageRows) ? messageRows : []).map(mapMessage).filter(Boolean) as Message[]);
      setActions((Array.isArray(actionRows) ? actionRows : []).map(mapAction).filter(Boolean) as ActionRun[]);
    } catch (err) {
      setMessages(prev => prev.filter(item => item.id !== localUser.id));
      const detail = err instanceof ApiError && err.code === 'LLM_PROVIDER_REQUIRED'
        ? 'Connect your AI model in AI Settings, then ask Stitchi again.'
        : err instanceof Error ? err.message : 'Stitchi could not complete the request.';
      setMessage(detail);
    } finally {
      setSending(false);
    }
  }

  async function decide(actionId: string, decision: 'approve' | 'reject') {
    if (!token) return;
    setMessage('');
    setSending(true);
    try {
      if (decision === 'approve') {
        await stitchiApi.approveAndExecuteAction(actionId, { notes: 'Approved and saved from Stitchi assistant' }, token);
        window.dispatchEvent(new CustomEvent('tanaghum:commercial-data-changed', { detail: { source: 'stitchi' } }));
      } else {
        await stitchiApi.rejectAction(actionId, { notes: 'Rejected from Stitchi assistant' }, token);
      }
      await refreshActions();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setSending(false);
    }
  }

  async function execute(actionId: string) {
    if (!token) return;
    setMessage('');
    setSending(true);
    try {
      await stitchiApi.executeAction(actionId, token);
      window.dispatchEvent(new CustomEvent('tanaghum:commercial-data-changed', { detail: { source: 'stitchi' } }));
      await refreshActions();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={compact ? 'flex h-full flex-col' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'}>
      <section className={compact ? 'flex min-h-0 flex-1 flex-col' : 'min-h-[720px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.06]'}>
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold text-white">Chat with Stitchi</div>
              <div className="mt-1 text-sm text-white/48">Ask for guidance or prepare governed work for approval.</div>
            </div>
            <div className="flex rounded-full border border-white/10 bg-white/[0.05] p-1">
              <ModeButton active={mode === 'ask'} onClick={() => setMode('ask')}>Ask</ModeButton>
              <ModeButton active={mode === 'prepare'} onClick={() => setMode('prepare')}>Prepare work</ModeButton>
            </div>
          </div>
        </div>

        <div className={compact ? 'min-h-0 flex-1 overflow-y-auto px-5 py-4' : 'h-[520px] overflow-y-auto px-5 py-5'}>
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-white/55">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting Stitchi...
            </div>
          ) : messages.length ? (
            <div className="space-y-4">
              {messages.map(item => <ChatBubble key={item.id} message={item} />)}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="flex min-h-full items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#080813]">
                  <MessageSquareText className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">Tell Stitchi what you want to do</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Stitchi can read your event context, answer questions, and prepare safe internal actions for approval.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          {message && <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">{message}</div>}
          <div className="mb-3 flex flex-wrap gap-2">
            {STARTER_PROMPTS.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/65 transition hover:bg-white/[0.09] hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={mode === 'prepare' ? 'Example: Record this event blocker...' : 'Example: What should I focus on today?'}
              className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm leading-6 text-white placeholder:text-white/35"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim() || !conversation}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#080813] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={mode === 'prepare' ? 'Prepare work with Stitchi' : 'Ask Stitchi'}
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'prepare' ? <WandSparkles className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </section>

      {!compact && (
        <aside className="space-y-4">
          <AieroPanel title="How Stitchi works" subtitle="Simple for users, governed in the backend.">
            <div className="space-y-3 text-sm leading-6 text-white/58">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#70f5df]" />
                <span>Answers can stream immediately using your connected AI model.</span>
              </div>
              <div className="flex gap-3">
                <WandSparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd166]" />
                <span>Work changes are prepared as cards and need approval before saving.</span>
              </div>
              <div className="flex gap-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff8da0]" />
                <span>External publishing, CRM writes, messaging, and calls stay blocked unless separately authorized.</span>
              </div>
            </div>
          </AieroPanel>

          <ActionList actions={actions} canApprove={canApprove} sending={sending} onDecision={decide} onExecute={execute} />

          <AieroPanel title="Useful places" subtitle="Jump to the workspace behind Stitchi's answer.">
            <div className="grid gap-2">
              <QuickLink to="/events" label="Events workspace" />
              <QuickLink to="/ideas" label="Content creator" />
              <QuickLink to="/integration-credentials" label="Connect data sources" />
              <QuickLink to="/ai-settings" label="AI model settings" />
            </div>
          </AieroPanel>
        </aside>
      )}

      {compact && (
        <div className="border-t border-white/10 p-4">
          <ActionList actions={actions} canApprove={canApprove} sending={sending} onDecision={decide} onExecute={execute} compact />
          <Link to="/stitchi" className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white">
            Open full workspace
          </Link>
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#080813]' : 'rounded-full px-4 py-2 text-xs font-semibold text-white/55'}
    >
      {children}
    </button>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={isUser
        ? 'max-w-[82%] rounded-[1.35rem] bg-white px-4 py-3 text-sm leading-6 text-[#080813]'
        : 'max-w-[88%] rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white/82'}
      >
        <div className="whitespace-pre-wrap">{message.content || (message.pending ? 'Thinking...' : '')}</div>
      </div>
    </div>
  );
}

function ActionList({
  actions,
  canApprove,
  sending,
  onDecision,
  onExecute,
  compact = false,
}: {
  actions: ActionRun[];
  canApprove: boolean;
  sending: boolean;
  onDecision: (actionId: string, decision: 'approve' | 'reject') => Promise<void>;
  onExecute: (actionId: string) => Promise<void>;
  compact?: boolean;
}) {
  const latestActions = actions.slice(0, compact ? 2 : 5);
  if (!latestActions.length) {
    return compact ? null : (
      <AieroPanel title="Prepared work" subtitle="Action cards will appear here when Stitchi prepares work for approval.">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/50">
          No prepared actions yet.
        </div>
      </AieroPanel>
    );
  }

  const content = (
    <div className="space-y-3">
      {latestActions.map(action => (
        <div key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{actionTitle(action.actionType)}</div>
              <div className="mt-1 text-xs leading-5 text-white/45">Prepared by Stitchi. No external execution.</div>
            </div>
            <AieroStatusPill accent={statusAccent(action.status)}>{actionStatusLabel(action.status)}</AieroStatusPill>
          </div>
          <ActionPreview action={action} />
          <div className="mt-3 flex flex-wrap gap-2">
            {action.status === 'awaiting_approval' && canApprove && (
              <>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void onDecision(action.id, 'approve')}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#080813] disabled:opacity-45"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve & Save
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void onDecision(action.id, 'reject')}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 disabled:opacity-45"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </>
            )}
            {action.status === 'awaiting_approval' && !canApprove && (
              <span className="text-xs leading-6 text-white/45">Manager approval required.</span>
            )}
            {action.status === 'approved' && (
              <button
                type="button"
                disabled={sending}
                onClick={() => void onExecute(action.id)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#70f5df] px-3 py-1.5 text-xs font-semibold text-[#080813] disabled:opacity-45"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save approved work
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (compact) return content;
  return <AieroPanel title="Prepared work" subtitle="Approve and save safe internal changes from here.">{content}</AieroPanel>;
}

function ActionPreview({ action }: { action: ActionRun }) {
  if (!action.previewPayload || typeof action.previewPayload !== 'object') return null;
  const preview = action.previewPayload as RecordMap;
  const rawRows: Array<[string, unknown]> = [
    ['Revenue line', preview.revenueLineName],
    ['Title', preview.title || preview.name],
    ['Objective', preview.objective],
    ['Audience', preview.audience],
    ['Budget target', preview.budgetTarget],
    ['Revenue target', preview.revenueTarget],
    ['Linked event', preview.linkedEventName],
    ['Action plan', preview.actionPlan],
  ];
  const rows: Array<[string, string]> = rawRows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => [label, String(value)]);
  if (!rows.length) return null;

  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">
      {rows.slice(0, 6).map(([label, value]) => (
        <div key={label} className="grid gap-1 text-xs leading-5 sm:grid-cols-[100px_1fr]">
          <span className="font-semibold uppercase tracking-[0.14em] text-white/38">{label}</span>
          <span className="min-w-0 break-words text-white/72">{String(value)}</span>
        </div>
      ))}
      {rows.length > 6 && (
        <div className="text-xs leading-5 text-white/45">
          {String(rows[6][1])}
        </div>
      )}
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
      {label}
    </Link>
  );
}

export function StitchiWorkspace() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-[#080813] text-white shadow-[0_28px_90px_rgba(8,8,19,0.22)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#ff5268]/16 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#00dcae]/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-[#8a7cff]/12 blur-3xl" />
      </div>
      <div className="relative border-b border-white/10 px-5 py-6 sm:px-7 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <span className="h-2 w-2 rounded-full bg-[#70f5df]" />
              AI work assistant
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-5xl">
              Tell Stitchi what work you want done.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58 sm:text-base">
              Ask questions, prepare event plans, record blockers, and turn daily work into governed actions without jumping between pages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AieroStatusPill accent="teal">Tenant safe</AieroStatusPill>
            <AieroStatusPill accent="amber">Approval gated</AieroStatusPill>
          </div>
        </div>
      </div>
      <div className="relative px-5 py-6 sm:px-7 lg:px-8">
        <StitchiChatPanel />
      </div>
    </div>
  );
}
