import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { aiProviderApi } from '../api';
import { Notice, ProductCard, ProductPage, ProductStatus } from '../components/ProductUI';

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
const CONFIGURABLE_PROVIDERS = PROVIDERS.filter((provider) => provider.type !== 'mock');

export default function AIProviderSettings() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState<'mock' | 'openai' | 'claude'>('mock');
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'claude'>('openai');
  const [model, setModel] = useState('gpt-4o');
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
    const nextProvider = creds.activeProvider || statusMap.activeProvider || 'mock';
    const configurableProvider = nextProvider === 'claude' ? 'claude' : 'openai';
    const credential = (creds.credentials || []).find((item) => item.provider === configurableProvider);
    const nextMeta = CONFIGURABLE_PROVIDERS.find((provider) => provider.type === configurableProvider) || CONFIGURABLE_PROVIDERS[0];
    setSelectedProvider(configurableProvider);
    setModel(credential?.model || nextMeta.defaultModel);
    setApiKey('');
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [status, credentialData] = await Promise.all([
          aiProviderApi.status(token as string),
          aiProviderApi.credentials(token as string),
        ]);
        if (cancelled) return;

        const statusMap = status as { providers: ProviderStatus[]; activeProvider: 'mock' | 'openai' | 'claude' };
        const creds = credentialData as { credentials: CredentialStatus[]; activeProvider: 'mock' | 'openai' | 'claude' };
        const nextProvider = creds.activeProvider || statusMap.activeProvider || 'mock';
        const configurableProvider = nextProvider === 'claude' ? 'claude' : 'openai';
        const credential = (creds.credentials || []).find((item) => item.provider === configurableProvider);
        const nextMeta = CONFIGURABLE_PROVIDERS.find((provider) => provider.type === configurableProvider) || CONFIGURABLE_PROVIDERS[0];

        setProviders(statusMap.providers || []);
        setCredentials(creds.credentials || []);
        setActiveProvider(nextProvider);
        setSelectedProvider(configurableProvider);
        setModel(credential?.model || nextMeta.defaultModel);
        setApiKey('');
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load provider settings');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedMeta = useMemo(
    () => PROVIDERS.find((provider) => provider.type === selectedProvider) || PROVIDERS[0],
    [selectedProvider],
  );

  async function saveCredential() {
    if (!token) return;
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

  async function saveTestAndUseProvider() {
    if (!token) return;
    setLoading('activate');
    setMessage('');
    try {
      await aiProviderApi.saveCredential({ provider: selectedProvider, model, apiKey }, token);
      const result = await aiProviderApi.test(selectedProvider, token) as { _label?: string; status?: string };
      await aiProviderApi.select(selectedProvider, token);
      setMessage(`${selectedMeta.name} saved, tested, and activated. ${result._label || 'Backend connection succeeded.'}`);
      setApiKey('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Provider activation failed');
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
    <ProductPage
      eyebrow="My workspace"
      title="AI Provider Settings"
      subtitle="Choose your LLM provider, store your own API key securely, and keep model execution isolated to your account. Model calls use the backend provider adapter only."
      action={<ProductStatus tone="good">Backend-only model calls</ProductStatus>}
    >

      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('missing') ? 'warn' : 'good'}>{message}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <ProductCard title="Provider Setup" subtitle="Keys are user-owned and raw values are never returned by the backend.">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Provider</span>
              <select
                value={selectedProvider}
                onChange={(event) => {
                  const provider = event.target.value as 'openai' | 'claude';
                  const credential = credentials.find((item) => item.provider === provider);
                  const nextMeta = CONFIGURABLE_PROVIDERS.find((item) => item.type === provider) || CONFIGURABLE_PROVIDERS[0];
                  setSelectedProvider(provider);
                  setModel(credential?.model || nextMeta.defaultModel);
                  setApiKey('');
                }}
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                {CONFIGURABLE_PROVIDERS.map((provider) => (
                  <option key={provider.type} value={provider.type}>{provider.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Model</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{selectedMeta.keyLabel}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste key once. It will be encrypted and never shown again."
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              />
            </label>

            <div className="grid gap-3">
              <button
                onClick={saveTestAndUseProvider}
                disabled={!apiKey || loading === 'activate'}
                className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {loading === 'activate' ? 'Saving and testing...' : `Save, Test & Use ${selectedMeta.name}`}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={selectProvider}
                disabled={loading === 'select'}
                className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {loading === 'select' ? 'Selecting...' : 'Use Provider'}
              </button>
              <button
                onClick={saveCredential}
                disabled={!apiKey || loading === 'save'}
                className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50"
              >
                {loading === 'save' ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        </ProductCard>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const status = providers.find((item) => item.type === provider.type);
              const credential = credentials.find((item) => item.provider === provider.type);
              const active = activeProvider === provider.type;
              return (
                <ProductCard key={provider.type} className={active ? 'border-blue-300 ring-1 ring-blue-200' : ''}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-950">{provider.name}</h3>
                        <p className="mt-1 text-xs text-neutral-500">{status?.scope === 'user' ? 'User credential' : provider.type === 'mock' ? 'Development/test only' : 'Environment or missing'}</p>
                      </div>
                      <ProductStatus tone={active ? 'good' : status?.configured ? 'info' : 'warn'}>{active ? 'Active' : status?.configured ? 'Configured' : 'Missing'}</ProductStatus>
                    </div>

                    <div className="space-y-2 text-sm">
                      <Line label="Model" value={credential?.model || status?.model || provider.defaultModel} />
                      <Line label="API key" value={provider.type === 'mock' ? 'Disabled for production' : credential ? `configured (${credential.keyFingerprint})` : status?.apiKeyStatus || 'missing'} />
                      <Line label="Scope" value={provider.type === 'mock' ? 'not selectable' : credential ? 'user isolated' : status?.scope || 'none'} />
                    </div>

                    {provider.type !== 'mock' && (
                      <button
                        onClick={() => testProvider(provider.type)}
                        disabled={!credential || loading === `test-${provider.type}`}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {loading === `test-${provider.type}` ? 'Testing...' : 'Test Backend Connection'}
                      </button>
                    )}
                  </div>
                </ProductCard>
              );
            })}
          </div>

          <Notice tone="info">
            Keys are encrypted with the deployment master key and scoped to the authenticated user. The frontend receives only status and fingerprint.
          </Notice>

          <ProductCard title="Activation Checklist" subtitle="A provider is accepted only after the backend can call it successfully.">
            <ol className="space-y-3 text-sm leading-6 text-neutral-700">
              <li><strong>1. Save key:</strong> the raw key is sent once to the backend and encrypted at rest.</li>
              <li><strong>2. Test backend connection:</strong> Tanaghum calls the provider adapter from the backend, never from the browser.</li>
              <li><strong>3. Use provider:</strong> the selected provider is stored on your AgentRep metadata for your user only.</li>
              <li><strong>4. Generate drafts:</strong> return to Command Center and run the campaign draft path.</li>
            </ol>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-right font-mono text-xs text-neutral-700">{value}</span>
    </div>
  );
}
