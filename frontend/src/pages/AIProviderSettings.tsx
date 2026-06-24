import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { aiProviderApi } from '../api';
import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI';

interface ProviderStatus {
  name: string;
  type: 'mock' | 'openai' | 'claude';
  configured: boolean;
  model: string;
  apiKeyStatus: 'configured' | 'missing';
  scope?: string;
}

interface CredentialStatus {
  id: string;
  provider: 'openai' | 'claude';
  model: string;
  apiKeyStatus: string;
  keyFingerprint: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  updatedAt: string;
}

const PROVIDERS = [
  { type: 'mock', name: 'Mock LLM', defaultModel: 'mock-v1', keyLabel: 'No key required' },
  { type: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o', keyLabel: 'OpenAI API key' },
  { type: 'claude', name: 'Claude', defaultModel: 'claude-sonnet-4-20250514', keyLabel: 'Claude API key' },
] as const;

export default function AIProviderSettings() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState<'mock' | 'openai' | 'claude'>('mock');
  const [selectedProvider, setSelectedProvider] = useState<'mock' | 'openai' | 'claude'>('mock');
  const [model, setModel] = useState('mock-v1');
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');

  async function load() {
    if (!token) return;
    const [status, credentialData] = await Promise.all([
      aiProviderApi.status(token),
      aiProviderApi.credentials(token),
    ]);
    const statusMap = status as { providers: ProviderStatus[]; activeProvider: 'mock' | 'openai' | 'claude' };
    const creds = credentialData as { credentials: CredentialStatus[]; activeProvider: 'mock' | 'openai' | 'claude' };
    setProviders(statusMap.providers || []);
    setCredentials(creds.credentials || []);
    setActiveProvider(creds.activeProvider || statusMap.activeProvider || 'mock');
    setSelectedProvider(creds.activeProvider || statusMap.activeProvider || 'mock');
  }

  useEffect(() => {
    load().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load provider settings'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectedMeta = useMemo(
    () => PROVIDERS.find((provider) => provider.type === selectedProvider) || PROVIDERS[0],
    [selectedProvider],
  );

  useEffect(() => {
    const credential = credentials.find((item) => item.provider === selectedProvider);
    setModel(credential?.model || selectedMeta.defaultModel);
    setApiKey('');
  }, [credentials, selectedMeta.defaultModel, selectedProvider]);

  async function saveCredential() {
    if (!token || selectedProvider === 'mock') return;
    setLoading('save');
    setMessage('');
    try {
      await aiProviderApi.saveCredential({ provider: selectedProvider, model, apiKey }, token);
      setMessage('API key encrypted and saved for your user account only. Raw key was not returned.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setLoading('');
    }
  }

  async function selectProvider() {
    if (!token) return;
    setLoading('select');
    setMessage('');
    try {
      await aiProviderApi.select(selectedProvider, token);
      setActiveProvider(selectedProvider);
      setMessage(`${selectedMeta.name} selected for your user session.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to select provider');
    } finally {
      setLoading('');
    }
  }

  async function testProvider(provider: 'openai' | 'claude') {
    if (!token) return;
    setLoading(`test-${provider}`);
    setMessage('');
    try {
      const result = await aiProviderApi.test(provider, token) as { _label?: string; status?: string };
      setMessage(result._label || `Provider test ${result.status || 'completed'}`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Provider test failed');
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <div className="flex flex-wrap gap-2">
          <DemoLabel>User-Owned Credentials</DemoLabel>
          <StatusBadge label="Encrypted at rest" variant="success" />
          <StatusBadge label="Raw keys never displayed" variant="success" />
          <StatusBadge label="Backend-only model calls" variant="info" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white">AI Provider Settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Choose your LLM provider, store your own API key securely, and keep model execution isolated to your account. STITCH uses your active provider only through the backend.
        </p>
      </header>

      {message && <Alert type={message.includes('Failed') || message.includes('missing') ? 'warning' : 'success'}>{message}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <Card title="Provider Setup">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Provider</span>
              <select
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as 'mock' | 'openai' | 'claude')}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white"
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider.type} value={provider.type}>{provider.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Model</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={selectedProvider === 'mock'}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white disabled:opacity-60"
              />
            </label>

            {selectedProvider !== 'mock' && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{selectedMeta.keyLabel}</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste key once. It will be encrypted and never shown again."
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={selectProvider}
                disabled={loading === 'select'}
                className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {loading === 'select' ? 'Selecting...' : 'Use Provider'}
              </button>
              <button
                onClick={saveCredential}
                disabled={selectedProvider === 'mock' || !apiKey || loading === 'save'}
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading === 'save' ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const status = providers.find((item) => item.type === provider.type);
              const credential = credentials.find((item) => item.provider === provider.type);
              const active = activeProvider === provider.type;
              return (
                <Card key={provider.type} className={active ? 'border-sky-500/60 ring-1 ring-sky-500/30' : ''}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{status?.scope === 'user' ? 'User credential' : provider.type === 'mock' ? 'Built-in fallback' : 'Environment or missing'}</p>
                      </div>
                      <StatusBadge label={active ? 'Active' : status?.configured ? 'Configured' : 'Missing'} variant={active ? 'success' : status?.configured ? 'info' : 'warning'} />
                    </div>

                    <div className="space-y-2 text-sm">
                      <Line label="Model" value={credential?.model || status?.model || provider.defaultModel} />
                      <Line label="API key" value={provider.type === 'mock' ? 'Not required' : credential ? `configured (${credential.keyFingerprint})` : status?.apiKeyStatus || 'missing'} />
                      <Line label="Scope" value={provider.type === 'mock' ? 'system' : credential ? 'user isolated' : status?.scope || 'none'} />
                    </div>

                    {provider.type !== 'mock' && (
                      <button
                        onClick={() => testProvider(provider.type)}
                        disabled={!credential || loading === `test-${provider.type}`}
                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                      >
                        {loading === `test-${provider.type}` ? 'Testing...' : 'Test Backend Connection'}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Alert type="info">
            Keys are encrypted with the deployment master key and scoped to the authenticated user. The frontend receives only status and fingerprint.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right font-mono text-xs text-slate-300">{value}</span>
    </div>
  );
}
