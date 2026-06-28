import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { smartLabsApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  Field,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function tone(value: string): 'good' | 'warn' | 'danger' | 'info' {
  const lower = value.toLowerCase();
  if (lower.includes('enabled') || lower.includes('configured') || lower.includes('executed') || lower.includes('ok')) return 'good';
  if (lower.includes('blocked') || lower.includes('missing')) return 'warn';
  if (lower.includes('failed') || lower.includes('error')) return 'danger';
  return 'info';
}

export default function SmartLabsVoice() {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<RecordMap | null>(null);
  const [loadingAction, setLoadingAction] = useState('');
  const [conversationForm, setConversationForm] = useState({
    agentId: '',
    message: 'السلام عليكم',
    confirmExternalExecution: false,
  });
  const [ttsForm, setTtsForm] = useState({
    agentId: '',
    text: 'وعليكم السلام، كيف أقدر أساعدك؟',
    voiceId: '',
    ttsBackend: '',
    confirmExternalExecution: false,
  });

  async function load() {
    if (!token) return;
    const response = await smartLabsApi.status(token);
    setStatus(response as RecordMap);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const response = await smartLabsApi.status(token as string);
        if (!cancelled) setStatus(response as RecordMap);
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load SmartLabs status');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setLoadingAction(label);
    setMessage('');
    try {
      const response = await action();
      setResult(response as RecordMap);
      setMessage(`${label} completed.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setLoadingAction('');
    }
  }

  const configured = status?.configured === true;
  const readAccess = text(status?.readAccess, 'blocked');
  const executionAccess = text(status?.executionAccess, 'blocked');
  const readBlockers = stringArray(status?.readBlockers);
  const executionBlockers = stringArray(status?.executionBlockers);
  const resultAudio = typeof result?.audioBase64 === 'string'
    ? `data:${text(result.contentType, 'audio/wav')};base64,${result.audioBase64}`
    : '';

  return (
    <ProductPage
      eyebrow="Integrations"
      title="SmartLabs Voice Agent"
      subtitle="Connect each tenant to its own SmartLabs ConvAI and text-to-speech account. Reads and execution are explicit, audited, and gated by production policy."
      action={<ProductStatus tone={configured ? 'good' : 'warn'}>{configured ? 'Tenant Key Saved' : 'Requires Tenant Key'}</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('blocked') ? 'danger' : 'info'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Credential" value={configured ? 'Saved' : 'Missing'} detail="Tenant-owned SmartLabs API key" tone={configured ? 'good' : 'warn'} />
        <MetricCard label="Read Access" value={readAccess} detail="Agents and voices endpoints" tone={tone(readAccess)} />
        <MetricCard label="Execution" value={executionAccess} detail="Conversation and TTS calls" tone={tone(executionAccess)} />
        <MetricCard label="Raw Secrets" value="Never Shown" detail="Credential vault returns status only" tone="info" />
      </div>

      <ProductCard
        title="Connection Setup"
        subtitle="Save the customer-owned SmartLabs key in the tenant credential vault. Do not paste the key anywhere else."
        action={<Link to="/integration-credentials" className="text-sm font-medium text-blue-700 hover:text-blue-900">Open Credentials</Link>}
      >
        <DetailGrid items={[
          { label: 'Provider', value: 'smartlabs_voice' },
          { label: 'Credential Type', value: 'api_key' },
          { label: 'Required Field', value: 'apiKey' },
          { label: 'Optional Fields', value: 'baseUrl, agentId, voiceId, ttsBackend' },
          { label: 'Default Base URL', value: 'https://api.thesmartlabs.net' },
          { label: 'Default Voice', value: 'smarttts2-xms-default' },
        ]} />
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductCard title="Read Test" subtitle="These buttons call SmartLabs read endpoints only when SMARTLABS_READ_ENABLED=true and the tenant API key is saved.">
          <div className="space-y-4">
            {readBlockers.length > 0 && <Notice tone="warn">{readBlockers.join('; ')}</Notice>}
            <div className="flex flex-wrap gap-3">
              <SecondaryAction disabled={Boolean(loadingAction)} onClick={() => runAction('Agent list test', () => smartLabsApi.testAgents(token as string))}>
                {loadingAction === 'Agent list test' ? 'Testing...' : 'Test Agents'}
              </SecondaryAction>
              <SecondaryAction disabled={Boolean(loadingAction)} onClick={() => runAction('Voice list test', () => smartLabsApi.testVoices(token as string))}>
                {loadingAction === 'Voice list test' ? 'Testing...' : 'Test Voices'}
              </SecondaryAction>
            </div>
          </div>
        </ProductCard>

        <ProductCard title="Execution Gates" subtitle="External execution needs tenant credentials, runtime flags, approval policy, and explicit confirmation.">
          <div className="space-y-3">
            {executionBlockers.length > 0 ? executionBlockers.map(blocker => (
              <div key={blocker} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{blocker}</div>
            )) : (
              <Notice tone="good">Execution gates are open for authorized SmartLabs calls.</Notice>
            )}
          </div>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductCard title="Conversation" subtitle="Preview the payload first. Execute only for authorized tenant testing or production use.">
          <div className="space-y-4">
            <Field label="Agent ID">
              <input
                value={conversationForm.agentId}
                onChange={(event) => setConversationForm({ ...conversationForm, agentId: event.target.value })}
                placeholder="Use credential agentId if blank"
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Message">
              <textarea
                value={conversationForm.message}
                onChange={(event) => setConversationForm({ ...conversationForm, message: event.target.value })}
                rows={4}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={conversationForm.confirmExternalExecution}
                onChange={(event) => setConversationForm({ ...conversationForm, confirmExternalExecution: event.target.checked })}
              />
              Confirm external SmartLabs conversation execution
            </label>
            <div className="flex flex-wrap gap-3">
              <SecondaryAction disabled={Boolean(loadingAction)} onClick={() => runAction('Conversation preview', () => smartLabsApi.conversation({ ...conversationForm, mode: 'preview' }, token as string))}>
                Preview Payload
              </SecondaryAction>
              <PrimaryAction disabled={Boolean(loadingAction)} onClick={() => runAction('Conversation execute', () => smartLabsApi.conversation({ ...conversationForm, mode: 'execute' }, token as string))}>
                Execute Conversation
              </PrimaryAction>
            </div>
          </div>
        </ProductCard>

        <ProductCard title="Text to Speech" subtitle="Generate SmartLabs audio only after the same execution gates are satisfied.">
          <div className="space-y-4">
            <Field label="Agent ID">
              <input
                value={ttsForm.agentId}
                onChange={(event) => setTtsForm({ ...ttsForm, agentId: event.target.value })}
                placeholder="Use credential agentId if blank"
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Text">
              <textarea
                value={ttsForm.text}
                onChange={(event) => setTtsForm({ ...ttsForm, text: event.target.value })}
                rows={4}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Voice ID">
                <input
                  value={ttsForm.voiceId}
                  onChange={(event) => setTtsForm({ ...ttsForm, voiceId: event.target.value })}
                  placeholder="smarttts2-xms-default"
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
              <Field label="TTS Backend">
                <input
                  value={ttsForm.ttsBackend}
                  onChange={(event) => setTtsForm({ ...ttsForm, ttsBackend: event.target.value })}
                  placeholder="omnivoice"
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={ttsForm.confirmExternalExecution}
                onChange={(event) => setTtsForm({ ...ttsForm, confirmExternalExecution: event.target.checked })}
              />
              Confirm external SmartLabs text-to-speech execution
            </label>
            <div className="flex flex-wrap gap-3">
              <SecondaryAction disabled={Boolean(loadingAction)} onClick={() => runAction('TTS preview', () => smartLabsApi.textToSpeech({ ...ttsForm, mode: 'preview' }, token as string))}>
                Preview Payload
              </SecondaryAction>
              <PrimaryAction disabled={Boolean(loadingAction)} onClick={() => runAction('TTS execute', () => smartLabsApi.textToSpeech({ ...ttsForm, mode: 'execute' }, token as string))}>
                Generate Audio
              </PrimaryAction>
            </div>
          </div>
        </ProductCard>
      </div>

      {result && (
        <ProductCard title="Latest SmartLabs Result" subtitle="Admin evidence view. No API keys or raw secrets are returned.">
          {resultAudio && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-2 text-sm font-medium text-emerald-900">Generated Audio</div>
              <audio controls src={resultAudio} className="w-full" />
            </div>
          )}
          <DetailGrid items={[
            { label: 'Status', value: text(result.status) },
            { label: 'Response Status', value: String(result.responseStatus || 'n/a') },
            { label: 'External Call', value: String((result.safety as RecordMap | undefined)?.externalCallPerformed ?? false) },
            { label: 'Raw Secrets Returned', value: String(result.rawSecretsReturned || (result.safety as RecordMap | undefined)?.rawSecretsReturned || false) },
          ]} />
          <details className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-neutral-800">Technical response</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-neutral-600">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </ProductCard>
      )}
    </ProductPage>
  );
}
